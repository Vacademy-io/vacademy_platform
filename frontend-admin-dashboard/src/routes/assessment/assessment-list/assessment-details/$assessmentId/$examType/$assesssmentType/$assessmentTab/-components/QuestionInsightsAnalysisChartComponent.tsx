import { Pie, PieChart } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { QuestionInsightsQuestionStatus } from '../-utils/assessment-details-interface';

const chartConfig = {
    correct: {
        label: 'Correct',
        color: 'hsl(var(--chart-1))',
    },
    partiallyCorrect: {
        label: 'Partially Correct',
        color: 'hsl(var(--chart-2))',
    },
    wrongResponse: {
        label: 'Wrong Response',
        color: 'hsl(var(--chart-3))',
    },
    skipped: {
        label: 'Skipped',
        color: 'hsl(var(--chart-4))',
    },
} satisfies ChartConfig;

export function QuestionInsightsAnalysisChartComponent({
    questionStatus,
    skipped,
}: {
    questionStatus: QuestionInsightsQuestionStatus;
    skipped: number;
}) {
    const chartData = [
        {
            responseType: 'correct',
            value: questionStatus?.correctAttempt,
            fill: '#97D4B4',
        },
        {
            responseType: 'partiallyCorrect',
            value: questionStatus?.partialCorrectAttempt,
            fill: '#FFDD82',
        },
        {
            responseType: 'wrongResponse',
            value: questionStatus?.incorrectAttempt,
            fill: '#F49898',
        },
        {
            responseType: 'skipped',
            value: skipped,
            fill: '#EEE',
        },
    ];
    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[180px]">
            <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="responseType"
                    innerRadius={42}
                    strokeWidth={2}
                />
            </PieChart>
        </ChartContainer>
    );
}
