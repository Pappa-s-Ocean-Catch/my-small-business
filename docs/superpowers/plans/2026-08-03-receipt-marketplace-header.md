# Receipt Marketplace Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Uber Eats or DoorDash branding and a prominent delivery/channel label at the top of every kitchen receipt.

**Architecture:** A pure helper in `utils/orderUtils.ts` maps an order to its receipt-header label and optional local logo asset. `ReceiptTemplate` renders that data above its existing date/payment header so every combined or section-split ticket uses the same presentation.

**Tech Stack:** TypeScript, React Native, Expo asset modules, Node built-in test runner.

## Global Constraints

- Use `assets/ubereats-logo.png` and `assets/doordash-logo.png`; do not add dependencies.
- Marketplace Uber Eats and DoorDash orders must show `DELIVERY` beneath the matching logo.
- Direct orders must show `INSTORE`, `PHONE PICKUP`, or `PHONE DELIVERY` as a large bold label.
- Retain the existing date/payment header below the new receipt header.
- Do not commit changes.

---

### Task 1: Define and test receipt-header mapping

**Files:**
- Modify: `apps/pappas-order-management/utils/orderUtils.ts`
- Modify: `apps/pappas-order-management/test/order-utils.test.ts`

**Interfaces:**
- Produces: `getReceiptHeader(order: Order): { label: string; logo: 'uber_eats' | 'doordash' | null }`
- Consumed by: `ReceiptTemplate`

- [ ] **Step 1: Write the failing tests**

```ts
test('maps supported marketplace partners to a branded delivery receipt header', () => {
  assert.deepEqual(getReceiptHeader(makeOrder({
    order_channel: 'third_party', delivery_partner_name: 'Uber Eats', order_type: 'pickup',
  })), { label: 'DELIVERY', logo: 'uber_eats' });
  assert.deepEqual(getReceiptHeader(makeOrder({
    order_channel: 'third_party', delivery_partner_name: 'DoorDash', order_type: 'pickup',
  })), { label: 'DELIVERY', logo: 'doordash' });
});

test('maps direct order channels to receipt labels without a logo', () => {
  assert.deepEqual(getReceiptHeader(makeOrder({ order_channel: 'instore' })), { label: 'INSTORE', logo: null });
  assert.deepEqual(getReceiptHeader(makeOrder({ order_channel: 'phone_pickup' })), { label: 'PHONE PICKUP', logo: null });
  assert.deepEqual(getReceiptHeader(makeOrder({ order_channel: 'phone_delivery' })), { label: 'PHONE DELIVERY', logo: null });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: TypeScript fails because `getReceiptHeader` is not exported.

- [ ] **Step 3: Implement the minimal mapping**

```ts
export type ReceiptHeader = { label: string; logo: 'uber_eats' | 'doordash' | null };

export const getReceiptHeader = (order: Order): ReceiptHeader => {
  const partner = order.delivery_partner_name?.trim().toLowerCase();
  if (getOrderChannel(order) === 'third_party' && partner === 'uber eats') return { label: 'DELIVERY', logo: 'uber_eats' };
  if (getOrderChannel(order) === 'third_party' && partner === 'doordash') return { label: 'DELIVERY', logo: 'doordash' };
  return { label: getOrderChannelReceiptLabel(order), logo: null };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

### Task 2: Render the receipt header

**Files:**
- Modify: `apps/pappas-order-management/components/ReceiptTemplate.tsx`

**Interfaces:**
- Consumes: `getReceiptHeader(order)`.
- Produces: a matching logo (when applicable) and large bold label above existing receipt metadata.

- [ ] **Step 1: Update `ReceiptTemplate`**

```tsx
const receiptHeader = getReceiptHeader(order);
const logoSource = receiptHeader.logo === 'uber_eats'
  ? require('../assets/ubereats-logo.png')
  : receiptHeader.logo === 'doordash'
    ? require('../assets/doordash-logo.png')
    : null;

<View style={styles.receiptHeader}>
  {logoSource && <Image source={logoSource} style={styles.marketplaceLogo} resizeMode="contain" />}
  <Text style={styles.receiptHeaderLabel}>{receiptHeader.label}</Text>
</View>
```

Place this block after the pre-order banner and before the date/payment lines; retain the existing lines unchanged.

- [ ] **Step 2: Add styles**

```ts
receiptHeader: { alignItems: 'center', marginBottom: 8 },
marketplaceLogo: { width: 220, height: 72, marginBottom: 4 },
receiptHeaderLabel: { fontSize: 30, fontWeight: 'bold', textAlign: 'center' },
```

- [ ] **Step 3: Run tests to verify compilation and behavior**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.

### Task 3: Strengthen receipt visual hierarchy

**Files:**
- Modify: `apps/pappas-order-management/components/ReceiptTemplate.tsx`

**Interfaces:**
- Produces: a 48px bold header label with visual space below the marketplace logo and a high-contrast customer-details panel.

- [ ] **Step 1: Update receipt styles and customer text references**

Use a 16px logo bottom margin and a 48px bold receipt-header label. Apply a black, padded customer panel and use dedicated white text styles for the name, phone, and delivery details so shared receipt text styles are not changed.

- [ ] **Step 2: Run the unit suite**

Run: `pnpm --filter pappas-order-management test:unit`

Expected: PASS.
