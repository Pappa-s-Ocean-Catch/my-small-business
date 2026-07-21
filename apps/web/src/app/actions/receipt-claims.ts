'use server';

import { createServiceRoleClient, createServerSupabaseClient } from '@my-small-business/supabase/server';
import { earnRewardPoints, getRewardPointsSettings } from '@/app/actions/reward-points';

type ClaimLookupResult = {
  success: boolean;
  error?: string;
  requiresAuth?: boolean;
  order?: {
    id: string;
    orderNumber: string;
    createdAt: string;
    total: number;
    subtotal: number;
    paymentStatus: string;
    orderStatus: string;
    customerName: string | null;
    rewardPointsEstimate: number;
    alreadyClaimed: boolean;
    claimedByCurrentUser: boolean;
  };
};

function normalizeClaimToken(token: string): string | null {
  const normalized = token.trim();
  if (!normalized) return null;
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(normalized)) return null;
  return normalized;
}

async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function fetchClaimableOrder(token: string) {
  const supabase = await createServiceRoleClient();
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      created_at,
      subtotal,
      total,
      payment_status,
      order_status,
      order_channel,
      user_id,
      customer_name,
      customer_email,
      customer_phone,
      receipt_claim_token,
      receipt_claimed_at,
      receipt_claimed_by_user_id
    `)
    .eq('receipt_claim_token', token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getReceiptClaimDetails(token: string): Promise<ClaimLookupResult> {
  try {
    const normalizedToken = normalizeClaimToken(token);
    if (!normalizedToken) {
      return { success: false, error: 'This receipt link is invalid.' };
    }

    const [order, user, settings] = await Promise.all([
      fetchClaimableOrder(normalizedToken),
      getCurrentUser(),
      getRewardPointsSettings(),
    ]);

    if (!order || order.order_channel !== 'instore') {
      return { success: false, error: 'This receipt claim link is not available.' };
    }

    const rewardPointsEstimate = settings.enabled
      ? Math.floor(Number(order.subtotal || 0) * settings.points_per_dollar)
      : 0;

    return {
      success: true,
      requiresAuth: !user,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        createdAt: order.created_at,
        total: Number(order.total || 0),
        subtotal: Number(order.subtotal || 0),
        paymentStatus: order.payment_status,
        orderStatus: order.order_status,
        customerName: order.customer_name,
        rewardPointsEstimate,
        alreadyClaimed: Boolean(order.receipt_claimed_at || order.receipt_claimed_by_user_id || order.user_id),
        claimedByCurrentUser: Boolean(user && (order.receipt_claimed_by_user_id === user.id || order.user_id === user.id)),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load receipt claim',
    };
  }
}

export async function claimReceiptOrder(token: string): Promise<{
  success: boolean;
  error?: string;
  alreadyClaimed?: boolean;
  pointsEarned?: number;
  rewardWarning?: string;
}> {
  try {
    const normalizedToken = normalizeClaimToken(token);
    if (!normalizedToken) {
      return { success: false, error: 'This receipt link is invalid.' };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Please log in first.' };
    }

    const supabase = await createServiceRoleClient();
    const [{ data: profile, error: profileError }, order] = await Promise.all([
      supabase.from('profiles').select('full_name, email, phone').eq('id', user.id).single(),
      fetchClaimableOrder(normalizedToken),
    ]);

    if (profileError) {
      return { success: false, error: profileError.message };
    }

    if (!order || order.order_channel !== 'instore') {
      return { success: false, error: 'This receipt claim link is not available.' };
    }

    if (order.receipt_claimed_by_user_id && order.receipt_claimed_by_user_id !== user.id) {
      return { success: false, error: 'This receipt has already been claimed by another account.', alreadyClaimed: true };
    }

    if (order.user_id && order.user_id !== user.id) {
      return { success: false, error: 'This order is already linked to another account.', alreadyClaimed: true };
    }

    if (order.receipt_claimed_by_user_id === user.id || order.user_id === user.id) {
      let pointsEarned: number | undefined;
      let rewardWarning: string | undefined;

      if (order.payment_status === 'paid') {
        const rewardResult = await earnRewardPoints(user.id, order.id, Number(order.subtotal || 0));
        if (rewardResult.success) {
          pointsEarned = rewardResult.pointsEarned;
        } else if (rewardResult.error !== 'Reward points are disabled' && rewardResult.error !== 'No points earned for this order amount') {
          rewardWarning = rewardResult.error;
        }
      }

      return { success: true, alreadyClaimed: true, pointsEarned, rewardWarning };
    }

    const updatePayload = {
      user_id: user.id,
      receipt_claimed_at: new Date().toISOString(),
      receipt_claimed_by_user_id: user.id,
      customer_name: order.customer_name?.trim() ? order.customer_name : profile.full_name ?? null,
      customer_email: order.customer_email?.trim() ? order.customer_email : profile.email ?? '',
      customer_phone: order.customer_phone?.trim() ? order.customer_phone : profile.phone ?? '',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)
      .eq('receipt_claim_token', normalizedToken)
      .is('receipt_claimed_at', null)
      .select('id, subtotal, payment_status')
      .maybeSingle();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    if (!updatedOrder) {
      const latestOrder = await fetchClaimableOrder(normalizedToken);
      if (latestOrder?.receipt_claimed_by_user_id === user.id || latestOrder?.user_id === user.id) {
        return { success: true, alreadyClaimed: true };
      }
      return { success: false, error: 'This receipt has already been claimed.', alreadyClaimed: true };
    }

    let pointsEarned: number | undefined;
    let rewardWarning: string | undefined;

    if (updatedOrder.payment_status === 'paid') {
      const rewardResult = await earnRewardPoints(user.id, order.id, Number(updatedOrder.subtotal || 0));
      if (rewardResult.success) {
        pointsEarned = rewardResult.pointsEarned;
      } else if (rewardResult.error !== 'Reward points are disabled' && rewardResult.error !== 'No points earned for this order amount') {
        rewardWarning = rewardResult.error;
      }
    }

    return { success: true, pointsEarned, rewardWarning };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to claim receipt',
    };
  }
}
