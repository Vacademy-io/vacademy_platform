/**
 * On-canvas caption preview for the editor.
 *
 * Renders the active caption phrase using the exact same DOM/CSS structure
 * as the render server (`generate_video.py:1614-1641`), so the editor view
 * is byte-for-byte identical to the rendered MP4 — modulo the canvas's CSS
 * `transform: scale(...)` which applies uniformly to caption + content.
 *
 * Mounts inside `EditorCanvas`'s scaled 1920×1080 div so positions and font
 * sizes are emitted in canvas-native pixels.
 */
import { useShallow } from 'zustand/react/shallow';
import { useVideoEditorStore } from './stores/video-editor-store';
import {
    activePhraseAt,
    captionContainerCss,
    captionInnerCss,
    karaokeWordSpans,
} from './utils/caption-rendering';

interface CaptionOverlayProps {
    canvasW: number;
    canvasH: number;
}

export function CaptionOverlay({ canvasW, canvasH }: CaptionOverlayProps) {
    const { settings, phrases, currentTime, entries } = useVideoEditorStore(
        useShallow((s) => ({
            settings: s.captionSettings,
            phrases: s.captionPhrases,
            currentTime: s.currentTime,
            entries: s.entries,
        }))
    );

    if (!settings.enabled || phrases.length === 0) return null;

    const phrase = activePhraseAt(phrases, currentTime);
    if (!phrase) return null;

    // Find the primary (non-branding) entry active at currentTime so we can
    // honour its per-shot caption_style. Mirrors generate_video.py's per-frame
    // entry walk so the editor preview matches the rendered MP4.
    const activeEntry = entries.find((e) => {
        if (e.id.startsWith('branding-')) return false;
        const inT = e.inTime ?? e.start ?? 0;
        const outT = e.exitTime ?? e.end ?? 0;
        return currentTime >= inT && currentTime < outT;
    });
    const override = activeEntry?.entry_meta?.caption_style;

    if (override?.hide) return null;

    // Compose effective settings — per-shot position wins over global, all
    // other fields stay global so colours/sizes don't unexpectedly shift mid-video.
    const effective =
        override?.position && override.position !== settings.position
            ? { ...settings, position: override.position }
            : settings;

    const innerStyle = captionInnerCss(effective, canvasW);

    // Karaoke mode: emit one styled <span> per word with active / past /
    // upcoming colors. The per-word comparison mirrors
    // CaptionDisplay.tsx:73-89 and generate_video.py's per-frame karaoke
    // loop EXACTLY, so all three surfaces agree on which word is current.
    if (effective.style === 'karaoke' && phrase.words.length > 0) {
        const spans = karaokeWordSpans(phrase, currentTime, effective);
        return (
            <div style={captionContainerCss(effective, canvasW, canvasH)}>
                <div style={innerStyle}>
                    {spans.map((s, i) => (
                        <span
                            key={i}
                            style={{
                                color: s.color,
                                fontWeight: s.fontWeight,
                                opacity: s.opacity,
                                transition: 'color 0.12s ease-out, opacity 0.12s ease-out',
                            }}
                        >
                            {s.text}
                            {i < spans.length - 1 ? ' ' : ''}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={captionContainerCss(effective, canvasW, canvasH)}>
            <div style={innerStyle}>{phrase.text}</div>
        </div>
    );
}
