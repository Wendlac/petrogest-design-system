/* ==========================================================================
   PETROGEST · Design System
   tools/verifier.js — Controle du systeme
   --------------------------------------------------------------------------
   Usage :

       node tools/verifier.js          controle tout, sort 1 si un test echoue
       node tools/verifier.js -v       detaille chaque test

   Aucune dependance. A lancer avant chaque livraison, et idealement en
   integration continue.

   POURQUOI CE FICHIER EXISTE
   Un design system ne se casse pas d'un coup. Il se casse d'une modification
   non reverifiee a la fois : une classe ajoutee au CSS et absente de l'index,
   un token renomme qui laisse un var() dans le vide, une couleur assombrie
   d'un cran qui fait passer un role sous le seuil AA. Chacune est invisible
   a la relecture, et toutes se detectent en une seconde par un programme.

   Ce que ce script NE peut pas faire : juger. Il verifie des invariants —
   ce qui doit rester vrai. Il ne dira jamais si un composant est bien
   dessine.

   ONZE CONTROLES
     1  balises HTML equilibrees
     2  sommaire et sections en correspondance, dans l'ordre de lecture
     3  identifiants uniques
     4  index des classes a jour avec le CSS
     5  index des attributs a jour avec le JS
     6  aucune var() non definie
     7  aucun token defini et jamais utilise
     8  contrastes AA dans les deux themes
     9  lignes cliquables pourvues d'un lien
    10  aucune entite HTML dans un bloc JSON
    11  aucun @import distant
   ========================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");
const VERBEUX = process.argv.includes("-v") || process.argv.includes("--verbose");
const PAGES = ["design-system.html", "correspondance.html"];

let echecs = 0, tests = 0;

function ok(nom, detail) {
  tests++;
  if (VERBEUX) console.log("  ✓ " + nom + (detail ? "  " + detail : ""));
}
function ko(nom, detail) {
  tests++; echecs++;
  console.log("  ✗ " + nom);
  if (detail) String(detail).split("\n").forEach(l => console.log("      " + l));
}
function titre(t) { console.log("\n" + t); }

function lire(p) { return fs.readFileSync(path.join(RACINE, p), "utf8"); }
function existe(p) { return fs.existsSync(path.join(RACINE, p)); }

function fichiersCss() {
  const entree = lire("css/petrogest.css");
  return [...entree.matchAll(/@import url\("([^"]+)"\)/g)]
    .map(m => "css/" + m[1]).filter(existe);
}

/* ==========================================================================
   1 · BALISES EQUILIBREES
   --------------------------------------------------------------------------
   Un </div> orphelin ne produit aucune erreur : le navigateur referme
   silencieusement, et des sections entieres se retrouvent hors de leur
   conteneur, decalees de quelques centaines de pixels. Vu une fois, jamais
   deux.
   ========================================================================== */
function controlerBalises() {
  titre("1 · Balises");
  for (const page of PAGES) {
    if (!existe(page)) continue;
    const s = lire(page);
    const desequilibres = [];
    for (const n of ["section", "div", "table", "thead", "tbody", "tr", "pre", "dialog", "figure"]) {
      const o = (s.match(new RegExp("<" + n + "[\\s>]", "g")) || []).length;
      const f = (s.match(new RegExp("</" + n + ">", "g")) || []).length;
      if (o !== f) desequilibres.push(n + " : " + o + " ouvrant(s) / " + f + " fermant(s)");
    }
    if (desequilibres.length) ko(page, desequilibres.join("\n"));
    else ok(page);
  }
}

/* ==========================================================================
   2 · SOMMAIRE ET SECTIONS
   --------------------------------------------------------------------------
   Le sommaire doit suivre l'ordre dans lequel on rencontre les sections en
   descendant la page. Quand les deux divergent, le lecteur perd la carte
   sans savoir pourquoi.
   ========================================================================== */
