# PETROGEST · Design System v1.0

Système de conception de l'application de gestion de stations-service.
HTML, CSS et JavaScript natifs. Aucun framework, aucune dépendance.

---

## Trois documents, dans cet ordre

| | À lire | Pour quoi |
|---|---|---|
| **1** | **[design-system.html](design-system.html)** | La référence : 50 sections, chaque composant avec ses variantes, ses états et le balisage exact à copier |
| **2** | **[correspondance.html](correspondance.html)** | La migration : 445 classes de la plateforme actuelle reliées à celles-ci, et les huit endroits où les deux couches JavaScript se recouvrent |
| **3** | ce fichier | Comment lancer, construire, vérifier |

Servir le dossier par HTTP — les deux pages chargent des `.woff2` et un
sprite SVG, que le protocole `file://` bloque.

```bash
node .server.js
```

Puis <http://localhost:4173/design-system.html>.

---

## Intégrer

En développement :

```html
<head>
  <!-- 1. EN PREMIER et SANS defer : pose le thème avant le premier rendu -->
  <script src="js/theme-boot.js"></script>

  <!-- 2. crossorigin est OBLIGATOIRE même en même origine,
          sinon le fichier est téléchargé deux fois -->
  <link rel="preload" as="font" type="font/woff2" crossorigin
        href="assets/fonts/dm-sans-var-latin.woff2">
  <link rel="preload" as="font" type="font/woff2" crossorigin
        href="assets/fonts/dm-mono-400-latin.woff2">

  <link rel="stylesheet" href="css/petrogest.css">
</head>

<body>
  ...
  <script src="js/petrogest.js" defer></script>
  <script src="js/charts.js"    defer></script>   <!-- si la page a des graphiques -->
</body>
```

En production, remplacer `petrogest.css` par `petrogest.build.css` : **une
requête au lieu de vingt-quatre.** Les `@import` ne se parallélisent pas — le
navigateur doit lire chaque fichier pour découvrir le suivant. Sur un laptop
en filaire cela ne se voit pas ; sur une tablette à la station, si.

Le développeur **n'écrit aucune ligne de JavaScript** pour faire fonctionner un
composant : il pose un attribut `data-pg-*`. Les 35 attributs et les 4
fonctions globales sont listés dans *Index des attributs*.

---

## Navigateurs

**Chrome / Edge 105+ · Safari 15.4+ · Firefox 121+.**

Ce que le système emploie et qui fixe ce plancher :

| Fonctionnalité | Sert à | Si absente |
|---|---|---|
| `<dialog>` + `::backdrop` | modales et panneaux | **la modale ne s'ouvre pas** — c'est la limite dure |
| `:focus-visible` | anneau de focus au clavier seulement | l'anneau apparaît aussi à la souris |
| `:has()` | la ligne se lève quand son lien a le focus | le lien garde son anneau, la ligne ne s'éclaire pas |
| `@page` nommée | Grand Livre en paysage | Firefox reste en portrait, ce qui demeure lisible |
| `print-color-adjust` | garder les couleurs de statut à l'impression | préfixé `-webkit-` pour les Chrome plus anciens |

**Le plancher réel est `<dialog>`** — Chrome 37, Safari 15.4, Firefox 98. Tout
le reste dégrade proprement. Firefox 121 n'est exigé que pour le confort du
`:has()`, employé à un seul endroit.

À vérifier avant la mise en production : **les tablettes des stations**. Une
tablette Android livrée avec un WebView non mis à jour peut se trouver sous ce
plancher, et c'est le poste où le système travaille le plus.

---

## Les trois commandes

```bash
node tools/build-css.js      # concatène les 24 feuilles → css/petrogest.build.css
node tools/verifier.js       # 19 contrôles ; sort 1 si l'un échoue
node tools/build-icons.js    # régénère assets/icons.svg depuis assets/icons/
```

`verifier.js` est le seul garde-fou du système. **À lancer avant toute
livraison**, idéalement en intégration continue. Il vérifie :

```
 1  balises HTML équilibrées
 2  sommaire et sections en correspondance, dans l'ordre de lecture
 3  identifiants uniques
 4  index des classes à jour avec le CSS
 5  index des attributs à jour avec le JS
 6  aucune var() sans définition
 7  aucun rôle sémantique jamais consommé
 8  contrastes AA dans les deux thèmes
 9  lignes cliquables pourvues d'un lien
10  aucune entité HTML dans un bloc JSON
11  aucun @import distant
12  version concordante entre VERSION, la doc et la feuille construite
13  feuille concaténée à jour avec les sources
```

Il n'a pas de dépendance et tourne en une seconde. Ajouter `-v` pour le détail.

