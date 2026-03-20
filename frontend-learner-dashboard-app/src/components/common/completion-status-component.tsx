import { PolarGrid, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

const chartConfig = {
    visitors: {
        label: "Completion",
        color: "#F6B97B",
    },
} satisfies ChartConfig;

export function CompletionStatusComponent({
    completionPercentage,
}: {
    completionPercentage: number;
}) {
    const chartData = [
        {
            browser: "visitors",
            visitors: completionPercentage,
            fill: "#F6B97B",
        },
    ];
    return (
        <div className="rounded-full border border-neutral-200 ">
            <ChartContainer config={chartConfig} className="h-[35px] w-[35px]">
                <RadialBarChart
                    data={chartData}
                    startAngle={0}
                    endAngle={completionPercentage * 3.6}
                    innerRadius={15}
                    outerRadius={22}
                >
                    <PolarGrid
                        gridType="circle"
                        radialLines={false}
                        stroke="none"
                        className="first:fill-neutral-100 last:fill-background"
                        polarRadius={[18, 18]}
                    />
                    <RadialBar dataKey="visitors" background cornerRadius={15} />
                    <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
                </RadialBarChart>
            </ChartContainer>
        </div>
    );
}
