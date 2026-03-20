import React, { useState, useMemo } from 'react';
import { Target, Clock, Coins, WarningCircle, Receipt } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { getInstituteId } from '@/constants/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import { BASE_URL } from '@/constants/urls';

// --- API Types ---
export interface DashboardCollectionRequest {
    instituteId: string;
    sessionId: string;
    feeTypes: string[];
}

export interface DashboardCollectionResponse {
    summary: {
        projectedRevenue: number; // e.g. 25000000 (2.5 Cr)
        tillNowExpected: number;
        tillNowCollected: number;
        totalOverdue: number;
        totalDue: number;
        collectionRate: number; // e.g., 87.5
    };
    pipeline: {
        projectedRevenue: number;
        expectedToDate: number;
        collectedToDate: number;
        totalOverdue: number;
        totalDue: number;
    };
    classWiseDetails: Array<{
        className: string;
        projectedRevenue: number;
        expectedToDate: number;
        collectedToDate: number;
        collectionRate: number;
        totalOverdue: number;
    }>;
    paymentModeInsights: Array<{
        mode: string;
        percentage: number;
        color: string;
    }>;
}

// --- Mock Data Service for demonstration ---
const fetchDashboardData = async (req: DashboardCollectionRequest): Promise<DashboardCollectionResponse> => {
    const response = await authenticatedAxiosInstance.post(`${BASE_URL}/admin-core-service/v1/admin/student-fee/dashboard/collection`, req);
    return response.data;
};

