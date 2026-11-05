// =========================================================
// Stuff to go — le « cerveau » de l'appli.
// Plan du fichier :
//   1. Réglages de base et données
//   2. Stockage (Firebase, ou mode démo local)
//   3. Navigation entre les écrans
//   4. Affichage de chaque écran
//   5. Actions (cocher, ajouter, supprimer...)
//   6. Export / import Excel
//   7. Démarrage
// =========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, onSnapshot, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { chargerExcelJS, ajouterFeuille, telechargerClasseur, lireClasseur, lireFeuille } from "./excel-style.js";
import { COULEURS, ICONES_CHOIX, iconeObjet, iconeListe, iconeContenant } from "./icones.js";

// ---------- 1. Réglages de base et données ----------

const VERSION = "v0.2";
const NOM_APPLI = "app-stuff-to-go";   // nom du dossier dans Firestore et des fichiers Excel

// Toutes les données de l'appli tiennent dans un seul objet « etat » :
//   poches    : réglages du contenant fixe « Poches »     { couleur, icone }
//   sacs      : mes sacs, dans l'ordre d'affichage        [{ id, nom, couleur, icone }]
//   listes    : mes listes par endroit                    [{ id, nom, icone, objets: [{ id, nom, qte, sac, icone }] }]
//   selection : les listes cochées sur l'accueil, dans l'ordre où je les ai cochées
//   coches    : les objets déjà pris (par leur nom en minuscules)
// Les « icone » sont facultatives : sans choix de ma part, l'appli devine d'après le nom.
let etat = etatVide();

function etatVide() {
  return {
    poches: { couleur: "jaune" },
    sacs: [{ id: "sac-a-dos", nom: "Sac à dos", couleur: "bleu" }],
    listes: [], selection: [], coches: []
  };
}

// Remet d'aplomb des données venues d'ailleurs (Firebase, ancienne version...)
// Ex. : un sac créé en v0.1 n'a pas de couleur → on lui en donne une, dans l'ordre.
function normaliser(d) {
  const sacs = Array.isArray(d.sacs) ? d.sacs : [];
  return {
    poches: { couleur: "jaune", ...(d.poches || {}) },
    sacs: sacs.map((s, i) => ({ ...s, couleur: s.couleur || COULEURS[(i + 1) % COULEURS.length] })),
    listes: Array.isArray(d.listes) ? d.listes.map(l => ({ ...l, objets: Array.isArray(l.objets) ? l.objets : [] })) : [],
    selection: Array.isArray(d.selection) ? d.selection : [],
    coches: Array.isArray(d.coches) ? d.coches : []
  };
}

// Petit identifiant unique pour chaque élément (ex. "k3f9x2a1")
const nouvelId = () => Math.random().toString(36).slice(2, 10);
// Clé d'un objet : son nom en minuscules, sans espaces autour.
// « Clés » et « clés » sont donc le même objet.
const cle = nom => nom.trim().toLowerCase();
const $ = id => document.getElementById(id);
// Planche des icônes (fichier SVG qui contient tous les dessins)
const PLANCHE = "icones/tabler.svg#";
// Transforme l'état en texte, toujours dans le même ordre (Firestore peut renvoyer
// les champs dans un autre ordre) : sert à voir si quelque chose a vraiment changé.
const enTexte = v => JSON.stringify(v, (k, x) =>
  x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x);

// Tous les contenants, dans l'ordre : Poches (fixe) puis mes sacs
const contenants = () => [{ id: "poches", nom: "Poches", ...etat.poches }, ...etat.sacs];
const SANS_SAC = { id: "?", nom: "Sans sac", couleur: "gris", icone: "point" };
const nomContenant = id => (contenants().find(c => c.id === id) || SANS_SAC).nom;

// ---------- 2. Stockage ----------
// Mode démo (adresse se terminant par ?demo) : données gardées dans ce navigateur
// seulement, sans connexion. Sert à tester l'appli sans compte.
const MODE_DEMO = new URLSearchParams(location.search).has("demo");

let refDoc = null;          // emplacement de mes données dans Firestore
let auth = null;
let dernierJSON = "";       // pour ne pas tout redessiner si rien n'a changé

