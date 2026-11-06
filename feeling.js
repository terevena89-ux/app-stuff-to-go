// =========================================================
// Le « feeling » de l'appli : vibrations, petits sons, effet de fin.
// Les réglages (vibration oui/non, son oui/non, affichage de la checklist) sont gardés sur CET appareil
// seulement (localStorage), pas synchronisés : le PC ne vibre pas, et on peut
// vouloir du son sur l'un et pas sur l'autre.
// =========================================================

const CLE = "stuff-feeling";

// Par défaut : vibration activée, son coupé, checklist en cadres séparés par contenant
let reglages = { vibration: true, son: false, affichage: "cadres" };
try { Object.assign(reglages, JSON.parse(localStorage.getItem(CLE)) || {}); } catch (e) { /* rien : on garde les valeurs par défaut */ }

export function lireReglage(nom) { return reglages[nom]; }
export function changerReglage(nom, valeur) {
  reglages[nom] = valeur;
  try { localStorage.setItem(CLE, JSON.stringify(reglages)); } catch (e) { /* stockage bloqué : tant pis */ }
}

// Le téléphone sait-il vibrer ? (Chrome Android oui ; PC et iPhone non)
export const peutVibrer = typeof navigator !== "undefined" && "vibrate" in navigator;

// L'utilisateur a-t-il demandé « moins d'animations » dans les réglages du tel ?
const moinsAnimations = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Vibration ----------
// Un nombre = durée en millisecondes ; une liste = vibre, pause, vibre...
function vibrer(motif) {
  if (!reglages.vibration || !peutVibrer) return;
  try { navigator.vibrate(motif); } catch (e) { /* ignoré */ }
}

// ---------- Son ----------
// Pas de fichier son : on fabrique le son avec le « synthétiseur » intégré au
// navigateur (Web Audio), comme les vieilles consoles. Rien à télécharger.
let audio = null;
function contexteAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
  return audio;
}
// Joue une note : fréquence (Hz), départ (s), durée (s), forme d'onde, volume
function note(freq, depart, duree, forme = "square", volume = 0.07) {
  const ac = contexteAudio();
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = forme; osc.frequency.value = freq;
  const t = ac.currentTime + depart;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree); // le son s'éteint vite
  osc.connect(gain).connect(ac.destination);
  osc.start(t); osc.stop(t + duree + 0.02);
}
// Clic mécanique sec : un « tac » aigu très court + un petit « toc » grave
function clic() {
  note(1800, 0, 0.018, "square", 0.05);
  note(160, 0, 0.04, "triangle", 0.12);
}
// Jingle 8-bit de fin : do-mi-sol-do qui monte
function jingle() {
  [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.12));
  note(1047, 0.36, 0.35);
}
function jouer(son) {
  if (!reglages.son) return;
  try { son(); } catch (e) { /* son indisponible : ignoré */ }
}

// ---------- Les moments de l'appli ----------

// On coche (ou décoche) un objet
export function aCoche(coche) {
  vibrer(coche ? 15 : 8);
  if (coche) jouer(clic);
}
// On attrape ou on lâche une ligne en mode ranger
export function attrape() { vibrer(12); }
export function lache() { vibrer(8); }
// On lance la préparation (bouton « Préparer ») : tic un peu plus marqué
export function lance() { vibrer(30); }

// Tout est coché : bannière « READY TO GO » qui traverse l'écran + jingle
export function toutEstPret(nbObjets) {
  vibrer([40, 40, 80]);
  jouer(jingle);
  document.querySelector(".banniere-fin")?.remove();
  const b = document.createElement("div");
  b.className = "banniere-fin";
  b.setAttribute("role", "status");
  b.innerHTML = `<span class="gros">READY TO GO</span><span class="petit">${nbObjets} objet${nbObjets > 1 ? "s" : ""} · rien oublié</span>`;
  document.body.appendChild(b);
  // On la laisse ~2 secondes, puis elle repart par la droite et disparaît
  const duree = moinsAnimations() ? 1600 : 1900;
  setTimeout(() => b.classList.add("sort"), duree);
  setTimeout(() => b.remove(), duree + 400);
}
