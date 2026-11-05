// =========================================================
// Service worker : un petit « gardien » qui tourne en arrière-plan.
// Il garde une copie des fichiers de l'appli pour qu'elle s'ouvre
// même sans réseau. (Les données, elles, sont gérées par Firebase.)
// À CHAQUE NOUVELLE VERSION : changer le numéro ci-dessous.
// =========================================================
const CACHE = "stuff-to-go-v0.2";

// Fichiers de l'appli à garder dès l'installation
const FICHIERS = [
  "./", "index.html", "style.css", "app.js", "icones.js", "excel-style.js", "firebase-config.js",
  "manifest.json", "icones/icone.svg", "icones/icone-192.png", "icones/tabler.svg",
  "polices/space-grotesk-latin-400-normal.woff2", "polices/space-grotesk-latin-700-normal.woff2",
  "polices/jetbrains-mono-latin-400-normal.woff2", "polices/jetbrains-mono-latin-700-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

// Supprime les copies des anciennes versions
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Bibliothèques (Firebase, ExcelJS) : versions fixes, donc on peut garder la copie
  if (url.hostname === "www.gstatic.com" || url.hostname === "cdnjs.cloudflare.com") {
    e.respondWith(
      caches.match(req).then(copie => copie || fetch(req).then(rep => {
        const clone = rep.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return rep;
      }))
    );
    return;
  }

  // Fichiers de l'appli : on essaie d'abord le réseau (pour avoir la dernière version),
  // et si pas de réseau, on prend la copie.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(rep => {
        const clone = rep.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return rep;
      }).catch(() => caches.match(req, { ignoreSearch: true }))
    );
  }
  // Le reste (connexion Google, base de données) passe sans être touché.
});
