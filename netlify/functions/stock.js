// Dependency-free: persists sold-out map in Netlify Blobs via the REST API (no npm package).
// Requires env vars (set in Netlify UI):
//   SITE_ID      - your Netlify site ID
//   NETLIFY_TOKEN - a Netlify personal access token (with blobs scope)
const ADMIN_CODE = process.env.ADMIN_CODE || "freshcatch2026"; // set ADMIN_CODE in Netlify UI for security
const STORE = "fish-stock";
const KEY = "soldout";
const SITE_ID = process.env.SITE_ID || "";
const TOKEN = process.env.NETLIFY_TOKEN || "";

const base = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/${STORE}`;

async function readMap() {
  if (!SITE_ID || !TOKEN) return {};
  try {
    const res = await fetch(`${base}/${KEY}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) return {};
    const text = await res.text();
    const data = JSON.parse(text);
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    return {};
  }
}

async function writeMap(map) {
  if (!SITE_ID || !TOKEN) return false;
  const res = await fetch(`${base}/${KEY}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(map),
  });
  return res.ok;
}

export default async (req, context) => {
  if (req.method === "GET") {
    const map = await readMap();
    return new Response(JSON.stringify(map), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  if (req.method === "POST") {
    const auth =
      req.headers.get("x-admin-code") || new URL(req.url).searchParams.get("code") || "";
    if (!auth || auth !== ADMIN_CODE) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    let body = {};
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const map = await readMap();
    const name = body.name;
    const soldOut = !!body.soldOut;
    if (typeof name !== "string" || !name) {
      return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (soldOut) map[name] = true; else delete map[name];
    const ok = await writeMap(map);
    if (!ok) return new Response(JSON.stringify({ error: "store write failed (check SITE_ID/NETLIFY_TOKEN)" }), { status: 500, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, map }), { headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { "content-type": "application/json" } });
};
