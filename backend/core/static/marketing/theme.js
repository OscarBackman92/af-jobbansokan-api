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

  function applyTheme(id) {
    if (!THEMES.includes(id)) return;
    document.documentElement.dataset.theme = resolveTheme(id);
    localStorage.setItem("theme", id);
    document.querySelectorAll(".theme-picker [data-theme]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.theme === id);
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
        document.documentElement.dataset.theme = resolveTheme("system");
      }
    });
})();
