"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { DailyLearnerTimeSpent } from "../../-types/types";
import dayjs from "dayjs";

const chartConfig = {
    desktop: {
        label: "timeSpent",
        color: "hsl(var(--chart-1))",
    },
    mobile: {
        label: "Mobile",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export function LineChartComponent({ chartData }: { chartData: DailyLearnerTimeSpent[] }) {
    return (
        <Card className="w-[70%]">
            {/* <CardContent className="h-[520px] border-none"> */}
            <ChartContainer className="h-[530px] w-full pb-6 pt-6" config={chartConfig}>
                <LineChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                        left: 25,
                        right: 25,
                        bottom: 25, // Add more space at the bottom for the X-axis label
                    }}
                    className="!h-fit !max-h-screen"
                >
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="activity_date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => dayjs(value).format("DD MMMM").slice(0, 6)}
                        label={{
                            value: "Date",
                            position: "left",
                            dx: 55,
                            dy: 30,
                            style: { fontSize: "14px", fill: "#ED7424" },
                        }}
                    />
                    <YAxis
                        dataKey="avg_daily_time_minutes"
                        tickLine={false}
                        axisLine={true}
                        tickMargin={8}
                        width={40}
                        label={{
                            value: "Hours",
                            position: "insideLeft",
                            angle: -90, // Rotates the text to be vertical
                            dx: -10, // Adjusts the horizontal position
                            dy: 200, // Adjusts the vertical position
                            style: { fontSize: "14px", fill: "#ED7424" },
                        }}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Line
                        dataKey="avg_daily_time_minutes"
                        type="monotone"
                        stroke="var(--color-desktop)"
                        strokeWidth={2}
                        dot={{
                            fill: "var(--color-desktop)",
                        }}
                        activeDot={{
                            r: 6,
                        }}
                    />
                </LineChart>
            </ChartContainer>
            {/* </CardContent> */}
        </Card>
    );
}
