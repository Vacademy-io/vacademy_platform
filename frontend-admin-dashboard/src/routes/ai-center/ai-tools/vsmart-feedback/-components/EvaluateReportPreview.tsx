import { Separator } from '@/components/ui/separator';
import { MyButton } from '@/components/design-system/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { AILectureFeedbackInterface } from '@/types/ai/generate-assessment/generate-complete-assessment';
import { StarRatingComponent } from '@/components/common/star-rating-component';
import {
    getPerformanceColor,
    getPerformanceLabel,
    getScoreFromString,
} from '@/routes/ai-center/-utils/helper';
import { ScrollArea } from '@/components/ui/scroll-area';

// Import Lucide Icons
import {
    FileText, // For Report Title
    Download, // For Export Button
    Clock, // For Duration
    CalendarDays, // For Evaluation Date
    ListChecks, // For Evaluation Criteria Header
    Mic, // For Delivery & Presentation
    GraduationCap, // For Content Quality
    Users, // For Student Engagement
    ClipboardCheck, // For Assessment & Feedback
    Languages, // For Inclusivity & Language
    Timer, // For Classroom Management (Pacing)
    Paperclip, // For Teaching Aids
    BadgeCheck, // For Professionalism
    Lightbulb, // For Scope of Improvement
    NotebookText, // For Summary
    HelpCircle, // Default/Fallback Icon
} from 'lucide-react';

// Helper function to get the appropriate icon based on criterion name
const getCriteriaIcon = (name: string | undefined): React.ElementType => {
    const lowerCaseName = name?.toLowerCase() || '';

    if (lowerCaseName.includes('delivery') || lowerCaseName.includes('presentation')) return Mic;
    if (lowerCaseName.includes('content')) return GraduationCap;
    if (lowerCaseName.includes('engagement')) return Users;
    if (lowerCaseName.includes('assessment') || lowerCaseName.includes('feedback'))
        return ClipboardCheck;
    if (lowerCaseName.includes('inclusivity') || lowerCaseName.includes('language'))
        return Languages;
    if (lowerCaseName.includes('management') || lowerCaseName.includes('pacing')) return Timer; // Assuming pacing falls under management
    if (lowerCaseName.includes('teaching aids') || lowerCaseName.includes('resource'))
        return Paperclip;
    if (lowerCaseName.includes('professionalism')) return BadgeCheck;

    return HelpCircle; // Fallback icon
};

