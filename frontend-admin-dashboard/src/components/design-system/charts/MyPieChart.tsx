import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface PieChartData {
    name: string;
    value: number;
}

interface MyPieChartProps {
    data: PieChartData[];
    showLabel?: boolean;
}

const COLORS = ['#97D4B4', '#E5F5EC', '#97D4B4', '#E5F5EC'];

export function MyPieChart({ data, showLabel = false }: MyPieChartProps) {
    if (!data || data.length === 0) {
        return <div className="flex h-full items-center justify-center">No data to display</div>;
    }

    return (
        <ResponsiveContainer width="100%" height={200}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={
                        showLabel
                            ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
                            : undefined
                    }
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip />
                {/* <Legend /> */}
            </PieChart>
        </ResponsiveContainer>
    );
}
