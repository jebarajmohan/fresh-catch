// Store = stock.json in the GitHub repo (written via GitHub Contents API).
// Requires ONE env var in Netlify UI: GITHUB_TOKEN (a repo-scoped PAT).
const OWNER = "jebarajmohan";
const REPO = "fresh-catch";
const PATH = "stock.json";
const ADMIN_CODE = process.env.ADMIN_CODE || "freshcatch2026"; // set ADMIN_CODE in Netlify UI for security
const GH_TOKEN = process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com";
const headers = (extra = {}) => ({
  Authorization: `Bearer ${GH_TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "freshcatch-admin",
  ...extra,
});

async function getFile() {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, { headers: headers() });
  if (!res.ok) return { content: "{}", sha: null };
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

async function putFile(content, sha) {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${PATH}`, {
    method: "PUT",
    headers: headers({ "content-type": "application/json" }),
    body: JSON.stringify({
      message: "Fresh Catch: update fish availability",
      content: Buffer.from(content).toString("base64"),
      sha,
    }),
  });
  return res.ok;
}

export default async (req, context) => {
  if (req.method === "GET") {
    const { content } = await getFile();
    let map = {};
    try { map = JSON.parse(content); } catch (e) {}
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
    if (!GH_TOKEN) {
      return new Response(JSON.stringify({ error: "server missing GITHUB_TOKEN env var" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    let body = {};
    try { body = await req.json(); } catch (e) {
      return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const { content, sha } = await getFile();
    let map = {};
    try { map = JSON.parse(content); } catch (e) {}
    const name = body.name;
    const soldOut = !!body.soldOut;
    if (typeof name !== "string" || !name) {
      return new Response(JSON.stringify({ error: "missing name" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    if (soldOut) map[name] = true; else delete map[name];
    const ok = await putFile(JSON.stringify(map, null, 2), sha);
    if (!ok) {
      return new Response(JSON.stringify({ error: "github write failed" }), { status: 500, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, map }), { headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), {
    status: 405,
    headers: { "content-type": "application/json" },
  });
};
