/* ==========================================================================
   PETROGEST · Design System
   tools/build-css.js — Concatenation de la feuille de style
   --------------------------------------------------------------------------
   Usage :

       node tools/build-css.js

   Produit css/petrogest.build.css, a lier en production a la place de
   css/petrogest.css. Aucune dependance : Node seul, n'importe quelle version
   recente.

   POURQUOI
   Les @import ne se paralellisent pas. Le navigateur doit telecharger et
   lire chaque fichier pour decouvrir le suivant : vingt fichiers, c'est
   vingt allers-retours en serie avant le premier pixel. Sur un laptop en
   filaire cela ne se voit pas ; sur une tablette a la station, si.

   CE QUE LE SCRIPT FAIT
   Il resout les @import en profondeur, dans l'ordre, une seule fois par
   fichier, et recopie le contenu tel quel.

   CE QU'IL NE FAIT PAS — ET C'EST VOULU
   Il ne minifie pas, ne reordonne rien, ne touche a aucune declaration. Un
   fichier de sortie qu'on peut relire et diff-er est un fichier dont on peut
   prouver qu'il est identique aux sources. Si la minification devient utile
   un jour, elle viendra apres, sur ce fichier-la.

   LES CHEMINS RELATIFS
   Le fichier de sortie est ecrit dans css/, le meme dossier que
   petrogest.css. Les url() relatives des composants — ../assets/fonts/…
   dans fonts.css — restent donc valides sans reecriture. Le script le
   verifie et refuse d'ecrire ailleurs si ce n'etait plus le cas.

   VERIFICATION
   Le script compte les accolades du resultat. Un desequilibre signale une
   troncature ou un fichier corrompu, la seule facon realiste pour cette
   operation de casser silencieusement.
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");
const ENTREE = path.join(RACINE, "css", "petrogest.css");
const SORTIE = path.join(RACINE, "css", "petrogest.build.css");

/* Les @import distants restent des @import : on ne telecharge rien au build.
   Le systeme n'en a plus aucun — les polices sont auto-hebergees — mais si
   quelqu'un en rajoute un, il doit rester visible dans la sortie plutot que
   d'etre avale silencieusement. */
const RE_IMPORT = /^\s*@import\s+url\(\s*["']?([^"')]+)["']?\s*\)\s*;?\s*$/;

const vus = new Set();
const ordre = [];
let distants = 0;

function resoudre(fichier) {
  const abs = path.resolve(fichier);
  if (vus.has(abs)) return "";          /* deja inclus : la cascade a garde la 1re place */
  vus.add(abs);

  if (!fs.existsSync(abs)) {
    console.error("!! introuvable : " + path.relative(RACINE, abs));
    process.exit(1);
  }

  ordre.push(path.relative(RACINE, abs).replace(/\\/g, "/"));

  const dossier = path.dirname(abs);
  const lignes = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const sortie = [];

  for (const ligne of lignes) {
    const m = ligne.match(RE_IMPORT);
    if (!m) { sortie.push(ligne); continue; }

    const cible = m[1];
    if (/^(https?:)?\/\//.test(cible)) {
      distants++;
      sortie.push(ligne);               /* on laisse passer, mais on previendra */
      continue;
    }
    sortie.push(resoudre(path.join(dossier, cible)));
  }

  return "/* ====== " + path.relative(RACINE, abs).replace(/\\/g, "/") +
         " ====== */\n" + sortie.join("\n");
}

const css = resoudre(ENTREE);

/* Les url() relatives ne survivent que si la sortie reste dans css/. */
if (path.dirname(SORTIE) !== path.join(RACINE, "css")) {
  console.error("!! la sortie doit rester dans css/ : les url() y sont relatives");
  process.exit(1);
}

/* La version vient du fichier VERSION, seule source. Le controleur verifie
   qu'elle concorde avec celle affichee dans la documentation : un numero
   qu'on peut oublier de mettre a jour n'est qu'une decoration. */
const VERSION = fs.readFileSync(path.join(RACINE, "VERSION"), "utf8").trim();

const entete =
  "/* PETROGEST · Design System v" + VERSION + " — feuille concatenee\n" +
  "   GENERE PAR tools/build-css.js — NE PAS MODIFIER A LA MAIN.\n" +
  "   Editer les fichiers de css/ puis relancer : node tools/build-css.js\n" +
  "   " + ordre.length + " fichiers · " + new Date().toISOString().slice(0, 10) + " */\n\n";

fs.writeFileSync(SORTIE, entete + css + "\n");

/* --- controle --- */
const o = (css.match(/{/g) || []).length;
const f = (css.match(/}/g) || []).length;
const ko = fs.statSync(SORTIE).size;

console.log(ordre.length + " fichiers concatenes, dans cet ordre :");
ordre.forEach((n, i) => console.log("  " + String(i + 1).padStart(2) + ". " + n));
console.log("");
console.log("sortie   : css/" + path.basename(SORTIE) + "  (" + (ko / 1024).toFixed(1) + " Ko)");
console.log("accolades: " + o + " ouvrantes / " + f + " fermantes  " + (o === f ? "OK" : "DESEQUILIBRE"));
if (distants) console.log("attention: " + distants + " @import distant(s) laisse(s) en place — ils resteront bloquants");
if (o !== f) process.exit(1);
