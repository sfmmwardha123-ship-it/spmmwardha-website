# Savitribai Phule Mahila Mandal Wardha — Go-Live Guide

Target domain: **https://spmmwardha.org**

This is a deployment package based on the supplied website, not a live deployment. You must connect your own GitHub, Cloudflare, Cloudinary, and GoDaddy accounts and complete the checks below.

## Package files
- `index.html` — original site structure/content retained; embedded photos are replaced with a reusable placeholder, and identified logo images are externalized to `assets/`.
- `assets/placeholder-photo.svg` — neutral placeholder used where embedded photos were removed.
- `assets/brand-logo-*` — extracted logo assets where the original HTML identified them as logos.
- `cloudinary-config.js` — public Worker URL only; no credentials.
- `CNAME` — `spmmwardha.org`.
- `sitemap.xml`, `robots.txt` — for the custom domain.
- `worker/worker.js`, `worker/wrangler.toml` — backend source and configuration template.

## 1. Create GitHub Pages site
1. Create a GitHub repository, for example `spmmwardha-website`.
2. Upload the **contents** of this project folder to the repository root, including `index.html`, `cloudinary-config.js`, `CNAME`, `sitemap.xml`, `robots.txt`, and `assets/`. Keep the `worker/` folder in the repository too, or keep a separate private backup.
3. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. GitHub Pages is not live until GitHub reports a successful deployment. Check the Actions/Pages status and open the URL it provides.

## 2. Create Cloudflare Worker and KV
1. In Cloudflare, create a Workers KV namespace.
2. Copy its namespace ID into `worker/wrangler.toml`, replacing `REPLACE_WITH_KV_NAMESPACE_ID`.
3. In the Cloudflare Worker configuration, bind that namespace with the exact binding name **`SITE_DATA`**.
4. Deploy `worker/worker.js` as a Worker named `spmmwardha-api`. Wrangler can be used from the `worker/` directory after installing Wrangler and signing in.
5. Add these values under Worker **Settings → Variables and Secrets** as **secrets**:
   - `ADMIN_PASSWORD` — choose a strong, unique password.
   - `CLOUDINARY_CLOUD_NAME` — from Cloudinary Console.
   - `CLOUDINARY_API_KEY` — from Cloudinary Console.
   - `CLOUDINARY_API_SECRET` — from Cloudinary Console.
6. If using a custom origin allowlist, set `ALLOWED_ORIGINS` to comma-separated exact origins, for example `https://spmmwardha.org,https://www.spmmwardha.org`. GitHub Pages `*.github.io` origins are also allowed by the starter Worker.
7. Copy the deployed Worker HTTPS URL. It usually resembles `https://spmmwardha-api.YOUR-SUBDOMAIN.workers.dev`.

Do not put the admin password or Cloudinary API credentials in GitHub files, HTML, or browser JavaScript.

## 3. Connect the frontend to the Worker
Edit `cloudinary-config.js` and replace `https://REPLACE-WITH-YOUR-CLOUDFLARE-WORKER-URL` with the real Worker URL, without a trailing slash. Commit the change to GitHub.

## 4. Cloudinary image uploads
The Worker accepts image data URLs for JPG/JPEG, PNG, and WebP and sends them to Cloudinary using server-side credentials. The API secret stays in Cloudflare. PDF and document uploads are **not implemented** by this backend.

After deployment, test one small image through the existing Admin interface. Confirm that the returned `secure_url` is saved in the shared site data.

## 5. Connect `spmmwardha.org` through GoDaddy
1. In GitHub repository **Settings → Pages → Custom domain**, enter `spmmwardha.org` and save.
2. GitHub Pages will show the DNS records it expects. Use those exact values in GoDaddy DNS. GitHub commonly uses A/AAAA records for an apex domain and a CNAME for `www`, but follow the records shown in your GitHub Pages settings because they can change.
3. **Do not delete or modify existing MX records** or email-related TXT records. They may be needed for official email.
4. Wait for DNS to propagate, then enable **Enforce HTTPS** when GitHub offers it.
5. The root `CNAME` file is already included. Do not add DNS values from guesses or from unrelated tutorials.

## 6. Validate the live website
Do these tests only after the Worker and Pages site are deployed:
1. Open `https://spmmwardha.org` and inspect the page on desktop and mobile.
2. Open Admin and log in using the password stored in the Worker secret.
3. Change a small text field, press the website's save action, and confirm a success message.
4. Open the site in a private/incognito window or on another device, refresh, and confirm the saved text appears.
5. Upload a JPG/PNG/WebP photo through Admin, save, refresh on another device, and confirm the image remains visible.
6. Test invalid password, unsupported image type, oversized upload, and a failed network request.
7. Review Cloudflare Worker logs if a request fails. Never share secrets in screenshots.

## 7. Google indexing
Once the custom domain works, add `https://spmmwardha.org/` to Google Search Console, verify ownership, submit `https://spmmwardha.org/sitemap.xml`, and request indexing for the homepage. Indexing is not immediate or guaranteed.

## Security and deployment notes
- `POST /api/login`, `GET /api/data`, `POST /api/save`, and `POST /api/upload-data-url` are implemented; `GET /api/load` is retained as a compatibility alias.
- The frontend currently uses the administrator password as a bearer token in memory for authorized write/upload requests. This is a simple shared-password model, not multi-user accounts or a session-token system. Use a strong password and consider a dedicated authentication service for higher-risk deployments.
- The Worker restricts browser origins, requires authorization for writes/uploads, validates image MIME data URLs, and checks the site-data payload size.
- Shared updates are stored in Cloudflare KV and are designed to be read by all visitors. KV propagation is not guaranteed to be instant everywhere.
- The project has **not** been deployed or tested against your live accounts from this package. You must verify the login, saving, and upload flows after setup.
- Free plans have quotas and terms that may change. Check current GitHub, Cloudflare, and Cloudinary limits before production use.
