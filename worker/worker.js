const MAX_SITE_DATA_BYTES = 900_000;
const MAX_IMAGE_DATA_URL_CHARS = 7_000_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = isAllowedOrigin(origin, env.ALLOWED_ORIGINS);
    const headers = {
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    };
    if (allowed) headers["Access-Control-Allow-Origin"] = origin;
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed || !origin ? 204 : 403, headers });
    }
    if (origin && !allowed) return reply({ ok: false, error: "Origin is not allowed. Configure ALLOWED_ORIGINS for this website." }, 403);

    try {
      if (url.pathname === "/api/login" && request.method === "POST") {
        const body = await request.json().catch(() => null);
        if (!env.ADMIN_PASSWORD || !body || typeof body.password !== "string" ||
            body.password !== env.ADMIN_PASSWORD) {
          return reply({ ok: false, error: "Incorrect administrator password." }, 401);
        }
        return reply({ ok: true });
      }

      if ((url.pathname === "/api/data" || url.pathname === "/api/load") && request.method === "GET") {
        if (!env.SITE_DATA) return reply({ ok: false, error: "SITE_DATA KV binding is not configured." }, 500);
        const data = await env.SITE_DATA.get("site-data", "json");
        return reply({ data: data || null });
      }

      if (url.pathname === "/api/save" && request.method === "POST") {
        if (!authorized(request, env)) return reply({ ok: false, error: "Unauthorized" }, 401);
        if (!env.SITE_DATA) return reply({ ok: false, error: "SITE_DATA KV binding is not configured." }, 500);
        const declaredLength = Number(request.headers.get("Content-Length") || 0);
        if (declaredLength > MAX_SITE_DATA_BYTES) {
          return reply({ ok: false, error: "Website data is too large. Upload photos to Cloudinary instead of storing Base64 images." }, 413);
        }
        const raw = await request.text();
        if (new TextEncoder().encode(raw).length > MAX_SITE_DATA_BYTES) {
          return reply({ ok: false, error: "Website data is too large. Upload photos to Cloudinary instead of storing Base64 images." }, 413);
        }
        const body = JSON.parse(raw);
        if (!body || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
          return reply({ ok: false, error: "Missing or invalid site data." }, 400);
        }
        await env.SITE_DATA.put("site-data", JSON.stringify(body.data));
        return reply({ ok: true });
      }

      if (url.pathname === "/api/upload-data-url" && request.method === "POST") {
        if (!authorized(request, env)) return reply({ ok: false, error: "Unauthorized" }, 401);
        if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
          return reply({ ok: false, error: "Cloudinary Worker secrets are not configured." }, 500);
        }
        const body = await request.json().catch(() => null);
        const dataUrl = body && body.dataUrl;
        if (typeof dataUrl !== "string" || dataUrl.length > MAX_IMAGE_DATA_URL_CHARS ||
            !/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(dataUrl)) {
          return reply({ ok: false, error: "Upload a JPG, JPEG, PNG, or WebP image under approximately 5 MB." }, 400);
        }
        const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,/i);
        const format = match[1].toLowerCase();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const toSign = `timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
        const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(toSign));
        const signature = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
        const form = new FormData();
        form.append("file", dataUrl);
        form.append("api_key", env.CLOUDINARY_API_KEY);
        form.append("timestamp", timestamp);
        form.append("signature", signature);
        const upload = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/image/upload`, {
          method: "POST", body: form
        });
        const result = await upload.json().catch(() => ({}));
        if (!upload.ok || !result.secure_url) {
          return reply({ ok: false, error: result.error?.message || "Cloudinary upload failed." }, 502);
        }
        return reply({ secure_url: result.secure_url, public_id: result.public_id, format: result.format || format });
      }

      return reply({ ok: false, error: "Not found" }, 404);
    } catch (error) {
      return reply({ ok: false, error: "Server error. Check Worker logs for details." }, 500);
    }
  }
};

function authorized(request, env) {
  const expected = env.ADMIN_PASSWORD;
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  return typeof expected === "string" && expected.length > 0 &&
    typeof got === "string" && got.length > 0 && got === expected;
}

function isAllowedOrigin(origin, configured) {
  if (!origin) return true;
  const list = String(configured || "https://spmmwardha.org,https://www.spmmwardha.org")
    .split(",").map(value => value.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "https:" && parsed.hostname.endsWith(".github.io")) return true;
    if (["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
  } catch (_) {}
  return false;
}
