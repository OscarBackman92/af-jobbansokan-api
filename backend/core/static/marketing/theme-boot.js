(function () {
  var valid = { system: 1, command: 1, daylight: 1, signal: 1 };
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
})();
