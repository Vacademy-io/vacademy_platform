import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, Play, BookOpen, Users, Clock } from "lucide-react";
import { IconRocket, IconMoodSmile, IconAdjustments } from "@tabler/icons-react";
import BoringAvatar from "boring-avatars";
import { useRouter } from "@tanstack/react-router";
import { getPublicUrlWithoutLogin } from "@/services/upload_file";
import LocalStorageUtils from "@/utils/localstorage";
import { Star } from "@phosphor-icons/react";
import { ProgressBar } from "@/components/ui/custom-progress-bar";
import { ProgressRing } from "@/routes/dashboard/-components/play/ProgressRing";
import { cn, toTitleCase } from "@/lib/utils";
import { getTerminology } from "@/components/common/layout-container/sidebar/utils.ts";
import { ContentTerms, RoleTerms, SystemTerms } from "@/types/naming-settings";
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Instructor {
    id: string;
    full_name: string;
    image_url?: string;
}

interface CourseCardProps {
    courseId: string;
    packageSessionId?: string;
    package_name: string;
    level_name: string;

    instructors: Instructor[];
    rating: number;
    description: string;
    percentageCompleted: number;
    tags: string[];
    studentCount?: number;
    previewImageUrl: string;
    selectedTab: string;
    readTimeInMinutes: number;
}

const fallbackInstructorImage =
    "https://api.dicebear.com/7.x/thumbs/svg?seed=anon";

