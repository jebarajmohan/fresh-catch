// GET /api/pay -> returns payment.json from GitHub
// POST /api/pay?code=<ADMIN_CODE> -> updates payment.json (upiId / qrDataUri)
const OWNER = "jebarajmohan";
const REPO = "fresh-catch";
const PATH = "payment.json";

function normalize(obj){
  if(!obj || typeof obj !== "object") return obj;
  const out = {};
  for(const [k,v] of Object.entries(obj)){
    const key = k.toLowerCase();
    if(v === "" || v === null || v === undefined) continue;
    out[key] = String(v).trim();
  }
  return out;
}

function ghHeaders(){
  const token = process.env.GITHUB_TOKEN || "";
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "freshcatch-pay",
    "Content-Type": "application/json"
  };
}

async function ghGet(){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if(!res.ok) return null;
  const data = await res.json();
  const content = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
  return { content: normalize(content), sha: data.sha };
}

async function ghPut(body, sha){
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const b64 = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");
  const res = await fetch(url, {
    method: "PUT",
    headers: ghHeaders(),
    body: JSON.stringify({ message: "Fresh Catch: update payment info", content: b64, sha })
  });
  if(!res.ok) throw new Error("GitHub save failed");
  return res.status;
}

async function handler(event){
  const url = new URL(event.rawUrl || event.url || "http://x");
  const code = url.searchParams.get("code") || "";

  if(event.httpMethod === "GET"){
    const data = await ghGet();
    if(!data) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currency: "INR" }) };
    return { statusCode: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(data.content) };
  }

  if(event.httpMethod === "POST"){
    const ADMIN = process.env.ADMIN_CODE || "freshcatch2026";
    if(!code || code !== ADMIN) return { statusCode: 401, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "unauthorized" }) };
    const body = JSON.parse(event.body || "{}");
    if(!body || typeof body !== "object") return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "invalid body" }) };
    const current = await ghGet();
    if(!current) return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "payment.json missing" }) };
    const merged = { ...current.content, ...body };
    await ghPut(merged, current.sha);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true, payment: merged }) };
  }

  return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method Not Allowed" }) };
}

export { handler };
