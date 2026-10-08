/* ==========================================================================
   PETROGEST · theme-boot.js
   --------------------------------------------------------------------------
   A charger EN PREMIER, dans le <head>, SANS defer :

       <script src="js/theme-boot.js"></script>

   C'est la seule exception a la regle « les scripts en bas, en defer ». Il
   doit s'executer AVANT le premier rendu, sinon la page s'affiche en clair
   pendant une fraction de seconde avant de basculer en sombre. Ce flash
   blanc est particulierement desagreable la nuit, qui est precisement le
   moment ou l'on utilise le theme sombre.

   Il fait deux choses et rien d'autre : lire la preference et poser
   l'attribut. Tout le reste est dans le CSS.

   Trois etats, pas deux :
     "clair"   choix explicite
     "sombre"  choix explicite
     absent    on suit le systeme, et on continue de le suivre s'il change
   ========================================================================== */

(function () {
  "use strict";

  var CLE = "petrogest_theme";

  function preferenceSysteme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark" : "light";
  }

  function lire() {
    try { return localStorage.getItem(CLE) || ""; } catch (e) { return ""; }
  }

  function appliquer(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  /* Au demarrage. */
  var choix = lire();
  appliquer(choix === "light" || choix === "dark" ? choix : preferenceSysteme());

  /* Sans choix explicite, on suit le systeme meme s'il change en cours de
     session — un utilisateur qui bascule son OS a 19 h ne devrait pas avoir
     a recharger. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var suivre = function () { if (!lire()) appliquer(preferenceSysteme()); };
    if (mq.addEventListener) mq.addEventListener("change", suivre);
    else if (mq.addListener) mq.addListener(suivre);
  }

  /* API publique — utilisee par [data-pg-theme-toggle]. */
  window.pgTheme = {
    get: function () { return document.documentElement.getAttribute("data-theme"); },

    set: function (theme) {
      /* La transition n'est active que le temps du basculement : animer des
         dizaines de proprietes en permanence ferait ramer une page dense. */
      document.documentElement.classList.add("pg-theme-switching");
      appliquer(theme);
      try {
        if (theme) localStorage.setItem(CLE, theme);
        else localStorage.removeItem(CLE);
      } catch (e) {}
      setTimeout(function () {
        document.documentElement.classList.remove("pg-theme-switching");
      }, 200);
      document.dispatchEvent(new CustomEvent("pg:theme", { detail: { theme: theme } }));
    },

    toggle: function () {
      window.pgTheme.set(window.pgTheme.get() === "dark" ? "light" : "dark");
    },

    /* Revenir a la preference du systeme. */
    auto: function () {
      document.documentElement.classList.add("pg-theme-switching");
      try { localStorage.removeItem(CLE); } catch (e) {}
      appliquer(preferenceSysteme());
      setTimeout(function () {
        document.documentElement.classList.remove("pg-theme-switching");
      }, 200);
    }
  };

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t && typeof t.closest === "function" && t.closest("[data-pg-theme-toggle]")) {
      e.preventDefault();
      window.pgTheme.toggle();
    }
  });
})();
