import React from "react";
import {
  ArrowSquareOut,
  BookOpen,
  Broadcast,
  CaretRight,
  ClipboardText,
  Exam,
  FilePdf,
  LinkSimple,
  PlayCircle,
  Presentation,
  Question,
} from "@phosphor-icons/react";
import type { CardIcon, LinkListCardData } from "../types";
import { ChatLink } from "./ChatLink";
import { classifyHref } from "./href";

const ICONS: Record<CardIcon, React.ElementType> = {
  course: BookOpen,
  slide: Presentation,
  video: PlayCircle,
  pdf: FilePdf,
  quiz: Exam,
  question: Question,
  live: Broadcast,
  assessment: ClipboardText,
  link: LinkSimple,
};

const ROW = "flex items-center gap-2.5 px-3 py-2";

export const LinkListCard: React.FC<{ card: LinkListCardData }> = ({ card }) => (
  <section className="overflow-hidden rounded-xl bg-card text-card-foreground shadow-sm ring-1 ring-border/30">
    {card.title && <h3 className="px-3 pt-2.5 pb-1 text-sm font-semibold">{card.title}</h3>}
    <ul className="divide-y divide-border/50">
      {card.items.map((item, i) => {
        const Icon = ICONS[item.icon ?? "link"];
        const target = classifyHref(item.href).kind;
        return (
          <li key={i}>
            <ChatLink
              href={item.href}
              className={`${ROW} transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none`}
              inertClassName={ROW}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium line-clamp-2">{item.title}</span>
                {item.subtitle && (
                  <span className="block truncate text-caption text-muted-foreground">{item.subtitle}</span>
                )}
              </span>
              {item.badge && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                  {item.badge}
                </span>
              )}
              {target === "internal" && (
                <CaretRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
              )}
              {target === "external" && (
                <ArrowSquareOut className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </ChatLink>
          </li>
        );
      })}
    </ul>
  </section>
);
