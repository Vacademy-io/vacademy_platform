import { useCallback, useEffect, useRef, useState } from "react";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { AI_SERVICE_URL } from "@/constants/urls";

// Voice for the parent chatbot: speech-to-text (ask by voice) AND text-to-speech
// (hear the answer). Browser Web Speech API — no backend, no API keys. Everything
// is capability-gated so it renders nothing where the platform doesn't support it
// (e.g. some native webviews).

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// i18n locale → BCP-47 for recognition + synthesis.
const LOCALE_TO_BCP47: Record<string, string> = { en: "en-US", hi: "hi-IN", ar: "ar-SA" };

export function useParentVoice(locale: string) {
  const short = (locale || "en").split("-")[0];
  const lang = LOCALE_TO_BCP47[short] || locale || "en-US";

  const recognitionSupported = !!getRecognitionCtor();
  const browserSpeechSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  // Voice output is primarily server neural TTS played through an <audio>
  // element (available everywhere the app runs); browser synthesis is only the
  // fallback — so "speech" is supported wherever we have a window at all.
  const speechSupported = typeof window !== "undefined";

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Strong reference to the current utterance — Chrome garbage-collects it
  // mid-speech otherwise, which cuts the audio off silently.
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  // The currently playing server-TTS audio element (edge-tts MP3).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Monotonic token: every speak()/cancelSpeak() bumps it, and the DELAYED
  // browser-speak only fires when its token is still current. Without this,
  // a cancel that lands inside the 60ms delay cannot stop the utterance —
  // rapid speaks then QUEUE behind each other (the "read every message from
  // the start" bug) and a pending timer can replay after close.
  const speakSeqRef = useRef(0);

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.src = "";
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
  }, []);

  // Warm up the voice list (getVoices() is empty on first call in some browsers).
  useEffect(() => {
    if (!browserSpeechSupported) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, [browserSpeechSupported]);

  const stopListen = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const listen = useCallback(
    (onResult: (transcript: string) => void) => {
      const Ctor = getRecognitionCtor();
      if (!Ctor) return;
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = e?.results?.[0]?.[0]?.transcript ?? "";
        if (transcript) onResult(transcript.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      try {
        rec.start();
      } catch {
        setListening(false);
      }
    },
    [lang],
  );

  const cancelSpeak = useCallback(() => {
    speakSeqRef.current += 1; // invalidate any pending delayed speak
    stopAudio();
    if (browserSpeechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    setSpeaking(false);
  }, [browserSpeechSupported, stopAudio]);

  // Browser speechSynthesis — the FALLBACK voice when server TTS is unavailable.
  const speakWithBrowser = useCallback(
    (text: string, isDevanagari: boolean) => {
      if (!browserSpeechSupported) return;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = isDevanagari ? "hi-IN" : lang;
        const want = (isDevanagari ? "hi" : short).toLowerCase();
        const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(want));
        if (voice) utter.voice = voice;
        utter.onend = () => setSpeaking(false);
        utter.onerror = () => setSpeaking(false);
        utterRef.current = utter; // hold the reference (Chrome GC bug)
        setSpeaking(true);
        // Chrome quirks: speak() issued synchronously after cancel() is sometimes
        // silently dropped, and a paused queue swallows every later utterance
        // (cancel-while-paused leaves it stuck). resume() + a short delay makes
        // the speak reliable — but the delayed call MUST re-check the token so a
        // cancel/newer speak that landed inside the delay wins.
        const seq = ++speakSeqRef.current;
        synth.resume();
        window.setTimeout(() => {
          if (speakSeqRef.current !== seq) return; // cancelled / superseded
          synth.speak(utter);
        }, 60);
      } catch {
        setSpeaking(false);
      }
    },
    [browserSpeechSupported, lang, short],
  );

  // Speak the given text. Tries the server's neural TTS first (edge-tts via
  // ai_service — far more natural than the robotic browser voices), then falls
  // back to on-device speechSynthesis. Devanagari in the text → Hindi voice
  // even when the app locale is English.
  //
  // The server audio is STREAMED (GET + progressive <audio>), so playback starts
  // on the first buffered bytes instead of after the whole file — and `speaking`
  // is bound to the real playback events, which is what drives the lip-sync.
  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      const isDevanagari = /[ऀ-ॿ]/.test(text);
      const langShort = isDevanagari ? "hi" : short;

      // Very long text would blow the URL; answers are 1-4 sentences, but be safe.
      if (text.length > 1500) {
        speakWithBrowser(text, isDevanagari);
        return;
      }

      // Stop anything already talking before starting the new answer — and
      // invalidate any browser-speak still waiting inside its 60ms delay.
      const seq = ++speakSeqRef.current;
      stopAudio();
      if (browserSpeechSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* ignore */
        }
      }

      // ── Tier 3: on-device browser voice ──
      const browserFallback = () => {
        if (speakSeqRef.current !== seq) return; // cancelled / superseded
        setSpeaking(false);
        stopAudio();
        speakWithBrowser(text, isDevanagari);
      };

      // ── Tier 2: POST + full blob — works against ai_service builds that
      // predate the streaming GET route (deploy-order resilience). ──
      const postFallback = () => {
        if (speakSeqRef.current !== seq) return;
        setSpeaking(false);
        stopAudio();
        void (async () => {
          try {
            const res = await authenticatedAxiosInstance.post(
              `${AI_SERVICE_URL}/tts/v1/speak`,
              { text, language: langShort },
              { responseType: "blob", timeout: 15000 },
            );
            if (speakSeqRef.current !== seq) return;
            const url = URL.createObjectURL(res.data as Blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            let failed = false;
            const fail = () => {
              if (failed) return;
              failed = true;
              URL.revokeObjectURL(url);
              browserFallback();
            };
            audio.onplaying = () => {
              if (speakSeqRef.current === seq) setSpeaking(true);
            };
            audio.onended = () => {
              setSpeaking(false);
              URL.revokeObjectURL(url);
            };
            audio.onerror = fail;
            audio.play().catch(fail);
          } catch {
            browserFallback();
          }
        })();
      };

      // ── Tier 1: streamed GET — playback starts on the first buffered bytes. ──
      const src =
        `${AI_SERVICE_URL}/tts/v1/speak?language=${encodeURIComponent(langShort)}` +
        `&text=${encodeURIComponent(text)}`;
      const audio = new Audio(src);
      audioRef.current = audio;
      let streamFailed = false;
      const streamFail = () => {
        if (streamFailed) return;
        streamFailed = true;
        postFallback();
      };
      audio.onplaying = () => {
        if (speakSeqRef.current === seq) setSpeaking(true);
      };
      audio.onended = () => setSpeaking(false);
      audio.onerror = streamFail;
      audio.play().catch(streamFail);
    },
    [short, browserSpeechSupported, stopAudio, speakWithBrowser],
  );

  useEffect(
    () => () => {
      cancelSpeak();
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [cancelSpeak],
  );

  return {
    recognitionSupported,
    speechSupported,
    listening,
    speaking,
    listen,
    stopListen,
    speak,
    cancelSpeak,
  };
}