// Enregistre l'état. Firestore garde l'écriture en attente si on est hors ligne,
// et l'envoie tout seul au retour du réseau. La dernière modification gagne.
function sauver() {
  dernierJSON = enTexte(etat);
  if (MODE_DEMO) {
    try { localStorage.setItem("stuff-demo", dernierJSON); } catch (e) { /* stockage plein ou bloqué */ }
    return;
  }
  if (!refDoc) return;
  setDoc(refDoc, { ...etat, maj: serverTimestamp() }).catch(err => {
    console.error(err);
    afficherToast("Échec de l'enregistrement", null);
  });
}

function demarrerFirebase() {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Cache local permanent : l'appli fonctionne hors ligne avec la dernière copie connue
  const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true, // un champ vide ne bloque pas l'enregistrement
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });

  onAuthStateChanged(auth, user => {
    if (!user) { montrer("connexion"); return; }
    $("compte-info").textContent = `Connecté : ${user.displayName || user.email}`;
    // Mes données : users/{mon uid}/app-stuff-to-go/donnees
    refDoc = doc(db, "users", user.uid, NOM_APPLI, "donnees");
    onSnapshot(refDoc, { includeMetadataChanges: true }, snap => {
      majSynchro(snap.metadata);
      if (!snap.exists()) {
        // Première utilisation : on crée les données de départ.
        // Seulement si la réponse vient vraiment du serveur, sinon on risquerait
        // d'écraser mes vraies données en étant hors ligne.
        if (!snap.metadata.fromCache) { etat = etatVide(); sauver(); router(); }
        return;
      }
      const recu = normaliser(snap.data());
      const json = enTexte(recu);
      if (json === dernierJSON) return; // rien de neuf (souvent : mon propre enregistrement)
      etat = recu;
      dernierJSON = json;
      router();
    });
  });
}

function demarrerDemo() {
  try { etat = normaliser(JSON.parse(localStorage.getItem("stuff-demo")) || etatVide()); }
  catch (e) { etat = etatVide(); }
  $("compte-info").textContent = "Mode démo : données gardées sur cet appareil seulement.";
  majSynchro(null);
  router();
}

async function seConnecter() {
  const fournisseur = new GoogleAuthProvider();
  $("connexion-erreur").hidden = true;
  try {
    await signInWithPopup(auth, fournisseur);
  } catch (err) {
    // Si la fenêtre de connexion est bloquée, on passe par une redirection
    if (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment") {
      signInWithRedirect(auth, fournisseur);
    } else if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request") {
      $("connexion-erreur").textContent = "Connexion impossible : " + err.message;
      $("connexion-erreur").hidden = false;
    }
  }
}

// Indicateur de synchro : synchronisé / en attente / hors ligne
let metaSynchro = null;
function majSynchro(meta) {
  if (meta !== undefined) metaSynchro = meta;
  let etatSynchro = "ok", ic = "cloud-check", texte = "Synchronisé";
  if (!navigator.onLine) { etatSynchro = "off"; ic = "cloud-off"; texte = "Hors ligne : les changements seront envoyés au retour du réseau"; }
  else if (metaSynchro && metaSynchro.hasPendingWrites) { etatSynchro = "attente"; ic = "cloud-up"; texte = "En attente d'envoi"; }
  if (MODE_DEMO) { etatSynchro = "off"; ic = "cloud-off"; texte = "Mode démo : pas de synchro"; }
  document.querySelectorAll(".synchro").forEach(el => {
    el.className = "synchro " + etatSynchro;
    el.title = texte;
    el.querySelector("use").setAttribute("href", PLANCHE + ic);
  });
}
window.addEventListener("online", () => majSynchro());
window.addEventListener("offline", () => majSynchro());

// ---------- 3. Navigation ----------
// Chaque écran a son adresse (#prep, #liste=..., #reglages) : ainsi le bouton
// « retour » du téléphone ramène à l'écran précédent, comme dans une vraie appli.

let ecranActuel = "";
let aNavigue = false; // a-t-on changé d'écran depuis l'ouverture ?

function aller(adresse) { aNavigue = true; location.hash = adresse; }
function retour() { if (aNavigue) history.back(); else location.replace("#"); }

function montrer(nom) {
  document.querySelectorAll(".ecran").forEach(e => { e.hidden = e.id !== "ecran-" + nom; });
  if (ecranActuel !== nom) window.scrollTo(0, 0);
  ecranActuel = nom;
}

