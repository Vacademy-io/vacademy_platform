"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import dayjs from "dayjs";

const chartConfig = {
    avg_daily_time_minutes: {
        label: "Time Spent",
        color: "hsl(var(--chart-1))",
    },
    avg_daily_time_minutes_batch: {
        label: "Time Spent By Batch",
        color: "hsl(var(--chart-6))",
    },
} satisfies ChartConfig;

export interface ChartDataType {
    activity_date: string;
    avg_daily_time_minutes: number;
    avg_daily_time_minutes_batch: number;
}
export function LineChartComponent({ chartData }: { chartData: ChartDataType[] }) {
    return (
        <Card className="w-[65%]">
            <ChartContainer className="h-[530px] w-full pb-6 pt-6" config={chartConfig}>
                <LineChart
                    accessibilityLayer
                    data={chartData}
                    margin={{
                        left: 35,
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
                        dataKey="avg_daily_time_minutes_batch"
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
                        stroke="var(--color-avg_daily_time_minutes)"
                        strokeWidth={2}
                        dot={{
                            fill: "var(--color-avg_daily_time_minutes)",
                        }}
                        activeDot={{
                            r: 6,
                        }}
                    />
                    <Line
                        dataKey="avg_daily_time_minutes_batch"
                        type="monotone"
                        stroke="var(--color-avg_daily_time_minutes_batch)"
                        strokeWidth={2}
                        dot={{
                            fill: "var(--color-avg_daily_time_minutes_batch)",
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