const CourseCard: React.FC<CourseCardProps> = ({
    courseId,
    packageSessionId,
    package_name,
    level_name,
    instructors,
    rating,
    description,
    percentageCompleted,
    tags,
    studentCount,
    previewImageUrl,
    selectedTab,
    readTimeInMinutes,
}) => {
    const [courseImageUrl, setCourseImageUrl] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(true);
    const router = useRouter();

    const instructor = instructors[0];
    const instructorName = instructor?.full_name || "Unknown Instructor";
    const instructorImage = instructor?.image_url || fallbackInstructorImage;

    const ratingValue = rating || 0;
    const cappedPercentageCompleted = Math.min(percentageCompleted, 100);
    const isCompleted = cappedPercentageCompleted === 100;

    const LevelIcon = useMemo(() => {
        const lvl = (level_name || "").toLowerCase();
        if (lvl === "beginner") return IconMoodSmile;
        if (lvl === "intermediate") return IconAdjustments;
        if (lvl === "advanced") return IconRocket;
        return IconMoodSmile;
    }, [level_name]);

    const handleViewCoureseDetails = (id: string) => {
        try {
            // Persist percentage locally as a fallback for details page
            const key = `COURSE_PCT_${id}`;
            LocalStorageUtils.set(key, {
                value: cappedPercentageCompleted,
                ts: Date.now(),
            });
        } catch {
            // Failed to save percentage to localStorage
        }
        router.navigate({
            to: "/study-library/courses/course-details",
            search: {
                courseId: id,
                packageSessionId: packageSessionId,
                selectedTab: selectedTab,
                percentageCompleted: cappedPercentageCompleted,
            },
        });
    };

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            if (!previewImageUrl) {
                if (isMounted) {
                    setLoadingImage(false);
                    setCourseImageUrl((prev) => (prev === null ? prev : null));
                }
                return;
            }

            setLoadingImage(true);
            try {
                const url = await getPublicUrlWithoutLogin(previewImageUrl);
                if (isMounted) {
                    const next = url || null;
                    setCourseImageUrl((prev) => (prev === next ? prev : next));
                }
            } catch {
                if (isMounted) {
                    setCourseImageUrl((prev) => (prev === null ? prev : null));
                }
            } finally {
                if (isMounted) {
                    setLoadingImage(false);
                }
            }
        };

        load();
        return () => {
            isMounted = false;
        };
    }, [previewImageUrl]);

    const getLevelBadgeVariant = () => {
        // ... (keep existing switch)
        switch (level_name.toLowerCase()) {
            case "beginner":
                return "secondary";
            case "intermediate":
                return "default";
            case "advanced":
                return "destructive";
            default:
                return "outline";
        }
    };

    const getLevelCustomClass = () => {
        // ... (keep existing switch)
        switch (level_name.toLowerCase()) {
            case "beginner":
                return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-transparent dark:bg-emerald-900/30 dark:text-emerald-300";
            case "intermediate":
                return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-transparent dark:bg-amber900/30 dark:text-amber-300";
            case "advanced":
                return "bg-rose-100 text-rose-700 hover:bg-rose-200 border-transparent dark:bg-rose-900/30 dark:text-rose-300";
            default:
                return "bg-primary-100 text-primary-700 hover:bg-primary-200 border-transparent dark:bg-primary/20 dark:text-primary";
        }
    };

    const levelLower = (level_name || "").trim().toLowerCase();
    const isDefaultLevel = levelLower === "default" || levelLower.includes("default");

    return (
        <Card className={cn(
            "course-card group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm flex flex-col w-full max-w-full animate-fade-in-up border-border/60 bg-card/50 hover:bg-card",
            // Vibrant Styles - Flat Pastel
            !isCompleted && "[.ui-vibrant_&]:bg-slate-50 dark:[.ui-vibrant_&]:bg-slate-900/30",
            !isCompleted && "[.ui-vibrant_&]:border-slate-200/50 dark:[.ui-vibrant_&]:border-slate-800/30",

            // Completed Styles
            isCompleted && "[.ui-vibrant_&]:bg-emerald-50 dark:[.ui-vibrant_&]:bg-emerald-950/30",
            isCompleted && "[.ui-vibrant_&]:border-emerald-200/50 dark:[.ui-vibrant_&]:border-emerald-800/30",

            "[.ui-vibrant_&]:shadow-sm [.ui-vibrant_&]:hover:shadow-md",

            // Play Styles - Rounded, bouncy, fun
            "[.ui-play_&]:rounded-2xl [.ui-play_&]:border-2 [.ui-play_&]:shadow-[0_6px_0_hsl(var(--primary-200))]",
            "[.ui-play_&]:hover:shadow-[0_9px_0_hsl(var(--primary-200))] [.ui-play_&]:hover:-translate-y-1",
            "[.ui-play_&]:transition-all [.ui-play_&]:duration-150"
        )}>
            {/* Background gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg pointer-events-none"></div>

            {/* Image Container */}
            {(loadingImage || courseImageUrl) && (
                <div className="relative w-full h-36 sm:h-40 lg:h-44 bg-muted flex items-center justify-center overflow-hidden rounded-t-lg course-card-image border-b">
                    {courseImageUrl && (
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center z-10">
                            <div className={cn(
                                "bg-background/90 backdrop-blur-sm rounded-full p-3 transform scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-md",
                                "[.ui-vibrant_&]:bg-white/90 [.ui-vibrant_&]:text-indigo-600 dark:[.ui-vibrant_&]:text-indigo-300"
                            )}>
                                <Play
                                    size={20}
                                    className="text-primary ml-1 fill-primary [.ui-vibrant_&]:text-inherit [.ui-vibrant_&]:fill-current"
                                />
                            </div>
                        </div>
                    )}

                    {loadingImage ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-muted">
                            <div className="flex flex-col items-center space-y-3">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        </div>
                    ) : courseImageUrl ? (
                        <img
                            src={courseImageUrl}
                            alt={package_name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : null}
                </div>
            )}

            <div className="flex flex-col flex-grow p-4 lg:p-5 gap-3">
                {/* Header */}
                <div className="flex justify-between items-start gap-3">
                    <h3
                        className="text-lg font-bold leading-tight group-hover:text-primary transition-colors duration-200 line-clamp-2"
                        title={toTitleCase(package_name)}
                    >
                        {toTitleCase(package_name)}
                    </h3>

                    <Badge
                        variant={getLevelBadgeVariant() as any}
                        className={cn(
                            "flex-shrink-0 gap-1 px-2.5 py-0.5",
                            getLevelCustomClass(),
                            // Default level logic: hidden by default, shown in vibrant/play mode
                            isDefaultLevel && "hidden [.ui-vibrant_&]:inline-flex [.ui-play_&]:inline-flex",
                            // Vibrant mode override for alignment/style if needed
                            "[.ui-vibrant_&]:shadow-sm",
                            // Play mode: pill badge
                            "[.ui-play_&]:rounded-full [.ui-play_&]:shadow-sm [.ui-play_&]:font-bold"
                        )}
                    >
                        <LevelIcon size={12} className="text-current hidden [.ui-vibrant_&]:block" />
                        {!isDefaultLevel && toTitleCase(level_name)}
                        {/* If it IS default level, we might want to show text in vibrant mode? 
                            Original logic: !isDefaultLevel && toTitleCase(level_name). 
                            If it's default level, text is hidden, only icon was shown in original logic?
                            Wait, original: `{!isDefaultLevel && toTitleCase(level_name)}`.
                            So if default level, NO TEXT. Only icon (if vibrant).
                        */}
                    </Badge>
                </div>

                {/* Description */}
                <div
                    className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-grow"
                    dangerouslySetInnerHTML={{
                        __html: description || "",
                    }}
                />

                {/* Instructor */}
                {instructors.length > 0 && (
                    <div className={cn(
                        "flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors duration-200 -mx-2",
                        // Vibrant Styles
                        "[.ui-vibrant_&]:hover:bg-white/60 [.ui-vibrant_&]:border [.ui-vibrant_&]:border-transparent [.ui-vibrant_&]:hover:border-primary/20"
                    )}>
                        <div className="relative flex-shrink-0">
                            {instructor?.image_url ? (
                                <img
                                    src={instructorImage}
                                    alt={instructorName}
                                    className="w-8 h-8 rounded-full object-cover ring-2 ring-background"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-background bg-background">
                                    <BoringAvatar
                                        size={32}
                                        name={instructorName}
                                        variant="beam"
                                        colors={["#FDE68A", "#C7D2FE", "#86EFAC", "#FCA5A5", "#93C5FD"]}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
                                {getTerminology(RoleTerms.Teacher, SystemTerms.Teacher)}
                            </p>
                            <div className="text-sm font-medium truncate">
                                {instructors.map((instructor, index) => (
                                    <span key={instructor.id}>
                                        {instructor.full_name}
                                        {index !== instructors.length - 1 ? ", " : ""}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tags */}
                <div className="min-h-[24px]">
                    {tags && tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {tags.slice(0, 3).map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="font-normal text-xs bg-muted/50 text-muted-foreground hover:bg-muted"
                                >
                                    {tag}
                                </Badge>
                            ))}
                            {tags.length > 3 && (
                                <span className="text-xs text-muted-foreground pl-1">
                                    +{tags.length - 3} more
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 py-2 border-t border-border/50 mt-1">
                    <div className="flex items-center gap-1.5">
                        <Star size={14} weight="fill" className="text-yellow-400" />
                        <span className="text-sm font-semibold">{ratingValue.toFixed(1)}</span>
                    </div>

                    <div className="flex items-center justify-end gap-3 text-xs text-muted-foreground">
                        {studentCount !== undefined && (
                            <div className="flex items-center gap-1">
                                <Users size={14} />
                                <span>{studentCount}</span>
                            </div>
                        )}
                        {readTimeInMinutes && (
                            <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>
                                    {readTimeInMinutes >= 60
                                        ? `${Math.floor(readTimeInMinutes / 60)}h ${readTimeInMinutes % 60}m`
                                        : `${readTimeInMinutes % 60}m`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {selectedTab === "PROGRESS" && (
                    <div className="space-y-1.5 pt-1">
                        {/* Default / Vibrant: linear progress bar */}
                        <div className="[.ui-play_&]:hidden">
                            <div className="flex justify-between text-xs font-medium">
                                <span>Progress</span>
                                <span>{cappedPercentageCompleted.toFixed(0)}%</span>
                            </div>
                            <ProgressBar value={cappedPercentageCompleted} className="h-1.5" />
                        </div>
                        {/* Play: circular progress ring */}
                        <div className="hidden [.ui-play_&]:flex items-center gap-3">
                            <ProgressRing value={cappedPercentageCompleted} size={44} strokeWidth={4} />
                            <div className="flex flex-col">
                                <span className="text-xs font-bold">{cappedPercentageCompleted.toFixed(0)}% Complete</span>
                                <span className="text-[10px] text-muted-foreground">Keep going!</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <CardFooter className="p-4 pt-0 mt-auto">
                <Button
                    className={cn(
                        "w-full font-semibold shadow-sm group/btn",
                        // Vibrant Styles - Flat Button
                        !isCompleted && "[.ui-vibrant_&]:bg-indigo-600 [.ui-vibrant_&]:hover:bg-indigo-700 [.ui-vibrant_&]:text-white",
                        isCompleted && "[.ui-vibrant_&]:bg-emerald-600 [.ui-vibrant_&]:hover:bg-emerald-700 [.ui-vibrant_&]:text-white",
                        "[.ui-vibrant_&]:shadow-md",
                        // Play mode: rounded, 3D press effect
                        "[.ui-play_&]:rounded-xl [.ui-play_&]:font-bold",
                        "[.ui-play_&]:shadow-[0_4px_0_hsl(var(--primary-400))]",
                        "[.ui-play_&]:hover:shadow-[0_6px_0_hsl(var(--primary-400))] [.ui-play_&]:hover:-translate-y-0.5",
                        "[.ui-play_&]:active:shadow-[0_1px_0_hsl(var(--primary-400))] [.ui-play_&]:active:translate-y-0.5"
                    )}
                    onClick={() => handleViewCoureseDetails(courseId)}
                >
                    <BookOpen
                        size={16}
                        className="mr-2 transition-transform duration-300 group-hover/btn:scale-110"
                    />
                    <span>
                        View{" "}
                        {getTerminology(
                            ContentTerms.Course,
                            SystemTerms.Course
                        )}
                    </span>
                    <ChevronRight
                        size={16}
                        className="ml-1 transition-transform duration-300 group-hover/btn:translate-x-1"
                    />
                </Button>
            </CardFooter>
        </Card>
    );
};

export default CourseCard;
