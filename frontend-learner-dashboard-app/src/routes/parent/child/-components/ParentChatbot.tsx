import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChatCircleDots, Robot, CaretRight } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useChildOverview } from "../-hooks/use-parent-child";

type QKey = "attendance" | "fees" | "rewards" | "tests" | "progress";
const QUESTIONS: QKey[] = ["attendance", "fees", "rewards", "tests", "progress"];

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
 * A friendly, safe parent Q&A — a "basic questionnaire" answered from the child's
 * overview data we already hold client-side. No AI backend, no data-leak surface:
 * every answer is computed from the guarded /overview response.
 */
export function ParentChatbot({ childId, childName }: ParentChatbotProps) {
  const { t } = useTranslation("parent");
  const navigate = useNavigate();
  const { data: overview } = useChildOverview(childId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [seq, setSeq] = useState(0);

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

  const ask = (q: QKey) => {
    const a = answer(q);
    setMessages((prev) => [
      ...prev,
      { id: seq + 1, role: "user", text: t(`chat.q.${q}`, { name: childName }) },
      { id: seq + 2, role: "bot", text: a.text, module: a.module },
    ]);
    setSeq((s) => s + 2);
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

        <div className="mt-2 flex max-h-72 flex-col gap-2 overflow-y-auto py-2">
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
      </SheetContent>
    </Sheet>
  );
}
