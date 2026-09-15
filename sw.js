function d(e, t) {
  if (e.method !== "GET")
    return "network";
  const a = new URL(e.url), n = a.origin + a.pathname;
  return e.mode === "navigate" && (n === t.scope || n === l(t.scope)) ? "shell" : t.precached.has(n) ? "precached" : "network";
}
function l(e) {
  return `${e}index.html`;
}
function o(e, t) {
  return `shell:${e}:${t}`;
}
function p(e, t, a) {
  const n = o(t, a), r = o(t, "");
  return e.filter((s) => s.startsWith(r) && s !== n);
}
async function w(e, t, a, n = fetch) {
  const r = new AbortController(), s = setTimeout(() => r.abort(), a);
  try {
    const i = await n(e, { signal: r.signal, cache: t, redirect: "manual" });
    return await i.clone().arrayBuffer(), i;
  } finally {
    clearTimeout(s);
  }
}
async function m(e, t) {
  const [a] = await Promise.allSettled([e()]);
  if (a.status === "fulfilled" && !k(a.value))
    return a.value;
  const n = await t().catch(() => {
  });
  if (n)
    return n;
  if (a.status === "fulfilled")
    return a.value;
  throw a.reason;
}
function k(e) {
  return e.status === 408 || e.status === 429 || e.status >= 500;
}
var g = { base: "/foodtracker/", paths: ["/foodtracker/apple-touch-icon.png", "/foodtracker/assets/index-B-lQH8Yg.css", "/foodtracker/assets/index-BnqskZvm.js", "/foodtracker/favicon-32.png", "/foodtracker/favicon.svg", "/foodtracker/icon-192.png", "/foodtracker/icon-512.png", "/foodtracker/index.html", "/foodtracker/manifest.webmanifest"], hash: "ae3022f9" };
const c = g, f = o(c.base, c.hash), h = new URL(c.base, self.location.href).href, E = l(h), L = {
  scope: h,
  precached: new Set(c.paths.map((e) => new URL(e, self.location.href).href))
}, v = 4e3, u = { cacheName: f, ignoreSearch: !0, ignoreVary: !0 };
self.addEventListener("install", (e) => {
  e.waitUntil(y().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(S().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const t = d(e.request, L);
  if (t === "shell") {
    const { url: a, cache: n } = e.request;
    e.respondWith(m(() => w(a, n, v), () => caches.match(E, u)));
  } else t === "precached" && e.respondWith(T(e.request));
});
async function y() {
  await (await caches.open(f)).addAll(c.paths.map((t) => new Request(t, { cache: "no-cache" })));
}
async function S() {
  const e = p(await caches.keys(), c.base, c.hash);
  await Promise.all(e.map((t) => caches.delete(t)));
}
async function T(e) {
  return await caches.match(e, u) ?? fetch(e);
}
//# sourceMappingURL=sw.js.map
