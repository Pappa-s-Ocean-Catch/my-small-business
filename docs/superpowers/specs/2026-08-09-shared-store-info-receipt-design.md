# Shared StoreInfo Receipt Design

## Goal

Use a database-backed StoreInfo record to keep business details consistent on every POS register and make customer receipts more readable and legally complete.

## Data Model

Extend the existing singleton `brand_settings` record with shared StoreInfo fields:

- shop display name
- legal company name
- ABN
- address line 1 and address line 2
- phone
- website
- logo URL
- opening-hours text

Seed the legal fields as `T.K.O CHIPPERY PTY LTD` and `20 689 326 547`. Current receipt shop name, address, phone, and website remain safe fallbacks for unconfigured or temporarily unavailable data.

## Access and Synchronization

The app reads StoreInfo from Supabase and caches it in a query/store layer. The POS settings editor writes to the same singleton row. A realtime invalidation/subscription refreshes open registers after a change, while each receipt still has a local fallback so printing remains available during a network outage.

## Settings Editor

Add a StoreInfo entry to POS Settings. It edits all StoreInfo fields in one shared form. `logo_url` remains a URL field and does not add new file-upload or storage behavior. Validation requires a non-empty shop name; legal name, ABN, contact, website, logo, and hours may remain blank.

## Receipt Design

The customer receipt will use StoreInfo instead of build-time environment values. It will enlarge the core typography (store name, order number, item rows, totals, and payment state), increase line spacing and visual separation, and keep the width appropriate for 58 mm and 80 mm printers. Shop name, address, phone, website, and logo are the receipt header; legal company name and ABN sit in a compact, readable footer. Opening hours are not printed in this change.

## Scope Boundaries

- Existing device-local printing controls remain device-specific.
- Kitchen-ticket templates are unchanged.
- This updates shared business identity for customer receipts and exposes the same data for future in-app use.
- All work stays uncommitted on `main` at the user's request.

## Acceptance Criteria

- Updating StoreInfo on one POS register changes the customer receipt details on other online registers.
- The receipt displays shop name, address, phone, legal company name, and ABN with larger readable text.
- The system prints safely with existing default contact details if StoreInfo cannot be loaded.
- No commit is created.
