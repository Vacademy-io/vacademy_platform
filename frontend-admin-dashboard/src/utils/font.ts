export function resolveFontStack(font?: string | null): string | null {
    if (!font) return null;
    const key = String(font).trim().toUpperCase();

    if (key === 'INTER') {
        return 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
    }

    return font;
}
