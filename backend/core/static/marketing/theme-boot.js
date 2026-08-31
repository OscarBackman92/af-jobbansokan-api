(function () {
  var valid = { system: 1, command: 1, daylight: 1, signal: 1 };
  var colors = { command: "#0c0c09", daylight: "#f4f4f1", signal: "#121614" };
  var t = localStorage.getItem("theme");
  if (!valid[t]) {
    t = "daylight";
  }
  if (t === "system") {
    t = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "command"
      : "daylight";
  }
  document.documentElement.dataset.theme = t;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", colors[t] || colors.daylight);
})();
