(function () {
  var THEMES = ["command", "daylight", "signal"];

  var THEME_COLOR = {
    command: "#0c0c09",
    daylight: "#f4f4f1",
    signal: "#121614",
  };

  function migrateTheme(id) {
    if (id === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "command"
        : "daylight";
    }
    return id;
  }

  function applyTheme(id) {
    id = migrateTheme(id);
    if (!THEMES.includes(id)) return;
    document.documentElement.dataset.theme = id;
    localStorage.setItem("theme", id);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLOR[id] || THEME_COLOR.daylight);
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

  var current = migrateTheme(localStorage.getItem("theme") || "daylight");
  if (!THEMES.includes(current)) current = "daylight";
  applyTheme(current);
})();
