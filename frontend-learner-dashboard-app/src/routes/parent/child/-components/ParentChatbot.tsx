import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import chatTeacher from "@/assets/parent-icons/chat-teacher.webp";
import {
  ChalkboardTeacher,
  CaretRight,
  PaperPlaneTilt,
  Microphone,
  SpeakerHigh,
  SpeakerSlash,
  House,
  Eye,
} from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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

  return (
    <Sheet onOpenChange={(open) => { if (!open) voice.cancelSpeak(); }}>
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
            <House weight="fill" className="size-6" aria-hidden />
            <span className="text-caption font-medium">{t("nav.home")}</span>
          </button>

          {/* Centre bot — raised above the bar, same attention animation as the old FAB */}
          <div className="flex flex-1 flex-col items-center">
            <SheetTrigger asChild>
              <motion.button
                aria-label={t("chat.open")}
                data-tour="parent-chat"
                className={cn(
                  "relative -mt-8 flex size-16 items-center justify-center rounded-full",
                  "bg-gradient-to-br from-primary-50 to-secondary-50 shadow-lg ring-4 ring-background",
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
            </SheetTrigger>
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

      <SheetContent side="bottom" className="mx-auto max-w-2xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ChalkboardTeacher weight="duotone" className="size-5 text-primary-500" aria-hidden />
            {t("chat.title")}
            {voice.speechSupported ? (
              <button
                type="button"
                onClick={() => {
                  voice.cancelSpeak();
                  setMuted((m) => !m);
                }}
                aria-label={muted ? t("chat.unmute") : t("chat.mute")}
                aria-pressed={muted}
                className="ms-auto flex size-8 items-center justify-center rounded-full text-primary-500 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                {muted ? (
                  <SpeakerSlash weight="fill" className="size-4" aria-hidden />
                ) : (
                  <SpeakerHigh weight="fill" className="size-4" aria-hidden />
                )}
              </button>
            ) : null}
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto py-2">
          <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-body text-foreground">
            {t("chat.greeting", { name: childName })}
          </div>
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="self-end rounded-2xl rounded-br-sm bg-primary-500 px-3 py-2 text-body text-primary-50">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="flex flex-col items-start gap-1">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-body text-foreground">
                  {m.text}
                </div>
                <div className="ms-1 flex items-center gap-3">
                  {voice.speechSupported ? (
                    <button
                      onClick={() => voice.speak(m.text)}
                      aria-label={t("chat.speak")}
                      className="inline-flex items-center gap-1 text-caption font-medium text-primary-500 focus:outline-none focus-visible:underline"
                    >
                      <SpeakerHigh weight="fill" className="size-3.5" aria-hidden />
                      {t("chat.speak")}
                    </button>
                  ) : null}
                  {m.module ? (
                    <button
                      onClick={() => navigate({ to: `/parent/child/${childId}/${m.module}` as never })}
                      className="inline-flex items-center gap-1 text-caption font-medium text-primary-500 focus:outline-none focus-visible:underline"
                    >
                      {t("chat.view")}
                      <CaretRight className="size-3 rtl:rotate-180" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {pending ? (
            <div className="self-start rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-body text-muted-foreground">
              {t("chat.thinking")}
            </div>
          ) : null}
        </div>

        {/* Preset questions ("basic questionnaire") */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className={cn(
                "rounded-full border border-border bg-card px-3 py-1.5 text-caption text-foreground",
                "transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              )}
            >
              {t(`chat.q.${q}`, { name: childName })}
            </button>
          ))}
        </div>

        {/* Primary call-to-action: speak. Big, highlighted, pulses while listening. */}
        {voice.recognitionSupported ? (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={voice.listening}
            disabled={pending}
            className={cn(
              "mt-3 flex w-full items-center justify-center gap-2 rounded-full py-3 text-body font-semibold shadow-sm",
              "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50",
              voice.listening ? "animate-pulse bg-danger-500 text-white" : "bg-primary-500 text-primary-50",
            )}
          >
            <Microphone weight="fill" className="size-5" aria-hidden />
            {voice.listening ? t("chat.listening") : t("chat.micCta")}
          </button>
        ) : null}

        {/* Or type */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="mt-2 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={voice.listening ? t("chat.listening") : t("chat.placeholder")}
            aria-label={t("chat.open")}
            disabled={pending}
            className={cn(
              "flex-1 rounded-full border border-border bg-card px-4 py-2 text-body text-foreground",
              "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
              "disabled:opacity-60",
            )}
          />
          <button
            type="submit"
            aria-label={t("chat.send")}
            disabled={!input.trim() || pending}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-primary-50",
              "transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
            )}
          >
            <PaperPlaneTilt weight="fill" className="size-4" aria-hidden />
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
