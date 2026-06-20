/*
 * landing-page.js — PLACEHOLDER
 *
 * Referenced by index.html but not part of the repository upload. This stub
 * prevents a 404 and provides the same graceful broken-image fallback used on
 * the rest of the site so missing landing-page posters render a placeholder
 * instead of a broken-image icon. Replace with the real asset before
 * publishing if it provided additional behaviour.
 */
(function () {
  if (window.__apnaImgFallback) return; // idempotent across pages/scripts
  window.__apnaImgFallback = true;

  var PLACEHOLDER = "Images/placeholder.svg";

  function swap(img) {
    if (!img || img.dataset.fallbackApplied) return;
    img.dataset.fallbackApplied = "1";
    img.onerror = null; // avoid an infinite error loop
    img.src = PLACEHOLDER;
  }

  document.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      if (t && t.tagName === "IMG") swap(t);
    },
    true
  );

  function sweep() {
    var imgs = document.getElementsByTagName("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete && img.naturalWidth === 0 && img.src) swap(img);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sweep);
  } else {
    sweep();
  }
  window.addEventListener("load", sweep);
})();
