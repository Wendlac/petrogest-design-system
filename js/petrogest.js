/* ==========================================================================
   PETROGEST · Design System — JavaScript
   --------------------------------------------------------------------------
   Vanilla, sans dependance, sans build.

       <script src="js/petrogest.js" defer></script>

   Tout est pilote par attributs `data-pg-*`. L'integrateur n'ecrit AUCUNE
   ligne de JavaScript : il pose le balisage, le composant s'initialise seul.
   Les elements ajoutes dynamiquement au DOM fonctionnent aussi (delegation
   d'evenements a la racine du document).
   ========================================================================== */

(function () {
  "use strict";

  /* La cible d'un evenement n'est pas toujours un Element : un keydown sans
     focus a `document` pour cible, et `document.closest` n'existe pas. Toute
     remontee du DOM passe par ici. */
  function closestFrom(target, selector) {
    if (!target || typeof target.closest !== "function") return null;
    return target.closest(selector);
  }

  /* ========================================================================
     MENU  ·  data-pg-menu="<id du menu>"
     ------------------------------------------------------------------------
     <button class="pg-btn pg-btn--ghost pg-btn--icon"
             data-pg-menu="m1" aria-haspopup="menu" aria-expanded="false">…</button>
     <div class="pg-menu" id="m1" role="menu" hidden>…</div>
     ==================================================================== */

  var openMenu = null;

  function closeMenu() {
    if (!openMenu) return;
    openMenu.menu.hidden = true;
    openMenu.trigger.setAttribute("aria-expanded", "false");
    openMenu = null;
  }

  function positionMenu(trigger, menu) {
    var r = trigger.getBoundingClientRect();
    menu.hidden = false;                        // mesurable seulement une fois affiche
    var m = menu.getBoundingClientRect();
    var gap = 4;

    // Aligne a droite du declencheur, bascule au-dessus s'il n'y a pas la place.
    var left = r.right - m.width;
    var top = r.bottom + gap;
    if (top + m.height > window.innerHeight - 8) top = r.top - m.height - gap;
    if (left < 8) left = 8;

    menu.style.position = "fixed";
    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
  }

  function toggleMenu(trigger) {
    var menu = document.getElementById(trigger.getAttribute("data-pg-menu"));
    if (!menu) return;
    var wasOpen = openMenu && openMenu.menu === menu;
    closeMenu();
    if (wasOpen) return;

    positionMenu(trigger, menu);
    trigger.setAttribute("aria-expanded", "true");
    openMenu = { trigger: trigger, menu: menu };

    var first = menu.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
    if (first) first.focus();
  }

  /* Navigation clavier dans un menu ouvert. */
  function menuKeydown(e) {
    if (!openMenu) return;
    var items = Array.prototype.filter.call(
      openMenu.menu.querySelectorAll('[role="menuitem"]'),
      function (el) { return el.getAttribute("aria-disabled") !== "true"; }
    );
    var i = items.indexOf(document.activeElement);

    if (e.key === "Escape") {
      e.preventDefault();
      var t = openMenu.trigger;
      closeMenu();
      t.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length].focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length].focus();
    } else if (e.key === "Tab") {
      closeMenu();
    }
  }

  /* ========================================================================
     ONGLETS  ·  data-pg-tabs
     ------------------------------------------------------------------------
     <div class="pg-tabs" role="tablist" data-pg-tabs>
       <button class="pg-tab" role="tab" aria-selected="true"  aria-controls="p1">Journal</button>
       <button class="pg-tab" role="tab" aria-selected="false" aria-controls="p2">Balance</button>
     </div>
     <div id="p1" role="tabpanel">…</div>
     <div id="p2" role="tabpanel" hidden>…</div>
     ==================================================================== */

  function selectTab(tab) {
    var list = tab.closest("[data-pg-tabs]");
    if (!list) return;
    list.querySelectorAll('[role="tab"]').forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    });
  }

  function tabsKeydown(e) {
    var tab = closestFrom(e.target, '[data-pg-tabs] [role="tab"]');
    if (!tab) return;
    var tabs = Array.prototype.slice.call(tab.closest("[data-pg-tabs]").querySelectorAll('[role="tab"]'));
    var i = tabs.indexOf(tab);
    var next = null;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); selectTab(next); next.focus(); }
  }

  /* ========================================================================
     TRI DE TABLEAU  ·  data-pg-sort sur le <button> d'en-tete
     ------------------------------------------------------------------------
     data-pg-sort="text" (defaut) | "num" | "date"
     Le <th> porte aria-sort, que la CSS utilise pour l'indicateur.
     ==================================================================== */

  function parseCell(td, type) {
    var raw = (td.getAttribute("data-sort-value") || td.textContent || "").trim();
    if (type === "num") {
      // Chiffres francais : espaces (y compris insecables) comme separateurs,
      // virgule decimale. « — » et « - » valent -Infinity pour tomber en fin de tri.
      var n = raw.replace(/[\s  ]/g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
      return n === "" || n === "-" ? -Infinity : parseFloat(n);
    }
    if (type === "date") {
      var m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : -Infinity;
    }
    return raw.toLocaleLowerCase("fr");
  }

  function sortTable(button) {
    var th = button.closest("th");
    var table = button.closest("table");
    if (!th || !table) return;

    var tbody = table.tBodies[0];
    if (!tbody) return;

    var index = Array.prototype.indexOf.call(th.parentNode.children, th);
    var type = button.getAttribute("data-pg-sort") || "text";
    var asc = th.getAttribute("aria-sort") !== "ascending";

    th.parentNode.querySelectorAll("th").forEach(function (h) { h.removeAttribute("aria-sort"); });
    th.setAttribute("aria-sort", asc ? "ascending" : "descending");

    var rows = Array.prototype.slice.call(tbody.rows);
    rows.sort(function (a, b) {
      var x = parseCell(a.cells[index], type);
      var y = parseCell(b.cells[index], type);
      if (x < y) return asc ? -1 : 1;
      if (x > y) return asc ? 1 : -1;
      return 0;
    });
    rows.forEach(function (r) { tbody.appendChild(r); });
  }

  /* ========================================================================
     LIGNE CLIQUABLE  ·  data-pg-row-href sur le <tr>
     ------------------------------------------------------------------------
     La regle d'action de ligne : ouvrir se fait en cliquant la ligne.
     Les clics sur un bouton, un lien ou un champ a l'interieur sont ignores.
     ==================================================================== */

  function rowActivate(e) {
    var row = closestFrom(e.target, "tr[data-pg-row-href]");
    if (!row) return;
    if (closestFrom(e.target, "button, a, input, select, textarea, label, .pg-menu")) return;

    /* On passe par le lien de la ligne quand il existe : il porte la vraie
       destination, et un clic simule dessus respecte Ctrl/Cmd, le clic
       milieu et « ouvrir dans un nouvel onglet ». L'attribut ne sert que de
       repli. */
    var lien = row.querySelector("a[href]");
    if (lien) { lien.click(); return; }
    window.location.href = row.getAttribute("data-pg-row-href");
  }

  /* ------------------------------------------------------------------------
     GARDE-FOU  ·  une ligne cliquable sans lien n'existe pas au clavier
     ------------------------------------------------------------------------
     Le defaut est invisible a l'oeil : la souris ouvre la ligne, tout a l'air
     de marcher. Il ne se voit qu'en essayant de tabuler — c'est-a-dire
     jamais, en pratique. On le signale donc a la construction.

     Silencieux en production : le message ne part qu'en local, sur un
     hote de developpement. */
  function verifierLignesCliquables() {
    var h = location.hostname;
    var local = h === "localhost" || h === "127.0.0.1" || h === "" || /.local$/.test(h);
    if (!local) return;
    var muettes = [];
    document.querySelectorAll("tr[data-pg-row-href]").forEach(function (tr) {
      if (!tr.querySelector("a[href]")) muettes.push(tr);
    });
    if (!muettes.length) return;
    console.warn(
      "[PETROGEST] " + muettes.length + " ligne(s) cliquable(s) sans lien : " +
      "inatteignables au clavier. La cellule d'identite doit contenir un <a href>. " +
      "Le clic de ligne est un confort, pas le chemin.", muettes);
  }

  /* ========================================================================
     SIDEBAR REPLIABLE  ·  data-pg-toggle-sidebar
     ==================================================================== */

  function toggleSidebar() {
    var app = document.querySelector(".pg-app");
    if (!app) return;
    var collapsed = app.classList.toggle("is-collapsed");
    try { localStorage.setItem("pg.sidebar", collapsed ? "collapsed" : "expanded"); } catch (err) {}
  }

  function restoreSidebar() {
    try {
      if (localStorage.getItem("pg.sidebar") === "collapsed") {
        var app = document.querySelector(".pg-app");
        if (app) app.classList.add("is-collapsed");
      }
    } catch (err) {}
  }

  /* ========================================================================
     SAUVEGARDE AUTOMATIQUE  ·  data-pg-autosave sur le <form>
     ------------------------------------------------------------------------
     <form data-pg-autosave data-pg-autosave-url="/api/declarations/42">
     <span class="pg-autosave" data-state="idle">
       <span class="pg-autosave__dot"></span><span data-pg-autosave-label>…</span>
     </span>

     Le formulaire se sauvegarde 1,2 s apres la derniere frappe. Il n'y a
     PAS de bouton « Enregistrer » sur un formulaire a sauvegarde auto —
     seulement des boutons qui font avancer.

     L'evenement `pg:autosave` est emis sur le formulaire avec le FormData ;
     le dev y branche son appel serveur, ou renseigne data-pg-autosave-url
     pour utiliser l'envoi POST par defaut.
     ==================================================================== */

  var AUTOSAVE_DELAY = 1200;
  var timers = new WeakMap();

  function setAutosaveState(form, state, text) {
    var box = document.querySelector('[data-pg-autosave-for="' + form.id + '"]') ||
              form.querySelector(".pg-autosave") ||
              document.querySelector(".pg-autosave");
    if (!box) return;
    box.setAttribute("data-state", state);
    var label = box.querySelector("[data-pg-autosave-label]");
    if (label) label.textContent = text;
  }

  /* --- File d'attente locale ------------------------------------------------
     Un chef de station saisit 135 champs debout sur une piste. Poster
     directement toutes les 1,2 s echouera des que le reseau faiblit, et la
     saisie sera perdue.

     REGLE : on COALESCE, on n'empile pas. Une seule photo en attente par
     formulaire, remplacee a chaque frappe. Vingt minutes de saisie hors
     ligne ne doivent pas produire 500 requetes a rejouer — juste un etat
     final a envoyer.

     La file survit a un rechargement de page et a une fermeture d'onglet. */

  var QUEUE_PREFIX = "pg.queue.";
  var backoff = 0;

  function queueKey(form) { return QUEUE_PREFIX + (form.id || "form"); }

  function serialiser(form) {
    var o = {};
    new FormData(form).forEach(function (v, k) {
      if (o[k] === undefined) o[k] = v;
      else { if (!Array.isArray(o[k])) o[k] = [o[k]]; o[k].push(v); }
    });
    return o;
  }

  function enfiler(form) {
    try {
      localStorage.setItem(queueKey(form), JSON.stringify({
        url: form.getAttribute("data-pg-autosave-url") || "",
        data: serialiser(form),
        ts: Date.now()
      }));
      return true;
    } catch (err) { return false; }   // quota plein, navigation privee…
  }

  function enAttente() {
    var n = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).indexOf(QUEUE_PREFIX) === 0) n++;
      }
    } catch (err) {}
    return n;
  }

  function heure() {
    return new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  function vider(form) {
    if (!navigator.onLine) {
      setAutosaveState(form, "queued", "Hors ligne — " + enAttente() + " en attente");
      return;
    }
    var brut;
    try { brut = localStorage.getItem(queueKey(form)); } catch (err) { brut = null; }
    if (!brut) return;

    var item = JSON.parse(brut);
    if (!item.url) {                       // pas d'URL : le dev gere l'envoi
      try { localStorage.removeItem(queueKey(form)); } catch (err) {}
      setAutosaveState(form, "saved", "Enregistre a " + heure());
      return;
    }

    setAutosaveState(form, "saving", "Enregistrement…");
    fetch(item.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.data)
    })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        try { localStorage.removeItem(queueKey(form)); } catch (err) {}
        backoff = 0;
        setAutosaveState(form, "saved", "Enregistre a " + heure());
      })
      .catch(function () {
        /* On GARDE la photo en file : rien n'est perdu. Nouvelle tentative
           avec un recul croissant, plafonne a 30 s. */
        backoff = Math.min(backoff ? backoff * 2 : 2000, 30000);
        setAutosaveState(form, "queued", "Reseau indisponible — sera envoye");
        setTimeout(function () { vider(form); }, backoff);
      });
  }

  function runAutosave(form) {
    var data = new FormData(form);
    var ev = new CustomEvent("pg:autosave", { detail: { data: data }, cancelable: true, bubbles: true });
    if (!form.dispatchEvent(ev)) return;   // le dev a pris la main

    if (!enfiler(form)) { setAutosaveState(form, "error", "Stockage local indisponible"); return; }
    vider(form);
  }

  function scheduleAutosave(e) {
    var form = closestFrom(e.target, "form[data-pg-autosave]");
    if (!form) return;
    setAutosaveState(form, "idle", "Modifications non enregistrees");
    clearTimeout(timers.get(form));
    timers.set(form, setTimeout(function () { runAutosave(form); }, AUTOSAVE_DELAY));
  }

  /* Retour du reseau : on vide tout ce qui attend, sans attendre une frappe. */
  function reprendre() {
    backoff = 0;
    document.querySelectorAll("form[data-pg-autosave]").forEach(vider);
  }
  window.addEventListener("online", reprendre);
  window.addEventListener("offline", function () {
    document.querySelectorAll("form[data-pg-autosave]").forEach(function (f) {
      setAutosaveState(f, "queued", "Hors ligne — " + enAttente() + " en attente");
    });
  });

  /* ========================================================================
     MODALE  ·  data-pg-open="<id>"  /  data-pg-close
     ------------------------------------------------------------------------
     <button data-pg-open="m-new"&gt;Nouvelle declaration</button>
     <dialog class="pg-modal" id="m-new">…</dialog>

     Bati sur <dialog> : le piege de focus, la touche Echap et la
     superposition sont fournis par le navigateur. On n'ajoute que la
     fermeture au clic sur le fond, que <dialog> ne fait pas tout seul.
     ==================================================================== */

  function openModal(id) {
    var dlg = document.getElementById(id);
    if (!dlg || typeof dlg.showModal !== "function") return;
    dlg.showModal();
    var premier = dlg.querySelector("[autofocus], input:not([type=hidden]), select, textarea");
    if (premier) premier.focus();
  }

  /* Clic sur le fond : <dialog> considere le backdrop comme faisant partie
     du dialogue, il faut donc comparer les coordonnees a sa boite. Une
     modale de progression (data-pg-persistent) ne se ferme pas ainsi. */
  function backdropClick(e) {
    var dlg = e.target;
    if (!dlg || dlg.tagName !== "DIALOG" || !dlg.open) return;
    if (dlg.hasAttribute("data-pg-persistent")) return;
    var r = dlg.getBoundingClientRect();
    var dedans = e.clientX >= r.left && e.clientX <= r.right &&
                 e.clientY >= r.top  && e.clientY <= r.bottom;
    if (!dedans) dlg.close("cancel");
  }

  /* ========================================================================
     ZONE DE DEPOT  ·  data-pg-drop
     ------------------------------------------------------------------------
     <label class="pg-drop" data-pg-drop data-pg-accept=".pdf,.jpg,.png"
            data-pg-max-mb="5">
       <input type="file" class="pg-visually-hidden" multiple>
     </label>

     Emet `pg:files` avec { acceptes, refuses }. L'etat visuel (survol,
     refus) est gere ici ; l'envoi reste a la charge de l'integrateur.
     ==================================================================== */

  function fichierValide(zone, file) {
    var accept = zone.getAttribute("data-pg-accept");
    var maxMo = parseFloat(zone.getAttribute("data-pg-max-mb") || "0");
    if (maxMo && file.size > maxMo * 1024 * 1024) return false;
    if (!accept) return true;
    var ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    return accept.split(",").some(function (a) { return a.trim().toLowerCase() === ext; });
  }

  function traiterFichiers(zone, liste) {
    var acceptes = [], refuses = [];
    Array.prototype.forEach.call(liste, function (f) {
      (fichierValide(zone, f) ? acceptes : refuses).push(f);
    });
    zone.classList.remove("is-dragover");
    if (refuses.length) {
      zone.classList.add("is-rejected");
      setTimeout(function () { zone.classList.remove("is-rejected"); }, 2200);
    }
    zone.dispatchEvent(new CustomEvent("pg:files", {
      detail: { acceptes: acceptes, refuses: refuses },
      bubbles: true
    }));
  }

  function dropHandlers() {
    ["dragenter", "dragover"].forEach(function (type) {
      document.addEventListener(type, function (e) {
        var zone = closestFrom(e.target, "[data-pg-drop]");
        if (!zone) return;
        e.preventDefault();
        zone.classList.add("is-dragover");
      });
    });
    document.addEventListener("dragleave", function (e) {
      var zone = closestFrom(e.target, "[data-pg-drop]");
      // Ne retire l'etat que si le curseur quitte reellement la zone.
      if (zone && !zone.contains(e.relatedTarget)) zone.classList.remove("is-dragover");
    });
    document.addEventListener("drop", function (e) {
      var zone = closestFrom(e.target, "[data-pg-drop]");
      if (!zone) return;
      e.preventDefault();
      traiterFichiers(zone, e.dataTransfer.files);
    });
    document.addEventListener("change", function (e) {
      var zone = closestFrom(e.target, "[data-pg-drop]");
      if (zone && e.target.type === "file") traiterFichiers(zone, e.target.files);
    });
  }

  /* ========================================================================
     LIGNES REPETABLES  ·  data-pg-repeat
     ------------------------------------------------------------------------
     <div data-pg-repeat>
       <template data-pg-repeat-template>…une ligne…</template>
       <div data-pg-repeat-rows>…</div>
       <button data-pg-repeat-add>+ Ajouter un produit</button>
     </div>
     Un bouton [data-pg-repeat-remove] dans une ligne la supprime.
     La derniere ligne ne se supprime pas.
     ==================================================================== */

  function majBoutonsRepeat(bloc) {
    var rows = bloc.querySelectorAll("[data-pg-repeat-rows] > *");
    rows.forEach(function (r) {
      var btn = r.querySelector("[data-pg-repeat-remove]");
      if (btn) btn.disabled = rows.length <= 1;
    });
  }

  function repeatAdd(bloc) {
    var tpl = bloc.querySelector("[data-pg-repeat-template]");
    var rows = bloc.querySelector("[data-pg-repeat-rows]");
    if (!tpl || !rows) return;
    rows.appendChild(tpl.content.cloneNode(true));
    majBoutonsRepeat(bloc);
    var dernier = rows.lastElementChild;
    var champ = dernier && dernier.querySelector("input, select");
    if (champ) champ.focus();
  }

  function repeatRemove(bouton) {
    var bloc = bouton.closest("[data-pg-repeat]");
    var rows = bloc.querySelector("[data-pg-repeat-rows]");
    if (rows.children.length <= 1) return;
    bouton.closest("[data-pg-repeat-rows] > *").remove();
    majBoutonsRepeat(bloc);
  }

  /* ========================================================================
     MODE DE SAISIE FOCALISE  ·  data-pg-entry
     ------------------------------------------------------------------------
     <div class="pg-entry" data-pg-entry>
       <button class="pg-entry__field" data-pg-entry-field="stock_debut">
         <span class="pg-entry__label">Stock début</span>
         <span class="pg-entry__value" data-pg-entry-value>32 349,63</span>
       </button>
       …
       <div class="pg-keypad">
         <button class="pg-keypad__key" data-pg-key="7">7</button>
         <button class="pg-keypad__key" data-pg-key="," >,</button>
         <button class="pg-keypad__key" data-pg-key="del">⌫</button>
       </div>
       <button class="pg-keypad__next" data-pg-key="next">Suivant</button>
     </div>

     Emet `pg:entry-change` sur le conteneur a chaque frappe, avec
     { champ, valeur, valeurs } — le calcul de l'ecart est de la logique
     metier, il reste a la charge de l'integrateur.
     ==================================================================== */

  function champsSaisissables(bloc) {
    return Array.prototype.slice.call(bloc.querySelectorAll("[data-pg-entry-field]"))
      .filter(function (f) { return !f.hasAttribute("disabled"); });
  }

  /* Le type du champ decide de la surface de saisie affichee a droite.
     Mesure sur la plateforme : les 135 champs d'un journal ne sont PAS tous
     numeriques — il y a des « motifs » en texte et des cases a cocher. */
  function typeChamp(champ) { return champ.getAttribute("data-pg-type") || "num"; }

  function majAvancement(bloc) {
    var champs = champsSaisissables(bloc);
    var remplis = champs.filter(function (f) {
      var v = f.querySelector("[data-pg-entry-value]");
      if (v) return (v.dataset.raw || "") !== "";
      var i = f.querySelector("input");
      return i ? i.value !== "" : false;
    }).length;
    var total = parseInt(bloc.getAttribute("data-pg-total") || champs.length, 10);
    var fait = parseInt(bloc.getAttribute("data-pg-done") || 0, 10) + remplis;

    var fill = bloc.querySelector(".pg-entry__progress-fill");
    var text = bloc.querySelector(".pg-entry__progress-text");
    if (fill) fill.style.width = total ? Math.round((fait / total) * 100) + "%" : "0%";
    if (text) text.textContent = fait + " / " + total + " champs";
  }

  function activerChamp(champ) {
    var bloc = champ.closest("[data-pg-entry]");
    champsSaisissables(bloc).forEach(function (f) {
      f.classList.remove("is-active");
      delete f.dataset.fresh;
    });
    champ.classList.add("is-active");
    bloc.setAttribute("data-mode", typeChamp(champ));

    /* Un champ texte rend la main au clavier du systeme : on focalise le
       vrai <input> pour que le clavier s'ouvre. */
    if (typeChamp(champ) === "text") {
      var saisie = champ.querySelector("input, textarea");
      if (saisie) { saisie.focus(); saisie.select(); }
    }
    /* Champ « frais » : le premier chiffre tape REMPLACE la valeur au lieu de
       s'y ajouter. C'est le geste de correction — on retape une jauge mal
       lue, on ne la complete pas. La correction arriere, elle, travaille
       toujours sur la valeur existante. */
    champ.dataset.fresh = "1";
    champ.scrollIntoView({ block: "nearest" });
  }

  function champActif(bloc) { return bloc.querySelector("[data-pg-entry-field].is-active"); }

  /* Formatage a la francaise pendant la frappe : espace insecable etroite
     tous les trois chiffres, virgule decimale. La valeur brute reste
     lisible via dataset.raw. */
  function formaterFR(brut) {
    if (brut === "" || brut === "-") return brut;
    var parts = brut.split(",");
    var entier = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts.length > 1 ? entier + "," + parts[1] : entier;
  }

  function ecrire(bloc, champ, touche) {
    if (typeChamp(champ) !== "num") return;   // le pave ne pilote que le numerique
    var cible = champ.querySelector("[data-pg-entry-value]");
    if (!cible) return;
    var brut = cible.dataset.raw !== undefined
      ? cible.dataset.raw
      : (cible.textContent || "").replace(/[\s ]/g, "");

    var frais = champ.dataset.fresh === "1";
    delete champ.dataset.fresh;

    if (touche === "del") {
      brut = brut.slice(0, -1);
    } else if (touche === "clear") {
      brut = "";
    } else if (touche === ",") {
      if (frais) brut = "0";
      if (brut.indexOf(",") === -1) brut = (brut || "0") + ",";
    } else {
      if (frais) brut = "";                 // premier chiffre : on remplace
      // Deux decimales au maximum : au-dela, la jauge n'est pas plus precise.
      var dec = brut.split(",")[1];
      if (dec !== undefined && dec.length >= 2) return;
      if (brut === "0") brut = "";
      brut += touche;
    }

    cible.dataset.raw = brut;
    cible.textContent = formaterFR(brut);

    majAvancement(bloc);

    bloc.dispatchEvent(new CustomEvent("pg:entry-change", {
      bubbles: true,
      detail: {
        champ: champ.getAttribute("data-pg-entry-field"),
        valeur: brut === "" ? null : parseFloat(brut.replace(",", ".")),
        element: champ
      }
    }));
  }

  function champSuivant(bloc) {
    var champs = champsSaisissables(bloc);
    var i = champs.indexOf(champActif(bloc));
    if (i > -1 && i < champs.length - 1) { activerChamp(champs[i + 1]); return; }
    // Dernier champ du produit : on passe au produit suivant.
    bloc.dispatchEvent(new CustomEvent("pg:entry-next-product", { bubbles: true }));
  }

  function toucheClavier(e) {
    var bloc = document.querySelector("[data-pg-entry]");
    if (!bloc || !champActif(bloc)) return;
    if (typeChamp(champActif(bloc)) !== "num") return;  // champ texte : le clavier lui appartient
    if (/^(INPUT|TEXTAREA)$/.test((e.target.tagName || ""))) return;
    var k = e.key;
    if (/^[0-9]$/.test(k))                    { e.preventDefault(); ecrire(bloc, champActif(bloc), k); }
    else if (k === "," || k === ".")          { e.preventDefault(); ecrire(bloc, champActif(bloc), ","); }
    else if (k === "Backspace")               { e.preventDefault(); ecrire(bloc, champActif(bloc), "del"); }
    else if (k === "Enter" || k === "Tab")    { e.preventDefault(); champSuivant(bloc); }
  }

  /* ========================================================================
     LATERALITE  ·  data-pg-hand-toggle
     ------------------------------------------------------------------------
     REGLE : on demande, on ne devine pas. La lateralite ne se detecte pas
     de facon fiable, et se tromper coute plus cher que de poser la question
     une fois — le rail passerait sous la main libre et le pave sous la main
     qui tient, ce qui rend l'ecran inutilisable.

     Le choix est memorise et vaut pour toutes les saisies suivantes.
     ==================================================================== */

  function basculerMain() {
    var bloc = document.querySelector("[data-pg-entry]");
    if (!bloc) return;
    var miroir = bloc.classList.toggle("pg-entry--mirror");
    try { localStorage.setItem("pg.hand", miroir ? "left" : "right"); } catch (err) {}
    var b = document.querySelector("[data-pg-hand-toggle]");
    if (b) b.setAttribute("aria-pressed", miroir ? "true" : "false");
  }

  function restaurerMain() {
    var bloc = document.querySelector("[data-pg-entry]");
    if (!bloc) return;
    try {
      if (localStorage.getItem("pg.hand") === "left") {
        bloc.classList.add("pg-entry--mirror");
        var b = document.querySelector("[data-pg-hand-toggle]");
        if (b) b.setAttribute("aria-pressed", "true");
      }
    } catch (err) {}
  }

  /* ========================================================================
     SECTION REPETABLE DANS LE FLUX  ·  data-pg-entry-add
     ------------------------------------------------------------------------
     Les Depenses de la journee, les Credits clients et les Manquants
     pompistes de l'etape Caisse sont des listes ouvertes : on y ajoute
     autant de lignes que necessaire.

     Le bouton vit DANS le rail, en fin de section — la ou l'utilisateur
     constate qu'il lui manque une ligne. Emet `pg:entry-add` ; c'est
     l'application qui cree la ligne, puis appelle activerLigne().
     ==================================================================== */

  function ajouterLigne(bouton) {
    var bloc = bouton.closest("[data-pg-entry]");
    bloc.dispatchEvent(new CustomEvent("pg:entry-add", {
      bubbles: true,
      detail: { section: bouton.getAttribute("data-pg-entry-add") }
    }));
  }

  /* ========================================================================
     NAVIGATION LATERALE  ·  data-pg-nav-toggle (tablette)
     ==================================================================== */

  function toggleNav() {
    var app = document.querySelector(".pg-app");
    if (app) app.classList.toggle("is-nav-open");
  }

  /* ========================================================================
     TOAST  ·  pgToast(options)
     ------------------------------------------------------------------------
     #toastContainer existe deja dans le shell de l application et n est
     jamais utilise. On s en sert — mais pour CONFIRMER, pas pour alerter :
     une erreur de validation appartient au champ concerne, pas a un coin de
     l ecran que personne ne regarde.

         pgToast({ titre: 'Journal soumis', texte: '07/09 · Barka Darsalamy' });
         pgToast({ titre: 'Export pret', action: 'Telecharger', onAction: fn });
     ==================================================================== */

  var ICONES = { success: 'i-check', error: 'i-alert', warning: 'i-alert', info: 'i-help' };

  function pgToast(o) {
    o = o || {};
    var zone = document.querySelector('.pg-toasts');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'pg-toasts';
      zone.setAttribute('role', 'status');
      zone.setAttribute('aria-live', 'polite');
      document.body.appendChild(zone);
    }

    var t = document.createElement('div');
    t.className = 'pg-toast' + (o.type ? ' pg-toast--' + o.type : '');
    t.innerHTML =
      '<svg class="pg-icon pg-toast__icon"><use href="#' + (ICONES[o.type] || 'i-check') + '"></use></svg>' +
      '<div class="pg-toast__body"><div class="pg-toast__title"></div>' +
      (o.texte ? '<div class="pg-toast__text"></div>' : '') + '</div>' +
      (o.action ? '<button class="pg-toast__action" type="button"></button>' : '') +
      '<button class="pg-toast__close" type="button" aria-label="Fermer">' +
      '<svg class="pg-icon"><use href="#i-x"></use></svg></button>';

    t.querySelector('.pg-toast__title').textContent = o.titre || '';
    if (o.texte) t.querySelector('.pg-toast__text').textContent = o.texte;
    if (o.action) {
      var b = t.querySelector('.pg-toast__action');
      b.textContent = o.action;
      b.addEventListener('click', function () { if (o.onAction) o.onAction(); fermer(); });
    }

    function fermer() {
      t.classList.add('is-leaving');
      setTimeout(function () { t.remove(); }, 220);
    }
    t.querySelector('.pg-toast__close').addEventListener('click', fermer);

    zone.appendChild(t);
    /* Un toast porteur d une action ne disparait pas tout seul : on ne
       retire pas une action sous les doigts de l utilisateur. */
    if (!o.action) setTimeout(fermer, o.duree || 5000);
    return { fermer: fermer };
  }
  window.pgToast = pgToast;

  /* ========================================================================
     BARRE DE CHARGEMENT  ·  pgLoad.start() / pgLoad.done()
     ------------------------------------------------------------------------
     Progresse par paliers DECROISSANTS et ne finit jamais seule : une barre
     qui atteint 100 % avant la reponse ment a l utilisateur.
     ==================================================================== */

  var lbEl, lbFill, lbTimer, lbPct = 0;

  function lbCreer() {
    if (lbEl) return;
    lbEl = document.querySelector('.pg-loadbar');
    if (!lbEl) {
      lbEl = document.createElement('div');
      lbEl.className = 'pg-loadbar';
      lbEl.innerHTML = '<div class="pg-loadbar__fill"></div>';
      document.body.appendChild(lbEl);
    }
    lbFill = lbEl.querySelector('.pg-loadbar__fill');
  }

  var pgLoad = {
    start: function () {
      lbCreer();
      lbEl.classList.remove('is-done');
      lbPct = 0; lbFill.style.width = '0%';
      clearInterval(lbTimer);
      lbTimer = setInterval(function () {
        /* On ne depasse jamais 90 % : les 10 derniers pour cent
           appartiennent a la reponse reelle. */
        lbPct += (90 - lbPct) * 0.12;
        lbFill.style.width = lbPct.toFixed(1) + '%';
      }, 220);
    },
    done: function () {
      if (!lbEl) return;
      clearInterval(lbTimer);
      lbEl.classList.add('is-done');
    }
  };
  window.pgLoad = pgLoad;

  /* ========================================================================
     RECHERCHE GLOBALE  ·  Ctrl+K  /  data-pg-palette
     ------------------------------------------------------------------------
     Portee : toute l application. A ne pas confondre avec .pg-search, qui
     filtre la liste courante. Deux portees, deux composants.
     ==================================================================== */

  function paletteOuvrir() {
    var p = document.querySelector('.pg-palette');
    if (!p || p.open) return;
    p.showModal();
    var i = p.querySelector('.pg-palette__input');
    if (i) { i.value = ''; i.focus(); paletteFiltrer(p, ''); }
  }

  function paletteFiltrer(p, q) {
    q = (q || '').trim().toLowerCase();
    var visibles = 0;
    p.querySelectorAll('.pg-palette__item').forEach(function (it) {
      var lab = it.querySelector('.pg-palette__label');
      var txt = (it.getAttribute('data-pg-search') || lab.textContent).toLowerCase();
      var ok = !q || txt.indexOf(q) > -1;
      it.hidden = !ok;
      it.classList.remove('is-active');
      if (ok) {
        visibles++;
        var brut = lab.getAttribute('data-brut') || lab.textContent;
        lab.setAttribute('data-brut', brut);
        if (q) {
          var i = brut.toLowerCase().indexOf(q);
          lab.innerHTML = i > -1
            ? brut.slice(0, i) + '<mark>' + brut.slice(i, i + q.length) + '</mark>' + brut.slice(i + q.length)
            : brut;
        } else { lab.textContent = brut; }
      }
    });
    /* Un groupe sans resultat disparait avec son titre. */
    p.querySelectorAll('.pg-palette__group').forEach(function (g) {
      var n = g.nextElementSibling, reste = false;
      while (n && !n.classList.contains('pg-palette__group')) {
        if (!n.hidden) reste = true;
        n = n.nextElementSibling;
      }
      g.hidden = !reste;
    });
    var vide = p.querySelector('.pg-palette__empty');
    if (vide) vide.hidden = visibles > 0;
    var prem = p.querySelector('.pg-palette__item:not([hidden])');
    if (prem) prem.classList.add('is-active');
  }

  function paletteNav(p, sens) {
    var items = Array.prototype.filter.call(p.querySelectorAll('.pg-palette__item'), function (i) { return !i.hidden; });
    if (!items.length) return;
    var i = items.findIndex(function (x) { return x.classList.contains('is-active'); });
    items.forEach(function (x) { x.classList.remove('is-active'); });
    var n = items[(i + sens + items.length) % items.length];
    n.classList.add('is-active');
    n.scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteOuvrir(); return; }
    var p = document.querySelector('.pg-palette[open]');
    if (!p) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); paletteNav(p, 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); paletteNav(p, -1); }
    else if (e.key === 'Enter') {
      var a = p.querySelector('.pg-palette__item.is-active');
      if (a) { e.preventDefault(); a.click(); p.close(); }
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.classList && e.target.classList.contains('pg-palette__input')) {
      paletteFiltrer(e.target.closest('.pg-palette'), e.target.value);
    }
  });

  /* ========================================================================
     BRANCHEMENT
     ==================================================================== */

  document.addEventListener("click", function (e) {
    var trigger = closestFrom(e.target, "[data-pg-menu]");
    if (trigger) { e.preventDefault(); e.stopPropagation(); toggleMenu(trigger); return; }

    if (closestFrom(e.target, ".pg-menu")) {
      if (closestFrom(e.target, '[role="menuitem"]')) closeMenu();
      return;
    }
    closeMenu();

    var tab = closestFrom(e.target, '[data-pg-tabs] [role="tab"]');
    if (tab) { e.preventDefault(); selectTab(tab); return; }

    var sort = closestFrom(e.target, "[data-pg-sort]");
    if (sort) { e.preventDefault(); sortTable(sort); return; }

    if (closestFrom(e.target, "[data-pg-toggle-sidebar]")) { e.preventDefault(); toggleSidebar(); return; }

    if (closestFrom(e.target, "[data-pg-palette]")) { e.preventDefault(); paletteOuvrir(); return; }

    var ouvre = closestFrom(e.target, "[data-pg-open]");
    if (ouvre) { e.preventDefault(); openModal(ouvre.getAttribute("data-pg-open")); return; }

    var ferme = closestFrom(e.target, "[data-pg-close]");
    if (ferme) {
      var d = ferme.closest("dialog");
      if (d) { e.preventDefault(); d.close("cancel"); return; }
    }

    var ajoute = closestFrom(e.target, "[data-pg-repeat-add]");
    if (ajoute) { e.preventDefault(); repeatAdd(ajoute.closest("[data-pg-repeat]")); return; }

    var retire = closestFrom(e.target, "[data-pg-repeat-remove]");
    if (retire) { e.preventDefault(); repeatRemove(retire); return; }

    if (closestFrom(e.target, "[data-pg-nav-toggle], .pg-sidebar-backdrop")) { e.preventDefault(); toggleNav(); return; }

    /* AVANT le gestionnaire de champ : un bouton Oui/Non vit a l interieur
       d un [data-pg-entry-field], qui l intercepterait sinon. */
    var choix = closestFrom(e.target, ".pg-entry__choice");
    if (choix) {
      e.preventDefault();
      var groupe = choix.closest(".pg-entry__choices");
      groupe.querySelectorAll(".pg-entry__choice").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
      choix.setAttribute("aria-pressed", "true");
      /* Repondre rend aussi le champ actif : « Suivant » enchaine alors
         depuis le bon endroit, et le rail reste coherent. */
      var champCase = choix.closest("[data-pg-entry-field]");
      if (champCase) activerChamp(champCase);
      return;
    }

    var champ = closestFrom(e.target, "[data-pg-entry-field]");
    if (champ) { e.preventDefault(); activerChamp(champ); return; }

    var touche = closestFrom(e.target, "[data-pg-key]");
    if (touche) {
      e.preventDefault();
      var bloc = touche.closest("[data-pg-entry]");
      var actif = bloc && champActif(bloc);
      var k = touche.getAttribute("data-pg-key");
      if (k === "next") { if (bloc) champSuivant(bloc); }
      else if (actif)   { ecrire(bloc, actif, k); }
      return;
    }

    if (closestFrom(e.target, "[data-pg-hand-toggle]")) { e.preventDefault(); basculerMain(); return; }

    var ajout = closestFrom(e.target, "[data-pg-entry-add]");
    if (ajout) { e.preventDefault(); ajouterLigne(ajout); return; }

    var etape = closestFrom(e.target, ".pg-entry__step");
    if (etape) {
      e.preventDefault();
      var ouvert = etape.getAttribute("aria-expanded") === "true";
      etape.closest("[data-pg-entry]").querySelectorAll(".pg-entry__step")
        .forEach(function (s2) { s2.setAttribute("aria-expanded", "false"); });
      etape.setAttribute("aria-expanded", ouvert ? "false" : "true");
      return;
    }

    var item = closestFrom(e.target, "[data-pg-entry-item]");
    if (item) {
      e.preventDefault();
      var rail = item.closest("[data-pg-entry]");
      rail.querySelectorAll("[data-pg-entry-item]").forEach(function (i) { i.setAttribute("aria-current", "false"); });
      item.setAttribute("aria-current", "true");
      rail.dispatchEvent(new CustomEvent("pg:entry-product", {
        bubbles: true, detail: { produit: item.getAttribute("data-pg-entry-item") }
      }));
      return;
    }

    rowActivate(e);
  });

  document.addEventListener("keydown", toucheClavier);

  document.addEventListener("click", backdropClick);
  dropHandlers();
  document.querySelectorAll("[data-pg-repeat]").forEach(majBoutonsRepeat);

  document.addEventListener("keydown", function (e) { menuKeydown(e); tabsKeydown(e); });
  document.addEventListener("input", scheduleAutosave);
  document.addEventListener("change", scheduleAutosave);
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);

  function demarrer() { restoreSidebar(); restaurerMain(); verifierLignesCliquables(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer);
  else demarrer();
})();
