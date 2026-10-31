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

## Sign-in and secrets

The static site is public code, but the dashboard data endpoint requires a valid Supabase session and an email listed in the server-side ALLOWED_EMAILS secret.

Configure these secrets in the Supabase project:

- GOOGLE_SERVICE_ACCOUNT_JSON: service account JSON key. Keep it in Supabase secrets only.
- ALLOWED_EMAILS: comma-separated Google account emails allowed to use the dashboard.

The service account needs Viewer access to:

- The seven source company spreadsheets listed above.
- The six Customer PO Tracking Master spreadsheets.
- The PPIC Escalation Dashboard spreadsheet, for its PPIC Remarks tab.

Enable Google Sheets API for the service account's Google Cloud project. The Edge Function uses the read-only Sheets scope. Never put service-account JSON, private keys, or service-role keys in this repository or config.js.

## Google sign-in

Enable Google OAuth in Supabase Authentication and configure the OAuth callback:

https://wgrlwgaymepehcpmizdl.supabase.co/auth/v1/callback

Set the Supabase site URL and allowed redirect URL to:

https://dme1306.github.io/PPIC/

Set ALLOWED_EMAILS to the approved users. The Edge Function checks both the Supabase session and that allowlist.

## Deploy

- GitHub Pages publishes index.html, app.js, styles.css, and config.js from the main branch through .github/workflows/pages.yml.
- Deploy supabase/functions/ppic-fms/index.ts to project wgrlwgaymepehcpmizdl with JWT verification enabled. supabase/config.toml records that setting for CLI deployment.
- Set the Supabase secrets before deploying the function.
- A push to main publishes the site; review the feature branch before merging.

## Source issue notes

The workbook's 5 Days view reads a fixed range (Raw!A2:P240) and includes cancelled rows. This dashboard builds the view from the full direct source responses and excludes cancelled orders.

The workbook contains formula errors in the production index and CSM web escalation output, and many blank cached formula values in the uploaded Excel snapshot. The dashboard displays source read failures and formula errors as warnings when they affect fields used by the live queue.

