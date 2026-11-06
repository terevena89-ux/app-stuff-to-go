// =========================================================
// La météo du jour, pour pré-cocher Pluie / Froid / Chaud / Vent / Neige.
// Source : Open-Meteo (open-meteo.com), gratuit, sans compte ni clé secrète.
// On n'envoie que la position de la ville choisie dans Réglages (jamais le GPS du tel).
// Si Open-Meteo ne répond pas (hors ligne, service arrêté...), rien n'est pré-coché :
// on coche à la main, l'appli marche quand même.
// =========================================================

// Les 5 météos possibles. « id » est ce qui est enregistré sur les objets (o.meteo).
export const METEOS = [
  { id: "pluie", nom: "Pluie", icone: "umbrella" },
  { id: "froid", nom: "Froid", icone: "temperature-minus" },
  { id: "chaud", nom: "Chaud", icone: "sun" },
  { id: "vent", nom: "Vent", icone: "wind" },
  { id: "neige", nom: "Neige", icone: "snowflake" }
];
export const nomMeteo = id => (METEOS.find(m => m.id === id) || { nom: id }).nom;

// Seuils par défaut (réglables dans Réglages) :
// pluie = risque de pluie en %, froid = température mini en °, chaud = température maxi en °,
// vent = rafales en km/h. Chaud se déclenche aussi si l'indice UV est fort (6 ou plus).
export const SEUILS_DEFAUT = { pluie: 50, froid: 8, chaud: 25, vent: 45 };

// Cherche une ville par son nom (ex. « Lyon ») : renvoie jusqu'à 5 propositions
export async function rechercherVille(nom) {
  const url = "https://geocoding-api.open-meteo.com/v1/search?count=5&language=fr&format=json&name=" + encodeURIComponent(nom);
  const rep = await fetch(url);
  if (!rep.ok) throw new Error("recherche impossible");
  const json = await rep.json();
  return (json.results || []).map(r => ({
    nom: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(", "),
    lat: Math.round(r.latitude * 100) / 100,   // 2 décimales suffisent (~1 km)
    lon: Math.round(r.longitude * 100) / 100
  }));
}

// La météo du reste de la journée (de l'heure actuelle à minuit, heure de la ville).
// Gardée une heure dans le navigateur, pour ne pas redemander à chaque ouverture.
const CLE_CACHE = "stuff-meteo";
export async function chargerMeteo(ville) {
  const cleVille = ville.lat + "," + ville.lon;
  try {
    const cache = JSON.parse(localStorage.getItem(CLE_CACHE));
    if (cache && cache.cleVille === cleVille && Date.now() - cache.quand < 60 * 60 * 1000) return cache.donnees;
  } catch (e) { /* pas de copie gardée : on demande au serveur */ }

  const url = "https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=1"
    + `&latitude=${ville.lat}&longitude=${ville.lon}`
    + "&current=temperature_2m,weather_code"
    + "&hourly=temperature_2m,precipitation_probability,wind_gusts_10m,snowfall,uv_index";
  const rep = await fetch(url);
  if (!rep.ok) throw new Error("météo indisponible");
  const j = await rep.json();
  // On ne garde que les heures restantes de la journée (« 2026-11-06T14:00 » ≥ heure actuelle)
  const heureActuelle = j.current.time.slice(0, 13);
  const idx = j.hourly.time.map((t, i) => t.slice(0, 13) >= heureActuelle ? i : -1).filter(i => i >= 0);
  const valeurs = nom => idx.map(i => j.hourly[nom][i]).filter(v => v !== null && v !== undefined);
  const max = l => l.length ? Math.max(...l) : 0;
  const min = l => l.length ? Math.min(...l) : 0;
  const temp = valeurs("temperature_2m");
  const donnees = {
    jour: j.current.time.slice(0, 10),
    actuelle: Math.round(j.current.temperature_2m),
    code: j.current.weather_code,             // code « temps qu'il fait » (pluie, neige...)
    min: Math.round(min(temp)),
    max: Math.round(max(temp)),
    pluie: max(valeurs("precipitation_probability")),
    rafales: Math.round(max(valeurs("wind_gusts_10m"))),
    neige: valeurs("snowfall").reduce((a, b) => a + b, 0),
    uv: max(valeurs("uv_index"))
  };
  try { localStorage.setItem(CLE_CACHE, JSON.stringify({ cleVille, quand: Date.now(), donnees })); } catch (e) { /* tant pis */ }
  return donnees;
}

// Quelles météos cocher d'après les données et les seuils ?
export function evaluer(d, seuils) {
  const s = { ...SEUILS_DEFAUT, ...seuils };
  const res = [];
  if (d.pluie >= s.pluie) res.push("pluie");
  if (d.min <= s.froid) res.push("froid");
  if (d.max >= s.chaud || d.uv >= 6) res.push("chaud");
  if (d.rafales >= s.vent) res.push("vent");
  if (d.neige > 0) res.push("neige");
  return res;
}

// Icône de la grande carte météo, d'après le temps qu'il fait en ce moment
// (codes WMO utilisés par Open-Meteo : 0-3 ciel clair à couvert, 51-67 et 80-82 pluie, 71-77 et 85-86 neige)
export function iconeTemps(d) {
  const c = d.code;
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snowflake";
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return "cloud-rain";
  if (c <= 1) return "sun";
  return "cloud";
}
