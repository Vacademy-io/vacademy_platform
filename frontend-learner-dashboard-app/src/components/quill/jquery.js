import $ from "jquery";

// Install jQuery on window so MathQuill (which reads `window.jQuery` at
// module-eval time) can find it. Plain `window.jQuery = $` was being stripped
// by esbuild's minifier as dead code — function-call form is always treated
// as side-effecting and survives tree-shaking.
Object.defineProperty(window, "jQuery", { value: $, writable: true, configurable: true });
Object.defineProperty(window, "$", { value: $, writable: true, configurable: true });
