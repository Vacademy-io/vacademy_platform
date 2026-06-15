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
import { playIllustrations } from "@/assets/play-illustrations";

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

    if (isLoading) {
        return <ContinueLearningCardSkeleton />;
    }

    if (!data?.slides || data.slides.length === 0) {
        const isFirstRun = !hasAnyProgress;
        return (
            <Card className={cn(
                "continue-learning-card-empty h-full border-dashed bg-muted/40 shadow-none hover:shadow-none transition-none",
                // Play: success surface (completion/progress semantics) — bright
                // surface, so ink text only; self-sufficient vs the legacy
                // .continue-learning-card-empty CSS shell (slated for deletion)
                "[.ui-play_&]:!bg-play-success [.ui-play_&]:!rounded-play-card [.ui-play_&]:!shadow-play-4d-success [.ui-play_&]:!border-0"
            )}>
                <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full space-y-4 relative overflow-hidden">
                    {/* Play mode illustration */}
                    <playIllustrations.Education className="hidden [.ui-play_&]:!block h-20 w-auto mb-2" />
                    <div className="p-3 bg-primary/10 rounded-full text-primary ring-1 ring-primary/20 [.ui-play_&]:bg-white [.ui-play_&]:text-play-ink [.ui-play_&]:ring-0">
                        {isFirstRun ? (
                            <BookOpen weight="duotone" size={24} />
                        ) : (
                            <Target weight="duotone" size={24} />
                        )}
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight [.ui-play_&]:font-black [.ui-play_&]:text-play-ink">
                            {isFirstRun ? "Start Learning" : "All Caught Up!"}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto [.ui-play_&]:text-play-ink">
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
                        className={cn(
                            "gap-2",
                            // Play: white chip with ink text on the bright success surface + press grammar
                            "[.ui-play_&]:rounded-xl [.ui-play_&]:font-bold [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide",
                            "[.ui-play_&]:!bg-white [.ui-play_&]:!text-play-ink [.ui-play_&]:!border-white [.ui-play_&]:hover:!bg-white/90",
                            "[.ui-play_&]:shadow-play-2d-success [.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none"
                        )}
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

    return (
        <Card className={cn(
            "continue-learning-card h-full flex flex-col shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden",
            // Vibrant: tenant-primary wash + top rail (no fixed hues)
            "[.ui-vibrant_&]:bg-primary-50 [.ui-vibrant_&]:border-primary-100",
            "[.ui-vibrant_&]:border-t-4 [.ui-vibrant_&]:border-t-primary-300",
            // Play Mode: navy premium surface, self-sufficient in JSX (legacy
            // .continue-learning-card rules in play-theme.css are slated for deletion)
            "[.ui-play_&]:!bg-play-navy [.ui-play_&]:!rounded-play-card [.ui-play_&]:!border-0",
            "[.ui-play_&]:!shadow-play-4d-navy [.ui-play_&]:hover:!shadow-play-4d-navy",
            "[.ui-play_&]:text-white",
            "[.ui-play_&]:flex [.ui-play_&]:flex-row"
        )}>
            <div className="[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0 [.ui-play_&]:flex [.ui-play_&]:flex-col">
            <CardHeader className="pb-3 px-4 sm:px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-3">
                    <div className={cn(
                        "p-2 bg-primary/10 rounded-md text-primary",
                        "[.ui-vibrant_&]:bg-primary-100 [.ui-vibrant_&]:text-primary-500",
                        "[.ui-play_&]:bg-white/25 [.ui-play_&]:text-white"
                    )}>
                        <Play weight="duotone" size={20} />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold [.ui-play_&]:text-white [.ui-play_&]:font-black">
                            Continue Learning
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5 [.ui-play_&]:text-white/80">
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
                    "[.ui-vibrant_&]:bg-white/50 [.ui-vibrant_&]:border-primary/30",
                    "[.ui-play_&]:bg-white/20 [.ui-play_&]:text-white [.ui-play_&]:border-white/20"
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
                                "[.ui-vibrant_&]:hover:bg-white/60 [.ui-vibrant_&]:hover:border-primary/20",
                                "[.ui-play_&]:bg-white/10 [.ui-play_&]:border-white/20 [.ui-play_&]:rounded-xl [.ui-play_&]:hover:bg-white/15 [.ui-play_&]:hover:border-white/30"
                            )}
                        >
                            <div className="flex-shrink-0">
                                <span className={cn(
                                    "flex items-center justify-center w-6 h-6 rounded-md text-xs font-medium",
                                    index === 0
                                        ? "bg-primary text-primary-foreground shadow-sm [.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/80 [.ui-play_&]:bg-white [.ui-play_&]:text-play-navy-deep [.ui-play_&]:font-bold"
                                        : "bg-muted text-muted-foreground [.ui-play_&]:bg-white/20 [.ui-play_&]:text-white"
                                )}>
                                    {index + 1}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate group-hover/item:text-primary transition-colors [.ui-play_&]:text-white [.ui-play_&]:font-bold [.ui-play_&]:group-hover/item:text-white">
                                    {slide.slide_title}
                                </h4>
                                <p className="text-xs text-muted-foreground truncate [.ui-play_&]:text-white/80">
                                    {slide.slide_description || "Continue from where you left off"}
                                </p>
                            </div>
                            <CaretRight size={14} weight="bold" className="text-muted-foreground group-hover/item:text-primary transition-colors [.ui-play_&]:text-white/70 [.ui-play_&]:group-hover/item:text-white" />
                        </div>
                    ))}
                </div>

                <Button
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className={cn(
                        "w-full gap-2 font-semibold",
                        "[.ui-vibrant_&]:bg-gradient-to-r [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/90 [.ui-vibrant_&]:shadow-lg [.ui-vibrant_&]:shadow-primary/20",
                        // Play: white chip with navy-deep ink — unmistakably readable on navy + press grammar
                        "[.ui-play_&]:!bg-white [.ui-play_&]:!text-play-navy-deep [.ui-play_&]:hover:!bg-white/90",
                        "[.ui-play_&]:font-black [.ui-play_&]:uppercase [.ui-play_&]:tracking-wide [.ui-play_&]:rounded-xl",
                        "[.ui-play_&]:shadow-play-2d-navy [.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none"
                    )}
                >
                    <Play weight="fill" size={16} />
                    Resume Learning
                </Button>
            </CardContent>
            </div>
            {/* Play: compact decorative side-rail (content owns the card) */}
            <div className="hidden [.ui-play_&]:!flex order-last w-24 flex-shrink-0 items-center justify-center self-center pr-3">
                <playIllustrations.ContinueLearning className="h-20 w-auto text-white" />
            </div>
        </Card>
    );
};