function router() {
  if (!MODE_DEMO && !refDoc) return; // pas encore connecté
  const h = location.hash.slice(1);
  if (h === "prep") { afficherChecklist(); montrer("checklist"); }
  else if (h.startsWith("liste=")) {
    const l = etat.listes.find(x => x.id === h.slice(6));
    if (!l) { location.replace("#"); return; }
    afficherEditionListe(l); montrer("liste");
  }
  else if (h === "reglages") { afficherReglages(); montrer("reglages"); }
  else { afficherAccueil(); montrer("accueil"); }
}
// En changeant d'écran, on referme une éventuelle grille d'icônes
window.addEventListener("hashchange", () => { grilleOuverte = null; router(); });

// ---------- 4. Affichage ----------

// Fabrique une icône : <svg><use href="icones/tabler.svg#nom"></svg>
function icone(nom, classe = "") {
  return `<svg class="ic ${classe}"><use href="${PLANCHE}${nom}"></use></svg>`;
}
// Case à cocher carrée (la coche n'apparaît que si la ligne a la classe « coche »)
const caseACocher = () => `<span class="case">${icone("check")}</span>`;
// Protège le texte tapé par l'utilisateur avant de l'afficher (évite qu'un « < » casse la page)
function echapper(t) {
  return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Grille de choix d'icône. Une seule ouverte à la fois ; « grilleOuverte » dit pour qui :
// "liste" (la liste en cours), "objet:ID" ou "sac:ID" (« sac:poches » pour les poches).
let grilleOuverte = null;
function grilleIcones(choisie) {
  return `<div class="grille-icones">${ICONES_CHOIX.map(n =>
    `<button type="button" data-icone-choix="${n}" class="${n === choisie ? "choisie" : ""}" aria-label="${n}">${icone(n)}</button>`
  ).join("")}</div>`;
}

// Range des objets par contenant, dans l'ordre : Poches, puis les sacs, puis « Sans sac »
function grouperParContenant(objets) {
  const ids = contenants().map(c => c.id);
  return [...contenants(), SANS_SAC].map(c => ({
    ...c, objets: objets.filter(o => c.id === "?" ? !ids.includes(o.sac) : o.sac === c.id)
  })).filter(g => g.objets.length);
}

// Bandeau coloré d'un contenant, avec un compteur à droite
function bandeau(g, compteur) {
  return `<h2 class="titre-section coul-${g.couleur}">${icone(iconeContenant(g))}<span class="nom">${echapper(g.nom)}</span><span>${compteur}</span></h2>`;
}

// --- Écran 1 : accueil ---
function afficherAccueil() {
  const filtre = cle($("champ-recherche").value || "");
  $("recherche-listes").hidden = etat.listes.length <= 6; // la recherche n'apparaît que si la liste devient longue
  const listes = etat.listes.filter(l => !filtre || cle(l.nom).includes(filtre));

  $("liste-listes").innerHTML = listes.length ? listes.map(l => {
    const choisie = etat.selection.includes(l.id);
    return `<li class="ligne ligne-cliquable ${choisie ? "coche" : ""}" data-choisir="${l.id}">
      ${caseACocher()}${icone(iconeListe(l))}
      <span class="nom">${echapper(l.nom)}</span>
      <span class="nb">${String(l.objets.length).padStart(2, "0")}</span>
      <button class="btn-icone" data-modifier="${l.id}" aria-label="Modifier ${echapper(l.nom)}">${icone("pencil")}</button>
    </li>`;
  }).join("") : `<li class="vide">${etat.listes.length ? "Aucune liste trouvée." : "Crée ta première liste, par exemple « Travail » ou « Piscine »."}</li>`;

  const n = etat.selection.filter(id => etat.listes.some(l => l.id === id)).length;
  const btn = $("btn-preparer");
  btn.disabled = n === 0;
  btn.innerHTML = n === 0 ? "Coche où tu vas" : `Préparer <span>[${n}]</span>${icone("arrow-right")}`;
}

// --- Écran 2 : checklist fusionnée ---
// Rassemble les objets des listes cochées. Si un objet est dans plusieurs listes,
// il n'apparaît qu'une fois : son contenant et son icône viennent de la première
// liste cochée, et on garde la plus grande quantité.
function fusionner() {
  const parCle = new Map();
  for (const id of etat.selection) {
    const l = etat.listes.find(x => x.id === id);
    if (!l) continue;
    for (const o of l.objets) {
      const k = cle(o.nom);
      const deja = parCle.get(k);
      if (deja) deja.qte = Math.max(deja.qte || 1, o.qte || 1);
      else parCle.set(k, { cle: k, nom: o.nom, qte: o.qte || 1, sac: o.sac, icone: iconeObjet(o) });
    }
  }
  return [...parCle.values()];
}

function afficherChecklist() {
  const listes = etat.selection.map(id => etat.listes.find(l => l.id === id)).filter(Boolean);
  $("pastilles").innerHTML = listes.map(l => `<span class="pastille">${icone(iconeListe(l))}${echapper(l.nom)}</span>`).join("");

  const objets = fusionner();
  const estPris = o => etat.coches.includes(o.cle);
  const pris = objets.filter(estPris).length;
  $("compteur").textContent = `${pris}/${objets.length}`;
  $("progression").style.width = objets.length ? `${Math.round(pris / objets.length * 100)}%` : "0";

  $("checklist").innerHTML = grouperParContenant(objets).map(g =>
    bandeau(g, `${g.objets.filter(estPris).length}/${g.objets.length}`) +
    g.objets.map(o => `<button class="objet ${estPris(o) ? "coche" : ""}" data-cocher="${echapper(o.cle)}">
        ${caseACocher()}${icone(o.icone)}
        <span class="nom">${echapper(o.nom)}${o.qte > 1 ? ` <span class="qte">×${o.qte}</span>` : ""}</span>
      </button>`).join("")
  ).join("")
    + (objets.length === 0 ? `<p class="vide">Ces listes sont vides. Ajoute des objets avec le crayon sur l'accueil.</p>` : "")
    + (objets.length > 0 && pris === objets.length ? `<p class="bravo">Tout est prêt — bonne route</p>` : "");
}

// --- Écran 3 : modifier une liste ---
let listeEnCours = null;

function optionsContenants(choisi) {
  const opts = contenants().map(c => `<option value="${c.id}" ${c.id === choisi ? "selected" : ""}>${echapper(c.nom)}</option>`);
  // Objet dont le sac a été supprimé : on l'indique au lieu de le changer en douce
  if (choisi && !contenants().some(c => c.id === choisi)) opts.push(`<option value="${echapper(choisi)}" selected>Sans sac</option>`);
  return opts.join("");
}

function afficherEditionListe(l) {
  listeEnCours = l;
  // Ne pas réécrire le nom pendant que je suis en train de le taper
  if (document.activeElement !== $("nom-liste")) $("nom-liste").value = l.nom;
  const bouton = $("icone-liste");
  bouton.dataset.ouvrir = "liste";
  bouton.innerHTML = icone(iconeListe(l));
  bouton.classList.toggle("ouvert", grilleOuverte === "liste");
  $("grille-liste").innerHTML = grilleOuverte === "liste" ? grilleIcones(iconeListe(l)) : "";

  $("objets-liste").innerHTML = grouperParContenant(l.objets).map(g =>
    bandeau(g, String(g.objets.length).padStart(2, "0")) +
    g.objets.map(o => {
      const ouvert = grilleOuverte === "objet:" + o.id;
      return `<div class="objet-edit" data-objet="${o.id}">
        <button type="button" class="choix-icone ${ouvert ? "ouvert" : ""}" data-ouvrir="objet:${o.id}" aria-label="Changer l'icône">${icone(iconeObjet(o))}</button>
        <input class="e-nom" value="${echapper(o.nom)}" aria-label="Nom de l'objet">
        <select class="e-sac" aria-label="Contenant">${optionsContenants(o.sac)}</select>
        <input class="e-qte" type="number" min="1" max="99" value="${o.qte > 1 ? o.qte : ""}" placeholder="1" aria-label="Quantité">
        <button class="btn-icone" data-suppr-objet="${o.id}" aria-label="Supprimer">${icone("x")}</button>
      </div>${ouvert ? grilleIcones(iconeObjet(o)) : ""}`;
    }).join("")
  ).join("") || `<p class="vide">Liste vide. Ajoute ton premier objet en bas.</p>`;

  // Menu du formulaire d'ajout (garde le dernier contenant choisi)
  const sel = $("objet-sac");
  const garde = sel.value || "poches";
  sel.innerHTML = optionsContenants(contenants().some(c => c.id === garde) ? garde : "poches");
}

// --- Écran 4 : réglages ---
function afficherReglages() {
  $("version").textContent = VERSION;
  $("nb-contenants").textContent = String(contenants().length).padStart(2, "0");
  $("liste-sacs").innerHTML = contenants().map((c, i) => {
    const ouvert = grilleOuverte === "sac:" + c.id;
    const j = i - 1; // position dans etat.sacs (Poches n'en fait pas partie)
    const commandes = c.id === "poches"
      ? `<span class="nom">Poches</span><span class="nb">FIXE</span>`
      : `<input class="s-nom" value="${echapper(c.nom)}" aria-label="Nom du sac">
         <button class="btn-icone" data-monter="${j}" aria-label="Monter" ${j === 0 ? "disabled" : ""}>${icone("chevron-up")}</button>
         <button class="btn-icone" data-descendre="${j}" aria-label="Descendre" ${j === etat.sacs.length - 1 ? "disabled" : ""}>${icone("chevron-down")}</button>
         <button class="btn-icone" data-suppr-sac="${c.id}" aria-label="Supprimer">${icone("trash")}</button>`;
    return `<div class="contenant" data-sac="${c.id}">
      <div class="ligne">
        <button type="button" class="choix-icone ${ouvert ? "ouvert" : ""}" data-ouvrir="sac:${c.id}" aria-label="Changer l'icône">${icone(iconeContenant(c))}</button>
        ${commandes}
      </div>
      <div class="nuancier">${COULEURS.map(k =>
        `<button type="button" class="coul-${k} ${k === c.couleur ? "choisie" : ""}" data-couleur="${k}" aria-label="Couleur ${k}"></button>`).join("")}</div>
      ${ouvert ? grilleIcones(iconeContenant(c)) : ""}
    </div>`;
  }).join("");
}

// ---------- 5. Actions ----------

// Message en bas de l'écran pendant 5 secondes, avec un bouton « Annuler » optionnel
let minuteurToast = null;
let actionAnnuler = null;
function afficherToast(texte, annuler) {
  $("toast-texte").textContent = texte;
  $("toast-annuler").hidden = !annuler;
  actionAnnuler = annuler;
  $("toast").hidden = false;
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => { $("toast").hidden = true; actionAnnuler = null; }, 5000);
}
$("toast-annuler").addEventListener("click", () => {
  if (actionAnnuler) actionAnnuler();
  $("toast").hidden = true;
});

