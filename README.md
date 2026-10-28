# Crius FMS Dashboard

Interactive dashboard hosted on GitHub Pages, with a Vercel serverless API reading only the Data tab from the FMS Google Sheet.

## Included
- Search, person/step/status filters, KPI cards and workflow queue
- Google Sign-In ID-token verification on the backend
- Email allowlist for dashboard access
- Google Sheets read-only API scope; no spreadsheet write operations
- Service-account credentials remain in Vercel environment variables, never in frontend files
- Data source is the Data tab only

## 1. Google Sheet access
The spreadsheet ID is configured as 1YSO4mq_bNNJo_g9-k_FWvVbRM6OPXZQ678ec0at25RA. Create or use a Google Cloud service account, enable the Google Sheets API, and share the spreadsheet with the service-account email as Viewer. Do not share a private key in GitHub or chat.

## 2. Google OAuth sign-in
Create a Google OAuth 2.0 Web application client. Add the GitHub Pages origin (for example https://dme1306.github.io) to Authorized JavaScript origins. Use the same OAuth Client ID in config.js and Vercel.

## 3. Deploy the API on Vercel
Import this repository into Vercel. Add these environment variables in the Vercel project settings for Production (and Preview if needed):
- GOOGLE_SHEET_ID = 1YSO4mq_bNNJo_g9-k_FWvVbRM6OPXZQ678ec0at25RA
- GOOGLE_CLIENT_ID = the Google OAuth Web Client ID
- GOOGLE_SERVICE_ACCOUNT_JSON = the complete service-account JSON object, as one environment-variable value
- ALLOWED_EMAILS = comma-separated Google email addresses allowed to see the dashboard
- ALLOWED_ORIGINS = https://dme1306.github.io (add local development origin only if needed)

Redeploy after adding variables. The API endpoint will be https://YOUR-VERCEL-PROJECT.vercel.app/api/fms.

## 4. Configure GitHub Pages frontend
Edit config.js and replace API_BASE_URL with the deployed Vercel API URL, and GOOGLE_CLIENT_ID with the OAuth Web Client ID. These are public configuration values, not secrets. Never add service-account JSON or a private key to config.js.

In GitHub, open Settings → Pages and publish from the main branch, root (/). The site URL will usually be https://dme1306.github.io/PPIC/ for this repository.

## 5. Verify the sheet
The backend service account must have Viewer access to the spreadsheet. The backend intentionally reads Data!A1:DF only. Other tabs are not queried.

## Pending-step logic
The dashboard checks the ordered step definitions in app.js. A step is pending only when its planned field is non-empty and its matching status/confirmation field is blank. The first pending step per order is shown. The supplied workbook contains repeated and helper columns, so verify the step-to-status mapping against the live sheet before relying on it for operational decisions.

Delay Hours are calculated from the pending step's planned date and current time. They refresh on the page every minute; refresh the data to retrieve new sheet values.

## Security notes
- Do not commit credentials, private keys, OAuth client secrets, or tokens.
- The Google service account has read-only scope.
- The backend returns data only after verifying a Google ID token and checking ALLOWED_EMAILS.
- Set ALLOWED_EMAILS to specific authorized people; do not leave it blank.