const EvaluateReportPreview = ({
    openDialog = false,
    evaluateLectureData,
}: {
    openDialog: boolean;
    evaluateLectureData: AILectureFeedbackInterface;
}) => {
    const [open, setOpen] = useState(openDialog);

    if (!evaluateLectureData) {
        return null;
    }

    const totalScoreNum = Number(evaluateLectureData?.totalScore);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {/* Using 5xl width, adjust as needed */}
            <DialogContent className="flex max-h-[90vh] w-full flex-col p-0 sm:max-w-5xl">
                <DialogHeader className="border-b bg-muted/30 p-4 px-6">
                    <DialogTitle className="text-primary flex items-center gap-2 text-lg font-semibold">
                        <FileText className="size-5" /> {/* Icon Added */}
                        {evaluateLectureData.reportTitle || 'Evaluation Report'}
                    </DialogTitle>
                </DialogHeader>

                <ScrollArea className="grow overflow-y-auto">
                    <div className="space-y-6 p-6">
                        <div className="flex items-center justify-between">
                            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                                {/* Optional: Icon for main title */}
                                {/* <Info className="h-6 w-6 text-muted-foreground" /> */}
                                {evaluateLectureData.title || 'Lecture Evaluation'}
                            </h2>
                            {/* Added Icon to Button */}
                            <MyButton type="button" size="sm">
                                <Download className="mr-2 size-4" /> Export
                            </MyButton>
                        </div>

                        <div className="flex flex-col items-start justify-between gap-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-center">
                            <div className="space-y-1.5 text-sm">
                                <div className="flex items-center">
                                    <span className="flex w-28 items-center gap-1.5 font-medium text-muted-foreground">
                                        {/* Optional: Icon for Lecture Title */}
                                        {/* <Info className="h-4 w-4" /> Lecture Title: */}
                                        Lecture Title:
                                    </span>
                                    <span className="text-foreground">
                                        {evaluateLectureData.lectureInfo?.lectureTitle || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <span className="flex w-28 items-center gap-1.5 font-medium text-muted-foreground">
                                        <Clock className="size-4" /> {/* Icon Added */}
                                        Duration:
                                    </span>
                                    <span className="text-foreground">
                                        {evaluateLectureData.lectureInfo?.duration || 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center">
                                    <span className="flex w-28 items-center gap-1.5 font-medium text-muted-foreground">
                                        <CalendarDays className="size-4" /> {/* Icon Added */}
                                        Evaluation Date:
                                    </span>
                                    <span className="text-foreground">
                                        {evaluateLectureData.lectureInfo?.evaluationDate || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Score section remains the same - Star rating is already visually strong */}
                            <div className="mt-4 flex items-center gap-4 sm:mt-0 sm:gap-6">
                                <div className="text-center">
                                    <span className="block text-xs uppercase text-muted-foreground">
                                        Total Score
                                    </span>
                                    <span className="text-primary text-2xl font-bold">
                                        {evaluateLectureData.totalScore ?? 'N/A'}/100
                                    </span>
                                </div>
                                <div className="text-center">
                                    <StarRatingComponent score={totalScoreNum} />
                                    <span
                                        className={`mt-1 block text-xs font-medium ${getPerformanceColor(
                                            totalScoreNum
                                        )}`}
                                    >
                                        {getPerformanceLabel(totalScoreNum)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-6">
                            <h3 className="flex items-center gap-2 text-xl font-semibold">
                                <ListChecks className="text-primary size-5" /> {/* Icon Added */}
                                Evaluation Criteria
                            </h3>
                            {evaluateLectureData.criteria?.map((criterion, index) => {
                                const IconComponent = getCriteriaIcon(criterion?.name); // Get specific icon
                                return (
                                    <div
                                        key={index}
                                        className="border-primary/30 space-y-3 rounded-r-md border-l-4 bg-muted/20 py-2 pl-4"
                                    >
                                        <div className="flex items-baseline gap-3">
                                            {/* Icon Added next to criterion name */}
                                            <h4 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                                <IconComponent className="size-5 text-muted-foreground" />
                                                {index + 1}. {criterion?.name}
                                            </h4>
                                            <span className="text-sm font-medium text-muted-foreground">
                                                (Score: {criterion?.score ?? 'N/A'} /
                                                {getScoreFromString(criterion?.name)})
                                            </span>
                                        </div>

                                        {criterion?.points && criterion.points.length > 0 && (
                                            <ul className="space-y-2 pl-2">
                                                {criterion.points.map((point, pointIndex) => (
                                                    <li key={pointIndex} className="text-sm">
                                                        <span className="font-medium text-foreground">
                                                            {point?.title}:
                                                        </span>
                                                        {point?.description?.map(
                                                            (desc, descIndex) => (
                                                                <p
                                                                    key={descIndex}
                                                                    className="ml-4 list-item list-outside list-disc pl-4 text-muted-foreground"
                                                                >
                                                                    {desc}
                                                                </p>
                                                            )
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}

                                        {criterion?.scopeOfImprovement &&
                                            criterion.scopeOfImprovement.length > 0 && (
                                                <div className="mt-3 space-y-1">
                                                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                                        <Lightbulb className="size-4 text-yellow-500" />{' '}
                                                        {/* Icon Added */}
                                                        Scope of Improvement:
                                                    </span>
                                                    <ul className="list-outside list-disc space-y-1 pl-6">
                                                        {criterion.scopeOfImprovement.map(
                                                            (improvement, impIndex) => (
                                                                <li
                                                                    key={impIndex}
                                                                    className="text-sm text-muted-foreground"
                                                                >
                                                                    {improvement}
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                    </div>
                                );
                            })}
                        </div>

                        {evaluateLectureData.summary && evaluateLectureData.summary.length > 0 && (
                            <>
                                <Separator />
                                <div className="space-y-2 pb-4">
                                    <h3 className="flex items-center gap-2 text-xl font-semibold">
                                        <NotebookText className="text-primary size-5" />{' '}
                                        {/* Icon Added */}
                                        Summary
                                    </h3>
                                    <ul className="list-outside list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                                        {evaluateLectureData.summary.map((summaryPoint, index) => (
                                            <li key={index}>{summaryPoint}</li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

export default EvaluateReportPreview;