function controlerSommaire() {
  titre("2 · Sommaire");
  for (const [page, selNav] of [["design-system.html", '<div class="doc-nav__group">'],
                                ["correspondance.html", '<div class="pg-nav-group">']]) {
    if (!existe(page)) continue;
    const s = lire(page);
    const d = s.indexOf(selNav);
    const f = s.indexOf("</nav>");
    if (d < 0 || f < 0) { ko(page, "sommaire introuvable"); continue; }
    /* Un lien de sommaire peut porter une classe : .pg-nav-item sur la page
       de correspondance, rien sur celle-ci. */
    const nav = [...s.slice(d, f).matchAll(/<a[^>]*\shref="#([^"]+)"/g)].map(m => m[1]);
    const ids = [...s.matchAll(/<section class="(?:doc-section|pg-section)" id="([^"]+)"/g)].map(m => m[1]);

    const orphelins = nav.filter(a => !ids.includes(a));
    const oubliees = ids.filter(i => !nav.includes(i));
    const rangs = nav.map(a => ids.indexOf(a));
    let ordre = true;
    for (let i = 1; i < rangs.length; i++) if (rangs[i] < rangs[i - 1]) ordre = false;

    const pb = [];
    if (orphelins.length) pb.push("liens sans section : " + orphelins.join(" "));
    if (oubliees.length) pb.push("sections hors sommaire : " + oubliees.join(" "));
    if (!ordre) pb.push("le sommaire ne suit pas l'ordre de lecture");
    if (pb.length) ko(page, pb.join("\n"));
    else ok(page, "(" + ids.length + " sections)");
  }
}

/* ==========================================================================
   3 · IDENTIFIANTS UNIQUES
   ========================================================================== */
function controlerIds() {
  titre("3 · Identifiants");
  for (const page of PAGES) {
    if (!existe(page)) continue;
    /* Un identifiant cite dans un <pre> est du texte, pas un element : sans
       cette coupe, chaque extrait de code documente ressemble a un doublon. */
    const src = lire(page).replace(/<pre[\s\S]*?<\/pre>/g, "");
    const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    const doubles = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
    if (doubles.length) ko(page, "en double : " + doubles.join(" "));
    else ok(page, "(" + ids.length + " identifiants)");
  }
}

/* ==========================================================================
   4 · INDEX DES CLASSES
   --------------------------------------------------------------------------
   L'index affirme : « si une classe figure ici, elle existe dans la feuille ».
   Cette promesse ne tient que si on la reverifie.
   ========================================================================== */
function classesDuCss() {
  const blocs = new Map();
  for (const f of fichiersCss()) {
    const src = lire(f).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of src.matchAll(/\.(pg-[a-z0-9_-]+)/g)) {
      const base = m[1].split(/__|--/)[0];
      if (!blocs.has(base)) blocs.set(base, new Set());
      if (m[1] !== base) blocs.get(base).add(m[1].slice(base.length));
    }
  }
  return blocs;
}
function controlerIndexClasses() {
  titre("4 · Index des classes");
  if (!existe("design-system.html")) return;
  const s = lire("design-system.html");
  const bloc = s.slice(s.indexOf('id="index"'));
  const listees = new Map();
  for (const m of bloc.matchAll(/<code>\.(pg-[a-z0-9-]+)<\/code><\/td><td class="pg-caption">([^<]*)</g)) {
    listees.set(m[1], new Set(m[2] === "&mdash;" ? [] : m[2].split(/\s+/).filter(Boolean)));
  }
  const reelles = classesDuCss();

  const absentes = [...reelles.keys()].filter(b => !listees.has(b));
  const fantomes = [...listees.keys()].filter(b => !reelles.has(b));
  const suffixesManquants = [];
  for (const [b, suff] of reelles) {
    if (!listees.has(b)) continue;
    const l = listees.get(b);
    for (const x of suff) if (!l.has(x)) suffixesManquants.push(b + x);
  }

  const pb = [];
  if (absentes.length) pb.push("dans le CSS, absents de l'index : " + absentes.join(" "));
  if (fantomes.length) pb.push("dans l'index, absents du CSS : " + fantomes.join(" "));
  if (suffixesManquants.length) pb.push("variantes non listees : " + suffixesManquants.join(" "));
  if (pb.length) ko("index a regenerer", pb.join("\n") + "\n→ node tools/build-index.js");
  else ok("a jour", "(" + reelles.size + " blocs)");
}

