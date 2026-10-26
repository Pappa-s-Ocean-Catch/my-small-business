# Management latest-reference audit — 20 October 2026

Compared the checked-out latest JPG exports with the native source and the final `screen.css` v4/v5 overrides. Filenames containing “modal” are historical: 067–073 are workspace pages in the actual latest images. The reference content, rather than those names, determined the settings correction.

Reference inspection: all 62 IDs below were viewed at landscape size, using contact sheets (plus full-size 031, 056, 067, 078). Nineteen phone representatives were also viewed. No simulator or browser control/capture was performed by this agent. “Source compared” is a code/reference review, not a claim of native pixel parity. Portrait references and post-change native screenshots remain for the parent audit.

Changes in this pass: full-page settings forms and short/wide card sizing; actual Store information backend save in the sole primary footer; footer follows short content and pins only for overflow; staged 041 filter EditorSheet; campaign footer/gutter correction; marketplace status/date EditorSheets; Smartpay field/card hierarchy; resolver empty workspace; shared ActionButton use throughout management ownership. Existing APIs, permissions, finance, pairing, messaging and printer actions remain authoritative.

| ID | Latest reference | Inspected | Native verification | Comparison / change |
|---|---|---|---|---|
| 031 | More · expanded | Landscape | Pending parent | Four More sections; preserve every route, Profile and Sign out. |
| 039 | Create a campaign · empty | Landscape + phone | Pending parent | Campaign form + preview; actions now follow content with 16-unit gutter. |
| 040 | Choose recipients · directory | Landscape | Pending parent | Recipient directory/selection; filters and unsent selection preserved. |
| 041 | Recipient filters & sort · filters-sort-modal | Landscape + phone | Pending parent | Replaced over-wide custom Modal with 620-unit EditorSheet; chip choices stage until Apply filters. |
| 042 | Review campaign · unsent-preview | Landscape | Pending parent | Email/recipient/SMS review and separate send actions preserved; no messages sent in this audit. |
| 043 | Coupons · all | Landscape | Pending parent | Responsive coupon cards and pagination; shared dark-on-white secondary actions. |
| 044 | Coupon details · modal | Landscape + phone | Pending parent | Existing shared EditorSheet and labelled detail rows; staged active switch retains explicit Done. |
| 045 | Coupons · active-filter | Landscape | Pending parent | Same coupon directory with active filter and totals. |
| 046 | Marketplace · uber-active | Landscape + phone | Pending parent | Provider connection cards, mapping entry and active-orders empty state. |
| 047 | Connect Uber Eats · uber-cookies-modal | Landscape | Pending parent | Connection EditorSheet retains credential field and explicit save. |
| 048 | Connect DoorDash · doordash-modal | Landscape | Pending parent | Connection EditorSheet preserves DoorDash business/store/DD key/cookie inputs. |
| 049 | Resolve menu names · unmatched-names | Landscape | Pending parent | Mapping workspace retains unresolved and saved mappings and separate save operations. |
| 050 | Marketplace · history | Landscape | Pending parent | History tab/date/status values preserved; source shape reviewed. |
| 051 | Filter marketplace status · status-menu | Landscape | Pending parent | Replaced anchored Menu with bounded status EditorSheet and staged Apply/Cancel. |
| 052 | Marketplace date range · date-menu | Landscape | Pending parent | Replaced anchored Menu with bounded date-range EditorSheet and staged Apply/Cancel. |
| 053 | Marketplace · scheduled | Landscape | Pending parent | Scheduled tab and configured-versus-unconfigured empty states preserved. |
| 054 | Deliveries · today-load-error | Landscape | Pending parent | Deliveries error/retry distinct from empty list; selected range/search preserved. |
| 055 | Deliveries · last-seven-days-load-error | Landscape | Pending parent | Same deliveries error family with Last 7 days selected. |
| 056 | New delivery · address-form | Landscape + phone | Pending parent | Quote-before-request form; 940-unit tablet panel/stacked phone fields; gutter now16. |
| 066 | Settings · default | Landscape + phone | Pending parent | Four-section Settings hub; 16-unit gutter and 76-unit action rows. |
| 067 | Store information · modal | Landscape + phone | Pending parent | Full-page Store information, 2-column tablet/stacked phone card; footer invokes backend Save store information; duplicate body Save/Done removed. |
| 068 | Refresh interval · modal | Landscape | Pending parent | Full-page 620-unit refresh form with Cancel/Done; existing 5–600 validation retained. |
| 069 | Order sound · modal | Landscape | Pending parent | Full-page 620-unit sound form; selection and Preview sound preserved. |
| 070 | Live order cards · modal | Landscape | Pending parent | Full-page 620-unit live-card form; layout/density/preview controls unchanged. |
| 071 | Marketplace auto-sync · modal | Landscape | Pending parent | Full-page wide auto-sync form; provider cards now wrap into two columns; all presets/custom intervals remain. |
| 072 | Caller ID · modal | Landscape + phone | Pending parent | Full-page Caller ID form; preset diagnostic responses now behind Diagnostics disclosure. Existing notification-display duration semantics preserved. |
| 073 | Print diagnostics · modal | Landscape | Pending parent | Full-page diagnostic form retaining register name and footer toggle. |
| 074 | Kitchen printers · overview | Landscape + phone | Pending parent | Connections page: enable/discovery moved inside connection card; saved-printer panel remains alongside on tablets. |
| 075 | Kitchen printers · edit-saved-printer | Landscape | Pending parent | Same connection/saved-printer layout in edit mode; update/cancel-edit preserved. |
| 076 | Smartpay pairing · pairing | Landscape + phone | Pending parent | Smartpay page rebuilt as 940-unit two-column card with actual pairing state, independent Save configuration and footer Pair terminal/Cancel; existing fields preserved. |
| 077 | Menu products · products | Landscape | Pending parent | Catalogue Products tab/search/group filters and management rows; gutter aligned to latest16. |
| 078 | New product · overview-modal | Landscape + phone | Pending parent | Wide product EditorSheet, two-column overview, shared modal chrome; unsaved draft retained. |
| 079 | New product · seo-tab | Landscape | Pending parent | Same product draft, SEO fields and Save product preserved. |
| 080 | New product · ingredients-tab | Landscape | Pending parent | Same product draft, warning/alert thresholds and inventory ingredients preserved. |
| 081 | Select inventory product · inventory-picker-modal | Landscape | Pending parent | Nested inventory picker retains selection return without saving whole product. |
| 082 | New product · bundle-tab | Landscape | Pending parent | Same product draft/bundle tab, inclusion quantities and picker preserved. |
| 083 | New product · addons-tab | Landscape | Pending parent | Same product draft/add-on groups tab, enabled choices preserved. |
| 084 | Menu categories · categories | Landscape | iPad native checked; see progress.md | Catalogue categories tab/management rows; gutter aligned to latest16. |
| 085 | New category · modal | Landscape | iPad native checked; see progress.md | Category EditorSheet retains name/description/sections/order/parent/active. |
| 086 | Add-on groups · groups | Landscape + phone | iPad native checked; see progress.md | Add-on group directory has independent disclosure/Add item/Edit/Delete targets. |
| 087 | New add-on group · modal | Landscape | iPad native checked; see progress.md | Group EditorSheet retains required/multiple/active/name/description/order. |
| 088 | Add-on groups · group-expanded | Landscape | iPad native checked; see progress.md | Expanded group retains all items and their Edit/Delete controls. |
| 089 | Call history · today | Landscape + phone | Pending parent | Call search/Today rows keep distinct Customer and Call back actions. |
| 090 | Call history · yesterday | Landscape | Pending parent | Same call directory with Yesterday filter. |
| 091 | Call history · all-time | Landscape | Pending parent | Same call directory with All time filter. |
| 092 | About this register · default | Landscape + phone | Pending parent | Installed build/network/memory panels; Check update/Restart/Refresh diagnostics preserved. |
| 093 | TV menus · default | Landscape + phone | Pending parent | TV image grid retains preview/download/move/delete/active toggle. |
| 094 | Preview menu image · image-modal | Landscape | Pending parent | Wide image-preview EditorSheet retains loading/error/download states. |
| 095 | Choose menu image · system-file-picker | Landscape | Pending parent | OS file picker remains native system handoff; no replica built. |
| 096 | Your profile · information-prompt | Landscape | Pending parent | Profile modal shared implementation owned by parent; reference inspected only here. |
| 097 | Sign out of this register? · confirmation | Landscape | Pending parent | More Sign out uses shared confirm EditorSheet; no session ended in this audit. |
| 098 | Open an app link · system-open-prompt | Landscape | Pending parent | System deep-link handoff remains OS-owned; no replica built. |
| 099 | Welcome back · default | Landscape + phone | Pending parent | Split navy/white login and compact stacked variant; no live credentials submitted. |
| 100 | Welcome back · required-fields-validation | Landscape | Pending parent | Same login validation, entered email/password retained and inline errors. |
| 101 | Choose notification sound · selection-prompt | Landscape | Pending parent | Existing SelectionSheet uses shared EditorSheet; sound preview and apply remain separate. |
| 102 | Settings · storage-and-integrations | Landscape | Pending parent | Same Settings hub showing storage/integrations; no catalogue/settings import/export executed. |
| 103 | Kitchen printers · saved-printers | Landscape | Pending parent | Saved printer tab retains default/edit/remove and simulator printers. |
| 104 | Printer section routing · section-routing-01 | Landscape + phone | Pending parent | Section routing card max940; per-section printer/mode/template/time fields preserved. |
| 105 | Printer section routing · section-routing-02 | Landscape | Pending parent | Same section routing family at lower scroll position; no routes removed. |
| 106 | Receipt & print behaviour · receipt-options | Landscape + phone | Pending parent | Receipt behaviour card max940 retains all existing receipt, instant-ticket and advanced fields. |
| 107 | Print journal · journal | Landscape | Pending parent | Print journal implementation remains gated by existing JOURNAL_LOGS_ENABLED; no invented events or enabling configuration. |
| 117 | Menu name resolver · empty | Landscape + phone | Pending parent | Fixed bare empty fallback: workspace header/Refresh/labelled Nothing to resolve + Back to Marketplace; refresh uses existing catalogue manual refresh. |

Known limits and follow-up:

- Native re-check is needed for every row after this pass, especially settings form/save footer and 041 filters. Parent reported the old modal/wide-filter defects before these fixes; those reports are not post-fix verification.
- Source 076 includes a simulator switch, but the existing Smartpay pairing settings/API have no simulator option. No inert or falsely functional simulator control was added. The production URL remains read-only as in the existing flow.
- Source 068 describes 5–300 seconds, while existing application validation currently supports 5–600. This presentation pass retains the existing setting contract.
- Source 072 calls its duration inactivity timeout; the existing setting controls notification-display duration. The existing business meaning/label is retained. Diagnostic response choices are all accessible behind Diagnostics.
- Journal state 107 remains subject to its production feature flag; it was not force-enabled or populated with fabricated data.
- Store, printer, marketplace, pairing and campaign operations were not executed against production services. System states 095/098 remain platform-owned.
- TypeScript (`tsc --noEmit --types react,node`) reports no errors in management-owned files after the final check; unrelated pre-existing ReceiptQrCode and CallerId errors remain. Shared unit dist-test was not touched.
