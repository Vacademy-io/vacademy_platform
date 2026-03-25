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
            // Karaoke style: highlight current word within the stable phrase
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
                        const isUpcoming = audioTime < word.start;

                        return (
                            <span
                                key={`${word.start}-${index}`}
                                style={{
                                    color: isCurrentWord
                                        ? settings.highlightColor
                                        : isPastWord
                                          ? 'rgba(255, 255, 255, 0.5)'
                                          : isUpcoming
                                            ? settings.textColor
                                            : settings.textColor,
                                    fontWeight: isCurrentWord ? 600 : 400,
                                    transition: 'color 0.2s ease-out, font-weight 0.2s ease-out',
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

    const positionStyles: React.CSSProperties =
        settings.position === 'top'
            ? { top: '40px', bottom: 'auto' }
            : { bottom: '80px', top: 'auto' };

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
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
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
            <div
                style={{
                    // Inner container for text - prevents reflow
                    display: 'inline-block',
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                }}
            >
                {captionContent}
            </div>
        </div>
    );
};

export default CaptionDisplay;
