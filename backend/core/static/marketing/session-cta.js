(function () {
  // Same key as the SPA (frontend/src/auth.ts). Guest CTAs stay visible
  // unless that token exists in this browser.
  function hasToken() {
    try {
      return Boolean(
        localStorage.getItem("token") || sessionStorage.getItem("token")
      );
    } catch (e) {
      return false;
    }
  }

  var signedIn = hasToken();
  document.querySelectorAll("[data-session-cta]").forEach(function (wrap) {
    wrap.querySelectorAll("[data-guest-cta]").forEach(function (el) {
      el.hidden = signedIn;
    });
    wrap.querySelectorAll("[data-authed-cta]").forEach(function (el) {
      el.hidden = !signedIn;
    });
  });
})();
