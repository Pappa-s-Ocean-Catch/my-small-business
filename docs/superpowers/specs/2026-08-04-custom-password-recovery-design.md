# Custom Password Recovery Design

## Goal

Use Pappas Ocean Catch's Resend-branded email for password recovery, make a freshly clicked recovery link establish a valid Supabase recovery session, and let email magic-link users create their first password without a current-password prompt.

## Current root causes

- `sendPasswordResetEmail` calls `resetPasswordForEmail`, which sends Supabase's standard reset email. Its imported Resend template is unused.
- The reset page calls `getUser()` before handling the recovery credentials from the URL hash, so the user has no session yet and the page rejects a valid recovery link.
- Profile equates Supabase's `app_metadata.provider === 'email'` with a password being present. Magic-link sessions use the same provider value even when they have no password.

## Design

The password-reset server action will normalize and look up the email, use the Supabase Admin API to generate a `recovery` action link with `/reset-password` as its redirect destination, and send that exact action link with Resend and the existing branded password-reset component. It will use the existing email sender and brand settings, and it will not call Supabase's email-sending reset method.

The reset page will read the recovery access and refresh tokens from the URL hash, establish a Supabase session with `setSession`, and only then enable password submission. It will preserve errors from Supabase and show the expired-link state only when session establishment fails or no recovery session exists.

Profile will derive password capability from the authentication methods attached to the user. An email identity with a current `email` provider is treated as a password login only when the user has previously created a password marker; email magic-link users have no marker and see the create-password form. On successful creation, the marker is persisted in user metadata and the page immediately switches to the normal change-password experience.

## Error handling

- Missing Resend configuration, missing sender, missing user, a failed recovery-link generation, or email-delivery failure returns a safe error to the login form.
- Recovery tokens are never logged. Invalid, missing, or expired recovery credentials leave the reset form disabled and explain how to request another link.
- Password mismatch and Supabase password-policy errors remain visible to the user.

## Verification

- Unit-test recovery-link generation and custom email dispatch by injecting/mocking the Supabase Admin and Resend boundaries.
- Unit-test recovery token extraction/session setup and the password-status decision helper.
- Run the focused tests, the web lint command, and the web TypeScript/build check before completion.
