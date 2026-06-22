// Progressive enhancement: quick "Add to cart" from product cards updates the
// header badge and shows a toast without a full page reload. Falls back to a
// normal form POST when JS is unavailable.
(function () {
  'use strict';

  function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#0f172a', color: '#fff', padding: '12px 20px', borderRadius: '10px',
      fontWeight: '600', fontSize: '.9rem', boxShadow: '0 10px 30px rgba(0,0,0,.25)',
      zIndex: '999', opacity: '0', transition: 'opacity .2s, transform .2s'
    });
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(-4px)'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 250); }, 1800);
  }

  function updateBadge(count) {
    var link = document.querySelector('.cart-link');
    if (!link) return;
    var badge = link.querySelector('.cart-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-badge';
      link.appendChild(badge);
    }
    badge.textContent = count;
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.classList.contains('card-add')) return; // only quick-add cards
    e.preventDefault();
    var btn = form.querySelector('button');
    var data = new URLSearchParams(new FormData(form));
    data.set('ajax', '1');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Adding…'; }
    fetch('/cart/add', { method: 'POST', headers: { 'X-Requested-With': 'fetch' }, body: data })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (json) {
        if (json && typeof json.count === 'number') updateBadge(json.count);
        showToast('Added to cart ✓');
      })
      .catch(function () { showToast('Could not add item'); })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Add to cart'; }
      });
  });
})();