// Supprime quelque chose en gardant une photo de l'état d'avant,
// pour pouvoir tout remettre si j'appuie sur « Annuler ».
function supprimerAvecAnnulation(texte, action) {
  const avant = structuredClone(etat);
  action();
  sauver();
  router();
  afficherToast(texte, () => { etat = avant; sauver(); router(); });
}

// Première couleur pas encore prise par un contenant (pour un nouveau sac)
const couleurLibre = () => COULEURS.find(k => !contenants().some(c => c.couleur === k)) || "gris";

// Boutons « Retour » et « Réglages »
document.querySelectorAll("[data-aller]").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.aller === "accueil") retour(); else aller(b.dataset.aller);
}));

$("btn-connexion").addEventListener("click", seConnecter);
$("btn-deconnexion").addEventListener("click", () => {
  if (MODE_DEMO) return;
  if (confirm("Se déconnecter ? Tes données restent en sécurité dans ton compte.")) signOut(auth).then(() => location.reload());
});

// --- Choix d'icône (valable sur tous les écrans) ---
document.addEventListener("click", e => {
  const ouvrir = e.target.closest("[data-ouvrir]");
  if (ouvrir) {
    // Toucher l'icône ouvre la grille ; la toucher à nouveau la referme
    grilleOuverte = grilleOuverte === ouvrir.dataset.ouvrir ? null : ouvrir.dataset.ouvrir;
    router();
    return;
  }
  const choix = e.target.closest("[data-icone-choix]");
  if (!choix || !grilleOuverte) return;
  const nom = choix.dataset.iconeChoix;
  const [type, id] = grilleOuverte.split(":");
  if (type === "liste" && listeEnCours) listeEnCours.icone = nom;
  if (type === "objet" && listeEnCours) {
    const o = listeEnCours.objets.find(x => x.id === id);
    if (o) o.icone = nom;
  }
  if (type === "sac") {
    if (id === "poches") etat.poches.icone = nom;
    else { const s = etat.sacs.find(x => x.id === id); if (s) s.icone = nom; }
  }
  grilleOuverte = null;
  sauver();
  router();
});

