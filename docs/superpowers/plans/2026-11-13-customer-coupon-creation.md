# Customer coupon creation implementation plan

**Goal:** Admins can issue a customer coupon from Coupons or the customer profile on the tablet.

**Architecture:** Reuse one EditorSheet with a customer selector on Coupons and a preselected customer on the profile. Insert using the authenticated Supabase client, preserving existing admin-only database RLS. Check current admin status before submitting. Existing percent/fixed redemption calculations remain in use.

**Defaults:** Positive discount, percent at most 100; fixed amounts have at most two decimal places. Customer required; no general coupons. One redemption total, one per customer, active immediately, no expiry, no minimum subtotal. Code and title required; suggest a fresh code. Resolve phone-only customers to a profile before issuance.

- [x] Add failing tests for issuance, invalid discounts/targets, rejected staff/anonymous sessions, duplicate code and database errors.
- [x] Implement validated customer coupon creation through authenticated Supabase; no service-role credentials.
- [x] Add shared modal with customer search, type selection, value/code/title, error and pending states.
- [x] Add admin-only entry points on Coupons and CustomerModal; refresh data after creation.
- [x] Verify focused tests, tablet unit suite, TypeScript and diff. Verify admin-only insert RLS with SQL if local database is available.

## Verification

- Tablet unit suite: 502 passed, 0 failed, including creation and auth-refresh regression tests.
- Frozen offline lockfile validation passed; tests reuse the workspace testing-library/react and jsdom versions.
- Full TypeScript check is blocked by existing minimatch type discovery; explicit node/react types report only existing ReceiptQrCode and caller-ID errors, none in changed feature files.
- Added `supabase/tests/customer_coupon_creation.sql` to exercise admin/staff/customer/anonymous inserts. Not executed: local Docker daemon is unavailable. No database migration is needed; existing coupons_admin_all RLS protects inserts.
- Native simulator verification unavailable: CoreSimulator connection failed in this environment.
- Reviewed permission refresh, stale async responses, duplicate submissions, targeted customer identity, and nested editor placement.
