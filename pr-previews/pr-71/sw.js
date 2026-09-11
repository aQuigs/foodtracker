function l(e, t) {
  if (e.method !== "GET")
    return "network";
  const a = new URL(e.url), r = a.origin + a.pathname;
  return e.mode === "navigate" && (r === t.scope || r === `${t.scope}index.html`) ? "shell" : t.precached.has(r) ? "precached" : "network";
}
function o(e, t) {
  return `shell:${e}:${t}`;
}
function d(e, t, a) {
  const r = o(t, a), n = o(t, "");
  return e.filter((s) => s.startsWith(n) && s !== r);
}
async function w(e, t, a, r = fetch) {
  const n = new AbortController(), s = setTimeout(() => n.abort(), a);
  try {
    const i = await r(e, { signal: n.signal, cache: t });
    return await i.clone().arrayBuffer(), i;
  } finally {
    clearTimeout(s);
  }
}
async function u(e, t) {
  try {
    return await e();
  } catch (a) {
    const r = await t();
    if (!r)
      throw a;
    return r;
  }
}
var m = { base: "/foodtracker/pr-previews/pr-71/", paths: ["/foodtracker/pr-previews/pr-71/apple-touch-icon.png", "/foodtracker/pr-previews/pr-71/assets/index-DU5N5wtt.js", "/foodtracker/pr-previews/pr-71/assets/index-sWPhfzPe.css", "/foodtracker/pr-previews/pr-71/favicon-32.png", "/foodtracker/pr-previews/pr-71/favicon.svg", "/foodtracker/pr-previews/pr-71/icon-192.png", "/foodtracker/pr-previews/pr-71/icon-512.png", "/foodtracker/pr-previews/pr-71/index.html", "/foodtracker/pr-previews/pr-71/manifest.webmanifest"], hash: "3ddc2fc4" };
const c = m, h = o(c.base, c.hash), p = new URL(c.base, self.location.href).href, k = `${p}index.html`, v = {
  scope: p,
  precached: new Set(c.paths.map((e) => new URL(e, self.location.href).href))
}, g = 4e3, f = { cacheName: h, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(E().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(L().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = l(e.request, v);
  if (t === "shell") {
    const { url: a, cache: r } = e.request;
    e.respondWith(u(() => w(a, r, g), () => caches.match(k, f)));
  } else t === "precached" && e.respondWith(y(e.request));
});
async function E() {
  await (await caches.open(h)).addAll(c.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function L() {
  const e = d(await caches.keys(), c.base, c.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function y(e) {
  return await caches.match(e, f) ?? fetch(e);
}
//# sourceMappingURL=sw.js.map
