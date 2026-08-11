type OrderWebhookRecord = {
  id: string;
  order_number: string;
  order_channel: string;
  total: number | string;
};

type PushJob = {
  id: string;
  order_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  status: string;
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_SECRET = Deno.env.get('ORDER_PUSH_WEBHOOK_SECRET');
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
const MAX_ATTEMPTS = 5;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toWebhookOrder(value: unknown): OrderWebhookRecord | null {
  if (!isRecord(value) || !isUuid(value.id) || typeof value.order_number !== 'string'
    || typeof value.order_channel !== 'string'
    || (typeof value.total !== 'number' && typeof value.total !== 'string')) {
    return null;
  }

  return value as OrderWebhookRecord;
}

function notificationPayload(order: OrderWebhookRecord): Record<string, unknown> {
  const total = Number(order.total);
  return {
    eventType: 'new_order',
    orderId: order.id,
    orderNumber: order.order_number,
    orderChannel: order.order_channel,
    total: Number.isFinite(total) ? total : 0,
  };
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]/g, ' ').slice(0, 500);
}

function retryAt(attemptCount: number): string {
  const delayMinutes = Math.min(2 ** Math.max(attemptCount - 1, 0), 30);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase server credentials are not configured');

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function createOrLoadJob(order: OrderWebhookRecord): Promise<PushJob> {
  const payload = notificationPayload(order);
  const created = await supabaseRequest('push_notification_jobs?on_conflict=order_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ order_id: order.id, event_type: 'new_order', payload }),
  });
  const rows = await readJson<PushJob[]>(created);
  if (rows[0]) return rows[0];

  const existing = await supabaseRequest(`push_notification_jobs?order_id=eq.${encodeURIComponent(order.id)}&select=id,order_id,payload,attempt_count,status`);
  const existingRows = await readJson<PushJob[]>(existing);
  if (!existingRows[0]) throw new Error('Notification job was not available after insert');
  return existingRows[0];
}

async function updateJob(jobId: string, update: Record<string, unknown>): Promise<void> {
  const response = await supabaseRequest(`push_notification_jobs?id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...update, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
}

async function getDueJobs(): Promise<PushJob[]> {
  const timestamp = encodeURIComponent(new Date().toISOString());
  const response = await supabaseRequest(
    `push_notification_jobs?select=id,order_id,payload,attempt_count,status&status=in.(pending,failed)&attempt_count=lt.${MAX_ATTEMPTS}&next_attempt_at=lte.${timestamp}&order=created_at.asc&limit=25`,
  );
  return readJson<PushJob[]>(response);
}

async function getTokens(): Promise<string[]> {
  const response = await supabaseRequest('order_management_push_devices?select=expo_push_token');
  const rows = await readJson<Array<{ expo_push_token: string }>>(response);
  return rows.map((row) => row.expo_push_token).filter(Boolean);
}

async function removeToken(token: string): Promise<void> {
  const response = await supabaseRequest(`order_management_push_devices?expo_push_token=eq.${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
}

async function submitExpoPushMessages(tokens: string[], payload: Record<string, unknown>): Promise<unknown[]> {
  if (tokens.length === 0) return [];

  const body = tokens.map((to) => ({
    to,
    title: `New order #${String(payload.orderNumber)}`,
    body: `${String(payload.orderChannel)} • $${Number(payload.total).toFixed(2)}`,
    sound: 'default',
    channelId: 'new-orders',
    priority: 'high',
    data: payload,
  }));
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Expo Push API request failed (${response.status})`);

  const responseBody = await response.json() as { data?: unknown[] };
  return Array.isArray(responseBody.data) ? responseBody.data : [];
}

async function deliverJob(job: PushJob): Promise<void> {
  if (job.status === 'sent') return;

  const attemptCount = job.attempt_count + 1;
  try {
    await updateJob(job.id, { status: 'sending', attempt_count: attemptCount });
    const tokens = await getTokens();
    const tickets = await submitExpoPushMessages(tokens, job.payload);

    await Promise.all(tickets.map(async (ticket, index) => {
      if (isRecord(ticket) && ticket.status === 'error'
        && isRecord(ticket.details) && ticket.details.error === 'DeviceNotRegistered'
        && tokens[index]) {
        await removeToken(tokens[index]);
      }
    }));

    await updateJob(job.id, { status: 'sent', sent_at: new Date().toISOString(), last_error: null });
  } catch (error) {
    await updateJob(job.id, {
      status: 'failed',
      last_error: safeError(error),
      next_attempt_at: retryAt(attemptCount),
    }).catch((updateError) => console.error('[push] unable to record notification failure', safeError(updateError)));
    console.error('[push] delivery skipped', safeError(error));
  }
}

Deno.serve(async (request) => {
  if (!WEBHOOK_SECRET || request.headers.get('x-order-push-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const body = await request.json();
    if (isRecord(body) && body.retry === true) {
      const jobs = await getDueJobs();
      await Promise.all(jobs.map(deliverJob));
      return json({ processed: jobs.length });
    }

    const order = isRecord(body) ? toWebhookOrder(body.record) : null;
    if (!order) return json({ error: 'invalid order webhook payload' }, 400);

    const job = await createOrLoadJob(order);
    await deliverJob(job);
    return json({ accepted: true }, 202);
  } catch (error) {
    console.error('[push] webhook handling failed', safeError(error));
    return json({ accepted: false }, 202);
  }
});
