import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import chatTeacher from "@/assets/parent-icons/chat-teacher.webp";
import chatTeacherTalk from "@/assets/parent-icons/chat-teacher-talk.webp";
import chatTeacherThink from "@/assets/parent-icons/chat-teacher-think.webp";
import {
  CaretRight,
  PaperPlaneTilt,
  Microphone,
  SpeakerHigh,
  SpeakerSlash,
  House,
  Eye,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ChildAvatar } from "./ChildAvatar";
import { useChildOverview } from "../-hooks/use-parent-child";
import { askChildAssistant } from "../-services/parent-portal-api";
import { useParentVoice } from "../-lib/use-parent-voice";
import { useViewAsChild } from "../-lib/use-view-as-child";

type QKey = "attendance" | "fees" | "rewards" | "tests" | "progress";
const QUESTIONS: QKey[] = ["attendance", "fees", "rewards", "tests", "progress"];

// Lightweight intent match so a parent can type a free-form question
// ("did my child attend the class today?") and still get a data-backed answer.
const KEYWORDS: Record<QKey, string[]> = {
  attendance: ["attend", "present", "absent", "class", "school", "came", "went", "today"],
  fees: ["fee", "pay", "due", "money", "invoice", "payment", "bill"],
  rewards: ["badge", "reward", "point", "prize", "star", "award", "achieve"],
  tests: ["test", "exam", "score", "mark", "result", "grade", "quiz", "assessment"],
  progress: ["progress", "lesson", "complete", "course", "study", "learn", "syllabus", "chapter"],
};

function matchQuestion(text: string): QKey | null {
  const low = text.toLowerCase();
  for (const q of QUESTIONS) {
    if (KEYWORDS[q].some((k) => low.includes(k))) return q;
  }
  return null;
}

interface Msg {
  id: number;
  role: "bot" | "user";
  text: string;
  module?: string;
}

interface ParentChatbotProps {
  childId: string;
  childName: string;
}

/**
 * The parent assistant. Free-text questions go to the guarded AI assistant
 * (`/assistant`, which answers only from the child's own data); if the LLM isn't
 * available it falls back to on-device preset answers computed from the guarded
 * /overview response. The preset question chips always use the on-device answers.
 */
