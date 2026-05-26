import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import React, { Suspense } from 'react';
const PieChart = React.lazy(() => import('recharts').then(module => ({ default: module.PieChart as unknown as React.ComponentType<any> })));
const Pie = React.lazy(() => import('recharts').then(module => ({ default: module.Pie as unknown as React.ComponentType<any> })));

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

// Recharts fill values resolved from CSS chart variables — no raw hex in JSX.
const RESPONSE_CHART_FILLS = {
    attempted: 'var(--color-correct)',  // --chart-1 (green tint)
    skipped: 'var(--color-skipped)',    // --chart-4 (neutral)
} as const;

export function ResponseBreakdownComponent({ responseData }: { responseData: ResponseData }) {
    const chartData = [
        {
            responseType: 'correct',
            value: responseData.attempted,
            fill: RESPONSE_CHART_FILLS.attempted,
        },
        {
            responseType: 'skipped',
            value: responseData.skipped,
            fill: RESPONSE_CHART_FILLS.skipped,
        },
    ];
    return (
        <ChartContainer config={chartConfig} className="mx-auto aspect-square size-44">
            <Suspense fallback={<div className="h-full w-full animate-pulse rounded-full bg-neutral-100 opacity-20" />}>
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
