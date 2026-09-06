/* GATAS Lab — table sorting/filtering, the photo lightbox, the hero video's
   pause control, and the copy-link button in the share row. All of it is
   progressive enhancement: without JS the tables render pre-sorted, a gallery
   photo is a plain link to the full-size image, the hero video keeps the native
   controls the template gives it, and the copy button never appears. */

(function () {
  "use strict";

  /* ----------------------------------------------------------------- tables */

  function cellKey(row, index) {
    var cell = row.cells[index];
    if (!cell) return "";
    var key = cell.getAttribute("data-sortkey");
    return key !== null ? key : cell.textContent.trim();
  }

  function compare(a, b) {
    var na = parseFloat(a);
    var nb = parseFloat(b);
    if (!isNaN(na) && !isNaN(nb) && String(na) === a.trim() && String(nb) === b.trim()) {
      return na - nb;
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }

  /* A header's position among the *sortable* headers is not its position in the
     row. `bibtable` lets `columns` put the unsortable link column anywhere, and
     `datatable` appends one, so the two indices only coincide while every
     unsortable column happens to sit last. Ask the row where the cell actually
     is. */
  function columnIndex(th) {
    return Array.prototype.indexOf.call(th.parentNode.cells, th);
  }

  function setupSorting(table) {
    var headers = table.querySelectorAll("thead th[data-sort]");
    Array.prototype.forEach.call(headers, function (th) {
      var index = columnIndex(th);
      if (index < 0) return;

      /* The `th` keeps its native columnheader role -- that is what tells a
         screen reader which column each cell belongs to, and `aria-sort` is
         only meaningful on it. Putting role="button" on the `th` replaced that
         role and threw both away, so the control is a real button inside the
         header instead. It also brings keyboard support with it. */
      var button = document.createElement("button");
      button.type = "button";
      button.className = "gatas-sort";
      while (th.firstChild) button.appendChild(th.firstChild);
      th.appendChild(button);

      button.addEventListener("click", function () {
        var body = table.tBodies[0];
        if (!body) return;
        var rows = Array.prototype.slice.call(body.rows);
        var descending = th.getAttribute("aria-sort") !== "descending";
        Array.prototype.forEach.call(headers, function (other) {
          other.removeAttribute("aria-sort");
        });
        th.setAttribute("aria-sort", descending ? "descending" : "ascending");
        rows.sort(function (r1, r2) {
          var result = compare(cellKey(r1, index), cellKey(r2, index));
          return descending ? -result : result;
        });
        rows.forEach(function (row) { body.appendChild(row); });
      });
    });
  }

  function setupFiltering(wrap, table) {
    var input = wrap.querySelector("input[data-filter-input]");
    var selects = wrap.querySelectorAll("select[data-filter-column]");
    var counter = wrap.querySelector("[data-filter-count]");
    if (!input && !selects.length) return;

    function apply() {
      var needle = input ? input.value.trim().toLowerCase() : "";
      var rows = table.tBodies[0] ? table.tBodies[0].rows : [];
      var shown = 0;
      Array.prototype.forEach.call(rows, function (row) {
        var visible = !needle || row.textContent.toLowerCase().indexOf(needle) !== -1;
        Array.prototype.forEach.call(selects, function (select) {
          if (!visible || !select.value) return;
          var index = parseInt(select.getAttribute("data-filter-column"), 10);
          var cell = row.cells[index];
          if (!cell || cell.textContent.trim() !== select.value) visible = false;
        });
        row.hidden = !visible;
        if (visible) shown++;
      });
      if (counter) {
        counter.textContent = shown + " of " + rows.length + " shown";
      }
    }

    if (input) input.addEventListener("input", apply);
    Array.prototype.forEach.call(selects, function (select) {
      select.addEventListener("change", apply);
    });
    apply();
  }

  /* -------------------------------------------------------------- lightbox */

  /* The gallery and collage shortcodes wrap every thumbnail in an anchor whose
     href is the full-size rendition. That anchor is the whole accessibility
     story here: it is focusable and activates from the keyboard for free, it
     makes the `:focus-within` rules in custom.css reachable, and with JS off it
     still does something useful -- it opens the photo. The lightbox is the
     enhancement on top, and it reads the full-size URL from the href rather
     than enlarging the cropped thumbnail. */
  function setupLightbox() {
    var galleries = document.querySelectorAll(".gatas-gallery, .gatas-collage");
    if (!galleries.length || typeof HTMLDialogElement === "undefined") return;

    var dialog = document.createElement("dialog");
    dialog.className = "gatas-lightbox";
    dialog.innerHTML =
      '<button type="button" class="gatas-lightbox__close" aria-label="Close">&times;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(dialog);

    var image = dialog.querySelector("img");
    var caption = dialog.querySelector("figcaption");
    var current = [];
    var position = 0;
    var opener = null;

    function show(index) {
      position = (index + current.length) % current.length;
      var link = current[position];
      var thumb = link.querySelector("img");
      image.src = link.getAttribute("href");
      image.alt = (thumb && thumb.alt) || "";
      caption.textContent =
        link.getAttribute("data-caption") || (thumb && thumb.alt) || "";
    }

    Array.prototype.forEach.call(galleries, function (gallery) {
      var links = Array.prototype.slice.call(gallery.querySelectorAll("a[data-lightbox]"));
      links.forEach(function (link, index) {
        link.addEventListener("click", function (event) {
          event.preventDefault();
          current = links;
          opener = link;
          show(index);
          dialog.showModal();
        });
      });
    });

    dialog.querySelector(".gatas-lightbox__close").addEventListener("click", function () {
      dialog.close();
    });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) dialog.close();
    });
    /* Send focus back to the photo that opened it, so a keyboard user does not
       land at the top of the document on every close. */
    dialog.addEventListener("close", function () {
      if (opener) opener.focus();
    });
    document.addEventListener("keydown", function (event) {
      if (!dialog.open || current.length < 2) return;
      if (event.key === "ArrowRight") show(position + 1);
      if (event.key === "ArrowLeft") show(position - 1);
    });
  }

  /* ------------------------------------------------------------ hero video */

  /* A hero video autoplays, because a paused simulation is a still frame with
     no play button on it. It also loops indefinitely, and WCAG 2.2.2 asks for a
     way to stop anything that moves for more than five seconds -- the
     Decapodes hero runs 16.7s a lap -- so a pause control is not optional.

     The template ships the video with native `controls`, which covers the
     requirement when this file does not load. Where it does load we take those
     away and put one small button in the corner of the plate instead: less
     furniture over the picture, still a real focusable button. A reduced-motion
     preference additionally holds the poster instead of playing. */
  function setupHeroVideos() {
    var videos = document.querySelectorAll(".gatas-hero__video");
    if (!videos.length) return;

    var calm = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    Array.prototype.forEach.call(videos, function (video) {
      video.controls = false;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "gatas-hero__toggle";

      function render() {
        var label = video.paused ? "Play" : "Pause";
        button.textContent = label;
        button.setAttribute("aria-label", label + " the background video");
      }

      button.addEventListener("click", function () {
        if (video.paused) {
          var started = video.play();
          if (started && started.catch) started.catch(function () {});
        } else {
          video.pause();
        }
      });

      video.addEventListener("play", render);
      video.addEventListener("pause", render);

      if (calm) {
        video.autoplay = false;
        video.loop = false;
        video.pause();
      }

      render();
      (video.parentNode || video).appendChild(button);
    });
  }

  /* ---------------------------------------------------------- copy a link */

  /* The share row's Bluesky and LinkedIn links work without JS; the copy
     button cannot, so the template ships it hidden and it is revealed only
     where the clipboard API is actually available. */
  function setupCopyLinks() {
    if (!navigator.clipboard) return;
    Array.prototype.forEach.call(document.querySelectorAll(".gatas-share__copy"), function (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        navigator.clipboard.writeText(button.getAttribute("data-url") || location.href).then(function () {
          var original = button.textContent;
          button.textContent = "Copied";
          setTimeout(function () { button.textContent = original; }, 1600);
        });
      });
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".gatas-tablewrap"), function (wrap) {
      var table = wrap.querySelector("table.gatas-table");
      if (!table) return;
      setupSorting(table);
      setupFiltering(wrap, table);
    });
    setupLightbox();
    setupHeroVideos();
    setupCopyLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
