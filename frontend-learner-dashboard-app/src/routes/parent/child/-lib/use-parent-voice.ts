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
        // the speak reliable.
        synth.resume();
        window.setTimeout(() => synth.speak(utter), 60);
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
  const speak = useCallback(
    (text: string) => {
      if (!text) return;
      const isDevanagari = /[ऀ-ॿ]/.test(text);
      const langShort = isDevanagari ? "hi" : short;
      void (async () => {
        try {
          const res = await authenticatedAxiosInstance.post(
            `${AI_SERVICE_URL}/tts/v1/speak`,
            { text, language: langShort },
            { responseType: "blob", timeout: 15000 },
          );
          // Stop anything already talking before starting the new answer.
          stopAudio();
          if (browserSpeechSupported) window.speechSynthesis.cancel();
          const url = URL.createObjectURL(res.data as Blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          const done = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onended = done;
          audio.onerror = done;
          setSpeaking(true);
          await audio.play();
          return;
        } catch {
          setSpeaking(false);
          // server TTS unavailable (offline / not deployed / autoplay blocked)
        }
        speakWithBrowser(text, isDevanagari);
      })();
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
