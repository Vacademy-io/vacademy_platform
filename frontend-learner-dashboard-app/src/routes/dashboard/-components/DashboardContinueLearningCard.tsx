import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    DashbaordResponse,
    DashboardSlide,
} from "../-types/dashboard-data-types";
import {
    getTerminology,
    getTerminologyPlural,
} from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { Play, Target, BookOpen, CaretRight, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayTheme } from "@/hooks/use-play-theme";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";
import iconContinue from "@/assets/cleaner-play/icon-continue.webp";
import emptyLearningIllustration from "@/assets/cleaner-play/empty-learning.webp";

// Skeleton mirroring the card layout to avoid layout shift while loading
const ContinueLearningCardSkeleton = () => (
    <Card className="h-full">
        <CardHeader className="pb-3 px-4 sm:px-6 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-md" />
                <div className="space-y-1.5">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
        </CardHeader>
        <CardContent className="pt-0 px-4 sm:px-6 space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-md" />
        </CardContent>
    </Card>
);

// Enhanced Continue Learning Card
export const ContinueLearningCard = ({
    data,
    onResumeClick,
    isLoading = false,
    hasAnyProgress = false,
}: {
    data: DashbaordResponse | null;
    onResumeClick: (slide: DashboardSlide) => void;
    isLoading?: boolean;
    /** Whether the learner has made any progress at all — splits the empty
     *  state into first-run ("start your first lesson") vs genuinely done. */
    hasAnyProgress?: boolean;
}) => {
    const navigate = useNavigate();
    const isPlay = usePlayTheme();
    const isCleanerPlay = useCleanerPlayTheme();

    if (isLoading) {
        return <ContinueLearningCardSkeleton />;
    }

    if (!data?.slides || data.slides.length === 0) {
        const isFirstRun = !hasAnyProgress;

        if (isCleanerPlay) {
            return (
                <div className="cp-card flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
                    <img
                        src={emptyLearningIllustration}
                        alt=""
                        aria-hidden="true"
                        className="h-32 w-auto sm:h-36"
                    />
                    <div className="space-y-1">
                        <h3 className="cp-heading text-h3">
                            {isFirstRun ? "Start Learning" : "All Caught Up!"}
                        </h3>
                        <p className="cp-muted mx-auto max-w-xs text-body">
                            {isFirstRun
                                ? `Browse your ${getTerminologyPlural(
                                      ContentTerms.Course,
                                      SystemTerms.Course
                                  )} and start your first lesson.`
                                : `You've completed all available ${getTerminologyPlural(
                                      ContentTerms.Slides,
                                      SystemTerms.Slides
                                  )}. Great work, keep the momentum going.`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate({ to: "/study-library/courses" })}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-body font-semibold text-primary-foreground shadow-sm transition-transform active:translate-y-0.5"
                    >
                        {isFirstRun ? (
                            <Play weight="fill" size={16} />
                        ) : (
                            <BookOpen weight="fill" size={16} />
                        )}
                        {isFirstRun ? "Start your first lesson" : "Explore Content"}
                    </button>
                </div>
            );
        }

        if (isPlay) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-4 rounded-play-card bg-play-success-soft p-6 text-center shadow-play-soft-card">
                    <img
                        src={emptyLearningIllustration}
                        alt=""
                        aria-hidden="true"
                        className="h-32 w-auto sm:h-36"
                    />
                    <div className="space-y-1">
                        <h3 className="text-h3 font-black text-play-success-soft-ink">
                            {isFirstRun ? "Start Learning" : "All Caught Up!"}
                        </h3>
                        <p className="mx-auto max-w-xs text-body font-medium text-play-ink/70">
                            {isFirstRun
                                ? `Browse your ${getTerminologyPlural(
                                      ContentTerms.Course,
                                      SystemTerms.Course
                                  )} and start your first lesson.`
                                : `You've completed all available ${getTerminologyPlural(
                                      ContentTerms.Slides,
                                      SystemTerms.Slides
                                  )}. Great work, keep the momentum going.`}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate({ to: "/study-library/courses" })}
                        className="inline-flex items-center gap-2 rounded-play-btn bg-play-success px-6 py-3 text-body font-black uppercase tracking-wide text-white shadow-play-2d-success transition-transform active:translate-y-0.5 active:shadow-none"
                    >
                        {isFirstRun ? (
                            <Play weight="fill" size={16} />
                        ) : (
                            <BookOpen weight="fill" size={16} />
                        )}
                        {isFirstRun ? "Start your first lesson" : "Explore Content"}
                    </button>
                </div>
            );
        }

        return (
            <Card className="continue-learning-card-empty h-full border-dashed bg-muted/40 shadow-none hover:shadow-none transition-none">
                <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full space-y-4 relative overflow-hidden">
                    <div className="p-3 bg-primary/10 rounded-full text-primary ring-1 ring-primary/20">
                        {isFirstRun ? (
                            <BookOpen weight="duotone" size={24} />
                        ) : (
                            <Target weight="duotone" size={24} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight">
                            {isFirstRun ? "Start Learning" : "All Caught Up!"}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            {isFirstRun
                                ? `Browse your ${getTerminologyPlural(
                                      ContentTerms.Course,
                                      SystemTerms.Course
                                  )} and start your first lesson.`
                                : `You've completed all available ${getTerminologyPlural(
                                      ContentTerms.Slides,
                                      SystemTerms.Slides
                                  )}. Great work, keep the momentum going.`}
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate({ to: "/study-library/courses" })}
                        variant="outline"
                        className="gap-2"
                    >
                        {isFirstRun ? (
                            <Play weight="fill" size={16} />
                        ) : (
                            <BookOpen weight="fill" size={16} />
                        )}
                        {isFirstRun ? "Start your first lesson" : "Explore Content"}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (isCleanerPlay) {
        return (
            <div className="cp-card flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src={iconContinue}
                            alt=""
                            aria-hidden="true"
                            className="h-11 w-11 object-contain"
                        />
                        <div>
                            <p className="cp-heading text-body">Continue Learning</p>
                            <p className="cp-muted text-caption">
                                {data.slides.length}{" "}
                                {(data.slides.length === 1
                                    ? getTerminology(ContentTerms.Slides, SystemTerms.Slides)
                                    : getTerminologyPlural(
                                          ContentTerms.Slides,
                                          SystemTerms.Slides
                                      )
                                ).toLocaleLowerCase()}{" "}
                                in progress
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-cp-terracotta-tint px-2.5 py-1 text-caption font-semibold text-cp-terracotta">
                        <Sparkle size={10} weight="fill" /> Active
                    </span>
                </div>

                <div className="flex-1 space-y-2">
                    {data.slides.slice(0, 3).map((slide, index) => (
                        <div
                            key={slide.slide_id}
                            onClick={() => onResumeClick(slide)}
                            className="flex cursor-pointer items-center gap-3 rounded-xl border border-cp-border p-2.5 transition-colors hover:bg-cp-bg-deep"
                        >
                            <span
                                className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
                                    index === 0
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-cp-bg-deep text-cp-muted"
                                )}
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <h4 className="cp-heading truncate text-caption font-semibold">
                                    {slide.slide_title}
                                </h4>
                                <p className="cp-muted truncate text-3xs">
                                    {slide.slide_description || "Continue from where you left off"}
                                </p>
                            </div>
                            <CaretRight size={14} weight="bold" className="cp-muted shrink-0" />
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-body font-semibold text-primary-foreground shadow-sm transition-transform active:translate-y-0.5"
                >
                    <Play weight="fill" size={16} />
                    Resume Learning
                </button>
            </div>
        );
    }

    if (isPlay) {
        return (
            <div className="flex h-full flex-col gap-4 rounded-play-card bg-play-navy-soft p-4 shadow-play-soft-card sm:p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img
                            src={iconContinue}
                            alt=""
                            aria-hidden="true"
                            className="h-11 w-11 object-contain"
                        />
                        <div>
                            <p className="text-body font-black text-play-navy-soft-ink">Continue Learning</p>
                            <p className="text-caption font-bold text-play-ink/60">
                                {data.slides.length}{" "}
                                {(data.slides.length === 1
                                    ? getTerminology(ContentTerms.Slides, SystemTerms.Slides)
                                    : getTerminologyPlural(
                                          ContentTerms.Slides,
                                          SystemTerms.Slides
                                      )
                                ).toLocaleLowerCase()}{" "}
                                in progress
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-caption font-black uppercase tracking-wide text-play-navy-soft-ink shadow-play-soft-card">
                        <Sparkle size={10} weight="fill" /> Active
                    </span>
                </div>

                <div className="flex-1 space-y-2">
                    {data.slides.slice(0, 3).map((slide, index) => (
                        <div
                            key={slide.slide_id}
                            onClick={() => onResumeClick(slide)}
                            className="flex cursor-pointer items-center gap-3 rounded-xl bg-white/60 p-2.5 transition-colors hover:bg-white"
                        >
                            <span
                                className={cn(
                                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-black",
                                    index === 0
                                        ? "bg-play-navy text-white"
                                        : "bg-white text-play-ink/60"
                                )}
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                                <h4 className="truncate text-caption font-bold text-play-ink">
                                    {slide.slide_title}
                                </h4>
                                <p className="truncate text-3xs text-play-ink/60">
                                    {slide.slide_description || "Continue from where you left off"}
                                </p>
                            </div>
                            <CaretRight size={14} weight="bold" className="shrink-0 text-play-ink/50" />
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className="flex w-full items-center justify-center gap-2 rounded-play-btn bg-play-navy py-3 text-body font-black uppercase tracking-wide text-white shadow-play-2d-navy transition-transform active:translate-y-0.5 active:shadow-none"
                >
                    <Play weight="fill" size={16} />
                    Resume Learning
                </button>
            </div>
        );
    }

    return (
        <Card className={cn(
            "continue-learning-card h-full flex flex-col shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden",
            // Vibrant: tenant-primary wash + top rail (no fixed hues)
            "[.ui-vibrant_&]:bg-primary-50 [.ui-vibrant_&]:border-primary-100",
            "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300"
        )}>
            <div>
            <CardHeader className="pb-3 px-4 sm:px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-3">
                    <div className={cn(
                        "p-2 bg-primary/10 rounded-md text-primary",
                        "[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500"
                    )}>
                        <Play weight="duotone" size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold">
                            Continue Learning
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {data.slides.length}{" "}
                            {(data.slides.length === 1
                                ? getTerminology(ContentTerms.Slides, SystemTerms.Slides)
                                : getTerminologyPlural(
                                      ContentTerms.Slides,
                                      SystemTerms.Slides
                                  )
                            ).toLocaleLowerCase()}{" "}
                            in progress
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className={cn(
                    "bg-primary/10 text-primary border-primary/20 gap-1",
                    "[.ui-vibrant_&]:bg-white/50 [.ui-vibrant_&]:border-primary/30"
                )}>
                    <Sparkle size={10} weight="fill" /> Active
                </Badge>
            </CardHeader>

            <CardContent className="pt-0 px-4 sm:px-6 flex-1 flex flex-col gap-4">
                <div className="space-y-2 flex-1">
                    {data.slides.slice(0, 3).map((slide, index) => (
                        <div
                            key={slide.slide_id}
                            onClick={() => onResumeClick(slide)}
                            className={cn(
                                "group/item flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/80 transition-colors cursor-pointer border border-transparent hover:border-border",
                                "[.ui-vibrant_&]:hover:bg-white/60 [.ui-vibrant_&]:hover:border-primary/20"
                            )}
                        >
                            <div className="flex-shrink-0">
                                <span className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded-md text-xs font-medium",
                                    index === 0
                                        ? "bg-primary text-primary-foreground shadow-sm [.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/80"
                                        : "bg-muted text-muted-foreground"
                                )}>
                                    {index + 1}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate group-hover/item:text-primary transition-colors">
                                    {slide.slide_title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate">
                                    {slide.slide_description || "Continue from where you left off"}
                                </p>
                            </div>
                            <CaretRight size={14} weight="bold" className="text-muted-foreground group-hover/item:text-primary transition-colors" />
                        </div>
                    ))}
                </div>

                <Button
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className={cn(
                        "w-full gap-2 font-semibold",
                        "[.ui-vibrant_&]:bg-gradient-to-r [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/90 [.ui-vibrant_&]:shadow-lg [.ui-vibrant_&]:shadow-primary/20"
                    )}
                >
                    <Play weight="fill" size={16} />
                    Resume Learning
                </Button>
            </CardContent>
            </div>
        </Card>
    );
};
