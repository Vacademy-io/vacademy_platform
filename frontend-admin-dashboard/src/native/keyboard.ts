import { Keyboard } from '@capacitor/keyboard';
import { isNative, isAndroid } from './platform';

// We intentionally configured Capacitor with `resize: none` so the WebView
// does NOT resize when the IME opens. Instead we publish the keyboard height
// as a CSS variable (--keyboard-height) and let the affected components
// reserve space themselves — typically with `padding-bottom: var(--keyboard-height)`
// or `bottom: var(--keyboard-height)` on sticky footers (e.g. the Create-tab
// composer's Send button).
//
// Why not resize? On iOS, WKWebView resize jumps the viewport in a way that
// fights TanStack Router scroll restoration. On Android, IME open/close
// triggers a full layout pass which thrashes the editor canvas.
//
// iOS fires keyboardWillShow ~300ms before the animation; Android historically
// only emits keyboardDidShow on some OEMs (notably older Samsung devices), so
// we subscribe to BOTH variants and trust whichever fires first. The DOM write
// is idempotent so the second event is a cheap no-op.
export function initKeyboard(): void {
    const root = document.documentElement;
    root.style.setProperty('--keyboard-height', '0px');

    if (!isNative()) return;

    const onShow = (info: { keyboardHeight: number }) => {
        root.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
        root.classList.add('keyboard-open');
    };
    const onHide = () => {
        root.style.setProperty('--keyboard-height', '0px');
        root.classList.remove('keyboard-open');
    };

    // iOS always emits the Will* variants. Android emits Did* reliably; some
    // builds also emit Will* but at the same time as Did*, so we just listen
    // to both. Listener registration is fire-and-forget — these handlers live
    // for the app lifetime.
    Keyboard.addListener('keyboardWillShow', onShow).catch(() => {});
    Keyboard.addListener('keyboardWillHide', onHide).catch(() => {});
    if (isAndroid()) {
        Keyboard.addListener('keyboardDidShow', onShow).catch(() => {});
        Keyboard.addListener('keyboardDidHide', onHide).catch(() => {});
    }
}
