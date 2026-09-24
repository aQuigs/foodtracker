function d(e, t) {
  if (e.method !== "GET")
    return "network";
  const a = new URL(e.url), c = a.origin + a.pathname;
  return e.mode === "navigate" && (c === t.scope || c === l(t.scope)) ? "shell" : t.precached.has(c) ? "precached" : "network";
}
function l(e) {
  return `${e}index.html`;
}
function o(e, t) {
  return `shell:${e}:${t}`;
}
function p(e, t, a) {
  const c = o(t, a), r = o(t, "");
  return e.filter((s) => s.startsWith(r) && s !== c);
}
async function w(e, t, a, c = fetch) {
  const r = new AbortController(), s = setTimeout(() => r.abort(), a);
  try {
    const i = await c(e, { signal: r.signal, cache: t, redirect: "manual" });
    return await i.clone().arrayBuffer(), i;
  } finally {
    clearTimeout(s);
  }
}
async function m(e, t) {
  const [a] = await Promise.allSettled([e()]);
  if (a.status === "fulfilled" && !k(a.value))
    return a.value;
  const c = await t().catch(() => {
  });
  if (c)
    return c;
  if (a.status === "fulfilled")
    return a.value;
  throw a.reason;
}
function k(e) {
  return e.status === 408 || e.status === 429 || e.status >= 500;
}
var g = { base: "/foodtracker/", paths: ["/foodtracker/apple-touch-icon.png", "/foodtracker/assets/index-BpKzKLZM.css", "/foodtracker/assets/index-CZgGyLNQ.js", "/foodtracker/favicon-32.png", "/foodtracker/favicon.svg", "/foodtracker/icon-192.png", "/foodtracker/icon-512.png", "/foodtracker/index.html", "/foodtracker/manifest.webmanifest"], hash: "67dcdd74" };
const n = g, f = o(n.base, n.hash), h = new URL(n.base, self.location.href).href, L = l(h), E = {
  scope: h,
  precached: new Set(n.paths.map((e) => new URL(e, self.location.href).href))
}, y = 4e3, u = { cacheName: f, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(v().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(S().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = d(e.request, E);
  if (t === "shell") {
    const { url: a, cache: c } = e.request;
    e.respondWith(m(() => w(a, c, y), () => caches.match(L, u)));
  } else t === "precached" && e.respondWith(C(e.request));
});
async function v() {
  await (await caches.open(f)).addAll(n.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function S() {
  const e = p(await caches.keys(), n.base, n.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function C(e) {
  return await caches.match(e, u) ?? fetch(e);
}
//# sourceMappingURL=sw.js.map