// --- Accueil ---
$("liste-listes").addEventListener("click", e => {
  const modif = e.target.closest("[data-modifier]");
  if (modif) { aller("liste=" + modif.dataset.modifier); return; }
  const ligne = e.target.closest("[data-choisir]");
  if (!ligne) return;
  const id = ligne.dataset.choisir;
  // On garde l'ordre dans lequel les listes sont cochées (la première a priorité)
  etat.selection = etat.selection.includes(id) ? etat.selection.filter(x => x !== id) : [...etat.selection, id];
  sauver();
  afficherAccueil();
});
$("champ-recherche").addEventListener("input", afficherAccueil);
$("btn-preparer").addEventListener("click", () => aller("prep"));
$("btn-nouvelle-liste").addEventListener("click", () => {
  const l = { id: nouvelId(), nom: "Nouvelle liste", objets: [] };
  etat.listes.push(l);
  sauver();
  aller("liste=" + l.id);
  // Nom pré-sélectionné : il suffit de taper pour le remplacer
  setTimeout(() => { $("nom-liste").focus(); $("nom-liste").select(); }, 50);
});

// --- Checklist ---
$("checklist").addEventListener("click", e => {
  const b = e.target.closest("[data-cocher]");
  if (!b) return;
  const k = b.dataset.cocher;
  etat.coches = etat.coches.includes(k) ? etat.coches.filter(x => x !== k) : [...etat.coches, k];
  sauver();
  afficherChecklist();
});
$("btn-tout-decocher").addEventListener("click", () => {
  if (!etat.coches.length) return;
  supprimerAvecAnnulation("Tout est décoché", () => { etat.coches = []; });
});

