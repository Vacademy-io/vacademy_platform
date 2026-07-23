import { useCallback, useEffect, useRef, useState } from "react";

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
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  // Strong reference to the current utterance — Chrome garbage-collects it
  // mid-speech otherwise, which cuts the audio off silently.
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Warm up the voice list (getVoices() is empty on first call in some browsers).
  useEffect(() => {
    if (!speechSupported) return;
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.addEventListener?.("voiceschanged", warm);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", warm);
  }, [speechSupported]);

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
    if (!speechSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, [speechSupported]);

  // Speak the given text. Must be triggered from a user gesture (iOS WKWebView).
  // Prefers a voice whose language matches the answer's script when detectable,
  // otherwise the app locale.
  const speak = useCallback(
    (text: string) => {
      if (!speechSupported || !text) return;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        // Devanagari in the text → speak Hindi even if the app locale is English.
        const isDevanagari = /[ऀ-ॿ]/.test(text);
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
    [speechSupported, lang, short],
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
