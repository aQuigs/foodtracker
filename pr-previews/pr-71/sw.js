function p(e, t) {
  if (e.method !== "GET")
    return "network";
  if (e.mode === "navigate")
    return "shell";
  const r = new URL(e.url);
  return t.has(r.origin + r.pathname) ? "precached" : "network";
}
function c(e, t) {
  return `shell:${new URL(e).pathname}:${t}`;
}
function f(e, t, r) {
  const n = c(t, r), s = c(t, "");
  return e.filter((i) => i.startsWith(s) && i !== n);
}
var l = { paths: ["/foodtracker/pr-previews/pr-71/apple-touch-icon.png", "/foodtracker/pr-previews/pr-71/assets/index-DSbvQxMm.js", "/foodtracker/pr-previews/pr-71/assets/index-sWPhfzPe.css", "/foodtracker/pr-previews/pr-71/favicon-32.png", "/foodtracker/pr-previews/pr-71/favicon.svg", "/foodtracker/pr-previews/pr-71/icon-192.png", "/foodtracker/pr-previews/pr-71/icon-512.png", "/foodtracker/pr-previews/pr-71/index.html", "/foodtracker/pr-previews/pr-71/manifest.webmanifest"], hash: "bd3163fa" };
const a = l, o = c(self.registration.scope, a.hash), w = new Set(a.paths.map((e) => new URL(e, self.location.href).href)), d = new URL("index.html", self.registration.scope).href, u = 4e3, h = { cacheName: o, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(m().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(k().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = p(e.request, w);
  t === "shell" ? e.respondWith(g(e.request)) : t === "precached" && e.respondWith(v(e.request));
});
async function m() {
  await (await caches.open(o)).addAll(a.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function k() {
  const e = f(await caches.keys(), self.registration.scope, a.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function v(e) {
  return await caches.match(e, h) ?? fetch(e);
}
async function g(e) {
  try {
    return await E(fetch(e), u);
  } catch (t) {
    const r = await caches.match(d, h);
    if (!r)
      throw t;
    return r;
  }
}
function E(e, t) {
  return new Promise((r, n) => {
    const s = setTimeout(() => n(new Error(`no response within ${t}ms`)), t);
    e.then(r, n).finally(() => clearTimeout(s));
  });
}
//# sourceMappingURL=sw.js.map