// --- Modifier une liste ---
$("nom-liste").addEventListener("change", () => {
  const nom = $("nom-liste").value.trim();
  if (!listeEnCours) return;
  if (!nom) { $("nom-liste").value = listeEnCours.nom; return; }
  listeEnCours.nom = nom;
  sauver();
  afficherEditionListe(listeEnCours); // l'icône devinée peut changer avec le nom
});
$("btn-suppr-liste").addEventListener("click", () => {
  const l = listeEnCours;
  if (!l) return;
  supprimerAvecAnnulation(`Liste « ${l.nom} » supprimée`, () => {
    etat.listes = etat.listes.filter(x => x.id !== l.id);
    etat.selection = etat.selection.filter(x => x !== l.id);
  });
  retour();
});
$("form-objet").addEventListener("submit", e => {
  e.preventDefault();
  const nom = $("objet-nom").value.trim();
  if (!nom || !listeEnCours) return;
  if (listeEnCours.objets.some(o => cle(o.nom) === cle(nom))) {
    afficherToast(`« ${nom} » est déjà dans cette liste`, null);
    return;
  }
  const qte = parseInt($("objet-qte").value, 10);
  // Pas d'icône enregistrée : elle sera devinée d'après le nom
  listeEnCours.objets.push({ id: nouvelId(), nom, qte: qte > 1 ? qte : 1, sac: $("objet-sac").value });
  sauver();
  $("objet-nom").value = "";
  $("objet-qte").value = "";
  afficherEditionListe(listeEnCours);
  $("objet-nom").focus(); // prêt pour taper l'objet suivant
});
// Modification d'un objet déjà dans la liste (nom, contenant, quantité)
$("objets-liste").addEventListener("change", e => {
  const ligne = e.target.closest("[data-objet]");
  if (!ligne || !listeEnCours) return;
  const o = listeEnCours.objets.find(x => x.id === ligne.dataset.objet);
  if (!o) return;
  const nom = ligne.querySelector(".e-nom").value.trim();
  if (nom) o.nom = nom;
  o.sac = ligne.querySelector(".e-sac").value;
  const qte = parseInt(ligne.querySelector(".e-qte").value, 10);
  o.qte = qte > 1 ? qte : 1;
  sauver();
  // Contenant changé : l'objet change de section. Nom changé : l'icône devinée peut changer.
  if (!e.target.classList.contains("e-qte")) afficherEditionListe(listeEnCours);
});
$("objets-liste").addEventListener("click", e => {
  const b = e.target.closest("[data-suppr-objet]");
  if (!b || !listeEnCours) return;
  const l = listeEnCours;
  const o = l.objets.find(x => x.id === b.dataset.supprObjet);
  supprimerAvecAnnulation(`« ${o.nom} » supprimé`, () => {
    l.objets = l.objets.filter(x => x.id !== o.id);
  });
});

