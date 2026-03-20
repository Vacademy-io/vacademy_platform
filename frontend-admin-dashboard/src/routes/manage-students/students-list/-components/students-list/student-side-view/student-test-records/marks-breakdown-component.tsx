import React, { Suspense } from 'react';
const PieChart = React.lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const Pie = React.lazy(() => import('recharts').then(module => ({ default: module.Pie as unknown as React.ComponentType<any> })));
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface MarksResponseDataInterface {
    correct: number;
    partiallyCorrect: number;
    wrongResponse: number;
    skipped: number;
}

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

export function MarksBreakdownComponent({ marksData }: { marksData: MarksResponseDataInterface }) {
    const chartData = [
        {
            responseType: 'correct',
            value: marksData.correct,
            fill: '#97D4B4',
        },
        {
            responseType: 'partiallyCorrect',
            value: marksData.partiallyCorrect,
            fill: '#FFDD82',
        },
        {
            responseType: 'wrongResponse',
            value: marksData.wrongResponse,
            fill: '#F49898',
        },
        {
            responseType: 'skipped',
            value: marksData.skipped,
            fill: '#EEE',
        },
    ];
    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[180px]">
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-gray-100 rounded-full opacity-20" />}>
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
            </Suspense>
        </ChartContainer>
    );
}
