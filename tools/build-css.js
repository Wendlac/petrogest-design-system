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

/* La concatenation vit dans une fonction, et non au fil du fichier, parce que
   tools/verifier.js l'appelle pour verifier que css/petrogest.build.css est
   bien a jour. Une seule logique, donc : si elle changeait ici sans changer
   la-bas, le controle validerait une feuille fausse.

   L'etat appartient a l'appel et non au module — deux appels de suite
   doivent rendre exactement le meme resultat. */
function concatener() {
  const vus = new Set();
  const ordre = [];
  let distants = 0;

  function resoudre(fichier) {
    const abs = path.resolve(fichier);
    if (vus.has(abs)) return "";          /* deja inclus : la cascade a garde la 1re place */
    vus.add(abs);

    /* On leve plutot que de sortir du processus : l'appelant peut etre le
       controleur, qui doit pouvoir rapporter la panne au lieu de mourir. */
    if (!fs.existsSync(abs)) throw new Error("introuvable : " + path.relative(RACINE, abs));

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

  return { css: resoudre(ENTREE), ordre: ordre, distants: distants };
}

module.exports = { concatener: concatener, SORTIE: SORTIE };

/* Ce qui suit ne s'execute qu'en ligne de commande : require() de ce fichier
   ne doit rien ecrire sur le disque. */
if (require.main !== module) return;

const r = concatener();
const css = r.css, ordre = r.ordre, distants = r.distants;

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
  /* Pas de date de generation : elle ferait differer le fichier a chaque
     reconstruction, meme sans un seul changement de source. Sur un fichier
     versionne, cela veut dire un diff de bruit a chaque fois et des conflits
     de fusion gratuits. Le nombre de fichiers, lui, dit quelque chose. */
  "   " + ordre.length + " fichiers */\n\n";

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
