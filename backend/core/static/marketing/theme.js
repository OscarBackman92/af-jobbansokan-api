(function () {
  var THEMES = ["command", "daylight", "signal"];

  function applyTheme(id) {
    if (!THEMES.includes(id)) return;
    document.documentElement.dataset.theme = id;
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

  var current = document.documentElement.dataset.theme || "daylight";
  if (!THEMES.includes(current)) current = "daylight";
  applyTheme(current);
})();
