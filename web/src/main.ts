const surface = import.meta.env.VITE_DEFAULT_SURFACE;

if (surface === "ceiling-controls") {
  void import("./ceiling-controls/main.js");
} else {
  void import("./display/main.js");
}
