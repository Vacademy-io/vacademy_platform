/**
 * Off-main-thread audio decoder.
 *
 * Decoding a 30 MB MP3 with `AudioContext.decodeAudioData` blocks the main
 * thread for 1–2 seconds; the worst spike most users hit in the editor.
 * `OfflineAudioContext.decodeAudioData` is available in workers (Chrome 87+,
 * Firefox 76+, Safari 14.1+) and frees the UI to keep rendering / scrubbing
 * while the decode runs.
 *
 * Protocol:
 *   parent → worker:  { id, arrayBuffer }   (arrayBuffer is transferred)
 *   worker → parent:  { id, ok: true,
 *                       sampleRate, length, numberOfChannels, duration,
 *                       channels: Float32Array[] }   (channels transferred)
 *                  |  { id, ok: false, error }
 *
 * The chosen sample rate (44100) is what the OfflineAudioContext resamples
 * to during decode. Playback is on a separate AudioContext (often 48000),
 * which resamples internally at `BufferSource.start()` — quality is
 * indistinguishable for our use.
 */
const TARGET_SAMPLE_RATE = 44100;

interface DecodeRequest {
    id: number;
    arrayBuffer: ArrayBuffer;
}

self.addEventListener('message', async (event: MessageEvent<DecodeRequest>) => {
    const { id, arrayBuffer } = event.data;
    try {
        // OfflineAudioContext gates feature availability; throws ReferenceError
        // in older Firefox versions where it's not exposed in workers.
        const Ctx = (self as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
            .OfflineAudioContext;
        if (!Ctx) {
            throw new Error('OfflineAudioContext unavailable in this worker');
        }
        const ctx = new Ctx(1, 1, TARGET_SAMPLE_RATE);
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        const channels: Float32Array[] = [];
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const view = buffer.getChannelData(i);
            // Copy so we own a transferable buffer; the AudioBuffer's view is
            // backed by an internal allocation we can't transfer.
            const copy = new Float32Array(view.length);
            copy.set(view);
            channels.push(copy);
        }
        (self as unknown as Worker).postMessage(
            {
                id,
                ok: true,
                sampleRate: buffer.sampleRate,
                length: buffer.length,
                numberOfChannels: buffer.numberOfChannels,
                duration: buffer.duration,
                channels,
            },
            channels.map((c) => c.buffer)
        );
    } catch (err) {
        (self as unknown as Worker).postMessage({
            id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
});

// Tell TS this file is a module (so `self` typing works above).
export {};
