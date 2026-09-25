import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import type { EngagementItem } from "@/services/engagement";
import { parseQuestionPayload } from "@/services/engagement";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { useCorporateTheme } from "@/hooks/use-corporate-theme";
import { CORPORATE_CHIP, stripLeadingEmoji, visualFor } from "./engagement-visuals";

/**
 * The reveal moment — last night's question, the right answer, and how the
 * learner did. This is the payoff the reveal time exists for; before it, a
 * completed task simply vanished from the feed and the answer was never shown.
 */
export function RevealedAnswers({ items }: { items: EngagementItem[] }) {
  const { t } = useTranslation("dashboardEngagement");
  const isCorporate = useCorporateTheme();
  if (items.length === 0) return null;

  return (
    <div className="border-t border-neutral-100 bg-gradient-to-b from-amber-50/60 to-transparent px-5 py-4 dark:border-neutral-800 dark:from-amber-950/20 [.ui-corporate_&]:bg-none [.ui-corporate_&]:border-border">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 [.ui-corporate_&]:normal-case [.ui-corporate_&]:tracking-normal [.ui-corporate_&]:font-medium [.ui-corporate_&]:text-muted-foreground">
        {isCorporate ? stripLeadingEmoji(t("card.revealed")) : t("card.revealed")}
      </p>
      <ul className="mt-2 space-y-3">
        {items.slice(0, 3).map((item) => {
          const visual = visualFor(item.itemType);
          const VisualIcon = visual.icon;
          const payload = parseQuestionPayload(item);
          const options = payload?.options ?? [];
          const isMcq = item.itemType === "QUESTION_OF_DAY" && options.length > 0;
          const correct = options.find((o) => o.id === item.correctOptionId);
          const mine = options.find((o) => o.id === item.selectedOptionId);
          const wasRight = item.isCorrect === true;

          return (
            <li
              key={`${item.id}-${item.runDate}`}
              className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border border-neutral-200 bg-white p-4 duration-500 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-lg ${isCorporate ? CORPORATE_CHIP : visual.chip}`}
                  aria-hidden
                >
                  {isCorporate ? (
                    wasRight ? (
                      <CheckCircle size={18} className="text-success-600" />
                    ) : item.isCorrect === false ? (
                      <XCircle size={18} />
                    ) : (
                      <VisualIcon size={18} />
                    )
                  ) : wasRight ? (
                    "🎉"
                  ) : item.isCorrect === false ? (
                    "💪"
                  ) : (
                    visual.glyph
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                    {item.title}
                  </p>
                  {item.packageSessionName && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {item.packageSessionName}
                    </p>
                  )}

                  {isMcq && (
                    <div className="mt-2 space-y-1 text-sm">
                      {correct && (
                        <p className="text-emerald-700 dark:text-emerald-300">
                          <span className="font-semibold">{t("card.answer")}</span> {correct.text}
                        </p>
                      )}
                      {mine && !wasRight && (
                        <p className="text-neutral-600 dark:text-neutral-400">
                          {t("card.youPicked", { text: mine.text })}
                        </p>
                      )}
                      {wasRight && (
                        <p className="text-neutral-600 dark:text-neutral-400">
                          {t("card.gotIt", { count: item.pointsAwarded ?? 0 })}
                        </p>
                      )}
                    </div>
                  )}

                  {item.explanation && (
                    <div
                      className="prose prose-sm mt-2 max-w-none text-sm text-neutral-600 dark:prose-invert dark:text-neutral-400"
                      // Teacher rich text, sanitized before it touches the DOM.
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(item.explanation, {
                          USE_PROFILES: { html: true },
                        }),
                      }}
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