**Un design system ne se casse pas d'un coup.** Il se casse d'une modification
non revérifiée à la fois : une classe ajoutée au CSS et absente de l'index, un
token renommé qui laisse un `var()` dans le vide, une couleur assombrie d'un
cran qui fait passer un rôle sous le seuil AA. Chacune est invisible à la
relecture ; toutes se détectent par un programme.

---

## Arborescence

```
VERSION                    ← seule source du numéro de version
design-system.html         ← la référence
correspondance.html        ← la migration depuis l'existant

css/
├── petrogest.css          ← à lier en développement
├── petrogest.build.css    ← à lier en production (généré, ne pas éditer)
├── fonts.css                @font-face, polices auto-hébergées
├── tokens.css               primitives → rôles sémantiques
├── base.css                 reset, typographie, chiffres, focus
├── theme-dark.css           inversion de rampe, sous @media screen
├── print.css                impression et export PDF
└── components/              18 fichiers, un par famille

js/
├── theme-boot.js          ← dans le <head>, SANS defer
├── petrogest.js             menus, onglets, tri, modales, saisie, sauvegarde auto
└── charts.js                graphiques SVG, sans dépendance

assets/
├── fonts/                 ← 6 woff2 + les deux licences OFL
├── icons.svg                sprite de 34 icônes, à inliner dans le body
├── icons/                   Remix Icon complet (3 229 fichiers, non livrés au navigateur)
└── logo-petrogest.svg       wordmark en currentColor : un fichier pour les deux thèmes

tools/
├── build-css.js
├── verifier.js
└── build-icons.js
```

---

## Ce qu'il faut savoir avant de modifier

**L'ordre des `@import` dans `petrogest.css` n'est pas arbitraire.** Il n'y a
aucune couche de spécificité artificielle : c'est la cascade qui travaille.
Trois fichiers doivent rester à leur place — `touch.css` après les composants
qu'il redensifie, `theme-dark.css` après tout ce qui consomme ses rôles,
`print.css` en dernier.

**Une paire de couleurs vient toujours de deux rôles, jamais de deux
primitives.** `--grey-0` sur `--amber-600` s'inversent dans le même sens : la
paire tenait en thème sombre et tombait à 3,49:1 en clair.

**Un rôle de texte se mesure sur les trois surfaces**, pas seulement sur le
fond de page. `--text-muted` annonçait 4,83:1 sur la page et tombait à 4,27:1
sur une surface creusée. Le contrôle 8 le vérifie désormais.

**Une ligne de tableau cliquable doit contenir un vrai `<a href>`** dans sa
cellule d'identité. Le clic sur la ligne est un confort ; le lien est le
chemin. Le contrôle 9 le vérifie, et `petrogest.js` prévient en console sur un
hôte de développement.

**`<script type="application/json">` est du texte brut** : les entités HTML n'y
sont jamais décodées. Écrire `Espèces`, jamais `Esp&egrave;ces`.

**Les états passent par ARIA quand ARIA existe** — `aria-sort`, `aria-selected`,
`aria-busy`, `aria-invalid`, `disabled`, `hidden` — et par une classe `.is-*`
seulement sinon. L'accessibilité et le style restent alors forcément
synchronisés.

---

## Le point tranché

**Les utilitaires d'espacement disparaissent au fil de la migration.**
`mb-1..4`, `mt-1..6`, `gap-2..4`, `flex`, `flex-center`, `grow` — 425
occurrences. Aucun équivalent n'est fourni, et il ne faut pas en recréer.

À la place, **un bloc de niveau page sait de combien il s'écarte du suivant** :
une règle unique dans `base.css`, seize pixels entre deux blocs, quarante entre
deux sections, zéro en queue de conteneur. Rien à poser dans le balisage.

Ce n'est pas un chantier séparé : la règle s'applique quand on touche un module
de toute façon. Et dans presque tous les cas l'utilitaire improvisait un
composant qui existe désormais — `flex flex-center mb-3` est une
`pg-table-bar`, le `<div class="grow"></div>` vide disparaît parce que les
conteneurs poussent déjà leurs actions à droite. Les treize combinaisons les
plus fréquentes sont mappées dans **[correspondance.html](correspondance.html#espacement)**.

## Un point resté ouvert

**Le redimensionnement des graphiques n'a pas pu être testé.** Rendu initial :
les neuf graphiques sont à l'échelle 1,00, y compris à 1180 px. Mais le
`ResizeObserver` ne se déclenche pas dans l'environnement où ce système a été
construit, si bien que **la rotation d'une tablette portrait ↔ paysage reste à
vérifier sur un vrai appareil** — et c'est le cas d'usage cible. Le mécanisme
est en place : un observateur par figure, plus un filet de sécurité sur
`resize`.
