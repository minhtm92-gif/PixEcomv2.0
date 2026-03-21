/**
 * PixEcom Upsell Banner Script
 *
 * Tự động hiển thị banner "EXTRA y% FOR NEXT ITEM IN CART" phía trên ô quantity.
 * Tất cả config auto-detect từ __NEXT_DATA__ (mỗi sellpage khác nhau).
 *
 * Cách chèn: Dán block <script>...</script> từ file upsell-script.html
 *            vào TRƯỚC thẻ </body> của sellpage.
 *
 * Công thức: y = 100 - ((100 - x) * a) / b
 * x thay đổi theo quantity dựa trên discount_items từ admin setting.
 */

(function () {
  'use strict';

  /* ===== SAFE BOOT: đợi DOM + Next.js hydrate xong ===== */
  var MAX_RETRIES = 20;
  var RETRY_INTERVAL = 500;
  var retryCount = 0;

  function boot() {
    try {
      var nextDataEl = document.getElementById('__NEXT_DATA__');
      var qtyEl = document.querySelector('input[type="tel"], input[name="quantity"], .quantity__input');
      var ctaEl = document.querySelector('.cta-buttons, .product-form__buttons');

      if (!nextDataEl || !qtyEl || !ctaEl) {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          setTimeout(boot, RETRY_INTERVAL);
          return;
        }
        console.warn('[PixEcom Upsell] Timeout: DOM chưa sẵn sàng sau ' + (MAX_RETRIES * RETRY_INTERVAL / 1000) + 's.');
        return;
      }
      init();
    } catch (e) {
      console.error('[PixEcom Upsell] Boot error:', e);
    }
  }

  /* ===== HELPERS ===== */

  function parsePrice(text) {
    if (!text) return null;
    var val = parseFloat(text.replace(/[^0-9.]/g, ''));
    return isNaN(val) ? null : val;
  }

  function getNextData() {
    try {
      return JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
    } catch (e) {
      return null;
    }
  }

  function getUpsalesConfig(nd) {
    try { return nd.props.pageProps.data.settings.pages.pageConfigs.upsales_nextitems; }
    catch (e) { return null; }
  }

  function getProductVariants(nd) {
    try { return nd.props.pageProps.data.product.variants; }
    catch (e) { return null; }
  }

  function detectPrices(variants) {
    var a = null, b = null;
    var pc = document.querySelector('.product__price');
    if (pc) {
      var ce = pc.querySelector('del, s, .compared, .compare-at-price');
      if (ce) b = parsePrice(ce.textContent);
      var ft = pc.textContent.trim();
      var ct = ce ? ce.textContent.trim() : '';
      a = parsePrice(ft.replace(ct, '').trim());
    }
    if ((!a || !b) && variants && variants.length > 0) {
      var v = variants[0];
      if (!a) a = v.price || v.default_price;
      if (!b) b = v.comparedPrice || v.compared_price;
    }
    return { a: a, b: b };
  }

  function getDiscountForQty(currentQty, discountItems) {
    if (!discountItems || discountItems.length === 0) return 0;
    var sorted = discountItems.slice().sort(function (a, b) { return a.quantity - b.quantity; });
    var matched = sorted[0];
    if (currentQty > 1) {
      for (var i = 0; i < sorted.length; i++) {
        if (sorted[i].quantity < currentQty) matched = sorted[i];
      }
    }
    return matched.discount;
  }

  function calculateY(x, a, b) {
    if (!a || !b || b === 0) return 0;
    return 100 - ((100 - x) * a) / b;
  }

  function formatY(y) {
    if (y <= 0) return '0';
    if (y === Math.floor(y)) return Math.floor(y).toString();
    return y.toFixed(1).replace(/\.0$/, '');
  }

  function getCurrentQty() {
    var input = document.querySelector('input[type="tel"], input[name="quantity"], .quantity__input');
    if (!input) return 1;
    var val = parseInt(input.value, 10);
    return isNaN(val) || val < 1 ? 1 : val;
  }

  function hexToLightBg(hex) {
    if (!hex || hex.charAt(0) !== '#') return '#e8f5e9';
    var r = parseInt(hex.substr(1, 2), 16);
    var g = parseInt(hex.substr(3, 2), 16);
    var bl = parseInt(hex.substr(5, 2), 16);
    r = Math.round(r * 0.1 + 255 * 0.9);
    g = Math.round(g * 0.1 + 255 * 0.9);
    bl = Math.round(bl * 0.1 + 255 * 0.9);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ===== RENDER ===== */

  function createBanner(yDisplay, color, bgColor, hookTemplate, subText) {
    var banner = document.createElement('div');
    banner.id = 'pixecom-upsell-banner';
    banner.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;'
      + 'background-color:' + bgColor + ';border:1px dashed ' + color + ';border-radius:4px;'
      + 'padding:8px 6px;margin:14px 0 10px;text-align:center;line-height:24px;'
      + 'font-family:inherit;box-sizing:border-box;width:100%;max-width:100%';

    var line1 = document.createElement('span');
    line1.id = 'pixecom-upsell-line1';
    line1.style.cssText = 'font-size:16px;font-weight:800;color:' + color
      + ';text-transform:uppercase;letter-spacing:0.3px';
    line1.textContent = hookTemplate.replace('{y}', yDisplay);

    var line2 = document.createElement('span');
    line2.style.cssText = 'font-size:16px;font-weight:500;color:' + color;
    line2.textContent = subText;

    banner.appendChild(line1);
    banner.appendChild(line2);
    return banner;
  }

  /* ===== INIT ===== */

  function init() {
    try {
      var nextData = getNextData();
      if (!nextData) return;

      var upsalesConfig = getUpsalesConfig(nextData);
      if (!upsalesConfig || !upsalesConfig.enable) return;

      var discountItems = upsalesConfig.discount_items;
      if (!discountItems || discountItems.length === 0) return;

      var variants = getProductVariants(nextData);
      var prices = detectPrices(variants);
      if (!prices.a || !prices.b) return;

      var color = upsalesConfig.color_discount || '#1d9f54';
      var bgColor = hexToLightBg(color);
      var hookTemplate = (upsalesConfig.hook_product_page || 'EXTRA {discount}{symboy} FOR NEXT ITEM IN CART')
        .replace('{discount}', '{y}').replace('{symboy}', '%');
      var subText = upsalesConfig.hook_sub_product_page || 'Apply to any Color and Size';

      var currentQty = getCurrentQty();
      var x = getDiscountForQty(currentQty, discountItems);
      var y = calculateY(x, prices.a, prices.b);
      if (y <= 0) return;
      var yDisplay = formatY(y);

      var existing = document.getElementById('pixecom-upsell-banner');
      if (existing) existing.remove();

      var insertionPoint = document.querySelector('.cta-buttons, .product-form__buttons');
      if (!insertionPoint) return;

      var banner = createBanner(yDisplay, color, bgColor, hookTemplate, subText);
      insertionPoint.parentNode.insertBefore(banner, insertionPoint);

      function recalculate() {
        try {
          var q = getCurrentQty();
          var xx = getDiscountForQty(q, discountItems);
          var np = detectPrices(variants);
          var aa = np.a || prices.a;
          var bb = np.b || prices.b;
          var yy = calculateY(xx, aa, bb);
          var yd = formatY(yy);

          var el = document.getElementById('pixecom-upsell-line1');
          if (el) el.textContent = hookTemplate.replace('{y}', yd);

          var bannerEl = document.getElementById('pixecom-upsell-banner');
          if (bannerEl) bannerEl.style.display = yy <= 0 ? 'none' : 'flex';
        } catch (e) { /* silent */ }
      }

      var qtyInput = document.querySelector('input[type="tel"], input[name="quantity"], .quantity__input');
      if (qtyInput) {
        qtyInput.addEventListener('input', recalculate);
        qtyInput.addEventListener('change', recalculate);
        try {
          new MutationObserver(function () { recalculate(); }).observe(qtyInput, { attributes: true });
        } catch (e) { /* MutationObserver not supported */ }

        var qtyWrapper = qtyInput.closest('.field, .quantity, .quantity-selector');
        if (!qtyWrapper && qtyInput.parentElement) qtyWrapper = qtyInput.parentElement.parentElement;
        if (qtyWrapper) {
          qtyWrapper.addEventListener('click', function () { setTimeout(recalculate, 50); });
        }
      }

      var optionsContainer = document.querySelector('.product__options, .product-form__options, .variant-selectors');
      if (optionsContainer) {
        optionsContainer.addEventListener('click', function () { setTimeout(recalculate, 100); });
      }

    } catch (e) {
      console.error('[PixEcom Upsell] Init error:', e);
    }
  }

  /* ===== START ===== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });
  } else {
    setTimeout(boot, 300);
  }

})();
