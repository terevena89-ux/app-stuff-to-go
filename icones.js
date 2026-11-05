// =========================================================
// Icônes et couleurs : ce qu'on peut choisir, et la « devinette »
// qui propose une icône d'après le nom (gourde → bouteille...).
// Les dessins eux-mêmes sont dans icones/tabler.svg.
// =========================================================

// Les 8 couleurs possibles pour un contenant (définies dans style.css : .coul-jaune, etc.)
export const COULEURS = ["jaune", "bleu", "vert", "corail", "rose", "violet", "turquoise", "gris"];

// Toutes les icônes proposées dans la grille de choix, rangées par thème
export const ICONES_CHOIX = [
  // affaires du quotidien
  "key", "wallet", "device-mobile", "headphones", "id", "id-badge-2", "credit-card", "cash",
  "device-laptop", "plug", "battery-charging", "charging-pile", "device-watch", "keyboard", "camera", "notebook",
  "book", "file-text", "receipt", "ticket", "lock", "paperclip", "scissors", "cards",
  // vêtements
  "shirt", "jacket", "hanger", "shoe", "sock", "sunglasses", "eyeglass", "umbrella",
  // toilette et santé
  "bath", "dental", "brush", "droplet", "toilet-paper", "diaper", "pill", "bandage",
  "first-aid-kit", "mask", "ear", "bucket-droplet",
  // manger et boire
  "bottle", "cup", "glass", "glass-full", "cookie", "apple",
  // dehors
  "tent", "bed", "sun", "moon", "bolt", "flame", "map", "map-pin",
  // contenants
  "hand-grab", "backpack", "briefcase", "luggage", "shirt-sport", "shopping-bag", "basket", "box",
  // endroits et activités
  "home", "building", "school", "barbell", "run", "walk", "bike", "swimming",
  "beach", "mountain", "trees", "plane", "car", "music", "confetti", "speakerphone",
  "heart", "gift", "calendar", "baby-carriage", "dog", "paw", "point"
];

// Met un texte en minuscules et sans accents, pour comparer facilement
export const simplifier = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Règles de devinette : [mots-clés séparés par |, icône].
// L'ORDRE COMPTE : les règles les plus précises d'abord
// (« lunettes de soleil » avant « lunettes », « chargeur » avant « téléphone »...).
const REGLES_OBJETS = [
  ["big 4| cle", "key"],
  ["portefeuille|porte-monnaie", "wallet"],
  ["chargeur|cable|adaptateur|prise", "plug"],
  ["batterie", "battery-charging"],
  ["ecouteur|casque audio", "headphones"],
  ["telephone|portable|smartphone", "device-mobile"],
  ["ordi|laptop| pc ", "device-laptop"],
  ["lunettes de soleil", "sunglasses"],
  ["lunettes de protection", "eyeglass"],
  ["lunette", "eyeglass"],
  ["creme solaire", "sun"],
  ["carte d'identite|identite|passeport|permis|carte vitale", "id"],
  ["badge|carte de la salle|carte d'adherent", "id-badge-2"],
  ["carte bancaire|carte bleue| cb ", "credit-card"],
  ["liquide|argent|espece|monnaie", "cash"],
  ["billet|ticket|bracelet|reservation", "ticket"],
  ["trousse de secours|secours", "first-aid-kit"],
  ["pansement", "bandage"],
  ["medicament|pilule|doliprane", "pill"],
  ["brosse a dent|dentifrice|fil dentaire", "dental"],
  ["gel douche|savon|shampo|serviette", "bath"],
  ["deodorant|parfum|serum|lingette|creme", "droplet"],
  ["papier toilette|mouchoir", "toilet-paper"],
  ["couche", "diaper"],
  ["peigne|brosse", "brush"],
  ["bouchon|boule quies", "ear"],
  ["masque|foulard", "mask"],
  ["bouteille a apporter| vin |biere", "glass"],
  ["gourde|bouteille|'eau | eau ", "bottle"],
  ["gobelet|tasse|thermos", "cup"],
  ["encas|gateau|biscuit|chewing|barre", "cookie"],
  ["fruit|pomme|banane", "apple"],
  ["dejeuner|repas|sandwich|gamelle", "basket"],
  ["chaussette", "sock"],
  ["chaussure|basket|tong|sandale", "shoe"],
  ["t-shirt|tshirt|chemise|maillot|debardeur", "shirt"],
  ["pull|veste|k-way|kway|poncho|manteau|blouson|sweat", "jacket"],
  ["pantalon|short|legging|jupe|robe|sous-vetement|culotte|caleçon|pyjama|vetement", "hanger"],
  ["parapluie", "umbrella"],
  ["tente", "tent"],
  ["duvet|sac de couchage|tapis|oreiller", "bed"],
  ["lampe|frontale", "bolt"],
  ["briquet|allumette", "flame"],
  ["carnet|cahier|stylo|crayon", "notebook"],
  ["livre|roman| bd ", "book"],
  ["document|dossier|papier", "file-text"],
  ["cadenas|antivol", "lock"],
  ["ciseaux", "scissors"],
  ["montre", "device-watch"],
  ["clavier", "keyboard"],
  ["appareil photo|camera", "camera"],
  ["plan|carte", "map"],
  ["pancarte|megaphone", "speakerphone"],
  ["casquette|chapeau|bonnet", "sun"],
  ["jeu de carte|cartes", "cards"],
  ["cadeau", "gift"],
  ["chien|laisse", "dog"],
  ["lessive", "bucket-droplet"],
  ["velo", "bike"],
  ["cle de voiture|voiture", "car"]
];

const REGLES_LISTES = [
  ["travail|bureau|boulot|taf", "briefcase"],
  ["sport|salle|gym|muscu", "barbell"],
  ["week-end|weekend|nuit", "moon"],
  ["vacances|voyage|avion", "plane"],
  ["manif", "speakerphone"],
  ["soiree|fete|apero", "glass-full"],
  ["concert", "music"],
  ["festival", "confetti"],
  ["balade|rando|marche|promenade", "walk"],
  ["piscine|nage", "swimming"],
  ["plage| mer ", "beach"],
  ["ecole|cours|fac|etude", "school"],
  ["montagne|ski", "mountain"],
  ["velo", "bike"],
  ["course|running|footing", "run"],
  ["maison|famille", "home"],
  ["camping", "tent"],
  ["courses|marche|magasin", "shopping-bag"]
];

const REGLES_CONTENANTS = [
  ["poche", "hand-grab"],
  ["sac a dos", "backpack"],
  ["sport", "shirt-sport"],
  ["valise|bagage", "luggage"],
  ["trousse", "bath"],
  ["sacoche|mallette|cartable", "briefcase"],
  ["voiture|coffre", "car"],
  ["panier", "basket"],
  ["boite", "box"]
];

function deviner(nom, regles, parDefaut) {
  const t = " " + simplifier(nom) + " "; // espaces autour : permet de chercher un mot entier (" eau ")
  for (const [mots, icone] of regles) {
    if (mots.split("|").some(m => t.includes(m))) return icone;
  }
  return parDefaut;
}

// Icône d'un objet / d'une liste / d'un contenant : celle choisie, sinon la devinette
export const iconeObjet = o => o.icone || deviner(o.nom, REGLES_OBJETS, "point");
export const iconeListe = l => l.icone || deviner(l.nom, REGLES_LISTES, "map-pin");
export const iconeContenant = c => c.icone || deviner(c.nom, REGLES_CONTENANTS, "shopping-bag");