// Helper to format currency
const formatCurrency = (val: number | undefined) => {
    if (val === undefined || val === null) return '₹ 0';
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} L`;
    return `₹ ${val.toLocaleString('en-IN')}`;
};

export default function CollectionDashboardMain() {
    // --- State ---
    const { getAllSessions } = useInstituteDetailsStore();
    const availableSessions = getAllSessions() || [];
    
    // We default to "All" (empty string)
    const [sessionId, setSessionId] = useState<string>('');
    const [selectedFeeTypes, setSelectedFeeTypes] = useState<string[]>([]);

    const allFeeTypes = ['Tuition Fee', 'Bus Fee', 'Mess Fee', 'Annual Fee', 'Exam Fee'];

    const instituteId = getInstituteId() || '';

    const actualSessionId = sessionId;

    // --- Query ---
    const requestBody: DashboardCollectionRequest = {
        instituteId,
        sessionId: actualSessionId,
        feeTypes: selectedFeeTypes
    };

    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['collection-dashboard', requestBody],
        queryFn: () => fetchDashboardData(requestBody),
        staleTime: 60000,
        enabled: !!instituteId
    });

    // --- Derived Data for Charts/UI ---
    const toggleFeeType = (type: string) => {
        setSelectedFeeTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const clearFeeTypes = () => setSelectedFeeTypes([]);

    const summaryCards = useMemo(() => {
        if (!dashboardData) return [];
        const { summary } = dashboardData;
        return [
            { title: 'Projected revenue', value: formatCurrency(summary.projectedRevenue), icon: Target, bgColor: 'bg-blue-50', iconColor: 'text-blue-600', borderColor: 'border-blue-100' },
            { title: 'Till now expected', value: formatCurrency(summary.tillNowExpected), icon: Clock, bgColor: 'bg-orange-50', iconColor: 'text-orange-500', borderColor: 'border-orange-100' },
            { title: 'Till now collected', value: formatCurrency(summary.tillNowCollected), icon: Coins, bgColor: 'bg-green-50', iconColor: 'text-green-600', borderColor: 'border-green-100' },
            { title: 'Total overdue', value: formatCurrency(summary.totalOverdue), icon: WarningCircle, bgColor: 'bg-red-50', iconColor: 'text-red-500', borderColor: 'border-red-100' },
            { title: 'Total due', value: formatCurrency(summary.totalDue), icon: Receipt, bgColor: 'bg-purple-50', iconColor: 'text-purple-600', borderColor: 'border-purple-100' },
        ];
    }, [dashboardData]);

    const pipelineData = useMemo(() => {
        if (!dashboardData) return [];
        const { pipeline } = dashboardData;
        return [
            { name: 'PR', val: pipeline.projectedRevenue, color: '#1e3a8a', tooltip: 'Projected Revenue' },
            { name: 'TNE', val: pipeline.expectedToDate, color: '#3b82f6', tooltip: 'Till Now Expected' },
            { name: 'TNC', val: pipeline.collectedToDate, color: '#10b981', tooltip: 'Till Now Collected' },
            { name: 'TO', val: pipeline.totalOverdue, color: '#ef4444', tooltip: 'Total Overdue' },
            { name: 'Td', val: pipeline.totalDue, color: '#a855f7', tooltip: 'Total Due' }
        ];
    }, [dashboardData]);

    const pieData = dashboardData?.paymentModeInsights.map(p => ({
        name: p.mode,
        value: p.percentage,
        color: p.color
    })) || [];

    const collectionRate = dashboardData?.summary.collectionRate || 0;
    const gaugeData = [
        { name: 'Collected', value: collectionRate, color: '#10b981' },
        { name: 'Remaining', value: 100 - collectionRate, color: '#e5e7eb' },
    ];

    const renderCustomAxisTick = ({ x, y, payload }: any) => {
        return (
            <g transform={`translate(${x},${y})`}>
                <text x={0} y={0} dy={16} textAnchor="middle" fill="#4b5563" fontSize={12} fontWeight={600}>
                    {payload.value}
                </text>
            </g>
        );
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300 w-full max-w-[1400px] mx-auto">
            {/* Outline Header & Filters */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-5">
                <div className="flex items-center gap-6 pb-4 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-gray-800 tracking-wide">School Collection</h1>
                    <div className="flex items-center gap-3 ml-auto text-sm">
                        <span className="font-semibold text-gray-600">Session -</span>
                        <select 
                            value={actualSessionId} 
                            onChange={(e) => setSessionId(e.target.value)}
                            className="border border-gray-300 rounded-md px-3 py-1.5 font-medium text-gray-700 outline-none focus:border-blue-500 cursor-pointer bg-gray-50 hover:bg-white"
                        >
                            <option value="">All</option>
                            {availableSessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
                        </select>
                    </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={clearFeeTypes}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm border ${selectedFeeTypes.length === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200'}`}
                    >
                        Total
                    </button>
                    {allFeeTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => toggleFeeType(type)}
                            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition shadow-sm border ${selectedFeeTypes.includes(type) ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="h-40 flex items-center justify-center text-gray-500 font-semibold tracking-wide">
                    Loading overview...
                </div>
            ) : (
                <>
                    {/* Top Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {summaryCards.map((card, idx) => (
                            <div key={idx} className={`bg-white border ${card.borderColor} rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden transition hover:shadow-md`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{card.title}</span>
                                    <div className={`p-1.5 bg-gray-50/50 rounded-full ${card.iconColor}`}>
                                        <card.icon size={18} weight="duotone" />
                                    </div>
                                </div>
                                <div className="text-xl font-extrabold text-gray-800 mt-1">{card.value}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Revenue Pipeline (Waterfall) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h2 className="text-sm font-bold text-gray-800 mb-6 border-b border-gray-100 pb-2">Waterfall Chart</h2>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }} barSize={50}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={renderCustomAxisTick} />
                                        <Tooltip 
                                            cursor={{fill: '#f9fafb'}} 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: number, name: string, props: any) => [formatCurrency(value), props.payload.tooltip]}
                                        />
                                        <Bar dataKey="val" radius={[6, 6, 0, 0]}>
                                            {pipelineData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Collection Rate Gauge */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center relative">
                            <h2 className="text-sm font-bold text-gray-800 w-full mb-4 border-b border-gray-100 pb-2">Collection Rate</h2>
                            <div className="w-full h-[220px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={gaugeData}
                                            cx="50%"
                                            cy="85%"
                                            startAngle={180}
                                            endAngle={0}
                                            innerRadius="70%"
                                            outerRadius="95%"
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {gaugeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-[65%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <div className="text-5xl font-extrabold text-gray-800">{collectionRate.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Details Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 lg:col-span-2 overflow-hidden flex flex-col">
                            <h2 className="text-sm font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Class-wise Collection</h2>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">P:R</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</th>
                                            <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-sm font-medium">
                                        {dashboardData?.classWiseDetails.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50 transition-colors group">
                                                <td className="py-3 px-4 text-gray-800 border-r border-gray-100 group-hover:bg-gray-100 transition rounded-l-md">{row.className}</td>
                                                <td className="py-3 px-4 text-gray-600 border-r border-gray-100">{formatCurrency(row.projectedRevenue)}</td>
                                                <td className="py-3 px-4 text-gray-600 border-r border-gray-100">{formatCurrency(row.expectedToDate)}</td>
                                                <td className="py-3 px-4 text-gray-800 border-r border-gray-100">{formatCurrency(row.collectedToDate)}</td>
                                                <td className="py-3 px-4 rounded-r-md">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                                            <div 
                                                                className={`h-full ${row.collectionRate >= 80 ? 'bg-green-500' : row.collectionRate >= 50 ? 'bg-orange-400' : 'bg-red-400'}`} 
                                                                style={{ width: `${row.collectionRate}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-500">{row.collectionRate}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Donut Chart */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col">
                            <h2 className="text-sm font-bold text-gray-800 mb-2 border-b border-gray-100 pb-2">Payment mode insights</h2>
                            <div className="flex-1 flex items-center justify-center">
                                <div className="w-full h-[#250px] relative flex">
                                    <ResponsiveContainer width="100%" height={260} className="ml-[-30px]">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                cursor={{fill: 'transparent'}}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: number) => [`${value}%`]}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                                        {pieData.map((entry, index) => (
                                            <div key={index} className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                                                <div className="w-3.5 h-3.5 rounded-sm shadow-sm" style={{ backgroundColor: entry.color }}></div>
                                                <div className="flex flex-col">
                                                    <span>{entry.name}</span>
                                                    <span className="text-gray-400">{entry.value}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
