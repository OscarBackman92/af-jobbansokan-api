(function () {
  try {
    if (!sessionStorage.getItem("token")) return;
  } catch (e) {
    return;
  }
  document.querySelectorAll("[data-session-cta]").forEach(function (wrap) {
    var guest = wrap.querySelector("[data-guest-cta]");
    var authed = wrap.querySelector("[data-authed-cta]");
    if (guest) guest.hidden = true;
    if (authed) authed.hidden = false;
  });
})();
