/* ==========================================================================
   PETROGEST · Design System — Graphiques
   --------------------------------------------------------------------------
   SVG ecrit a la main, sans dependance. Remplace Chart.js.

       <script src="js/charts.js" defer></script>

   Fichier separe de petrogest.js : une page sans graphique n'a pas a le
   charger.

   USAGE — declaratif, comme le reste du systeme :

       <figure class="pg-chart" data-pg-chart="line">
         <script type="application/json">
           { "labels": ["01/06","02/06"], "series": [{"name":"CA","values":[1,2]}] }
         </script>
       </figure>

   Types : line · bars · hbars · donut · spark
   Options communes : unite, format ("fcfa" | "litres" | "nombre" | "pct"),
                      aire (line), total (donut)
   ========================================================================== */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var CAT = ["--cat-1", "--cat-2", "--cat-3", "--cat-4", "--cat-5", "--cat-6"];

  function el(nom, attrs) {
    var n = document.createElementNS(NS, nom);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) n.setAttribute(k, attrs[k]);
    return n;
  }

  function couleur(i, mono) {
    if (mono) return "var(--chart-ink)";
    return "var(" + CAT[i % CAT.length] + ")";
  }

  /* Formatage francais. Les milliers sont separes par une espace insecable
     etroite, la decimale est une virgule. */
  function fmt(v, format) {
    if (v === null || v === undefined) return "—";
    if (format === "pct") return v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
    var n = Math.abs(v) >= 1000 ? Math.round(v) : v;
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  }

  /* Echelle : on cherche un maximum « rond » pour que les graduations
     tombent juste. Un axe qui affiche 37 428 ne se lit pas. */
  function jolieBorne(max) {
    if (max <= 0) return 1;
    var exp = Math.floor(Math.log10(max));
    var base = Math.pow(10, exp);
    var pas = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < pas.length; i++) {
      if (max <= base * pas[i]) return base * pas[i];
    }
    return base * 10;
  }

  /* Le SVG est rendu a la largeur REELLE de son conteneur, pas a une
     largeur fixe ensuite etiree. Sinon un viewBox de 720 affiche dans 934 px
     agrandit tout de 30 % : le texte d axe prevu a 10 px sort a 13, les
     traits a 2,6 px. A l echelle 1:1, ce qui est dessine a 10 px MESURE
     10 px. */
  function mesurer(fig) {
    var w = fig.clientWidth || 720;
    return Math.max(320, Math.min(w, 1100));
  }

  function lireConfig(fig) {
    var s = fig.querySelector('script[type="application/json"]');
    if (!s) return null;
    try { return JSON.parse(s.textContent); } catch (e) { return null; }
  }

  function zoneReadout(fig) {
    var r = fig.querySelector(".pg-chart__readout");
    if (!r) {
      r = document.createElement("div");
      r.className = "pg-chart__readout";
      var svg = fig.querySelector("svg");
      fig.insertBefore(r, svg || fig.firstChild);
    }
    return r;
  }

  function legende(fig, items, mono, format, inline) {
    var anc = fig.querySelector(".pg-chart__legend");
    if (anc) anc.remove();
    var l = document.createElement("div");
    l.className = "pg-chart__legend" + (inline ? " pg-chart__legend--inline" : "");
    var total = items.reduce(function (a, b) { return a + (b.valeur || 0); }, 0);

    items.forEach(function (it, i) {
      var k = document.createElement("div");
      k.className = "pg-chart__key";
      k.innerHTML =
        '<span class="pg-chart__key-swatch" style="background:' + couleur(i, mono) + '"></span>' +
        '<span class="pg-chart__key-name"></span>' +
        '<span class="pg-chart__key-value"></span>' +
        (total ? '<span class="pg-chart__key-pct"></span>' : "");
      k.querySelector(".pg-chart__key-name").textContent = it.nom;
      k.querySelector(".pg-chart__key-value").textContent = fmt(it.valeur, format);
      if (total) k.querySelector(".pg-chart__key-pct").textContent = Math.round((it.valeur / total) * 100) + " %";
      l.appendChild(k);
    });
    fig.appendChild(l);
  }

  /* ========================================================================
     COURBE
     ==================================================================== */

  function courbe(fig, cfg) {
    var W = mesurer(fig), H = cfg.hauteur || 180, mg = { t: 12, r: 12, b: 26, l: 52 };
    var iw = W - mg.l - mg.r, ih = H - mg.t - mg.b;
    var series = cfg.series || [];
    var mono = series.length === 1;
    var labels = cfg.labels || [];

    var max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    max = jolieBorne(max);

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    var x = function (i) { return mg.l + (labels.length < 2 ? iw / 2 : (i / (labels.length - 1)) * iw); };
    var y = function (v) { return mg.t + ih - (v / max) * ih; };

    /* Graduations horizontales seulement : les verticales n'aident pas a
       lire une serie temporelle. */
    for (var g = 0; g <= 4; g++) {
      var vy = mg.t + (g / 4) * ih;
      svg.appendChild(el("line", { x1: mg.l, y1: vy, x2: W - mg.r, y2: vy, class: "pg-chart__grid" }));
      var t = el("text", { x: mg.l - 8, y: vy + 3, class: "pg-chart__axis", "text-anchor": "end" });
      t.textContent = fmt(max * (1 - g / 4), cfg.format);
      svg.appendChild(t);
    }

    series.forEach(function (s, si) {
      var d = s.values.map(function (v, i) { return (i ? "L" : "M") + x(i) + " " + y(v); }).join(" ");
      if (cfg.aire && mono) {
        svg.appendChild(el("path", {
          d: d + " L" + x(s.values.length - 1) + " " + (mg.t + ih) + " L" + x(0) + " " + (mg.t + ih) + " Z",
          class: "pg-chart__area"
        }));
      }
      svg.appendChild(el("path", { d: d, class: "pg-chart__line", style: "stroke:" + couleur(si, mono) }));
    });

    /* Quelques dates seulement : un axe surcharge est illisible. */
    var pas = Math.max(1, Math.ceil(labels.length / 6));
    labels.forEach(function (lb, i) {
      if (i % pas && i !== labels.length - 1) return;
      var t = el("text", { x: x(i), y: H - 6, class: "pg-chart__axis pg-chart__axis--cat", "text-anchor": "middle" });
      t.textContent = lb;
      svg.appendChild(t);
    });

    /* Lecture au survol : valeur a place fixe, jamais une bulle flottante —
       au doigt une bulle est inatteignable, a la souris elle masque la
       donnee voisine. */
    var curseur = el("line", { class: "pg-chart__cursor", y1: mg.t, y2: mg.t + ih, opacity: 0 });
    svg.appendChild(curseur);
    var zone = el("rect", { x: mg.l, y: mg.t, width: iw, height: ih, fill: "transparent" });
    svg.appendChild(zone);

    var out = zoneReadout(fig);
    function survol(ev) {
      var b = svg.getBoundingClientRect();
      var px = ((ev.clientX - b.left) / b.width) * W;
      var i = Math.round(((px - mg.l) / iw) * (labels.length - 1));
      i = Math.max(0, Math.min(labels.length - 1, i));
      curseur.setAttribute("x1", x(i)); curseur.setAttribute("x2", x(i)); curseur.setAttribute("opacity", 1);
      out.innerHTML = "";
      var d = document.createElement("span"); d.textContent = labels[i]; out.appendChild(d);
      series.forEach(function (s, si) {
        var v = document.createElement("span");
        v.className = "pg-chart__readout-value";
        v.style.color = couleur(si, mono);
        v.textContent = (series.length > 1 ? s.name + " " : "") + fmt(s.values[i], cfg.format) + (cfg.unite ? " " + cfg.unite : "");
        out.appendChild(v);
      });
    }
    zone.addEventListener("mousemove", survol);
    zone.addEventListener("touchmove", function (e) { survol(e.touches[0]); });
    svg.addEventListener("mouseleave", function () { curseur.setAttribute("opacity", 0); out.innerHTML = ""; });

    fig.appendChild(svg);
    if (series.length > 1) {
      legende(fig, series.map(function (s) {
        return { nom: s.name, valeur: s.values.reduce(function (a, b) { return a + b; }, 0) };
      }), false, cfg.format, true);
    }
  }

  /* ========================================================================
     BARRES VERTICALES
     ==================================================================== */

  function barres(fig, cfg) {
    var W = mesurer(fig), H = cfg.hauteur || 180, mg = { t: 12, r: 12, b: 30, l: 52 };
    var iw = W - mg.l - mg.r, ih = H - mg.t - mg.b;
    var vals = cfg.values || [], labels = cfg.labels || [];
    var max = jolieBorne(Math.max.apply(null, vals.concat([0])));
    var pas = iw / vals.length, larg = Math.min(pas * 0.6, 48);

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    for (var g = 0; g <= 4; g++) {
      var vy = mg.t + (g / 4) * ih;
      svg.appendChild(el("line", { x1: mg.l, y1: vy, x2: W - mg.r, y2: vy, class: "pg-chart__grid" }));
      var t = el("text", { x: mg.l - 8, y: vy + 3, class: "pg-chart__axis", "text-anchor": "end" });
      t.textContent = fmt(max * (1 - g / 4), cfg.format);
      svg.appendChild(t);
    }

    var out = zoneReadout(fig);
    vals.forEach(function (v, i) {
      var h = (v / max) * ih;
      var bx = mg.l + i * pas + (pas - larg) / 2;
      var r = el("rect", {
        x: bx, y: mg.t + ih - h, width: larg, height: Math.max(h, 1),
        rx: 3, class: "pg-chart__bar",
        style: cfg.couleurs === false ? "" : "fill:" + couleur(i, vals.length === 1 || cfg.mono)
      });
      r.addEventListener("mouseenter", function () {
        out.innerHTML = "";
        var a = document.createElement("span"); a.textContent = labels[i] || "";
        var b = document.createElement("span"); b.className = "pg-chart__readout-value";
        b.textContent = fmt(v, cfg.format) + (cfg.unite ? " " + cfg.unite : "");
        out.appendChild(a); out.appendChild(b);
      });
      svg.appendChild(r);

      var lt = el("text", { x: bx + larg / 2, y: H - 8, class: "pg-chart__axis pg-chart__axis--cat", "text-anchor": "middle" });
      lt.textContent = labels[i] || "";
      svg.appendChild(lt);
    });
    svg.addEventListener("mouseleave", function () { out.innerHTML = ""; });
    fig.appendChild(svg);
  }

  /* ========================================================================
     BARRES HORIZONTALES  ·  classements
     ==================================================================== */

  function barresH(fig, cfg) {
    var items = cfg.items || [];
    var lh = 34, W = mesurer(fig), H = items.length * lh + 8;
    var lw = cfg.largeurLibelle || 190, vw = 96;
    var iw = W - lw - vw - 16;
    var max = Math.max.apply(null, items.map(function (i) { return i.valeur; }).concat([0])) || 1;

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    items.forEach(function (it, i) {
      var y0 = i * lh + 4;
      var t = el("text", { x: 0, y: y0 + 20, class: "pg-chart__hbar-label" });
      t.textContent = it.nom;
      svg.appendChild(t);

      svg.appendChild(el("rect", { x: lw, y: y0 + 8, width: iw, height: 14, rx: 3, fill: "var(--surface-sunken)" }));
      svg.appendChild(el("rect", {
        x: lw, y: y0 + 8, width: Math.max((it.valeur / max) * iw, 2), height: 14, rx: 3,
        class: "pg-chart__bar",
        style: "fill:" + (it.critique ? "var(--red-600)" : couleur(0, !cfg.couleurs))
      }));

      var v = el("text", { x: W, y: y0 + 20, class: "pg-chart__hbar-value" });
      v.textContent = fmt(it.valeur, cfg.format);
      svg.appendChild(v);
    });
    fig.appendChild(svg);
  }

  /* ========================================================================
     ANNEAU
     ==================================================================== */

  function anneau(fig, cfg) {
    var items = cfg.items || [];
    var S = 200, R = 88, r = 58, cx = S / 2, cy = S / 2;
    var total = items.reduce(function (a, b) { return a + b.valeur; }, 0) || 1;

    var svg = el("svg", { viewBox: "0 0 " + S + " " + S, role: "img", style: "max-width:200px;margin:0 auto" });
    var a0 = -Math.PI / 2;
    var out = zoneReadout(fig);

    items.forEach(function (it, i) {
      var ang = (it.valeur / total) * Math.PI * 2;
      var a1 = a0 + ang;
      var grand = ang > Math.PI ? 1 : 0;
      var p = [
        "M", cx + R * Math.cos(a0), cy + R * Math.sin(a0),
        "A", R, R, 0, grand, 1, cx + R * Math.cos(a1), cy + R * Math.sin(a1),
        "L", cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        "A", r, r, 0, grand, 0, cx + r * Math.cos(a0), cy + r * Math.sin(a0), "Z"
      ].join(" ");
      var arc = el("path", { d: p, class: "pg-chart__arc", style: "fill:" + couleur(i) });
      arc.addEventListener("mouseenter", function () {
        out.innerHTML = "";
        var a = document.createElement("span"); a.textContent = it.nom;
        var b = document.createElement("span"); b.className = "pg-chart__readout-value";
        b.textContent = fmt(it.valeur, cfg.format) + " · " + Math.round((it.valeur / total) * 100) + " %";
        out.appendChild(a); out.appendChild(b);
      });
      svg.appendChild(arc);
      a0 = a1;
    });

    var tv = el("text", { x: cx, y: cy - 2, class: "pg-chart__center-value" });
    tv.textContent = fmt(total, cfg.format);
    svg.appendChild(tv);
    var tl = el("text", { x: cx, y: cy + 14, class: "pg-chart__center-label" });
    tl.textContent = cfg.centre || "Total";
    svg.appendChild(tl);

    svg.addEventListener("mouseleave", function () { out.innerHTML = ""; });
    fig.appendChild(svg);
    legende(fig, items, false, cfg.format);
  }

  /* ========================================================================
     SPARKLINE
     ==================================================================== */

  function spark(fig, cfg) {
    var v = cfg.values || [];
    var W = 72, H = 20;
    var min = Math.min.apply(null, v), max = Math.max.apply(null, v);
    var ec = max - min || 1;
    var d = v.map(function (val, i) {
      return (i ? "L" : "M") + (i / (v.length - 1)) * W + " " + (H - ((val - min) / ec) * (H - 3) - 1.5);
    }).join(" ");
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" });
    svg.appendChild(el("path", { d: d }));
    fig.appendChild(svg);
  }

  /* ========================================================================
     INITIALISATION
     ==================================================================== */

  var rendus = {
    line: courbe, bars: barres, hbars: barresH, donut: anneau, spark: spark
  };

  function rendre(fig) {
    if (fig.dataset.pgRendu === "1") return;
    var cfg = lireConfig(fig);
    var type = fig.getAttribute("data-pg-chart");
    var fn = rendus[type];
    if (!cfg || !fn) {
      fig.insertAdjacentHTML("beforeend", '<div class="pg-chart__empty">Aucune donnée</div>');
      fig.dataset.pgRendu = "1";
      return;
    }
    var vide = (cfg.series && !cfg.series.length) || (cfg.values && !cfg.values.length) ||
               (cfg.items && !cfg.items.length);
    if (vide) {
      fig.insertAdjacentHTML("beforeend", '<div class="pg-chart__empty">' + (cfg.vide || "Aucune donnée sur la période") + "</div>");
    } else {
      fn(fig, cfg);
    }
    fig.dataset.pgRendu = "1";
  }

  function init(racine) {
    (racine || document).querySelectorAll("[data-pg-chart]").forEach(function (f) {
      rendre(f);
      if (!largeurs.has(f)) { largeurs.set(f, Math.round(f.clientWidth)); observer(f); }
    });
  }

  /* Expose le strict minimum : re-rendre apres un changement de donnees. */
  window.pgCharts = {
    init: init,
    refresh: function (fig) {
      fig.querySelectorAll("svg, .pg-chart__legend, .pg-chart__readout, .pg-chart__empty").forEach(function (n) { n.remove(); });
      delete fig.dataset.pgRendu;
      rendre(fig);
    }
  };

  /* Un ResizeObserver PAR figure, plutot qu un seul ecouteur de fenetre.
     Trois cas que l ecouteur global ne couvrait pas :
       - la largeur change avant que le script soit charge ;
       - la sidebar se replie, la fenetre ne bouge pas ;
       - la figure est dans un onglet masque, mesuree a 0 puis revelee.
     On ne re-rend que si la largeur a REELLEMENT change, sinon le rendu
     se declencherait lui-meme en boucle. */

  var largeurs = new WeakMap();
  var ro = null;   /* UN SEUL observateur, garde en portee module.

     Piege : un ResizeObserver cree dans une fonction et laisse en variable
     locale n'est plus reference une fois la fonction terminee — le
     ramasse-miettes peut le collecter, et il cesse silencieusement de
     notifier. Aucune erreur, juste des graphiques qui ne se redimensionnent
     plus. Un observateur unique en portee module ne peut pas disparaitre. */

  function observer(fig) {
    if (typeof ResizeObserver !== "function") return;
    if (!ro) {
      ro = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
          var f = e.target;
          var w = Math.round(e.contentRect.width);
          if (!w || w === largeurs.get(f)) return;
          largeurs.set(f, w);
          if (f.dataset.pgRendu === "1") window.pgCharts.refresh(f);
        });
      });
    }
    ro.observe(fig);
  }

  /* Filet de securite : le redimensionnement de fenetre, en plus de
     l'observateur. Les deux visent le meme but mais ne couvrent pas les
     memes cas —

       ResizeObserver  attrape TOUT changement de largeur, y compris ceux
                       qui ne bougent pas la fenetre (sidebar repliee,
                       onglet revele, panneau ouvert) ;
       resize          fonctionne meme la ou ResizeObserver est indisponible
                       ou inerte.

     La garde `w === largeurs.get(f)` empeche un double rendu quand les deux
     se declenchent pour le meme changement. */

  var minuteur;
  window.addEventListener("resize", function () {
    clearTimeout(minuteur);
    minuteur = setTimeout(function () {
      document.querySelectorAll("[data-pg-chart]").forEach(function (f) {
        var w = Math.round(f.clientWidth);
        if (!w || w === largeurs.get(f) || f.dataset.pgRendu !== "1") return;
        largeurs.set(f, w);
        window.pgCharts.refresh(f);
      });
    }, 180);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
