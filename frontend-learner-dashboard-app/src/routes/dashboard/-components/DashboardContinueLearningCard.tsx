import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DashbaordResponse,
    DashboardSlide,
} from "../-types/dashboard-data-types";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { ChevronRight, Sparkles } from "lucide-react";
import { Play, Target, BookOpen } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { playIllustrations } from "@/assets/play-illustrations";

// Enhanced Continue Learning Card
export const ContinueLearningCard = ({
    data,
    onResumeClick,
}: {
    data: DashbaordResponse | null;
    onResumeClick: (slide: DashboardSlide) => void;
}) => {
    if (!data?.slides || data.slides.length === 0) {
        return (
            <Card className={cn(
                "h-full border-dashed bg-muted/40 shadow-none hover:shadow-none transition-none",
                "[.ui-play_&]:border-solid [.ui-play_&]:border-2 [.ui-play_&]:border-[hsl(var(--play-green))]/30 [.ui-play_&]:bg-[hsl(var(--play-green))]/5 [.ui-play_&]:shadow-[0_4px_0_hsl(var(--play-green)/0.2)]"
            )}>
                <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full space-y-4 relative overflow-hidden">
                    {/* Play mode illustration */}
                    <playIllustrations.Education className="hidden [.ui-play_&]:!block h-20 w-auto mb-2 text-green-600" />
                    <div className="p-3 bg-primary/10 rounded-full text-primary ring-1 ring-primary/20 [.ui-play_&]:bg-[hsl(var(--play-green))]/20 [.ui-play_&]:text-[hsl(var(--play-green))] [.ui-play_&]:ring-0">
                        <Target
                            weight="duotone"
                            size={24}
                        />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold tracking-tight [.ui-play_&]:font-black">
                            All Caught Up!
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                            You've completed all available{" "}
                            {getTerminology(ContentTerms.Slides, SystemTerms.Slides)}s. Explore
                            more content to continue learning.
                        </p>
                    </div>
                    <Button variant="outline" className="gap-2 [.ui-play_&]:rounded-xl [.ui-play_&]:font-bold [.ui-play_&]:uppercase [.ui-play_&]:shadow-[0_3px_0_hsl(var(--primary-300))]">
                        <BookOpen weight="duotone" size={16} />
                        Explore Content
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "h-full flex flex-col shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden",
            // Vibrant Mode Styles
            "[.ui-vibrant_&]:bg-indigo-50 dark:[.ui-vibrant_&]:bg-indigo-950/30",
            "[.ui-vibrant_&]:border-indigo-200 dark:[.ui-vibrant_&]:border-indigo-800/50",
            // Play Mode: solid blue card
            "[.ui-play_&]:!bg-[#5B9BD5] [.ui-play_&]:!border-[#5B9BD5] [.ui-play_&]:!shadow-[0_5px_0_#3D7AB5]",
            "[.ui-play_&]:text-white",
            "[.ui-play_&]:flex [.ui-play_&]:flex-row [.ui-play_&]:md:flex-col"
        )}>
            {/* Play SVG: side on mobile, top on desktop */}
            <div className="hidden [.ui-play_&]:!flex order-2 md:order-first w-28 md:w-full items-center justify-center bg-white/10 p-2 md:px-6 md:pt-4 md:pb-2 flex-shrink-0">
              <playIllustrations.ContinueLearning className="h-24 md:h-28 w-auto text-white" />
            </div>
            <div className="[.ui-play_&]:flex-1 [.ui-play_&]:min-w-0">
            <CardHeader className="pb-3 px-4 sm:px-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center space-x-3">
                    <div className={cn(
                        "p-2 bg-primary/10 rounded-md text-primary",
                        "[.ui-vibrant_&]:bg-indigo-100 [.ui-vibrant_&]:text-indigo-600 [.ui-vibrant_&]:dark:bg-indigo-500/20 [.ui-vibrant_&]:dark:text-indigo-300"
                    )}>
                        <Play weight="duotone" size={18} />
                    </div>
                    <div>
                        <CardTitle className="text-base font-semibold">
                            Continue Learning
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {data.slides.length}{" "}
                            {getTerminology(
                                ContentTerms.Slides,
                                SystemTerms.Slides
                            ).toLocaleLowerCase()}
                            {data.slides.length !== 1 ? "s" : ""} in progress
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" className={cn(
                    "bg-primary/10 text-primary border-primary/20 gap-1",
                    "[.ui-vibrant_&]:bg-white/50 [.ui-vibrant_&]:border-primary/30"
                )}>
                    <Sparkles size={8} /> Active
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
                                    index === 0 ? "bg-primary text-primary-foreground shadow-sm [.ui-vibrant_&]:bg-gradient-to-br [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/80" : "bg-muted text-muted-foreground"
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
                            <ChevronRight size={14} className="text-muted-foreground group-hover/item:text-primary transition-colors" />
                        </div>
                    ))}
                </div>

                <Button
                    onClick={() => data.slides[0] && onResumeClick(data.slides[0])}
                    className={cn(
                        "w-full gap-2",
                        "[.ui-vibrant_&]:bg-gradient-to-r [.ui-vibrant_&]:from-primary [.ui-vibrant_&]:to-primary/90 [.ui-vibrant_&]:shadow-lg [.ui-vibrant_&]:shadow-primary/20"
                    )}
                    size="sm"
                >
                    <Play weight="duotone" size={14} />
                    Resume Learning
                </Button>
            </CardContent>
            </div>
        </Card>
    );
};
