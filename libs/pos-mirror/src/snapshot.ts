export type MirrorOrderLine = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type MirrorCartInput = {
  items: MirrorOrderLine[];
  subtotal: number;
  discount: number;
  total: number;
};

export type MirrorOrderSnapshotV1 = {
  version: 1;
  updatedAt: string;
  itemCount: number;
  items: MirrorOrderLine[];
  subtotal: number;
  discount: number;
  total: number;
};

export type EmptyMirrorOrder = Record<string, never>;

function assertNonEmptyString(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return normalized;
}

function assertQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError('quantity must be an integer greater than zero');
  }
  return value;
}

function normalizeCurrency(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number`);
  }

  const [coefficient, exponent = '0'] = value.toString().split('e');
  const shifted = Number(`${coefficient}e${Number(exponent) + 2}`);
  const cents = Math.round(shifted);
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`${field} must be within the supported currency range`);
  }

  return cents / 100;
}

function normalizeLine(line: MirrorOrderLine): MirrorOrderLine {
  return {
    id: assertNonEmptyString(line.id, 'id'),
    name: assertNonEmptyString(line.name, 'name'),
    quantity: assertQuantity(line.quantity),
    unitPrice: normalizeCurrency(line.unitPrice, 'unitPrice'),
    lineTotal: normalizeCurrency(line.lineTotal, 'lineTotal'),
  };
}

export function buildMirrorOrderSnapshot(
  input: MirrorCartInput,
  now: () => Date = () => new Date(),
): MirrorOrderSnapshotV1 | EmptyMirrorOrder {
  if (input.items.length === 0) {
    return {};
  }

  const items = input.items.map(normalizeLine);
  const updatedAt = now().toISOString();

  return {
    version: 1,
    updatedAt,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    items,
    subtotal: normalizeCurrency(input.subtotal, 'subtotal'),
    discount: normalizeCurrency(input.discount, 'discount'),
    total: normalizeCurrency(input.total, 'total'),
  };
}

export function isEmptyMirrorOrder(value: unknown): value is EmptyMirrorOrder {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value as object).length === 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseCurrency(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  try {
    return normalizeCurrency(value, 'currency');
  } catch {
    return null;
  }
}

function parseLine(value: unknown): MirrorOrderLine | null {
  if (!isRecord(value)
    || typeof value.id !== 'string'
    || !value.id.trim()
    || typeof value.name !== 'string'
    || !value.name.trim()
    || !Number.isInteger(value.quantity)
    || (value.quantity as number) <= 0) {
    return null;
  }

  const unitPrice = parseCurrency(value.unitPrice);
  const lineTotal = parseCurrency(value.lineTotal);
  if (unitPrice === null || lineTotal === null) {
    return null;
  }

  return {
    id: value.id.trim(),
    name: value.name.trim(),
    quantity: value.quantity as number,
    unitPrice,
    lineTotal,
  };
}

export function parseMirrorOrderSnapshot(value: unknown): MirrorOrderSnapshotV1 | null {
  if (!isRecord(value)
    || value.version !== 1
    || typeof value.updatedAt !== 'string'
    || !Number.isFinite(Date.parse(value.updatedAt))
    || !Number.isInteger(value.itemCount)
    || (value.itemCount as number) <= 0
    || !Array.isArray(value.items)
    || value.items.length === 0) {
    return null;
  }

  const subtotal = parseCurrency(value.subtotal);
  const discount = parseCurrency(value.discount);
  const total = parseCurrency(value.total);
  if (subtotal === null || discount === null || total === null) {
    return null;
  }

  const items = value.items.map(parseLine);
  if (items.some((item) => item === null)) {
    return null;
  }

  const parsedItems = items as MirrorOrderLine[];
  if (parsedItems.reduce((sum, item) => sum + item.quantity, 0) !== value.itemCount) {
    return null;
  }

  return {
    version: 1,
    updatedAt: value.updatedAt,
    itemCount: value.itemCount as number,
    items: parsedItems,
    subtotal,
    discount,
    total,
  };
}
