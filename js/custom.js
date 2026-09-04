/* GATAS Lab — table sorting/filtering, the photo lightbox, and the copy-link
   button in the share row. All of it is progressive enhancement: without JS
   the tables render pre-sorted, the gallery images stay plain links to the
   full image, and the copy button never appears. */

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

  function setupSorting(table) {
    var headers = table.querySelectorAll("thead th[data-sort]");
    Array.prototype.forEach.call(headers, function (th, index) {
      th.setAttribute("tabindex", "0");
      th.setAttribute("role", "button");
      var sort = function () {
        var body = table.tBodies[0];
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
      };
      th.addEventListener("click", sort);
      th.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sort();
        }
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

    function show(index) {
      position = (index + current.length) % current.length;
      var source = current[position];
      image.src = source.getAttribute("data-full") || source.src;
      image.alt = source.alt || "";
      caption.textContent = source.getAttribute("data-caption") || source.alt || "";
    }

    Array.prototype.forEach.call(galleries, function (gallery) {
      var images = Array.prototype.slice.call(gallery.querySelectorAll("img"));
      images.forEach(function (img, index) {
        img.addEventListener("click", function (event) {
          event.preventDefault();
          current = images;
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
    document.addEventListener("keydown", function (event) {
      if (!dialog.open || current.length < 2) return;
      if (event.key === "ArrowRight") show(position + 1);
      if (event.key === "ArrowLeft") show(position - 1);
    });
  }

  /* ------------------------------------------------------------ hero video */

  /* A hero video autoplays, because a paused simulation is a still frame with
     no play button on it. `autoplay` is not something CSS can revoke, so
     honour a reduced-motion preference here instead: hold the poster, and let
     the reader start it themselves if they want to. */
  function calmHeroVideos() {
    if (!window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    Array.prototype.forEach.call(document.querySelectorAll(".gatas-hero__video"), function (video) {
      video.autoplay = false;
      video.loop = false;
      video.controls = true;
      video.pause();
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
    calmHeroVideos();
    setupCopyLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
