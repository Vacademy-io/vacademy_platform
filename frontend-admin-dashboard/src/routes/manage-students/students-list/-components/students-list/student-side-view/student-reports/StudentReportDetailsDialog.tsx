import { StudentReportData } from '@/types/student-analysis';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MyDialog } from '@/components/design-system/dialog';

interface StudentReportDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    report: StudentReportData | null;
    title?: string;
}

const markdownComponents = {
    h3: ({ ...props }) => (
        <h3 className="mb-5 mt-0 text-[1rem] font-bold text-slate-900" {...props} />
    ),
    table: ({ ...props }) => (
        <div className="my-6 overflow-x-auto">
            <table
                className="w-full border-collapse border border-slate-200 text-[0.95rem]"
                {...props}
            />
        </div>
    ),
    thead: ({ ...props }) => <thead className="bg-slate-50" {...props} />,
    th: ({ ...props }) => (
        <th
            className="border border-slate-200 px-4 py-2.5 text-left font-bold text-slate-900"
            {...props}
        />
    ),
    td: ({ ...props }) => (
        <td className="border border-slate-200 px-4 py-2.5 text-slate-800" {...props} />
    ),
};

export const StudentReportDetailsDialog = ({
    open,
    onOpenChange,
    report,
    title = 'Analysis Report',
}: StudentReportDetailsDialogProps) => {
    if (!report) return null;

    const formatTitle = (key: keyof StudentReportData) => {
        return key
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const KEYS = {
        STRENGTHS: 'strengths' as keyof StudentReportData,
        WEAKNESSES: 'weaknesses' as keyof StudentReportData,
        PROGRESS: 'progress' as keyof StudentReportData,
        LEARNING_FREQUENCY: 'learning_frequency' as keyof StudentReportData,
        STUDENT_EFFORTS: 'student_efforts' as keyof StudentReportData,
        TOPICS_IMPROVEMENT: 'topics_of_improvement' as keyof StudentReportData,
        TOPICS_DEGRADATION: 'topics_of_degradation' as keyof StudentReportData,
        REMEDIAL_POINTS: 'remedial_points' as keyof StudentReportData,
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={title}
            dialogWidth="max-w-4xl"
            content={
                <div className="flex flex-col gap-4">
                    <ScrollArea className="h-[calc(90vh-160px)]">
                        {/* Adjusted height to account for new description and gap */}
                        <div className="p-0">
                            {/* Removed p-6 as MyDialog content already has padding */}
                            <Tabs defaultValue="efforts" className="w-full">
                                <TabsList className="mb-4 grid w-full grid-cols-4">
                                    <TabsTrigger value="efforts">Efforts</TabsTrigger>
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="topics">Topics</TabsTrigger>
                                    <TabsTrigger value="remedial">Remedial</TabsTrigger>
                                </TabsList>

                                <TabsContent value="efforts" className="space-y-6">
                                    <div className="space-y-2">
                                        <Card>
                                            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkBreaks, remarkGfm]}
                                                    components={markdownComponents}
                                                >
                                                    {report[KEYS.STUDENT_EFFORTS] as string}
                                                </ReactMarkdown>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkBreaks, remarkGfm]}
                                                    components={markdownComponents}
                                                >
                                                    {report[KEYS.LEARNING_FREQUENCY] as string}
                                                </ReactMarkdown>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </TabsContent>

                                <TabsContent value="overview" className="space-y-6">
                                    <Card>
                                        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkBreaks, remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {report[KEYS.PROGRESS] as string}
                                            </ReactMarkdown>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="topics" className="space-y-6">
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">
                                                    {formatTitle(KEYS.STRENGTHS)}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {Object.entries(
                                                    (report[KEYS.STRENGTHS] as Record<
                                                        string,
                                                        number
                                                    >) || {}
                                                ).map(([topic, score]) => (
                                                    <div key={topic} className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">
                                                                {topic}
                                                            </span>
                                                            <span className="text-green-600">
                                                                {score}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={score}
                                                            className="h-2 !bg-gray-200 [&>div]:bg-green-500"
                                                        />
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">
                                                    {formatTitle(KEYS.WEAKNESSES)}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {Object.entries(
                                                    (report[KEYS.WEAKNESSES] as Record<
                                                        string,
                                                        number
                                                    >) || {}
                                                ).map(([topic, score]) => (
                                                    <div key={topic} className="space-y-1">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="font-medium">
                                                                {topic}
                                                            </span>
                                                            <span className="text-red-600">
                                                                {score}%
                                                            </span>
                                                        </div>
                                                        <Progress
                                                            value={score}
                                                            className="h-2 !bg-gray-200 [&>div]:bg-red-500"
                                                        />
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    </div>
                                    <Card>
                                        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkBreaks, remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {report[KEYS.TOPICS_IMPROVEMENT] as string}
                                            </ReactMarkdown>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkBreaks, remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {report[KEYS.TOPICS_DEGRADATION] as string}
                                            </ReactMarkdown>
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                <TabsContent value="remedial" className="space-y-6">
                                    <Card>
                                        <CardContent className="prose prose-sm dark:prose-invert max-w-none pt-4">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkBreaks, remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {report[KEYS.REMEDIAL_POINTS] as string}
                                            </ReactMarkdown>
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </ScrollArea>
                </div>
            }
        />
    );
};
