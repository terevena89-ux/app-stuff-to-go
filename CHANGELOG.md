# Journal des nouveautés — Stuff to go

## v0.5 — 2026-11-05
- Mode « ranger » : bouton (flèches haut/bas) dans le bandeau de chaque écran. Les poignées n'apparaissent qu'en mode ranger ; le bouton devient « OK » pour sortir, et le mode se coupe en changeant d'écran.
- Ranger aussi dans « Prêt à partir » : ordre et sac des objets juste pour cette sortie (effacés par « Tout décocher ») ; cases et croix cachées pendant qu'on range.
- Accueil épuré : plus de compteur d'objets ni de recherche ; le crayon n'apparaît qu'en mode ranger.

## v0.4 — 2026-11-05
- Pendant la préparation : une croix sur chaque objet le retire juste pour cette sortie (la liste d'origine ne change pas, « Annuler » possible).
- « Ajouter pour cette sortie » : ajoute un objet en plus (avec suggestions), marqué « Cette fois ». Case « Garder aussi dans la liste » pour l'ajouter pour de bon à une des listes cochées.
- « Tout décocher » remet toute la préparation à zéro (coches, ajouts et retraits).
- Bandeau du haut coloré selon l'écran : accueil jaune, checklist bleu, modifier vert, réglages gris.

## v0.3.2 — 2026-11-05
- Correction : le glisser pour réordonner restait bloqué après une case (le navigateur « perdait » le doigt quand la ligne bougeait). Le doigt est maintenant suivi sur toute la page.

## v0.3.1 — 2026-11-05
- Correction : l'appli installée sur le téléphone pouvait garder l'ancienne version (GitHub laisse les fichiers 10 min en mémoire). Le gardien revérifie maintenant toujours auprès du serveur.
- Mise à jour automatique : vérification à chaque retour sur l'appli, et rechargement tout seul quand une nouvelle version arrive.

## v0.3 — 2026-11-05
- « Nouvelle liste » propose : partir de zéro, ou copier une liste existante (« Concert (copie) »).
- Suggestions en tapant un objet : l'appli propose ceux de tes autres listes ; en choisir un reprend son contenant et son icône.
- Glisser pour réordonner, avec la poignée (les petits points) : les listes sur l'accueil, les objets dans Modifier (glisser un objet sous un autre bandeau change son contenant), les sacs dans Réglages (remplace les flèches).
- Ligne d'objet plus compacte dans Modifier.

## v0.2 — 2026-11-05
Nouveau style « brut ».
- Angles droits, traits épais, ombres décalées sur les boutons.
- Police mixte : Space Grotesk pour les textes, JetBrains Mono pour les chiffres et les titres (copiées dans l'appli, marchent hors ligne).
- Une couleur par contenant (8 au choix dans Réglages), en bandeau dans la checklist ; atténuées en thème sombre.
- Barre de progression et compteur par contenant (ex. 2/6).
- Icônes partout (listes, contenants, objets), choisies dans une grille ; sans choix, l'appli devine d'après le nom (gourde → bouteille).
- Excel : nouvelles colonnes Icône et Couleur, nouvelle feuille « Endroits ». Les fichiers de la v0.1 restent importables.

## v0.1 — 2026-11-05
Première version.
- Listes par endroit (Travail, Sport, Piscine...), à combiner : on coche où on va, puis « Préparer ».
- Checklist rangée par contenant : « Poches » d'abord, puis chaque sac.
- Un objet présent dans plusieurs listes n'apparaît qu'une fois (contenant de la première liste cochée, plus grande quantité).
- Quantité optionnelle (« T-shirt ×2 »).
- Objets pris grisés et barrés ; bouton « Tout décocher ».
- Mes sacs gérés dans Réglages (ajouter, renommer, réordonner, supprimer).
- Synchro téléphone / PC avec Firebase (compte Google), fonctionne hors ligne.
- Export / import Excel.
- « Annuler » après chaque suppression.
- Thème clair / sombre automatique, installable sur Android (PWA).
