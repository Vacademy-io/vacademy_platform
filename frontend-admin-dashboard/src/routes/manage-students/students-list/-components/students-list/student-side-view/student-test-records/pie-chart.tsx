import React, { Suspense } from 'react';
const RechartsPieChart = React.lazy(() => import('recharts').then(module => ({ default: module.PieChart as unknown as React.ComponentType<any> })));
const Pie = React.lazy(() => import('recharts').then(module => ({ default: module.Pie as unknown as React.ComponentType<any> })));
const Cell = React.lazy(() => import('recharts').then(module => ({ default: module.Cell as unknown as React.ComponentType<any> })));
const ResponsiveContainer = React.lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer as unknown as React.ComponentType<any> })));

interface PieChartProps {
    data: {
        name: string;
        value: number;
        marks?: string | number;
        color: string;
    }[];
    width: number;
    height: number;
}

export function PieChart({ data, width, height }: PieChartProps) {
    return (
        <div className="flex flex-col items-center gap-10">
            <div style={{ width, height }}>
                <Suspense fallback={<div className="h-full w-full animate-pulse bg-gray-100 rounded-full opacity-20" />}>
                    <ResponsiveContainer>
                        <RechartsPieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="40%" // Adjusted to center the pie chart vertically
                                innerRadius={48}
                                outerRadius={80}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </RechartsPieChart>
                    </ResponsiveContainer>
                </Suspense>
            </div>
            <div className="flex flex-col gap-4">
                {data && data.length > 0 ? (
                    data.map((obj, key) => (
                        <div key={key} className="flex items-center gap-4">
                            <div
                                style={{ backgroundColor: obj.color }}
                                className="size-6 rounded-full"
                            ></div>
                            <div className="flex items-center gap-2 text-subtitle">
                                <div>{obj.name}:</div>
                                <div>
                                    {obj.value}
                                    {obj.marks && ` (${obj.marks})`}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="py-4 text-center text-subtitle">No pie chart data available</p>
                )}
            </div>
        </div>
    );
}
