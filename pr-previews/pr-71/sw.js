function d(e, t) {
  if (e.method !== "GET")
    return "network";
  const c = new URL(e.url), r = c.origin + c.pathname;
  return e.mode === "navigate" && (r === t.scope || r === h(t.scope)) ? "shell" : t.precached.has(r) ? "precached" : "network";
}
function h(e) {
  return `${e}index.html`;
}
function o(e, t) {
  return `shell:${e}:${t}`;
}
function w(e, t, c) {
  const r = o(t, c), n = o(t, "");
  return e.filter((s) => s.startsWith(n) && s !== r);
}
async function u(e, t, c, r = fetch) {
  const n = new AbortController(), s = setTimeout(() => n.abort(), c);
  try {
    const i = await r(e, { signal: n.signal, cache: t });
    return await i.clone().arrayBuffer(), i;
  } finally {
    clearTimeout(s);
  }
}
async function m(e, t) {
  try {
    return await e();
  } catch (c) {
    const r = await t();
    if (!r)
      throw c;
    return r;
  }
}
var k = { base: "/foodtracker/pr-previews/pr-71/", paths: ["/foodtracker/pr-previews/pr-71/apple-touch-icon.png", "/foodtracker/pr-previews/pr-71/assets/index-DU5N5wtt.js", "/foodtracker/pr-previews/pr-71/assets/index-sWPhfzPe.css", "/foodtracker/pr-previews/pr-71/favicon-32.png", "/foodtracker/pr-previews/pr-71/favicon.svg", "/foodtracker/pr-previews/pr-71/icon-192.png", "/foodtracker/pr-previews/pr-71/icon-512.png", "/foodtracker/pr-previews/pr-71/index.html", "/foodtracker/pr-previews/pr-71/manifest.webmanifest"], hash: "3ddc2fc4" };
const a = k, p = o(a.base, a.hash), f = new URL(a.base, self.location.href).href, v = h(f), g = {
  scope: f,
  precached: new Set(a.paths.map((e) => new URL(e, self.location.href).href))
}, E = 4e3, l = { cacheName: p, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(L().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(y().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = d(e.request, g);
  if (t === "shell") {
    const { url: c, cache: r } = e.request;
    e.respondWith(m(() => u(c, r, E), () => caches.match(v, l)));
  } else t === "precached" && e.respondWith(S(e.request));
});
async function L() {
  await (await caches.open(p)).addAll(a.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function y() {
  const e = w(await caches.keys(), a.base, a.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function S(e) {
  return await caches.match(e, l) ?? fetch(e);
}
//# sourceMappingURL=sw.js.map