/* ==========================================================================
   5 · INDEX DES ATTRIBUTS
   ========================================================================== */
function controlerIndexAttributs() {
  titre("5 · Index des attributs");
  if (!existe("design-system.html")) return;
  const js = ["js/petrogest.js", "js/charts.js", "js/theme-boot.js"]
    .filter(existe).map(lire).join("\n");
  const duCode = [...new Set([...js.matchAll(/data-pg-[a-z-]+/g)].map(m => m[0]))]
    .filter(a => a !== "data-pg-").sort();

  const doc = lire("design-system.html");
  const bloc = doc.slice(doc.indexOf('id="attributs"'), doc.indexOf('id="index"'));
  const listes = new Set([...bloc.matchAll(/<td><code>(data-pg-[a-z-]+)<\/code><\/td>/g)].map(m => m[1]));

  const absents = duCode.filter(a => !listes.has(a));
  const fantomes = [...listes].filter(a => !duCode.includes(a));
  const pb = [];
  if (absents.length) pb.push("implementes, non documentes : " + absents.join(" "));
  if (fantomes.length) pb.push("documentes, absents du code : " + fantomes.join(" "));
  if (pb.length) ko("index a regenerer", pb.join("\n"));
  else ok("a jour", "(" + duCode.length + " attributs)");
}

/* ==========================================================================
   6 · VAR() NON DEFINIES
   --------------------------------------------------------------------------
   Un var(--typo) ne provoque aucune erreur : la propriete est simplement
   ignoree, et l'element herite. C'est le genre de defaut qui passe une
   relecture et se voit six mois plus tard.
   ========================================================================== */
/* --------------------------------------------------------------------------
   Extraction des declarations de tokens.

   Deux pieges, tous deux rencontres :

   1. Un modificateur BEM suivi d'une pseudo-classe — .pg-btn--primary:hover —
      ressemble a une definition de token.

   2. Plusieurs declarations peuvent tenir sur une ligne :
        --red-50: #2C1516;  --red-100: #3A1A1B;  --red-200: #55201F;
      Une expression reguliere globale qui exige un « ; » devant CONSOMME ce
      point-virgule, si bien qu'elle n'attrape qu'une declaration sur deux.
      C'est le genre de defaut qui ne se voit pas : le controle passe, avec la
      moitie des valeurs.

   On decoupe donc sur « ; », puis on ne garde de chaque morceau que ce qui
   suit la derniere accolade — un selecteur ne peut alors plus passer pour
   une declaration.
   -------------------------------------------------------------------------- */
function declarations(src) {
  const out = [];
  /* Les commentaires d'abord : dans ce systeme, un bloc s'ouvre presque
     toujours sur une explication, si bien que la PREMIERE declaration de
     chaque bloc se trouve derriere un /* ... *​/ et passait a la trappe. */
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const piece of src.split(";")) {
    const coupe = Math.max(piece.lastIndexOf("{"), piece.lastIndexOf("}"));
    const seg = coupe >= 0 ? piece.slice(coupe + 1) : piece;
    const m = /^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]*)$/.exec(seg);
    if (m) out.push([m[1], m[2].trim()]);
  }
  return out;
}

