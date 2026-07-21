import { useCallback, useEffect, useRef, useState } from "react";

// Speech-to-text for the parent chatbot: the parent asks by voice, the bot answers
// in text. Uses the browser Web Speech API — no backend, no API keys. Capability-
// gated, so the mic renders nothing where the platform doesn't support it (e.g.
// some native webviews).

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

// i18n locale → BCP-47 for recognition.
const LOCALE_TO_BCP47: Record<string, string> = { en: "en-US", hi: "hi-IN", ar: "ar-SA" };

export function useParentVoice(locale: string) {
  const short = (locale || "en").split("-")[0];
  const lang = LOCALE_TO_BCP47[short] || locale || "en-US";

  const recognitionSupported = !!getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

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

  // Stop any in-flight recognition on unmount.
  useEffect(
    () => () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { recognitionSupported, listening, listen, stopListen };
}
