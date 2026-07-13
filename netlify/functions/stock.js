const STORE_NAME = "fish-stock";
const ADMIN_CODE = process.env.ADMIN_CODE || "freshcatch2026"; // set ADMIN_CODE in Netlify UI for security
const STOCK_KEY = "soldout";

export default async (req, context) => {
  // Netlify Functions v2 injects `context.blobs` (BlobStore) automatically.
  const store = context.blobs;

  const readMap = async () => {
    try {
      const raw = await store.get(STOCK_KEY, { type: "json" });
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  };

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
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const map = await readMap();
    const name = body.name;
    const soldOut = !!body.soldOut;

    if (typeof name !== "string" || !name) {
      return new Response(JSON.stringify({ error: "missing name" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (soldOut) map[name] = true;
    else delete map[name];

    await store.set(STOCK_KEY, JSON.stringify(map));

    return new Response(JSON.stringify({ ok: true, map }), {
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
};