export function ParentChatbot({ childId, childName }: ParentChatbotProps) {
  const { t, i18n } = useTranslation("parent");
  const navigate = useNavigate();
  const { viewAsChild, switching: switchingToChild } = useViewAsChild(childId, childName);
  const voice = useParentVoice(i18n.language);
  const { data: overview } = useChildOverview(childId);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  // Auto-speak answers by default; the parent can mute from the header.
  const [muted, setMuted] = useState(false);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  const addMsg = (m: Msg) => setMessages((prev) => [...prev, m]);
  const speakIfAuto = (text: string) => {
    if (!muted && voice.speechSupported) voice.speak(text);
  };
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  const answer = (q: QKey): { text: string; module?: string } => {
    const o = overview;
    switch (q) {
      case "attendance":
        return o?.attendancePercent != null
          ? { text: t("chat.a.attendance", { name: childName, percent: Math.round(o.attendancePercent) }), module: "attendance" }
          : { text: t("chat.a.attendanceNone", { name: childName }) };
      case "fees":
        return (o?.pendingInvoiceCount ?? 0) > 0
          ? { text: t("chat.a.feesDue", { count: o?.pendingInvoiceCount }), module: "payments" }
          : { text: t("chat.a.feesPaid") };
      case "rewards":
        return { text: t("chat.a.rewards", { name: childName, badges: o?.badgeCount ?? 0, certs: o?.certificateCount ?? 0 }), module: "rewards" };
      case "tests":
        return o?.assessmentCount != null
          ? { text: t("chat.a.tests", { name: childName, count: o.assessmentCount }), module: "assessments" }
          : { text: t("chat.a.testsNone"), module: "assessments" };
      case "progress":
        return o?.courseCompletionPercent != null
          ? { text: t("chat.a.progress", { name: childName, percent: Math.round(o.courseCompletionPercent) }), module: "progress" }
          : { text: t("chat.a.progressNone"), module: "progress" };
    }
  };

  const push = (userText: string, a: { text: string; module?: string }) => {
    addMsg({ id: nextId(), role: "user", text: userText });
    addMsg({ id: nextId(), role: "bot", text: a.text, module: a.module });
    speakIfAuto(a.text);
  };

  const ask = (q: QKey) => push(t(`chat.q.${q}`, { name: childName }), answer(q));

  const keywordAnswer = (text: string): { text: string; module?: string } => {
    const q = matchQuestion(text);
    return q ? answer(q) : { text: t("chat.fallback") };
  };

  // A question (typed or spoken): try the AI assistant (answers from the guarded
  // child's data); fall back to on-device keyword answers if the LLM isn't available.
  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || pending) return;
    setInput("");
    addMsg({ id: nextId(), role: "user", text });
    setPending(true);
    try {
      const res = await askChildAssistant(childId, text);
      if (res?.available && res.answer) {
        addMsg({ id: nextId(), role: "bot", text: res.answer });
        speakIfAuto(res.answer);
        return;
      }
    } catch {
      // fall through to the on-device answer
    } finally {
      setPending(false);
    }
    const a = keywordAnswer(text);
    addMsg({ id: nextId(), role: "bot", text: a.text, module: a.module });
    speakIfAuto(a.text);
  };

  // Mic: transcribe the spoken question, drop it in the box, and ask.
  const toggleMic = () => {
    if (voice.listening) {
      voice.stopListen();
      return;
    }
    voice.listen((transcript) => {
      setInput(transcript);
      void submit(transcript);
    });
  };

  const closeAssistant = () => {
    voice.cancelSpeak();
    voice.stopListen();
    setOpen(false);
  };

  // Esc closes the full-screen assistant.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAssistant();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The most recent answer drives the centre text + the "speaking" teacher.
  const lastBot = [...messages].reverse().find((m) => m.role === "bot");

  // Lip-sync: while speaking, flip the mouth open/closed on a short interval so the
  // teacher visibly "talks"; a separate thinking frame shows while an answer loads.
  const [mouthOpen, setMouthOpen] = useState(false);
  useEffect(() => {
    if (!voice.speaking) {
      setMouthOpen(false);
      return;
    }
    const id = setInterval(() => setMouthOpen((m) => !m), 220);
    return () => clearInterval(id);
  }, [voice.speaking]);

  const teacherSrc = pending
    ? chatTeacherThink
    : voice.speaking && mouthOpen
      ? chatTeacherTalk
      : chatTeacher;

  // Gentle idle float / listening pulse (the mouth frames carry the "speaking" cue).
  const teacherAnimate = voice.listening ? { scale: [1, 1.04, 1] } : { y: [0, -7, 0] };
  const teacherTransition = {
    duration: voice.listening ? 1.1 : 3.2,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  return (
    <>
      {/* Mobile bottom navigation: Home · Ask (teacher bot) · Student view */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-end justify-around px-4 pb-1.5 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: "/parent/child/$childId", params: { childId } })}
            aria-label={t("nav.home")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-muted-foreground",
              "transition-colors hover:text-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
            )}
          >
            <House weight="fill" className="size-7" aria-hidden />
            <span className="text-caption font-medium">{t("nav.home")}</span>
          </button>

          {/* Centre bot — raised above the bar, same attention animation as before */}
          <div className="flex flex-1 flex-col items-center">
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("chat.open")}
              data-tour="parent-chat"
              className={cn(
                "relative -mt-8 flex size-16 items-center justify-center overflow-hidden rounded-full",
                "bg-background shadow-lg ring-2 ring-primary-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              )}
              animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 3.2, ease: "easeInOut" }}
              whileHover={{ scale: 1.08, rotate: 0 }}
              whileTap={{ scale: 0.94 }}
            >
              {/* Pulsing halo — a soft ripple that keeps drawing attention. */}
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary-300/40"
                animate={{ scale: [1, 1.55], opacity: [0.45, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <img src={chatTeacher} alt="" aria-hidden className="relative size-full object-contain p-1" />
            </motion.button>
            <span className="mt-0.5 text-caption font-semibold text-primary-500">{t("nav.ask")}</span>
          </div>

          <button
            type="button"
            onClick={() => void viewAsChild()}
            disabled={switchingToChild}
            aria-label={t("nav.studentView")}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-muted-foreground",
              "transition-colors hover:text-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              "disabled:opacity-50",
            )}
          >
            <Eye weight="duotone" className="size-6" aria-hidden />
            <span className="text-caption font-medium">{t("nav.studentView")}</span>
          </button>
        </div>
      </nav>

      {/* Full-screen voice assistant — teacher speaks the answer, tap-to-speak, suggested questions.
          Light "playful-clean" theme: white stage so the white-background teacher blends (no box). */}
      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("chat.title")}
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Header: close · mute · child chip */}
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-5">
              <button
                type="button"
                onClick={closeAssistant}
                aria-label={t("common.back")}
                className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <X weight="bold" className="size-5" aria-hidden />
              </button>
              <div className="flex items-center gap-2">
                {voice.speechSupported ? (
                  <button
                    type="button"
                    onClick={() => {
                      voice.cancelSpeak();
                      setMuted((m) => !m);
                    }}
                    aria-label={muted ? t("chat.unmute") : t("chat.mute")}
                    aria-pressed={muted}
                    className="flex size-9 items-center justify-center rounded-full bg-muted text-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    {muted ? (
                      <SpeakerSlash weight="fill" className="size-5" aria-hidden />
                    ) : (
                      <SpeakerHigh weight="fill" className="size-5" aria-hidden />
                    )}
                  </button>
                ) : null}
                <div className="flex items-center gap-2 rounded-full bg-muted py-1 pe-3 ps-1">
                  <span className="size-7 shrink-0 overflow-hidden rounded-full">
                    <ChildAvatar name={childName} size={28} />
                  </span>
                  <span className="max-w-32 truncate text-caption font-medium text-foreground">{childName}</span>
                </div>
              </div>
            </div>

            {/* Centre stage: the teacher (mouth-swap while speaking) + the answer / intro */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <motion.img
                src={teacherSrc}
                alt=""
                aria-hidden
                className="h-44 w-auto drop-shadow-lg sm:h-52"
                animate={teacherAnimate}
                transition={teacherTransition}
              />

              {lastBot ? (
                <div ref={scrollRef} className="mt-4 max-h-44 w-full max-w-md overflow-y-auto">
                  <p className="text-h3 font-medium leading-relaxed text-foreground">{lastBot.text}</p>
                  {lastBot.module ? (
                    <button
                      type="button"
                      onClick={() => {
                        navigate({ to: `/parent/child/${childId}/${lastBot.module}` as never });
                        closeAssistant();
                      }}
                      className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1.5 text-caption font-medium text-primary-500 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      {t("chat.view")}
                      <CaretRight className="size-3 rtl:rotate-180" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <h2 className="mt-4 text-h1 font-bold text-foreground">{t("chat.askTitle", { name: childName })}</h2>
                  <p className="mt-2 max-w-xs text-body text-muted-foreground">{t("chat.askSubtitle")}</p>
                </>
              )}

              {pending ? (
                <p className="mt-4 text-caption text-muted-foreground">{t("chat.thinking")}</p>
              ) : null}
            </div>

            {/* Tap to speak — big orange mic, pulses while listening */}
            {voice.recognitionSupported ? (
              <div className="flex flex-col items-center gap-2 pb-2">
                <span className="text-caption font-medium text-muted-foreground">
                  {voice.listening ? t("chat.listening") : t("chat.micCta")}
                </span>
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-pressed={voice.listening}
                  disabled={pending}
                  className={cn(
                    "relative flex size-16 items-center justify-center rounded-full text-white shadow-lg",
                    "bg-gradient-to-br from-primary-400 to-primary-500",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50",
                  )}
                >
                  {voice.listening ? (
                    <motion.span
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-primary-300/50"
                      animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                    />
                  ) : null}
                  <Microphone weight="fill" className="relative size-7" aria-hidden />
                </button>
              </div>
            ) : null}

            {/* Suggested / most-asked questions — horizontal scroll like the reference */}
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => ask(q)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-4 py-2 text-caption text-foreground",
                    "hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                  )}
                >
                  {t(`chat.q.${q}`, { name: childName })}
                </button>
              ))}
            </div>

            {/* Type instead (accessibility fallback) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="flex items-center gap-2 border-t border-border px-4 pb-6 pt-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("chat.placeholder")}
                aria-label={t("chat.placeholder")}
                disabled={pending}
                className={cn(
                  "flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-body text-foreground",
                  "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-60",
                )}
              />
              <button
                type="submit"
                aria-label={t("chat.send")}
                disabled={!input.trim() || pending}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white",
                  "transition-opacity disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                )}
              >
                <PaperPlaneTilt weight="fill" className="size-5" aria-hidden />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
