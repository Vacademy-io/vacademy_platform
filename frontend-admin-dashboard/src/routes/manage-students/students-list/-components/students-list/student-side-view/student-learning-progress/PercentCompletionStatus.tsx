import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import { PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

const chartData = [{ browser: 'safari', visitors: 200, fill: 'var(--color-safari)' }];

const chartConfig = {
    visitors: {
        label: 'Visitors',
    },
    safari: {
        label: 'Safari',
        color: '#F6B97B',
    },
} satisfies ChartConfig;

export const PercentCompletionStatus = ({ percentage }: { percentage: number }) => {
    const angle = (360 * percentage) / 100;
    return (
        <ChartContainer config={chartConfig} className="h-[100px] w-[80px]">
            <RadialBarChart
                data={chartData}
                startAngle={0}
                endAngle={angle}
                innerRadius={30}
                outerRadius={50}
            >
                <PolarGrid
                    gridType="circle"
                    radialLines={false}
                    stroke="none"
                    className="first:fill-muted last:fill-background"
                    polarRadius={[35, 35]}
                />
                <RadialBar dataKey="visitors" background cornerRadius={10} />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
            </RadialBarChart>
        </ChartContainer>
    );
};
