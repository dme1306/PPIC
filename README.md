# Crius FMS Dashboard

Static dashboard deployed with GitHub Pages. Supabase Auth handles Google sign-in and a Supabase Edge Function securely reads the Google Sheets `Data` tab.

## Architecture
- GitHub Pages: public static frontend at https://dme1306.github.io/PPIC/
- Supabase Auth: Google OAuth login
- Supabase Edge Function: `ppic-fms`
- Google Sheets: reads `Data!A1:DF` only, using a server-side service account with read-only scope

## Required Supabase Edge Function secrets
- `GOOGLE_SHEET_ID`: `1YSO4mq_bNNJo_g9-k_FWvVbRM6OPXZQ678ec0at25RA`
- `GOOGLE_SERVICE_ACCOUNT_JSON`: complete JSON key from a Google Cloud service account
- `ALLOWED_EMAILS`: comma-separated email addresses permitted to use the dashboard

The Google Sheet must be shared with the service account's `client_email` as Viewer. Enable Google Sheets API in Google Cloud. Never commit service-account JSON, private keys, or OAuth client secrets.

## Google sign-in setup
1. In Supabase Dashboard → Authentication → Sign In / Providers, enable Google and set the Google OAuth Client ID and Client Secret.
2. In Google Cloud Console → APIs & Services → Credentials, create/use an OAuth Web application client.
3. Add `https://wgrlwgaymepehcpmizdl.supabase.co/auth/v1/callback` as an Authorized redirect URI in the Google OAuth client.
4. In Supabase Authentication URL Configuration, set Site URL to `https://dme1306.github.io/PPIC/` and add that same URL to Redirect URLs.
5. Add the dashboard URL as an Authorized JavaScript origin if Google Cloud requests it. If Google's consent screen is in Testing mode, add authorized users as test users.

## Frontend configuration
`config.js` contains only the Supabase project URL and publishable key. A publishable key is designed for browser use; never use a Supabase service-role/secret key in this file.

## GitHub Pages
GitHub Actions workflow `.github/workflows/pages.yml` publishes `index.html`, `app.js`, `styles.css`, and `config.js` on pushes to `main`. In GitHub repository Settings → Pages, set the build/deployment source to GitHub Actions.

## Pending-step logic
The dashboard shows only the first pending step for each order. A step is pending when its planned/assignment field is non-empty and its matching confirmation/status field is blank. Column mappings are maintained in `app.js`; confirm the unusual later-stage pairs against the live sheet headers before relying on the queue for operational decisions.

## Security
- The Edge Function validates the Supabase access token and checks `ALLOWED_EMAILS`.
- Google Sheets access is read-only and service-account credentials stay in Supabase secrets.
- Do not publish access tokens, service-role keys, or service-account JSON.
