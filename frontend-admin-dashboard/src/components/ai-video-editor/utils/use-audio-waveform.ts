import { useState, useEffect } from 'react';
import { decodeFromUrl } from '../playback/audio-decode-cache';

/**
 * Returns normalized peak amplitudes (0–1) for an audio URL, ready to render.
 *
 * Decoding is shared with the playback engine via `audio-decode-cache.ts`,
 * so the master narration is decoded exactly once per session even when both
 * the waveform and the playback engine want it. Decoding runs in a Web
 * Worker — the main thread stays responsive on first scrub.
 *
 * The peak-extraction loop runs on the main thread but is cheap (O(samples)
 * with one pass producing `numPeaks` blocks).
 */
export function useAudioWaveform(audioUrl?: string, numPeaks = 400) {
    const [peaks, setPeaks] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    // Natural clip length (seconds) — needed to size an audio-track lane clip
    // on the timeline. `undefined` until decoded (or on decode failure).
    const [duration, setDuration] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!audioUrl) {
            setPeaks([]);
            setDuration(undefined);
            return;
        }
        let cancelled = false;
        setLoading(true);

        decodeFromUrl(audioUrl)
            .then((decoded) => {
                if (cancelled) return;
                setDuration(decoded.duration);
                const raw = decoded.channels[0];
                if (!raw || raw.length === 0) {
                    setPeaks([]);
                    return;
                }
                const blockSize = Math.max(1, Math.floor(raw.length / numPeaks));
                const computed: number[] = new Array(numPeaks);
                let globalMax = 0;
                for (let i = 0; i < numPeaks; i++) {
                    let peak = 0;
                    const start = i * blockSize;
                    const end = Math.min(start + blockSize, raw.length);
                    for (let j = start; j < end; j++) {
                        const abs = Math.abs(raw[j] ?? 0);
                        if (abs > peak) peak = abs;
                    }
                    computed[i] = peak;
                    if (peak > globalMax) globalMax = peak;
                }
                const normalised = globalMax > 0 ? computed.map((p) => p / globalMax) : computed;
                if (!cancelled) setPeaks(normalised);
            })
            .catch(() => {
                // Audio unavailable / CORS — silently skip waveform.
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [audioUrl, numPeaks]);

    return { peaks, loading, duration };
}
