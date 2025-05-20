import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Pie, PieChart } from 'recharts';

interface ResponseData {
    attempted: number;
    skipped: number;
}

const chartConfig = {
    correct: {
        label: 'Correct',
        color: 'hsl(var(--chart-1))',
    },
    skipped: {
        label: 'Skipped',
        color: 'hsl(var(--chart-4))',
    },
} satisfies ChartConfig;

export function ResponseBreakdownComponent({ responseData }: { responseData: ResponseData }) {
    const chartData = [
        {
            responseType: 'correct',
            value: responseData.attempted,
            fill: '#97D4B4',
        },
        {
            responseType: 'skipped',
            value: responseData.skipped,
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
