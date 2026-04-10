import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInstituteId } from '@/constants/helper';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import {
    fetchFeeTypesForInstitute,
    getFeeTypesQueryKey,
    fetchDashboardCollectionData,
    getCollectionDashboardQueryKey,
    DashboardCollectionRequest,
    DashboardCollectionResponse
} from '@/services/manage-finances';
import { Target, Clock, Coins, WarningCircle, Receipt } from '@phosphor-icons/react';
import { formatCurrency } from '@/utils/finance-utils';

const VENDOR_LABEL_MAP: Record<string, string> = {
    RAZORPAY: 'Online Portal',
    CASHFREE: 'Online Portal',
    STRIPE: 'Online Portal',
    OFFLINE: 'Cash',
    MANUAL: 'Cash',
    EWAY: 'Bank Transfer',
};

const LABEL_COLOR_MAP: Record<string, string> = {
    'Online Portal': '#10b981',
    'Bank Transfer': '#f59e0b',
    'Cash': '#6366f1',
};

const DEFAULT_COLOR = '#94a3b8';

function vendorToLabel(vendor: string): string {
    return VENDOR_LABEL_MAP[vendor.toUpperCase()] || 'Other';
}

function calcRate(collected: number, expected: number): number {
    if (!expected || expected === 0) return 0;
    return (collected / expected) * 100;
}

export const useCollectionDashboard = () => {
    const { getAllSessions } = useInstituteDetailsStore();
    const availableSessions = getAllSessions() || [];

    const [sessionId, setSessionId] = useState<string>('');
    const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>([]);
    const instituteId = getInstituteId() || '';

    // --- Fee Types ---
    const { data: feeTypeOptions = [] } = useQuery({
        queryKey: getFeeTypesQueryKey(),
        queryFn: fetchFeeTypesForInstitute,
        staleTime: 300000,
        enabled: !!instituteId
    });

    // --- Dashboard Data ---
    const requestBody: DashboardCollectionRequest = useMemo(() => ({
        instituteId,
        sessionId,
        feeTypeIds: selectedFeeTypeIds
    }), [instituteId, sessionId, selectedFeeTypeIds]);

    const { data: dashboardData, isLoading, isError, refetch } = useQuery({
        queryKey: getCollectionDashboardQueryKey(requestBody),
        queryFn: () => fetchDashboardCollectionData(requestBody),
        staleTime: 60000,
        enabled: !!instituteId
    });

    // --- Actions ---
    const toggleFeeType = (id: string) => {
        setSelectedFeeTypeIds(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const clearFeeTypes = () => setSelectedFeeTypeIds([]);

    // --- Derived Data for UI ---
    const totalDue = useMemo(() => {
        if (!dashboardData) return 0;
        return dashboardData.projectedRevenue - dashboardData.collectedToDate;
    }, [dashboardData]);

    const collectionRate = useMemo(() => {
        if (!dashboardData) return 0;
        return calcRate(dashboardData.collectedToDate, dashboardData.expectedToDate);
    }, [dashboardData]);

    const summaryCards = useMemo(() => {
        if (!dashboardData) return [];
        return [
            { title: 'Projected revenue', value: formatCurrency(dashboardData.projectedRevenue), icon: Target, bgColor: 'bg-blue-50', iconColor: 'text-blue-600', borderColor: 'border-blue-100' },
            { title: 'Till now expected', value: formatCurrency(dashboardData.expectedToDate), icon: Clock, bgColor: 'bg-orange-50', iconColor: 'text-orange-500', borderColor: 'border-orange-100' },
            { title: 'Till now collected', value: formatCurrency(dashboardData.collectedToDate), icon: Coins, bgColor: 'bg-green-50', iconColor: 'text-green-600', borderColor: 'border-green-100' },
            { title: 'Total overdue', value: formatCurrency(dashboardData.totalOverdue), icon: WarningCircle, bgColor: 'bg-red-50', iconColor: 'text-red-500', borderColor: 'border-red-100' },
            { title: 'Total due', value: formatCurrency(totalDue), icon: Receipt, bgColor: 'bg-purple-50', iconColor: 'text-purple-600', borderColor: 'border-purple-100' },
        ];
    }, [dashboardData, totalDue]);

    const pipelineData = useMemo(() => {
        if (!dashboardData) return [];
        return [
            { name: 'PR', val: dashboardData.projectedRevenue, color: '#1e3a8a', tooltip: 'Projected Revenue' },
            { name: 'TNE', val: dashboardData.expectedToDate, color: '#3b82f6', tooltip: 'Till Now Expected' },
            { name: 'TNC', val: dashboardData.collectedToDate, color: '#10b981', tooltip: 'Till Now Collected' },
            { name: 'TO', val: dashboardData.totalOverdue, color: '#ef4444', tooltip: 'Total Overdue' },
            { name: 'TD', val: totalDue, color: '#a855f7', tooltip: 'Total Due' }
        ];
    }, [dashboardData, totalDue]);

    const classWiseDetails = useMemo(() => {
        if (!dashboardData?.classWiseBreakdown) return [];
        return dashboardData.classWiseBreakdown.map(row => ({
            className: row.className,
            projectedRevenue: row.projectedRevenue,
            expectedToDate: row.expectedToDate,
            collectedToDate: row.collectedToDate,
            collectionRate: calcRate(row.collectedToDate, row.expectedToDate),
            totalOverdue: row.overdue,
        }));
    }, [dashboardData]);

    const pieData = useMemo(() => {
        if (!dashboardData?.paymentModeBreakdown?.length) return [];

        // Aggregate by label (multiple vendors can map to same label)
        const labelTotals: Record<string, number> = {};
        let grandTotal = 0;
        for (const entry of dashboardData.paymentModeBreakdown) {
            const label = vendorToLabel(entry.vendor);
            labelTotals[label] = (labelTotals[label] || 0) + entry.amount;
            grandTotal += entry.amount;
        }

        if (grandTotal === 0) return [];

        return Object.entries(labelTotals)
            .map(([name, amount]) => ({
                name,
                value: parseFloat(((amount / grandTotal) * 100).toFixed(1)),
                color: LABEL_COLOR_MAP[name] || DEFAULT_COLOR,
            }))
            .sort((a, b) => b.value - a.value);
    }, [dashboardData]);

    const gaugeData = useMemo(() => [
        { name: 'Collected', value: collectionRate, color: '#10b981' },
        { name: 'Remaining', value: 100 - collectionRate, color: '#e5e7eb' },
    ], [collectionRate]);

    return {
        sessionId,
        setSessionId,
        availableSessions,
        selectedFeeTypeIds,
        feeTypeOptions,
        toggleFeeType,
        clearFeeTypes,
        dashboardData,
        isLoading,
        isError,
        refetch,
        summaryCards,
        pipelineData,
        classWiseDetails,
        pieData,
        collectionRate,
        gaugeData
    };
};
