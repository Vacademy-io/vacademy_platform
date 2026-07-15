import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CaretRight, ArrowRight } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePlayTheme } from "@/hooks/use-play-theme";
import { useCleanerPlayTheme } from "@/hooks/use-cleaner-play-theme";

export const StatCardSkeleton = () => (
    <Card className="h-full">
        <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
            </div>
        </CardContent>
    </Card>
);

export const StatCard = ({
    title,
    count,
    icon: Icon,
    onClick,
    isLoading = false,
    className,
    iconClassName,
    illustration,
    cleanerIllustrationSrc,
    emptyActionLabel,
}: {
    title: string;
    count: number | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    icon: any;
    onClick: () => void;
    isLoading?: boolean;
    className?: string;
    iconClassName?: string;
    illustration?: React.FC<React.SVGProps<SVGSVGElement>>;
    /** Cleaner Play only — a raster (webp) icon illustration, since that
     *  skin's art is generated imagery, not an SVG component. */
    cleanerIllustrationSrc?: string;
    /** Shown instead of the title when the count is genuinely 0, turning the
     *  card into an invitation (e.g. "Browse Courses") rather than a dead zero. */
    emptyActionLabel?: string;
}) => {
    const isPlay = usePlayTheme();
    const isCleanerPlay = useCleanerPlayTheme();

    // Skeleton while loading — covers the count-not-yet-known (undefined/null) case
    if (isLoading) return <StatCardSkeleton />;

    const isEmpty = (count ?? 0) === 0;
    const showAction = isEmpty && !!emptyActionLabel;
    const subtitleText = showAction ? emptyActionLabel : title;

    if (isCleanerPlay) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-label={
                    showAction
                        ? `${title} - ${emptyActionLabel}`
                        : `View ${title} - ${count ?? 0} items`
                }
                className={cn(
                    "cp-card group flex h-full w-full flex-col items-start gap-3 p-4 text-left transition-transform duration-base ease-out-soft hover:-translate-y-0.5"
                )}
            >
                <div className="flex w-full items-center justify-between">
                    {cleanerIllustrationSrc ? (
                        <img
                            src={cleanerIllustrationSrc}
                            alt=""
                            aria-hidden="true"
                            className="h-11 w-11 object-contain"
                        />
                    ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cp-sage-tint text-cp-sage">
                            <Icon size={20} weight="duotone" />
                        </span>
                    )}
                    <CaretRight
                        size={16}
                        className="cp-muted transition-transform duration-300 group-hover:translate-x-0.5"
                    />
                </div>
                {showAction ? (
                    <span className="cp-heading inline-flex items-center gap-1 text-h3">
                        {emptyActionLabel}
                        <ArrowRight size={16} weight="bold" />
                    </span>
                ) : (
                    <span className="cp-heading text-h2 tabular-nums">
                        {(count ?? 0).toLocaleString()}
                    </span>
                )}
                {!showAction && (
                    <span className="cp-muted text-caption font-medium">{title}</span>
                )}
            </button>
        );
    }

    return (
        <Card
            onClick={onClick}
            className={cn(
                "group relative overflow-hidden cursor-pointer transition-all duration-base ease-out-soft hover:shadow-md hover:border-primary/20 h-full",
                // Vibrant: card stays white unless the caller passes the
                // primary-50 wash + top-rail via className (tenant grammar)
                // Play Mode Styles
                "[.ui-play_&]:border-0 [.ui-play_&]:hover:-translate-y-1 [.ui-play_&]:active:translate-y-0.5 [.ui-play_&]:active:shadow-none",
                className
            )}
            tabIndex={0}
            role="button"
            aria-label={
                showAction
                    ? `${title} - ${emptyActionLabel}`
                    : `View ${title} - ${count ?? 0} items`
            }
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
        >
            {/* Play mode: compact layout, content left + illustration right rail at all breakpoints */}
            {isPlay && illustration ? (
                <div className="flex flex-row h-full">
                    {/* Content: left */}
                    <div className="flex-1 p-3 sm:p-4 flex flex-col justify-between relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <div className={cn(
                                "p-2 rounded-md transition-colors",
                                iconClassName || "bg-white/20 text-white"
                            )}>
                                <Icon size={20} weight="fill" className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <CaretRight size={16} className="text-white/90 group-hover:text-white" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                                {(count ?? 0).toLocaleString()}
                            </div>
                            <div className="text-caption font-bold text-white/90 uppercase tracking-wide">
                                {subtitleText}
                            </div>
                        </div>
                    </div>
                    {/* Illustration: right rail */}
                    <div className="w-24 sm:w-28 flex items-center justify-center bg-white/10 p-2 flex-shrink-0">
                        {React.createElement(illustration, { className: "h-20 w-auto text-white" })}
                    </div>
                </div>
            ) : (
                /* Default / Vibrant layout */
                <>
                    <CardContent className="p-3 sm:p-4 flex flex-col justify-between h-full relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <div className={cn(
                                "p-2 bg-primary/10 rounded-md text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20",
                                "[.ui-vibrant_&]:ring-0",
                                iconClassName
                            )}>
                                <Icon size={20} weight="duotone" className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <CaretRight size={16}
                                className="text-muted-foreground group-hover:text-primary transition-all duration-300 group-hover:translate-x-0.5"
                            />
                        </div>
                        <div className="space-y-1">
                            {showAction ? (
                                // Empty: a "Get started" invitation, never a dead "0".
                                <div className="inline-flex items-center gap-1 text-lg sm:text-xl font-bold tracking-tight text-primary">
                                    Get started
                                    <ArrowRight
                                        size={16}
                                        weight="bold"
                                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                                    />
                                </div>
                            ) : (
                                <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                    {(count ?? 0).toLocaleString()}
                                </div>
                            )}
                            <div className={cn(
                                "text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1",
                                "[.ui-vibrant_&]:text-primary/70 [.ui-vibrant_&]:group-hover:text-primary",
                                showAction && "text-muted-foreground font-medium"
                            )}>
                                {subtitleText}
                            </div>
                        </div>
                    </CardContent>
                    {/* Vibrant Decorator */}
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl hidden [.ui-vibrant_&]:block group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                </>
            )}
        </Card>
    );
};
