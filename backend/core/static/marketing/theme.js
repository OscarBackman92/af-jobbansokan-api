(function () {
  var THEMES = ["system", "command", "daylight", "signal"];

  function resolveTheme(id) {
    if (id === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "command"
        : "daylight";
    }
    return id;
  }

  var THEME_COLOR = {
    command: "#0c0c09",
    daylight: "#f4f4f1",
    signal: "#121614",
  };

  function applyTheme(id) {
    if (!THEMES.includes(id)) return;
    var resolved = resolveTheme(id);
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem("theme", id);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLOR[resolved] || THEME_COLOR.daylight);
    }
    document.querySelectorAll(".theme-picker [data-theme]").forEach(function (btn) {
      var on = btn.dataset.theme === id;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  document.querySelectorAll(".theme-picker [data-theme]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyTheme(btn.dataset.theme);
    });
  });

  var current = localStorage.getItem("theme") || "daylight";
  if (!THEMES.includes(current)) current = "daylight";
  applyTheme(current);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", function () {
      if (localStorage.getItem("theme") === "system") {
        applyTheme("system");
      }
    });
})();