// --- Réglages : contenants ---
$("form-sac").addEventListener("submit", e => {
  e.preventDefault();
  const nom = $("sac-nom").value.trim();
  if (!nom) return;
  etat.sacs.push({ id: nouvelId(), nom, couleur: couleurLibre() });
  sauver();
  $("sac-nom").value = "";
  afficherReglages();
});
$("liste-sacs").addEventListener("change", e => {
  const bloc = e.target.closest("[data-sac]");
  const s = bloc && etat.sacs.find(x => x.id === bloc.dataset.sac);
  if (!s) return;
  const nom = e.target.value.trim();
  if (nom) { s.nom = nom; sauver(); afficherReglages(); } else e.target.value = s.nom;
});
$("liste-sacs").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const bloc = b.closest("[data-sac]");
  if (b.dataset.couleur && bloc) {
    if (bloc.dataset.sac === "poches") etat.poches.couleur = b.dataset.couleur;
    else { const s = etat.sacs.find(x => x.id === bloc.dataset.sac); if (s) s.couleur = b.dataset.couleur; }
    sauver();
    afficherReglages();
    return;
  }
  const echanger = (i, j) => { [etat.sacs[i], etat.sacs[j]] = [etat.sacs[j], etat.sacs[i]]; sauver(); afficherReglages(); };
  if (b.dataset.monter) echanger(+b.dataset.monter, +b.dataset.monter - 1);
  else if (b.dataset.descendre) echanger(+b.dataset.descendre, +b.dataset.descendre + 1);
  else if (b.dataset.supprSac) {
    const s = etat.sacs.find(x => x.id === b.dataset.supprSac);
    supprimerAvecAnnulation(`Sac « ${s.nom} » supprimé`, () => {
      etat.sacs = etat.sacs.filter(x => x.id !== s.id);
    });
  }
});

// ---------- 6. Export / import Excel ----------
// Fichier : feuille « Listes » (une ligne par objet), feuille « Endroits » (icône de
// chaque liste) et feuille « Sacs » (contenants, couleur, icône).
// Colonne « Icône » vide = icône devinée automatiquement d'après le nom.

$("btn-export").addEventListener("click", async () => {
  try {
    const ExcelJS = await chargerExcelJS();
    const classeur = new ExcelJS.Workbook();
    classeur.creator = "Stuff to go";
    const lignes = [];
    etat.listes.forEach(l => {
      // Objets rangés par contenant pour que le fichier soit lisible
      const ordre = contenants().map(c => c.id);
      const rang = sac => { const i = ordre.indexOf(sac); return i < 0 ? 999 : i; }; // « Sans sac » à la fin
      [...l.objets]
        .sort((a, b) => rang(a.sac) - rang(b.sac))
        .forEach(o => lignes.push({ liste: l.nom, contenant: nomContenant(o.sac), objet: o.nom, qte: o.qte || 1, icone: o.icone || "" }));
      if (!l.objets.length) lignes.push({ liste: l.nom, contenant: "", objet: "", qte: "", icone: "" }); // garde les listes vides
    });
    ajouterFeuille(classeur, "Listes", [
      { header: "Liste", key: "liste", width: 22 },
      { header: "Contenant", key: "contenant", width: 18 },
      { header: "Objet", key: "objet", width: 30 },
      { header: "Quantité", key: "qte", width: 11 },
      { header: "Icône", key: "icone", width: 16 }
    ], lignes);
    ajouterFeuille(classeur, "Endroits", [
      { header: "Liste", key: "liste", width: 26 },
      { header: "Icône", key: "icone", width: 16 }
    ], etat.listes.map(l => ({ liste: l.nom, icone: l.icone || "" })));
    ajouterFeuille(classeur, "Sacs", [
      { header: "Ordre", key: "ordre", width: 8 },
      { header: "Sac", key: "sac", width: 24 },
      { header: "Couleur", key: "couleur", width: 12 },
      { header: "Icône", key: "icone", width: 16 }
    ], contenants().map((c, i) => ({ ordre: i, sac: c.nom, couleur: c.couleur, icone: c.icone || "" })));
    await telechargerClasseur(classeur, NOM_APPLI);
  } catch (err) {
    afficherToast("Export impossible : " + err.message, null);
  }
});

