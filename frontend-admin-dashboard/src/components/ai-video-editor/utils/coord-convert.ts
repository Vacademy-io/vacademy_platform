/**
 * Convert screen-space (CSS pixel) coordinates relative to the canvas
 * container into canvas-space coordinates (1920×1080 or 1080×1920).
 */
export function screenToCanvas(screenX: number, screenY: number, scale: number): [number, number] {
    return [screenX / scale, screenY / scale];
}

/**
 * Convert canvas-space coordinates into screen-space pixels.
 */
export function canvasToScreen(canvasX: number, canvasY: number, scale: number): [number, number] {
    return [canvasX * scale, canvasY * scale];
}

/**
 * Clamp a value within [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
