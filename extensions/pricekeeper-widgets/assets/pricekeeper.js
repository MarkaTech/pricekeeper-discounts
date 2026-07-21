// PriceKeeper storefront widgets — display only. Reads /cart.js on cart
// pages (the only external network request these widgets make anywhere) and
// renders was/now prices, tier tables, BOGO badges, and countdowns computed
// from the shop metafield. This script has no authority over what a customer
// actually pays — checkout (the Function) always computes the real price.
(function () {
  "use strict";

  function formatMoney(cents) {
    return (cents / 100).toFixed(2);
  }

  function initCountdowns() {
    document.querySelectorAll("[data-pk-ends-at]").forEach(function (el) {
      var endsAt = new Date(el.getAttribute("data-pk-ends-at")).getTime();
      function tick() {
        var remaining = endsAt - Date.now();
        if (remaining <= 0) {
          el.textContent = "";
          return;
        }
        var hours = Math.floor(remaining / 3600000);
        var mins = Math.floor((remaining % 3600000) / 60000);
        var secs = Math.floor((remaining % 60000) / 1000);
        el.textContent = hours + "h " + mins + "m " + secs + "s";
        requestAnimationFrame(function () {
          setTimeout(tick, 1000);
        });
      }
      tick();
    });
  }

  function initShippingBar() {
    var bar = document.getElementById("pk-shipping-bar");
    if (!bar) return;

    var campaigns = [];
    try {
      campaigns = JSON.parse(bar.getAttribute("data-pk-campaigns") || "[]") || [];
    } catch (e) {
      return; // malformed metafield — fail silently, display-only widget
    }

    var shippingCampaign = campaigns.filter(function (c) {
      return c.type === "FREE_SHIPPING";
    })[0];
    if (!shippingCampaign) return;

    var threshold = Number(shippingCampaign.minSubtotal || 0) * 100; // to cents
    if (!threshold) return;

    fetch("/cart.js")
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var remaining = threshold - cart.total_price;
        bar.textContent =
          remaining > 0
            ? "Add " + formatMoney(remaining) + " more for free shipping"
            : "You've unlocked free shipping!";
      })
      .catch(function () {
        /* fail silently — display-only widget, never blocks the storefront */
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCountdowns();
    initShippingBar();
  });
})();
