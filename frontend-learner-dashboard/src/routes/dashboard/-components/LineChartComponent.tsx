import { Card } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, CartesianGrid, XAxis, YAxis, Line } from "recharts";
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

export const LineChartComponent = () => {
    return(
        <Card>
            <ChartContainer config={chartConfig}>
                <LineChart
                    accessibilityLayer
                    data={[{
                        activity_date: "2025-01-01",
                        avg_daily_time_minutes: 10,
                        avg_daily_time_minutes_batch: 5,
                    },
                    {
                        activity_date: "2025-01-02",
                        avg_daily_time_minutes: 20,
                        avg_daily_time_minutes_batch: 10,
                    },
                    {
                        activity_date: "2025-01-03",
                        avg_daily_time_minutes: 30,
                        avg_daily_time_minutes_batch: 15,
                    },
                    ]}
                    margin={{
                        left: 35,
                        right: 25,
                        bottom: 25,
                    }}
                    className="!h-fit !maxh-h-screen"
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
                            angle: -90,
                            dx: -10,
                            dy: 200,
                            style: { fontSize: "14px", fill: "#ED7424" },
                        }}
                    />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Line
                        dataKey="avg_daily_time_minutes"
                        type="monotone"
                        stroke={chartConfig.avg_daily_time_minutes.color}
                        strokeWidth={2}
                        dot={{
                            fill: chartConfig.avg_daily_time_minutes.color,
                        }}
                        activeDot={{
                            r: 6,
                        }}
                    />
                    <Line
                        dataKey="avg_daily_time_minutes_batch"
                        type="monotone"
                        stroke={chartConfig.avg_daily_time_minutes_batch.color}
                        strokeWidth={2}
                        dot={{
                            fill: chartConfig.avg_daily_time_minutes_batch.color,
                        }}
                        activeDot={{
                            r: 6,
                        }}
                    />
                </LineChart>
            </ChartContainer>
        </Card>
    )
}
