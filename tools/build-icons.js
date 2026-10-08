/* ==========================================================================
   PETROGEST · Générateur de sprite d'icônes
   --------------------------------------------------------------------------
   Le jeu Remix Icon compte 3 229 fichiers. On n'en embarque que ceux dont
   l'application se sert : ce script en fabrique un sprite unique, inliné
   une fois dans la page, sans aucune requête réseau supplémentaire.

   Pour ajouter une icône : ajoutez une ligne dans ICONES ci-dessous, puis

       node tools/build-icons.js

   Le sprite est réécrit dans assets/icons.svg.
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
const SOURCE = path.join(RACINE, "assets", "icons");
const SORTIE = path.join(RACINE, "assets", "icons.svg");

/* nom dans le design system  →  chemin Remix (sans .svg) */
const ICONES = {
  "i-dashboard": "System/dashboard-line",
  "i-station":   "Map/gas-station-line",
  "i-file":      "Document/file-list-3-line",
  "i-truck":     "Map/truck-line",
  "i-users":     "User & Faces/group-line",
  "i-paperclip": "Business/attachment-line",
  "i-book":      "Document/book-2-line",
  "i-chart":     "Business/line-chart-line",
  "i-alert":     "System/alert-line",
  "i-message":   "Communication/message-3-line",
  "i-settings":  "System/settings-3-line",
  "i-history":   "System/history-line",
  "i-more":      "System/more-2-fill",
  "i-plus":      "System/add-line",
  "i-x":         "System/close-line",
  "i-check":     "System/check-line",
  "i-download":  "System/download-2-line",
  "i-search":    "System/search-line",
  "i-left":      "Arrows/arrow-left-line",
  "i-right":     "Arrows/arrow-right-line",
  "i-up":        "Arrows/arrow-up-s-line",
  "i-down":      "Arrows/arrow-down-s-line",
  "i-sort":      "Arrows/arrow-up-down-line",
  "i-panel":     "System/menu-line",
  "i-mail":      "Business/mail-line",
  "i-help":      "System/question-line",
  "i-logout":    "System/logout-box-r-line",
  "i-trash":     "System/delete-bin-line",
  "i-edit":      "Design/edit-box-line",
  "i-inbox":     "Business/inbox-line",
  "i-upload":    "System/upload-cloud-2-line",
  "i-filter":    "System/filter-3-line",
  "i-calendar":  "Business/calendar-line",
  "i-external":  "System/external-link-line"
};

const symboles = [];
const manquantes = [];

for (const [nom, chemin] of Object.entries(ICONES)) {
  const fichier = path.join(SOURCE, chemin + ".svg");
  if (!fs.existsSync(fichier)) { manquantes.push(nom + " → " + chemin); continue; }

  const brut = fs.readFileSync(fichier, "utf8");
  const corps = brut.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").trim();

  // Remix Icon dessine en fill="currentColor" ; les attributs de couleur des
  // <path> sont retires pour que l'icone herite du texte qui la porte.
  const nettoye = corps.replace(/\s(fill|stroke)="[^"]*"/g, "");

  symboles.push('  <symbol id="' + nom + '" viewBox="0 0 24 24">' + nettoye + "</symbol>");
}

const sprite =
  "<!-- Genere par tools/build-icons.js — ne pas modifier a la main.\n" +
  "     Source : Remix Icon (Apache 2.0). " + symboles.length + " icones. -->\n" +
  '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">\n' +
  symboles.join("\n") +
  "\n</svg>\n";

fs.writeFileSync(SORTIE, sprite);

console.log("Sprite ecrit : assets/icons.svg");
console.log("  " + symboles.length + " icones · " + Math.round(sprite.length / 1024) + " Ko");
if (manquantes.length) {
  console.log("  INTROUVABLES :");
  manquantes.forEach(function (m) { console.log("    " + m); });
}
