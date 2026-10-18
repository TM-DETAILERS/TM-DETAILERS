# TM Detailers — Publish and activate in Cloudflare

This guide assumes you already have Cloudflare Pages connected to GitHub, as in your `tm-detailers` project, and currently use `tmdetailers.ca`.

## Step 0: Save a backup

Before uploading anything, save a copy of the old GitHub `index.html` or download your current repository as ZIP. **Do not delete the repo or remove your current Cloudflare domain.**

## Step 1: Upload the extracted files to GitHub

1. Unzip `TM-Detailers-Luxury-Website.zip` on your computer.
2. Open the existing `TM-DETAILERS/TM-DETAILERS` GitHub repository.
3. Upload the `public` folder, `functions` folder, `database` folder, `README.md` and `SETUP.md` in the same folder structure shown in the ZIP. The source file `public/index.html` must remain *inside* `public`.
4. Commit the changes to your `main` branch. Do not put the zip itself in GitHub; upload the extracted files.
5. You may leave the old `index.html` in the repository root temporarily; Cloudflare won't use it once the output folder is updated.

## Step 2: Change Cloudflare's build output folder

1. Cloudflare dashboard → **Workers & Pages** → project **tm-detailers** → **Settings** → **Builds & deployments** (or **Build** in newer dashboard).
2. Keep framework preset **None** and production branch **main**.
3. Set **Build command** to `exit 0` (or leave blank if the UI permits).
4. Change **Build output directory** from `.` to **`public`**.
5. Save and start a new deployment (Deployments → Retry deployment / create deployment if needed). Do not connect your custom domain to an untested deployment.
6. Open `https://tm-detailers.pages.dev` and check the updated homepage.

The `functions` directory must remain at GitHub repository root, next to `public`, for Pages Functions to be deployed.

## Step 3: Create a D1 database and tables

1. In Cloudflare, expand **Storage & databases → D1 SQL database** (labels may vary). Click **Create database**. Name it `tm-detailers-data`.
2. Open the newly created database → **Console**. Paste the entire contents of `database/schema.sql` into the SQL console, then run the statements. Make sure the tables were created.
3. Go back to **Workers & Pages → tm-detailers → Settings → Bindings**.
4. Click **Add binding → D1 database**. Set variable name **`DB`**, select `tm-detailers-data`, save under **Production**.
5. Redeploy the Pages project. Bindings apply on the next deployment.

## Step 4: Add private server secrets

Under **Workers & Pages → tm-detailers → Settings → Variables and Secrets** (some dashboards put this under Settings → Environment variables):

- Add encrypted secret `ADMIN_PASSWORD`: **a unique strong password of at least 12 characters** that only the owners know.
- Add encrypted secret `SESSION_SECRET`: a different, random string **at least 32 characters long**. Generate this privately and do not upload it to GitHub or send it in screenshots.

Save these for **Production** and redeploy again. Never paste their values into public website source or a GitHub commit.

You can change `ADMIN_PASSWORD` later using Cloudflare; changing `SESSION_SECRET` also signs all owners/business clients out. Use a password manager and, if available, Cloudflare account 2FA.

## Step 5: Smoke-test before letting customers book

1. Visit `tm-detailers.pages.dev/api/site`. It should return JSON containing `ok: true` and site settings. If it returns 503, at least one binding/secret isn't configured or the deployment hasn't updated.
2. Open the public site. The booking button should be enabled if your owner settings allow bookings.
3. Scroll to footer → **Owner login**. Sign in with your private `ADMIN_PASSWORD`.
4. Open **Photo gallery**. Upload a test photo and choose **Save website changes**. Reopen the site in a private/incognito window and verify the photo appears.
5. Open **Business accounts**. Create a test account with prices for each vehicle (and optional custom code), copy its code. Log out and use **Business account login** to confirm the special prices.
6. Submit one TEST booking using non-sensitive dummy details, then check it appears in **Bookings**. Change its status. Before launch, manually remove test bookings in the D1 Console or keep them clearly labeled.
7. When tested, connect `tmdetailers.ca` in your Pages project's **Custom domains** settings if you have not already. Cloudflare will guide you through any conflicting GitHub A or `www` CNAME records. Remove/replace GitHub DNS records only as the custom-domain setup instructs. **Do not delete the domain registration.**
8. After `tmdetailers.ca` loads over HTTPS, you can change the repo visibility to private. Your Cloudflare Pages site will remain public; individual HTML, CSS, JS responses are always viewable in browsers.

## Admin controls

- **Site content:** Hero text/photo, public contact/Instagram, about section, promotional banner.
- **Services:** Add, remove or edit service cards.
- **Pricing:** Public and default business vehicle prices.
- **Photo gallery:** Upload photos, add HTTPS links, move up/down, remove, edit captions. Uploads are compressed to max 1200 px and under 750 KB; larger images require resizing. Instagram is a linked showcase, not an automatic Instagram sync.
- **Business accounts:** Independent business rates, optional custom business login code, account suspension, code rotation.
- **Bookings:** See booking requests and change their status.
- **Settings:** Seasonal colour theme, accent colour, booking open/closed, blocked dates, times, max per day, homepage sections.

## Important limits

The built-in booking form **does not charge customers** and does not send automatic emails. Owner confirmation is manual. It does not currently accept cancellations/rescheduling from customers. There is no secure payment checkout; use a dedicated payment provider only when you choose to build that. Private customer information is stored in D1, not in browser localStorage. Gallery photos are public once published.

This is a tested starter with server-side protections but is not a guarantee of production security. Before collecting real customer data, review your privacy policy, retention, access controls and security setup, and test in the actual Cloudflare account. Use Cloudflare 2FA.

Official docs: https://developers.cloudflare.com/pages/functions/bindings/ and https://developers.cloudflare.com/pages/configuration/build-configuration/