function tokensDefinis() {
  const def = new Set();
  for (const f of fichiersCss()) {
    for (const [n] of declarations(lire(f))) def.add(n);
  }
  return def;
}
function controlerVariables() {
  titre("6 · Variables");
  const def = tokensDefinis();
  const manquantes = new Map();
  for (const f of fichiersCss()) {
    const src = lire(f).replace(/\/\*[\s\S]*?\*\//g, "");
    /* var(--x, repli) est volontaire : la valeur vient de l'exterieur —
       --level pose en ligne sur une jauge, par exemple. On ne signale que les
       var() SANS repli, les seules qui echouent en silence. */
    for (const m of src.matchAll(/var\((--[a-z0-9-]+)\s*\)/g)) {
      if (!def.has(m[1])) {
        if (!manquantes.has(m[1])) manquantes.set(m[1], new Set());
        manquantes.get(m[1]).add(path.basename(f));
      }
    }
  }
  if (manquantes.size) {
    ko("var() sans definition",
       [...manquantes].map(([v, f]) => v + "  (" + [...f].join(", ") + ")").join("\n"));
  } else ok("toutes resolues", "(" + def.size + " tokens)");
}

/* ==========================================================================
   7 · TOKENS ORPHELINS
   --------------------------------------------------------------------------
   Deux couches, deux verdicts differents — et les confondre donnerait un
   controle inutilisable.

   Une PRIMITIVE inutilisee n'est pas un defaut : les rampes se definissent
   entieres. --amber-800 existe parce que la rampe ambre va de 50 a 800, et
   un integrateur qui en a besoin doit le trouver a sa place. Percer un trou
   dans une echelle coute plus cher que d'y laisser un barreau inutilise.

   Un ROLE inutilise, si. Un role existe parce qu'un composant en a besoin ;
   s'il n'en a plus, il ne reste qu'une question de plus a se poser au
   moment de choisir — « lequel dois-je prendre ? ».
   ========================================================================== */
function controlerTokensOrphelins() {
  titre("7 · Tokens orphelins");

  /* Reconnaitre une echelle par sa FORME, pas par sa place dans le fichier :
     un token qui se termine par un cran chiffre — --space-1, --grey-500,
     --amber-800 — appartient a une echelle. Le decoupage par position avait
     l'air de marcher jusqu'a ce que l'echelle d'espacement, ecrite apres la
     frontiere des roles, se fasse prendre pour une poignee de roles morts. */
  const cran = /^(--[a-z-]+?)-(\d+)$/;

  const utilises = new Set();
  for (const f of fichiersCss()) {
    for (const m of lire(f).matchAll(/var\((--[a-z0-9-]+)/g)) utilises.add(m[1]);
  }
  for (const p of PAGES) {
    if (!existe(p)) continue;
    for (const m of lire(p).matchAll(/var\((--[a-z0-9-]+)/g)) utilises.add(m[1]);
  }

  const definis = [...tokensDefinis()];
  const orphelins = definis.filter(v => !utilises.has(v));

  /* Une echelle est vivante des qu'un de ses crans sert. */
  const famillesVivantes = new Set();
  for (const v of utilises) { const m = cran.exec(v); if (m) famillesVivantes.add(m[1]); }

  const barreaux = orphelins.filter(v => { const m = cran.exec(v); return m && famillesVivantes.has(m[1]); });
  const rolesMorts = orphelins.filter(v => !barreaux.includes(v));

  if (rolesMorts.length) {
    ko(rolesMorts.length + " role(s) jamais consomme(s)",
       rolesMorts.join(" ") + "\nUn role sans composant qui l'emploie n'est plus qu'une question de plus a se poser au moment de choisir.");
  } else {
    ok("aucun role mort", barreaux.length ? "(" + barreaux.length + " crans d'echelle inutilises, normal)" : "");
  }
}

/* ==========================================================================
   8 · CONTRASTES
   --------------------------------------------------------------------------
   Le controle le plus utile du fichier. Il resout le graphe des tokens dans
   les deux themes et mesure chaque paire role/surface.

   Une lecon apprise a la dure : mesurer un role sur le seul fond de page ne
   suffit pas. --text-muted annoncait 4,83:1 sur la page et tombait a 4,27:1
   sur une surface creusee. On mesure donc chaque role contre LES TROIS
   surfaces, et on retient le pire cas.
   ========================================================================== */
function valeursTheme(sombre) {
  /* On lit tokens.css, puis on superpose le bloc sombre de theme-dark.css. */
  const brut = new Map();
  const ajouter = src => {
    for (const [n, v] of declarations(src)) brut.set(n, v);
  };
  ajouter(lire("css/tokens.css").replace(/\/\*[\s\S]*?\*\//g, ""));
  if (sombre && existe("css/theme-dark.css")) {
    const d = lire("css/theme-dark.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const i = d.indexOf('[data-theme="dark"] {');
    if (i >= 0) ajouter(d.slice(i, d.indexOf("\n}", i)));
  }
  /* Resolution des chaines var(--a) -> var(--b) -> #hex */
  const resoudre = (v, prof) => {
    if (prof > 12) return null;
    const m = /^var\((--[a-z0-9-]+)\)$/.exec(v.trim());
    if (!m) return v.trim();
    const suivant = brut.get(m[1]);
    return suivant === undefined ? null : resoudre(suivant, prof + 1);
  };
  const out = new Map();
  for (const [k, v] of brut) { const r = resoudre(v, 0); if (r) out.set(k, r); }
  return out;
}
function hexVersRgb(h) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return null;
  let x = m[1];
  if (x.length === 3) x = x.split("").map(c => c + c).join("");
  return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
}
function luminance(rgb) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contraste(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function controlerContrastes() {
  titre("8 · Contrastes");

  /* Roles de texte : mesures contre les trois surfaces, pire cas retenu. */
  const SURFACES = ["--surface-page", "--surface-raised", "--surface-sunken"];
  const TEXTES = ["--text-primary", "--text-secondary", "--text-muted"];
  /* Paires explicites : un fond precis pour un texte precis. */
  const PAIRES = [
    ["--action-primary-text", "--action-primary-bg"],
    ["--action-secondary-text", "--action-secondary-bg"],
    ["--action-danger-text", "--action-danger-bg"],
    ["--status-success-text", "--status-success-bg"],
    ["--status-warning-text", "--status-warning-bg"],
    ["--status-critical-text", "--status-critical-bg"],
    ["--status-info-text", "--status-info-bg"],
    ["--status-neutral-text", "--status-neutral-bg"],
    ["--text-inverse", "--surface-inverse"]
  ];
  const SEUIL = 4.5;

  for (const sombre of [false, true]) {
    const nom = sombre ? "sombre" : "clair";
    const v = valeursTheme(sombre);
    const couleur = t => { const x = v.get(t); return x ? hexVersRgb(x) : null; };
    const echoues = [], illisibles = [];

    for (const t of TEXTES) {
      const c = couleur(t);
      if (!c) { illisibles.push(t); continue; }
      for (const s of SURFACES) {
        const f = couleur(s);
        if (!f) { illisibles.push(s); continue; }
        const r = contraste(c, f);
        if (r < SEUIL) echoues.push(t + " sur " + s + " : " + r.toFixed(2));
      }
    }
    for (const [t, f] of PAIRES) {
      const c = couleur(t), b = couleur(f);
      if (!c || !b) { illisibles.push(t + "/" + f); continue; }
      const r = contraste(c, b);
      if (r < SEUIL) echoues.push(t + " sur " + f + " : " + r.toFixed(2));
    }

    if (echoues.length) ko("theme " + nom, echoues.join("\n") + "\n(seuil AA : " + SEUIL + ":1)");
    else ok("theme " + nom, "(" + (TEXTES.length * SURFACES.length + PAIRES.length) + " paires" +
            (illisibles.length ? ", " + [...new Set(illisibles)].length + " non resolue(s)" : "") + ")");
  }
}

/* ==========================================================================
   9 · LIGNES CLIQUABLES
   --------------------------------------------------------------------------
   Le defaut est invisible a l'oeil : la souris ouvre la ligne, tout a l'air
   de marcher. Il ne se voit qu'en essayant de tabuler.
   ========================================================================== */
function controlerLignesCliquables() {
  titre("9 · Lignes cliquables");
  for (const page of PAGES) {
    if (!existe(page)) continue;
    const s = lire(page);
    const lignes = s.split("\n");
    let total = 0, sansLien = 0;
    for (let i = 0; i < lignes.length; i++) {
      if (!/<tr data-pg-row-href=/.test(lignes[i])) continue;
      total++;
      let bloc = "";
      for (let j = i; j < lignes.length && !/<\/tr>/.test(bloc); j++) bloc += lignes[j];
      if (!/<a\s[^>]*href=/.test(bloc)) sansLien++;
    }
    if (sansLien) ko(page, sansLien + " ligne(s) sur " + total + " sans <a href> : inatteignables au clavier");
    else if (total) ok(page, "(" + total + " lignes, toutes pourvues)");
    else ok(page, "(aucune)");
  }
}

/* ==========================================================================
   10 · ENTITES DANS LES BLOCS JSON
   --------------------------------------------------------------------------
   <script type="application/json"> est du texte brut : les entites n'y sont
   jamais decodees. « Esp&egrave;ces » s'affiche tel quel dans la legende.
   ========================================================================== */
function controlerJson() {
  titre("10 · Blocs JSON");
  for (const page of PAGES) {
    if (!existe(page)) continue;
    const s = lire(page);
    const fautifs = [];
    let n = 0;
    for (const m of s.matchAll(/<script type="application\/json">([\s\S]*?)<\/script>/g)) {
      n++;
      const e = m[1].match(/&[a-zA-Z]{2,8};/g);
      if (e) fautifs.push([...new Set(e)].join(" "));
      try { JSON.parse(m[1]); } catch (err) { fautifs.push("JSON illisible : " + err.message); }
    }
    if (fautifs.length) ko(page, fautifs.join("\n"));
    else ok(page, "(" + n + " blocs)");
  }
}

/* ==========================================================================
   11 · IMPORTS DISTANTS
   --------------------------------------------------------------------------
   Une feuille importee depuis un domaine externe est bloquante : rien n'est
   peint tant qu'elle n'est pas recue. Sur la piste, avec une tablette en 3G
   capricieuse, cela retarde le premier pixel de plusieurs secondes.
   ========================================================================== */
function controlerImports() {
  titre("11 · Imports distants");
  const distants = [];
  for (const f of ["css/petrogest.css", ...fichiersCss()]) {
    for (const m of lire(f).matchAll(/@import\s+url\(\s*["']?(https?:)?\/\/[^)]+\)/g)) {
      distants.push(path.basename(f) + " : " + m[0].slice(0, 70));
    }
  }
  for (const p of PAGES) {
    if (!existe(p)) continue;
    for (const m of lire(p).matchAll(/<link[^>]+href="https?:\/\/[^"]+"/g)) distants.push(p + " : " + m[0].slice(0, 70));
  }
  if (distants.length) ko("ressources externes", distants.join("\n"));
  else ok("aucune", "(polices auto-hebergees)");
}

/* ==========================================================================
   12 · VERSION
   --------------------------------------------------------------------------
   Le fichier VERSION est la seule source. La documentation l'affiche, la
   feuille concatenee la porte en en-tete. Un numero qu'on peut oublier de
   mettre a jour quelque part n'est qu'une decoration.
   ========================================================================== */
function controlerVersion() {
  titre("12 · Version");
  if (!existe("VERSION")) { ko("fichier VERSION absent"); return; }
  const v = lire("VERSION").trim();
  if (!/^\d+\.\d+(\.\d+)?$/.test(v)) { ko("format inattendu", "« " + v + " »"); return; }

  const ecarts = [];
  const doc = lire("design-system.html");
  const m = /doc-nav__version">Design System · v([\d.]+)</.exec(doc);
  if (!m) ecarts.push("la documentation n'affiche aucune version");
  else if (m[1] !== v) ecarts.push("documentation : v" + m[1] + "  ≠  VERSION : v" + v);

  if (existe("css/petrogest.build.css")) {
    const tete = lire("css/petrogest.build.css").slice(0, 200);
    const b = /Design System v([\d.]+)/.exec(tete);
    if (!b) ecarts.push("la feuille concatenee ne porte aucune version");
    else if (b[1] !== v) ecarts.push("petrogest.build.css : v" + b[1] + "  ≠  VERSION : v" + v +
                                     "\n→ node tools/build-css.js");
  }

  if (ecarts.length) ko("versions discordantes", ecarts.join("\n"));
  else ok("v" + v, "(VERSION, documentation, feuille concatenee)");
}

/* ========================================================================== */

console.log("PETROGEST · controle du design system");
controlerBalises();
controlerSommaire();
controlerIds();
controlerIndexClasses();
controlerIndexAttributs();
controlerVariables();
controlerTokensOrphelins();
controlerContrastes();
controlerLignesCliquables();
controlerJson();
controlerImports();
controlerVersion();

console.log("");
if (echecs) {
  console.log(echecs + " echec(s) sur " + tests + " controles.");
  process.exit(1);
}
console.log(tests + " controles, aucun echec.");
