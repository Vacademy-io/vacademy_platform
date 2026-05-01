/**
 * Module-level cache of decoded `AudioBuffer`s keyed by URL. Decoding the
 * same URL twice is wasteful — narration and waveform peaks both want the
 * same buffer, and re-press of Play after a pause shouldn't re-decode.
 */
const cache = new Map<string, Promise<AudioBuffer>>();

export async function decodeFromUrl(audioCtx: AudioContext, url: string): Promise<AudioBuffer> {
    const existing = cache.get(url);
    if (existing) return existing;
    const promise = (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`);
        const buf = await res.arrayBuffer();
        return audioCtx.decodeAudioData(buf);
    })();
    cache.set(url, promise);
    try {
        return await promise;
    } catch (err) {
        // Don't poison the cache on transient errors
        cache.delete(url);
        throw err;
    }
}

export function clearAudioDecodeCache() {
    cache.clear();
}
