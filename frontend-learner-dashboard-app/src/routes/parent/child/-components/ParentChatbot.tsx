import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChatCircleDots, Robot, CaretRight, PaperPlaneTilt, Microphone } from "@phosphor-icons/react";
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
  const voice = useParentVoice(i18n.language);
  const { data: overview } = useChildOverview(childId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;
  const addMsg = (m: Msg) => setMessages((prev) => [...prev, m]);
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
        return;
      }
    } catch {
      // fall through to the on-device answer
    } finally {
      setPending(false);
    }
    const a = keywordAnswer(text);
    addMsg({ id: nextId(), role: "bot", text: a.text, module: a.module });
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
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label={t("chat.open")}
          data-tour="parent-chat"
          className={cn(
            "fixed bottom-5 end-5 z-50 flex size-14 items-center justify-center rounded-full",
            "bg-primary-500 text-primary-50 shadow-lg transition-transform hover:scale-105",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
          )}
        >
          <ChatCircleDots size={26} weight="fill" aria-hidden />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="mx-auto max-w-2xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Robot weight="duotone" className="size-5 text-primary-500" aria-hidden />
            {t("chat.title")}
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
                {m.module ? (
                  <button
                    onClick={() => navigate({ to: `/parent/child/${childId}/${m.module}` as never })}
                    className="ms-1 inline-flex items-center gap-1 text-caption font-medium text-primary-500 focus:outline-none focus-visible:underline"
                  >
                    {t("chat.view")}
                    <CaretRight className="size-3 rtl:rotate-180" aria-hidden />
                  </button>
                ) : null}
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

        {/* Free-text question box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
          className="mt-3 flex items-center gap-2"
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
          {voice.recognitionSupported ? (
            <button
              type="button"
              onClick={toggleMic}
              aria-label={t("chat.mic")}
              aria-pressed={voice.listening}
              disabled={pending}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50",
                voice.listening
                  ? "animate-pulse bg-danger-500 text-white"
                  : "bg-primary-50 text-primary-500",
              )}
            >
              <Microphone weight="fill" className="size-4" aria-hidden />
            </button>
          ) : null}
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
