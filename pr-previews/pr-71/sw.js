function u(e, t) {
  if (e.method !== "GET")
    return "network";
  const r = new URL(e.url), a = r.origin + r.pathname;
  return e.mode === "navigate" && (a === t.scope || a === f(t.scope)) ? "shell" : t.precached.has(a) ? "precached" : "network";
}
function f(e) {
  return `${e}index.html`;
}
function o(e, t) {
  return `shell:${e}:${t}`;
}
function d(e, t, r) {
  const a = o(t, r), n = o(t, "");
  return e.filter((s) => s.startsWith(n) && s !== a);
}
async function w(e, t, r, a = fetch) {
  const n = new AbortController(), s = setTimeout(() => n.abort(), r);
  try {
    const i = await a(e, { signal: n.signal, cache: t, redirect: "manual" });
    return await i.clone().arrayBuffer(), i;
  } finally {
    clearTimeout(s);
  }
}
async function m(e, t) {
  const [r] = await Promise.allSettled([e()]);
  if (r.status === "fulfilled" && !v(r.value))
    return r.value;
  const a = await t().catch(() => {
  });
  if (a)
    return a;
  if (r.status === "fulfilled")
    return r.value;
  throw r.reason;
}
function v(e) {
  return e.status === 408 || e.status === 429 || e.status >= 500;
}
var k = { base: "/foodtracker/pr-previews/pr-71/", paths: ["/foodtracker/pr-previews/pr-71/apple-touch-icon.png", "/foodtracker/pr-previews/pr-71/assets/index-DU5N5wtt.js", "/foodtracker/pr-previews/pr-71/assets/index-sWPhfzPe.css", "/foodtracker/pr-previews/pr-71/favicon-32.png", "/foodtracker/pr-previews/pr-71/favicon.svg", "/foodtracker/pr-previews/pr-71/icon-192.png", "/foodtracker/pr-previews/pr-71/icon-512.png", "/foodtracker/pr-previews/pr-71/index.html", "/foodtracker/pr-previews/pr-71/manifest.webmanifest"], hash: "3ddc2fc4" };
const c = k, l = o(c.base, c.hash), h = new URL(c.base, self.location.href).href, g = f(h), E = {
  scope: h,
  precached: new Set(c.paths.map((e) => new URL(e, self.location.href).href))
}, L = 4e3, p = { cacheName: l, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(y().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(S().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = u(e.request, E);
  if (t === "shell") {
    const { url: r, cache: a } = e.request;
    e.respondWith(m(() => w(r, a, L), () => caches.match(g, p)));
  } else t === "precached" && e.respondWith(T(e.request));
});
async function y() {
  await (await caches.open(l)).addAll(c.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function S() {
  const e = d(await caches.keys(), c.base, c.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function T(e) {
  return await caches.match(e, p) ?? fetch(e);
}
//# sourceMappingURL=sw.js.map
