# PPIC Escalation Dashboard

A GitHub Pages dashboard that reads the original PPIC source sheets directly and calculates the pending workflow queue on the server. It does not use Looker Studio or the combined workbook as its main data feed.

## Data flow

1. The Supabase Edge Function reads Data!A:DF from the seven company source workbooks: Crius, Medella, Samson, Anuttama, Orbit, Chiros/Sig, and Chimak.
2. It checks the planned/trigger and completion field pairs used by the workbook's workflow formulas. The same order can appear in more than one workflow group when several teams have pending work.
3. Six Customer PO Tracking Master sheets provide the customer sales order date and the “Available in Production File” flag. The dashboard also reads PPIC notes from the PPIC Remarks tab in the combined workbook.
4. The browser receives only the normalized dashboard rows and links each task back to its source row.

The direct source tabs extend through column DF. The combined workbook only imports A:BT and calculates additional helper fields locally, so this site reads the source tabs through DF.

## Pending and aging rules

- A step is pending when its workflow trigger/planned field is filled and its matching completion field is blank.
- Step mappings are company-specific and follow the workbook formulas, including conditional F&D/Product Master branches.
- The QA / spec view shows rows where the QA / Product Specification step is pending.
- The 5+ day view uses calendar days from the source timestamp. It matches the workbook's P > 4 threshold.
- Step aging is calculated from the planned/trigger date. The production flag is shown as a filter; all statuses are visible by default.

The workbook's current “Spec approval pending” tab filters Q = Yes, while Raw!Q is labeled “PO exist in production.” This site follows the actual pending QA/spec step instead.

The combined workbook's Raw formula omits Chimak. The direct dashboard includes Chimak from its source sheet.

## Opening the dashboard

The dashboard loads as soon as the page opens and refreshes every five minutes. The local project folder needs the public `config.js` file, which is included in the repository. The deployed address is `https://dme1306.github.io/PPIC/`.

## Public access and secrets

The dashboard and live data endpoint are public with no sign-in. Anyone with the website link can view and retrieve the live order data. The Google Sheets source IDs and service-account key stay in Supabase secrets, while the function's Google Sheets scope is read-only.

Configure these secrets in the Supabase project:

- GOOGLE_SERVICE_ACCOUNT_JSON: service account JSON key. Keep it in Supabase secrets only.
- PPIC_SOURCES_JSON: JSON array of the seven source sheet IDs and their workflow profiles.
- PPIC_TRACKERS_JSON: JSON array of the six customer tracking sheet IDs.
- PPIC_REMARKS_SPREADSHEET_ID: ID of the workbook containing the PPIC Remarks tab.

Keep all spreadsheet IDs in Supabase secrets. Do not add them to this public repository. Use `core` for Crius, Medella, Samson, and Anuttama; `regional` for Orbit and Chiros/Sig; and `chimak` for Chimak. The source setting uses objects shaped like `{"name":"Crius","id":"SHEET_ID","profile":"core","skipDrug":true}`. Tracker objects use `{"name":"Crius","id":"SHEET_ID"}`. Add the six tracker books for Crius, Samson, Chiros/Sig, Anuttama, Chimak, and Orbit.

The service account needs Viewer access to:

- The seven source company spreadsheets listed above.
- The six Customer PO Tracking Master spreadsheets.
- The PPIC Escalation Dashboard spreadsheet, for its PPIC Remarks tab.

Enable Google Sheets API for the service account's Google Cloud project. Never put service-account JSON, private keys, or service-role keys in this repository or config.js. Since the endpoint is public, anyone can request its returned rows even if they do not use the dashboard page.

## Deploy

- GitHub Pages publishes index.html, app.js, styles.css, and config.js from the main branch through .github/workflows/pages.yml.
- Deploy supabase/functions/ppic-fms/index.ts to project wgrlwgaymepehcpmizdl with JWT verification disabled. supabase/config.toml records that setting for CLI deployment.
- Set the Supabase secrets before deploying the function.
- A push to main publishes the site; review the feature branch before merging.

## Source issue notes

The workbook's 5 Days view reads a fixed range (Raw!A2:P240) and includes cancelled rows. This dashboard builds the view from the full direct source responses and excludes cancelled orders.

The workbook contains formula errors in the production index and CSM web escalation output, and many blank cached formula values in the uploaded Excel snapshot. The dashboard displays source read failures and formula errors as warnings when they affect fields used by the live queue.

