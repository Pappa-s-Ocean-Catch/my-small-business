# Coupon email implementation plan

**Goal:** Optional email on tablet coupon creation, plus admin-only resend of the same eligible coupon from Coupons and customer profiles.

**Architecture:** POST /api/coupons/send-email accepts only couponId. Authenticate the bearer token and require admin before looking up coupon and saved target profile/email. Reject inactive, scheduled, expired and exhausted coupons, missing recipients and general coupons. Render a dedicated CouponEmail inside the existing EmailLayout with database brand name/logo. Creation remains saved if email fails; report delivery separately so retry cannot issue another coupon.

**Defaults:** Send checkbox unchecked; available for profile targets (server resolves their current email), or customers with an email target. Use profile email as source of truth for profile-targeted coupons. No arbitrary recipient or client-supplied coupon content. Manual resend uses the same API and code, with pending and success/error feedback. Do not send live customer emails during verification.

- [x] Add API behavior tests for auth, eligibility, target lookup, resend, provider failure and malformed requests; observe failures.
- [x] Implement testable API handler, branded template and route.
- [x] Add tablet email client, optional creation send result, checkbox and reusable resend button.
- [x] Verify API tests, template rendering, tablet suite, typechecks and review.

## Verification

- Tablet test suite: 507 passed, 0 failed.
- API test suite (library, action and rendered email tests): 87 passed, 0 failed.
- API TypeScript check: passed.
- Tablet TypeScript check: still reports existing ReceiptQrCode and caller-ID errors, none in coupon feature files.
- Percentage and fixed HTML previews: `artifacts/coupon-email/percent.html` and `fixed.html`; render tests cover branding, escaping, terms and Melbourne expiry.
- Reviewed and corrected same-recipient usage checks for email-only targets and current-profile email wording/availability.
- Browser visual preview was unavailable because local file navigation was blocked by browser policy; no screenshot verification claimed.
- No live email deliveries, database migrations or deployment performed. Sending uses existing RESEND_API_KEY, EMAIL_FROM, brand settings and optional OVERRIDE_EMAIL_ADDRESS configuration.
