import { Pie, PieChart } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { useSuspenseQuery } from '@tanstack/react-query';
import { handleGetOverviewData } from '../-services/assessment-details-services';
import { Route } from '..';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { convertToLocalDateTime, getInstituteId } from '@/constants/helper';
import { useInstituteQuery } from '@/services/student-list-section/getInstituteDetails';
import { getSubjectNameById } from '@/routes/assessment/question-papers/-utils/helper';
import { AssessmentOverviewDataInterface } from '@/types/assessment-overview';
import AssessmentStudentLeaderboard from './AssessmentStudentLeaderboard';
import { ContentTerms, SystemTerms } from '@/routes/settings/-components/NamingSettings';
import { getTerminology } from '@/components/common/layout-container/sidebar/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
    CalendarPlus,
    PlayCircle,
    StopCircle,
    BookOpen,
    Timer,
    Users,
    Gauge,
    Trophy,
} from 'lucide-react';

const chartConfig = {
    ongoing: {
        label: 'Ongoing',
        color: 'hsl(var(--chart-2))',
    },
    pending: {
        label: 'Pending',
        color: 'hsl(var(--chart-3))',
    },
    attempted: {
        label: 'Attempted',
        color: 'hsl(var(--chart-4))',
    },
} satisfies ChartConfig;

export function AssessmentDetailsPieChart({
    assessmentOverviewData,
}: {
    assessmentOverviewData: AssessmentOverviewDataInterface;
}) {
    const chartData = [
        {
            browser: 'ongoing',
            visitors: assessmentOverviewData.total_ongoing,
            fill: '#97D4B4',
        },
        {
            browser: 'pending',
            visitors:
                assessmentOverviewData.total_participants -
                (assessmentOverviewData.total_ongoing + assessmentOverviewData.total_attempted),
            fill: '#FAD6AE',
        },
        {
            browser: 'attempted',
            visitors: assessmentOverviewData.total_attempted,
            fill: '#E5F5EC',
        },
    ];
    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[250px]">
            <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={chartData} dataKey="visitors" nameKey="browser" />
            </PieChart>
        </ChartContainer>
    );
}

export function QuestionsPieChart() {
    const instituteId = getInstituteId();
    const { assessmentId, examType } = Route.useParams();
    const { data: instituteDetails } = useSuspenseQuery(useInstituteQuery());
    const { data, isLoading } = useSuspenseQuery(
        handleGetOverviewData({ assessmentId, instituteId })
    );

    if (isLoading) return <DashboardLoader />;

    const overview = data.assessment_overview_dto;
    const subjectLabel = getTerminology(ContentTerms.Subjects, SystemTerms.Subjects);
    const subjectName =
        getSubjectNameById(instituteDetails?.subjects || [], overview.subject_id || '') || 'N/A';
    const pendingCount =
        overview.total_participants - (overview.total_ongoing + overview.total_attempted);
    const avgDurationMin = (Math.floor(overview.average_duration) / 60).toFixed(2);
    const durationLabel =
        overview.duration_in_min >= 60
            ? `${Math.floor(overview.duration_in_min / 60)} hr${
                  overview.duration_in_min % 60 > 0
                      ? ` ${overview.duration_in_min % 60} min`
                      : ''
              }`
            : `${overview.duration_in_min} min`;

    const infoItems = [
        {
            icon: CalendarPlus,
            label: 'Created on',
            value: convertToLocalDateTime(overview.created_on),
            show: true,
        },
        {
            icon: PlayCircle,
            label: 'Start Date & Time',
            value: convertToLocalDateTime(overview.start_date_and_time),
            show: examType === 'EXAM' || examType === 'SURVEY',
        },
        {
            icon: StopCircle,
            label: 'End Date & Time',
            value: convertToLocalDateTime(overview.end_date_and_time),
            show: examType === 'EXAM' || examType === 'SURVEY',
        },
        {
            icon: BookOpen,
            label: subjectLabel,
            value: subjectName,
            show: true,
        },
        {
            icon: Timer,
            label: 'Duration',
            value: durationLabel,
            show: examType === 'EXAM' || examType === 'MOCK',
        },
        {
            icon: Users,
            label: 'Total Participants',
            value: String(overview.total_participants),
            show: true,
        },
    ].filter((item) => item.show);

    return (
        <div className="mt-6 flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
            <div className="flex w-full flex-col gap-6 lg:w-1/2">
                {/* Assessment metadata grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {infoItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Card
                                key={item.label}
                                className="border-slate-200 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <CardContent className="flex items-start gap-3 p-4">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex min-w-0 flex-col">
                                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                                            {item.label}
                                        </p>
                                        <p className="truncate text-sm font-semibold text-slate-900">
                                            {item.value}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Key stat tiles */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="border-0 bg-gradient-to-br from-primary-50 to-white shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Gauge className="h-4 w-4" />
                                <p className="text-xs font-medium uppercase tracking-wider">
                                    Avg. Duration
                                </p>
                            </div>
                            <p className="mt-2 text-3xl font-bold tabular-nums text-primary-600">
                                {avgDurationMin}
                                <span className="ml-1 text-base font-medium text-slate-500">
                                    min
                                </span>
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="border-0 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                        <CardContent className="p-5">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Trophy className="h-4 w-4" />
                                <p className="text-xs font-medium uppercase tracking-wider">
                                    Avg. Marks
                                </p>
                            </div>
                            <p className="mt-2 text-3xl font-bold tabular-nums text-amber-600">
                                {overview.average_marks.toFixed(2)}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Participation breakdown */}
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-6">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                                Participation Breakdown
                            </h3>
                            <span className="text-xs text-slate-500">
                                {overview.total_participants} total
                            </span>
                        </div>
                        <div className="flex items-center gap-6">
                            <AssessmentDetailsPieChart assessmentOverviewData={overview} />
                            <div className="flex flex-col gap-3">
                                <LegendItem
                                    color="bg-[#97D4B4]"
                                    label="Ongoing"
                                    count={overview.total_ongoing}
                                />
                                <LegendItem
                                    color="bg-[#FAD6AE]"
                                    label="Pending"
                                    count={pendingCount}
                                />
                                <LegendItem
                                    color="bg-[#E5F5EC]"
                                    label="Attempted"
                                    count={overview.total_attempted}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
            {/* Assessment Student Leaderboard */}
            <AssessmentStudentLeaderboard />
        </div>
    );
}

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className={`h-3 w-3 rounded-sm ${color}`} />
            <span className="text-sm text-slate-700">{label}</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
                {count}
            </span>
        </div>
    );
}
