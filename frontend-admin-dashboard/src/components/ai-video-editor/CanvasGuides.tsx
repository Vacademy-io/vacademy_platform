/**
 * Optional overlay guides on the editor canvas — safe-area + rule-of-thirds
 * + center crosshair. Mounted inside the scaled 1920×1080 canvas div, so
 * coordinates are in canvas-space and lines stay correctly positioned at any
 * zoom (counter-scaled stroke widths keep the lines visually constant).
 */
interface CanvasGuidesProps {
    canvasW: number;
    canvasH: number;
    /** Canvas → screen scale. Used to keep stroke width constant on screen. */
    scale: number;
    /** Mode set selected by the user. Each one is independent. */
    showSafeArea: boolean;
    showRuleOfThirds: boolean;
    showCenter: boolean;
}

export function CanvasGuides({
    canvasW,
    canvasH,
    scale,
    showSafeArea,
    showRuleOfThirds,
    showCenter,
}: CanvasGuidesProps) {
    if (!showSafeArea && !showRuleOfThirds && !showCenter) return null;

    // SVG strokes scale with the parent transform, so divide to keep them at
    // ~1px on screen regardless of canvas zoom.
    const sw = scale > 0 ? 1 / scale : 1;

    // Action-safe = inner 95%; title-safe = inner 90%. Broadcast standard.
    const action = { x: canvasW * 0.025, y: canvasH * 0.025, w: canvasW * 0.95, h: canvasH * 0.95 };
    const title = { x: canvasW * 0.05, y: canvasH * 0.05, w: canvasW * 0.9, h: canvasH * 0.9 };

    return (
        <svg
            width={canvasW}
            height={canvasH}
            viewBox={`0 0 ${canvasW} ${canvasH}`}
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 19000,
            }}
        >
            {showSafeArea && (
                <>
                    <rect
                        x={action.x}
                        y={action.y}
                        width={action.w}
                        height={action.h}
                        fill="none"
                        stroke="#fbbf24"
                        strokeOpacity="0.7"
                        strokeWidth={sw}
                        strokeDasharray={`${6 * sw} ${4 * sw}`}
                    />
                    <rect
                        x={title.x}
                        y={title.y}
                        width={title.w}
                        height={title.h}
                        fill="none"
                        stroke="#22c55e"
                        strokeOpacity="0.7"
                        strokeWidth={sw}
                        strokeDasharray={`${6 * sw} ${4 * sw}`}
                    />
                </>
            )}

            {showRuleOfThirds &&
                [1, 2].map((i) => (
                    <g key={`thirds-${i}`}>
                        <line
                            x1={(canvasW * i) / 3}
                            y1={0}
                            x2={(canvasW * i) / 3}
                            y2={canvasH}
                            stroke="#ffffff"
                            strokeOpacity="0.45"
                            strokeWidth={sw}
                        />
                        <line
                            x1={0}
                            y1={(canvasH * i) / 3}
                            x2={canvasW}
                            y2={(canvasH * i) / 3}
                            stroke="#ffffff"
                            strokeOpacity="0.45"
                            strokeWidth={sw}
                        />
                    </g>
                ))}

            {showCenter && (
                <>
                    <line
                        x1={canvasW / 2}
                        y1={0}
                        x2={canvasW / 2}
                        y2={canvasH}
                        stroke="#6366f1"
                        strokeOpacity="0.5"
                        strokeWidth={sw}
                    />
                    <line
                        x1={0}
                        y1={canvasH / 2}
                        x2={canvasW}
                        y2={canvasH / 2}
                        stroke="#6366f1"
                        strokeOpacity="0.5"
                        strokeWidth={sw}
                    />
                </>
            )}
        </svg>
    );
}