$("btn-import").addEventListener("click", () => $("fichier-import").click());
$("fichier-import").addEventListener("change", async e => {
  const fichier = e.target.files[0];
  e.target.value = ""; // pour pouvoir réimporter le même fichier plus tard
  if (!fichier) return;
  if (!confirm("Remplacer toutes tes listes et tes sacs par le contenu de ce fichier ?")) return;
  try {
    const classeur = await lireClasseur(fichier);
    const lignesListes = lireFeuille(classeur.getWorksheet("Listes"));
    const lignesSacs = lireFeuille(classeur.getWorksheet("Sacs"));
    const lignesEndroits = lireFeuille(classeur.getWorksheet("Endroits"));
    if (!lignesListes.length) throw new Error("feuille « Listes » introuvable ou vide");

    // On n'accepte que des couleurs et icônes connues (un fichier modifié à la main
    // pourrait contenir n'importe quoi). Inconnue = on laisse l'appli décider.
    const avecIcone = (obj, nom) => { if (ICONES_CHOIX.includes(nom)) obj.icone = nom; return obj; };
    const couleurValide = k => COULEURS.includes(k) ? k : null;

    // Les contenants : on réutilise les identifiants existants quand le nom correspond
    const poches = { couleur: "jaune" };
    const sacs = [];
    const trouverSac = nom => {
      if (!nom || cle(nom) === "poches") return "poches";
      let s = sacs.find(x => cle(x.nom) === cle(nom));
      if (!s) {
        const ancien = etat.sacs.find(x => cle(x.nom) === cle(nom));
        const prises = [poches.couleur, ...sacs.map(x => x.couleur)];
        s = { id: ancien ? ancien.id : nouvelId(), nom, couleur: COULEURS.find(k => !prises.includes(k)) || "gris" };
        sacs.push(s);
      }
      return s.id;
    };
    lignesSacs.forEach(l => {
      const id = trouverSac(l["Sac"]);
      const cible = id === "poches" ? poches : sacs.find(x => x.id === id);
      if (couleurValide(l["Couleur"])) cible.couleur = l["Couleur"];
      avecIcone(cible, l["Icône"]);
    });

    const listes = [];
    const trouverListe = nomListe => {
      let liste = listes.find(x => x.nom === nomListe);
      if (!liste) {
        const ancienne = etat.listes.find(x => x.nom === nomListe);
        liste = { id: ancienne ? ancienne.id : nouvelId(), nom: nomListe, objets: [] };
        listes.push(liste);
      }
      return liste;
    };
    lignesEndroits.forEach(l => { if (l["Liste"]) avecIcone(trouverListe(l["Liste"]), l["Icône"]); });
    lignesListes.forEach(l => {
      if (!l["Liste"]) return;
      const liste = trouverListe(l["Liste"]);
      if (l["Objet"] && !liste.objets.some(o => cle(o.nom) === cle(l["Objet"]))) {
        const qte = parseInt(l["Quantité"], 10);
        liste.objets.push(avecIcone({ id: nouvelId(), nom: l["Objet"], qte: qte > 1 ? qte : 1, sac: trouverSac(l["Contenant"]) }, l["Icône"]));
      }
    });

    supprimerAvecAnnulation(`Import terminé : ${listes.length} liste(s)`, () => {
      etat.poches = poches;
      etat.sacs = sacs;
      etat.listes = listes;
      etat.selection = etat.selection.filter(id => listes.some(l => l.id === id));
    });
  } catch (err) {
    afficherToast("Import impossible : " + err.message, null);
  }
});

// ---------- 7. Démarrage ----------

// Service worker : permet d'ouvrir l'appli sans réseau et de l'installer
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js");
}

$("version").textContent = VERSION;
if (MODE_DEMO) demarrerDemo(); else demarrerFirebase();
