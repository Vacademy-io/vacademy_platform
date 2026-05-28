/**
 * CaptionDisplay Component
 * Renders smooth, stable subtitles like YouTube
 * Phrases stay on screen until they naturally end
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { WordTimestamp, CaptionSettings, CAPTION_FONT_SIZES } from '../types';

interface CaptionPhrase {
    words: WordTimestamp[];
    text: string;
    startTime: number;
    endTime: number;
}

interface CaptionDisplayProps {
    words: WordTimestamp[]; // Legacy - now using phrase
    currentTime: number;
    audioStartAt?: number;
    settings: CaptionSettings;
    // New: pass the stable phrase directly
    currentPhrase?: CaptionPhrase | null;
    currentWordIndex?: number;
}

export const CaptionDisplay: React.FC<CaptionDisplayProps> = ({
    words,
    currentTime,
    audioStartAt = 0,
    settings,
    currentPhrase,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    currentWordIndex: _currentWordIndex = -1,
}) => {
    const audioTime = currentTime - audioStartAt;
    const [isVisible, setIsVisible] = useState(false);
    const lastPhraseRef = useRef<string>('');

    // Track phrase changes for fade transitions
    useEffect(() => {
        const phraseText = currentPhrase?.text || '';
        if (phraseText !== lastPhraseRef.current) {
            // Phrase changed - trigger fade
            if (phraseText) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
            lastPhraseRef.current = phraseText;
        }
    }, [currentPhrase]);

    // Build caption text - stable, doesn't flicker
    const captionContent = useMemo(() => {
        // Use the stable phrase if provided
        const displayWords = currentPhrase?.words || words;
        if (displayWords.length === 0) return null;

        const fontSize = CAPTION_FONT_SIZES[settings.fontSize];

        if (settings.style === 'karaoke') {
            // Karaoke style: highlight current word within the stable phrase.
            //
            // Must stay in lockstep with the editor's `karaokeWordSpans` and
            // the render server's per-frame karaoke loop in
            // generate_video.py:
            //   - current word: `highlightColor`, weight = base + 200 (capped 900)
            //   - past word:    `textColor`, opacity 0.5, base weight
            //   - upcoming:     `textColor`, opacity 1.0, base weight
            //
            // The previous version hardcoded `rgba(255,255,255,0.5)` for
            // past words and `600`/`400` for weight, which diverged from
            // the editor + MP4 when the user picked a non-white textColor
            // or a non-default fontWeight.
            const baseWeight = settings.fontWeight ?? 400;
            const heavyWeight = Math.min(900, baseWeight + 200);
            return (
                <span
                    style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.5,
                        letterSpacing: '0.02em',
                    }}
                >
                    {displayWords.map((word, index) => {
                        const isCurrentWord = audioTime >= word.start && audioTime < word.end;
                        const isPastWord = audioTime >= word.end;

                        return (
                            <span
                                key={`${word.start}-${index}`}
                                style={{
                                    color: isCurrentWord
                                        ? settings.highlightColor
                                        : settings.textColor,
                                    opacity: isPastWord ? 0.5 : 1,
                                    fontWeight: isCurrentWord ? heavyWeight : baseWeight,
                                    transition:
                                        'color 0.2s ease-out, opacity 0.2s ease-out, font-weight 0.2s ease-out',
                                    display: 'inline',
                                }}
                            >
                                {word.word}
                                {index < displayWords.length - 1 ? ' ' : ''}
                            </span>
                        );
                    })}
                </span>
            );
        } else {
            // Phrase style: simple stable text (no per-word updates)
            const text = currentPhrase?.text || displayWords.map((w) => w.word).join(' ');
            return (
                <span
                    style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.5,
                        color: settings.textColor,
                        letterSpacing: '0.02em',
                    }}
                >
                    {text}
                </span>
            );
        }
    }, [currentPhrase, words, audioTime, settings]);

    // Don't render if captions disabled or no content
    if (!settings.enabled) {
        return null;
    }

    // If no phrase, hide smoothly
    if (!currentPhrase && words.length === 0) {
        return null;
    }

    // Position as a fraction of player height to mirror the render server's
    // `height * 0.037` / `* 0.074` (generate_video.py:1623-1627). Fixed-px
    // values only matched the MP4 at the native 1920×1080 canvas; smaller
    // preview containers showed captions visibly higher than the rendered output.
    const positionStyles: React.CSSProperties =
        settings.position === 'top'
            ? { top: '3.7%', bottom: 'auto' }
            : { bottom: '7.4%', top: 'auto' };

    // Resolve `fontFamily` enum to a CSS family with system fallback. Mirrors
    // `resolveCaptionFontFamily` in the editor's caption-rendering.ts so the
    // post-gen preview matches the editor preview and the rendered MP4.
    const SYSTEM_STACK =
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
    const fontFamily =
        settings.fontFamily === 'inter'
            ? `'Inter', ${SYSTEM_STACK}`
            : settings.fontFamily === 'montserrat'
              ? `'Montserrat', ${SYSTEM_STACK}`
              : settings.fontFamily === 'noto-sans'
                ? `'Noto Sans', ${SYSTEM_STACK}`
                : settings.fontFamily === 'fira-code'
                  ? `'Fira Code', ui-monospace, monospace`
                  : SYSTEM_STACK;

    // Text stroke (outline). Player-display pixels — caller's container
    // is variable size, so we treat `textStrokeWidth` as CSS px directly
    // rather than scaling by 1920w like the canvas/render paths do.
    const innerStyle: React.CSSProperties = {
        display: 'inline-block',
        textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
    };
    if (settings.textStrokeWidth > 0) {
        innerStyle.WebkitTextStrokeWidth = `${settings.textStrokeWidth}px`;
        innerStyle.WebkitTextStrokeColor = settings.textStrokeColor;
        innerStyle.paintOrder = 'stroke fill';
    }

    return (
        <div
            data-caption-container
            style={{
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)',
                maxWidth: '85%',
                padding: '10px 20px',
                borderRadius: '8px',
                background: `rgba(0, 0, 0, ${settings.backgroundOpacity})`,
                textAlign: 'center',
                fontFamily,
                fontWeight: settings.fontWeight,
                zIndex: 15,
                pointerEvents: 'none',
                // Smooth fade transitions when phrases change
                opacity: isVisible && captionContent ? 1 : 0,
                transition: 'opacity 0.25s ease-out',
                // Prevent layout shifts
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...positionStyles,
            }}
        >
            <div style={innerStyle}>{captionContent}</div>
        </div>
    );
};

export default CaptionDisplay;
