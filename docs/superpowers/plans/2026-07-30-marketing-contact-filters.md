# Marketing Contact Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let POS operators show only customers with email, phone, or both contact methods before selecting campaign recipients.

**Architecture:** Add a pure contact-filter predicate in a small POS library module, then apply it in the Marketing screen before row sorting and pagination. The selected-recipient map remains independent of the active filter, while the existing server endpoint stays responsible for final eligibility validation.

**Tech Stack:** React Native, TypeScript, React Native Paper, Node.js built-in test runner.

## Global Constraints

- Email checked means a non-empty email; Phone checked means a non-empty phone.
- Both checked means both contact methods; neither checked means all customers.
- Changing filters must not remove already-selected recipients.
- Apply filters before sorting, counts, pagination, and **Select all visible**.
- Do not change server-side opt-out, duplicate, or missing-contact safeguards.

---

### Task 1: Add and verify the contact-filter predicate

**Files:**
- Create: `apps/pappas-order-management/test/marketing-contact-filter.test.ts`
- Create: `apps/pappas-order-management/lib/marketing-contact-filter.ts`
- Modify: `apps/pappas-order-management/tsconfig.test.json`

**Interfaces:**
- Produces: `matchesContactFilter(customer, filters): boolean`, where `filters` is `{ email: boolean; phone: boolean }`.
- Consumes: an object with optional `email` and `phone` strings.

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesContactFilter } from '../lib/marketing-contact-filter';

const emailOnly = { email: 'email@example.com', phone: '' };
const phoneOnly = { email: '', phone: '0400000000' };
const both = { email: 'both@example.com', phone: '0400000001' };
const neither = { email: '', phone: '' };

test('filters contacts using the selected email and phone requirements', () => {
  assert.equal(matchesContactFilter(emailOnly, { email: false, phone: false }), true);
  assert.equal(matchesContactFilter(neither, { email: false, phone: false }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: true, phone: false }), true);
  assert.equal(matchesContactFilter(phoneOnly, { email: true, phone: false }), false);
  assert.equal(matchesContactFilter(phoneOnly, { email: false, phone: true }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: false, phone: true }), false);
  assert.equal(matchesContactFilter(both, { email: true, phone: true }), true);
  assert.equal(matchesContactFilter(emailOnly, { email: true, phone: true }), false);
  assert.equal(matchesContactFilter(phoneOnly, { email: true, phone: true }), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "filters contacts"`

Expected: the test fails because `matchesContactFilter` is not exported.

- [ ] **Step 3: Write the minimal predicate**

```ts
export type ContactFilters = { email: boolean; phone: boolean };

export function matchesContactFilter(
  customer: { email?: string | null; phone?: string | null },
  filters: ContactFilters
) {
  if (filters.email && !customer.email?.trim()) return false;
  if (filters.phone && !customer.phone?.trim()) return false;
  return true;
}
```

- [ ] **Step 4: Include the pure module in the POS test compiler input**

Add this entry to the `include` array in `apps/pappas-order-management/tsconfig.test.json`:

```json
"lib/marketing-contact-filter.ts"
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter pappas-order-management test:unit -- --test-name-pattern "filters contacts"`

Expected: one passing test with all four filter states covered.

- [ ] **Step 6: Commit the predicate and test**

```bash
git add apps/pappas-order-management/lib/marketing-contact-filter.ts apps/pappas-order-management/test/marketing-contact-filter.test.ts apps/pappas-order-management/tsconfig.test.json
git commit -m "test: cover marketing contact filters"
```

### Task 2: Add the filter controls and apply them to available recipients

**Files:**
- Modify: `apps/pappas-order-management/app/(drawer)/marketing.tsx:145-550`
- Test: `apps/pappas-order-management/test/marketing-contact-filter.test.ts`

**Interfaces:**
- Consumes: `matchesContactFilter(customer, filters)` and `ContactFilters` from `@/lib/marketing-contact-filter`.
- Produces: filter-aware available rows, counts, pagination, and visible bulk selection.

- [ ] **Step 1: Add filter state and filter rows before sorting**

```ts
const [contactFilters, setContactFilters] = useState({ email: false, phone: false });

// Add: import { matchesContactFilter } from '@/lib/marketing-contact-filter';

const filteredCustomerRows = useMemo(
  () => customerListRows.filter(({ customer }) => matchesContactFilter(customer, contactFilters)),
  [customerListRows, contactFilters]
);

const sortedCustomerRows = useMemo(
  () => sortCustomerRows(filteredCustomerRows, sortOption, sortDirection),
  [filteredCustomerRows, sortOption, sortDirection]
);
```

- [ ] **Step 2: Add two independent checkbox controls above the recipient list**

```tsx
<View style={styles.contactFilterRow}>
  <Text style={styles.contactFilterLabel}>Show customers with</Text>
  <Checkbox.Item
    label="Email"
    status={contactFilters.email ? 'checked' : 'unchecked'}
    onPress={() => setContactFilters((current) => ({ ...current, email: !current.email }))}
    style={styles.contactFilterItem}
  />
  <Checkbox.Item
    label="Phone"
    status={contactFilters.phone ? 'checked' : 'unchecked'}
    onPress={() => setContactFilters((current) => ({ ...current, phone: !current.phone }))}
    style={styles.contactFilterItem}
  />
</View>
```

- [ ] **Step 3: Add compact styles for the filter row**

```ts
contactFilterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
contactFilterLabel: { color: '#334155', fontWeight: '600' },
contactFilterItem: { width: 118, paddingVertical: 0 },
```

- [ ] **Step 4: Verify selection behavior manually**

Run the POS app and verify:

1. With no filters, all contact combinations remain visible.
2. Email and Phone each include customers who also have the other contact method.
3. Both selected includes only customers with both values.
4. The available count, page controls, and **Select all visible** use the filtered rows.
5. Changing a filter leaves recipients already in the Selected column unchanged.

- [ ] **Step 5: Run unit tests and TypeScript check**

Run: `pnpm --filter pappas-order-management test:unit && pnpm --filter pappas-order-management exec tsc --noEmit`

Expected: all unit tests and TypeScript validation pass.

- [ ] **Step 6: Commit the POS filter UI**

```bash
git add apps/pappas-order-management/app/(drawer)/marketing.tsx
git commit -m "feat: filter marketing recipients by contact method"
```
