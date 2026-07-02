// The @capacitor/keyboard plugin was REMOVED on purpose.
//
// On Android (notably Android 14+/16) the plugin installs a WindowInsets IME
// animation callback that takes over the IME insets and CANCELS the soft-keyboard
// show at PHASE_CLIENT_APPLY_ANIMATION — tapping a text field focused it but no
// keyboard ever appeared (and the field couldn't receive hardware keys either),
// while password fields happened to work. Removing the plugin restores the
// WebView's native IME handling on both Android and iOS.
//
// Keyboard insets/safe-area are handled purely in CSS via env(safe-area-inset-*)
// and the `--keyboard-height` variable (kept defined here at 0 so existing
// `max(var(--keyboard-height), …)` rules stay valid). The native WebView resizes
// for the IME by default, so sticky bars stay visible without plugin help.
export function initKeyboard(): void {
    document.documentElement.style.setProperty('--keyboard-height', '0px');
}
