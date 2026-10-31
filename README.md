# PPIC Escalation Dashboard

The website reads the original PPIC source workbooks directly and presents the live escalation queue. It does not use Looker Studio or depend on the combined workbook for its main rows.

## Source and output

The public page calls the `ppic-live` Supabase Edge Function. The function reads the seven company `Data` tabs through column `DF`, applies the planned/trigger and matching completion pairs from the workbook's company-specific workflow formulas, and returns one row for each pending workflow group. This preserves the workbook's primary, Payment, Legal, F&D, Sales, Check, and Confirmation outputs, including the conditional Product Master/F&D branches.

The function also reads six Customer PO Tracking Master sheets for customer sales dates and the “Available in Production File” flag. It reads PPIC remarks and concern-person email mappings from the combined PPIC workbook. Each output row links to its original company source row.

## Workbook rules shown on the page

- **Main escalation queue:** matches the workbook's Raw/Main status exclusions and excludes rows whose production-file flag is `Yes`.
- **QA / spec pending:** uses the actual pending QA / Product Specification step: the stage trigger is filled and its completion field is blank. This follows the requested rule instead of the workbook tab's current `Q = Yes` filter. The view applies the queue's cancelled-status exclusions.
- **5 Days:** follows the workbook's calculated age `P > 4` from the source timestamp and inherits Raw's status filter. It includes production-file `Yes` rows. The workbook displays a fixed range through row 240; the website reads the full source responses.
- **Step delay:** applies the same planned-date and hour calculation used by the source Web Escalation formulas. The table keeps the source's order status, status, remarks, planned date, step delay, customer sales date, concern email, and PPIC remarks visible as separate fields.

The combined workbook's Raw formula omits Chimak. The direct dashboard includes Chimak from its own source workbook.

## Public access and configuration

The site opens without sign-in and refreshes every five minutes. The site and data endpoint are public: anyone with the link can view or request the returned live order rows. Source row links in the returned data identify the originating spreadsheet and row.

The function uses the seven source workbook IDs, six tracker workbook IDs, and combined PPIC workbook ID defined in its server-side defaults. Optional `PPIC_SOURCES_JSON`, `PPIC_TRACKERS_JSON`, and `PPIC_REMARKS_SPREADSHEET_ID` secrets can override those defaults.

Configure this Supabase project secret for source access:

- `GOOGLE_SERVICE_ACCOUNT_JSON`: service-account JSON key with read-only Google Sheets API access.

Keep the service-account key in Supabase secrets, never in `config.js` or the public repository. Source workbook IDs are not credentials; the public endpoint already returns live order rows by design. The service account needs Viewer access to the seven source workbooks, six tracking workbooks, and combined PPIC workbook. Enable the Google Sheets API in its Google Cloud project.

Source profiles: use `core` for Crius, Medella, Samson, and Anuttama; `regional` for Orbit and Chiros/Sig; and `chimak` for Chimak. Set `skipDrug: true` for Crius. Source objects use `{"name":"Crius","id":"SHEET_ID","profile":"core","skipDrug":true}`; tracker objects use `{"name":"Crius","id":"SHEET_ID"}`.

## Publish and troubleshoot

GitHub Pages publishes `index.html`, `app.js`, `styles.css`, and `config.js` from the `main` branch at `https://dme1306.github.io/PPIC/`. The separate `ppic-live` function is deployed with JWT verification disabled; it does not replace the existing `ppic-fms` function.

If the page reports that it cannot load data, check that `GOOGLE_SERVICE_ACCOUNT_JSON` is set, the service account has Viewer access to every configured workbook, and the Google Sheets API is enabled. The server response lists any source or tracker sheets that fail to load. A push to `main` publishes the website; the `ppic-live` function must be redeployed when its code changes.

