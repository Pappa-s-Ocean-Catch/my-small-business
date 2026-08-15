# Atomic Customer Profile Linking Design

## Goal

Allow a phone-OTP customer to claim one matching legacy customer profile, including its orders and reward data, without violating the unique `profiles.email` constraint or leaving a partial merge.

## Current failure

Phone OTP creates an Auth user and a new profile without an email. During profile completion, `mergeExistingCustomerProfileIntoAuthUser` locates a legacy customer profile by supplied email or phone, moves related records, then updates the new profile with the email before deleting the legacy profile. When the legacy profile owns that email, `profiles_email_key` rejects the update.

The separate service-role requests also allow prior order and rewards changes to persist when the profile update fails.

## Design

Create a `public.merge_customer_profile_into_auth_user` PostgreSQL function and call it from the existing server action.

The function accepts the destination Auth user ID, normalized optional email, normalized optional phone, and optional full name. In one transaction it:

1. Locks the destination profile and confirms it exists.
2. Locates candidate legacy profiles with the customer role by email and/or phone, excluding the destination profile.
3. Allows no match, or exactly one candidate. It raises a domain-specific conflict when email and phone select different profiles or multiple legacy profiles match.
4. Rejects an email owned by a non-customer profile.
5. When a legacy candidate exists, reassigns orders and reward transactions, combines reward balances, removes the legacy reward balance, deletes the legacy profile, and then updates the destination profile with the resolved contact data and `customer` role.
6. When no legacy candidate exists, updates only the destination profile.

Deleting the legacy profile before assigning its email makes the unique email transfer valid. The function's transaction guarantees that a failed validation or update rolls back every preceding change.

## Error behavior

The server action returns the database error message as a failed merge. The existing phone-profile completion caller keeps presenting that error and does not continue to update Auth metadata after a failed merge.

## Scope boundaries

- Only legacy `customer` profiles are eligible for automatic merging.
- An email owned by `admin` or `staff` remains unavailable and is never merged.
- No changes to profile-page editing, password signup, or the `profiles.email` unique constraint.

## Verification

Add a migration-level regression test or SQL test fixture that proves a phone-created profile can merge a legacy customer profile holding the supplied email, with its order and reward references moved and only the destination profile retaining the email. Add tests for the non-customer email conflict and ambiguous email/phone matches. Run the focused test command, TypeScript checking for the web app, and migration SQL validation available in the repository.
