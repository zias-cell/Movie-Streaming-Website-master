/*
 * main-min.js — PLACEHOLDER
 *
 * The original minified bundle referenced by the content pages was not part of
 * the repository upload. This stub (a) prevents a 404 for the referenced path
 * and (b) provides a graceful fallback so that missing poster images render a
 * placeholder instead of a broken-image icon. Replace with the real asset
 * before publishing if it provided additional behaviour.
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

  // Catch load errors as they happen. The error event does not bubble, so we
  // listen on the document in the capture phase.
  document.addEventListener(
    "error",
    function (e) {
      var t = e.target;
      if (t && t.tagName === "IMG") swap(t);
    },
    true
  );

  // Catch images that already failed before this script executed.
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
