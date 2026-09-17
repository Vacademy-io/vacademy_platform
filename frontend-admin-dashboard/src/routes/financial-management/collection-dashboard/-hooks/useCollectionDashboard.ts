import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import type { TFunction } from 'i18next';

type VendorCategory = 'ONLINE_PORTAL' | 'CASH' | 'BANK_TRANSFER' | 'OTHER';

const VENDOR_CATEGORY_MAP: Record<string, VendorCategory> = {
    RAZORPAY: 'ONLINE_PORTAL',
    CASHFREE: 'ONLINE_PORTAL',
    STRIPE: 'ONLINE_PORTAL',
    OFFLINE: 'CASH',
    MANUAL: 'CASH',
    EWAY: 'BANK_TRANSFER',
};

const CATEGORY_COLOR_MAP: Record<VendorCategory, string> = {
    ONLINE_PORTAL: '#10b981',
    BANK_TRANSFER: '#f59e0b',
    CASH: '#6366f1',
    OTHER: '#94a3b8',
};

const DEFAULT_COLOR = '#94a3b8';

function vendorToCategory(vendor: string): VendorCategory {
    return VENDOR_CATEGORY_MAP[vendor.toUpperCase()] || 'OTHER';
}

function categoryLabel(category: VendorCategory, t: TFunction): string {
    switch (category) {
        case 'ONLINE_PORTAL':
            return t('vendorLabels.onlinePortal');
        case 'CASH':
            return t('vendorLabels.cash');
        case 'BANK_TRANSFER':
            return t('vendorLabels.bankTransfer');
        default:
            return t('vendorLabels.other');
    }
}

function calcRate(collected: number, expected: number): number {
    if (!expected || expected === 0) return 0;
    return (collected / expected) * 100;
}

export const useCollectionDashboard = () => {
    const { t } = useTranslation('financialManagementUseCollectionDashboard');
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
            { title: t('summaryCards.projectedRevenue'), value: formatCurrency(dashboardData.projectedRevenue), icon: Target, bgColor: 'bg-blue-50', iconColor: 'text-blue-600', borderColor: 'border-blue-100' },
            { title: t('summaryCards.tillNowExpected'), value: formatCurrency(dashboardData.expectedToDate), icon: Clock, bgColor: 'bg-orange-50', iconColor: 'text-orange-500', borderColor: 'border-orange-100' },
            { title: t('summaryCards.tillNowCollected'), value: formatCurrency(dashboardData.collectedToDate), icon: Coins, bgColor: 'bg-green-50', iconColor: 'text-green-600', borderColor: 'border-green-100' },
            { title: t('summaryCards.totalOverdue'), value: formatCurrency(dashboardData.totalOverdue), icon: WarningCircle, bgColor: 'bg-red-50', iconColor: 'text-red-500', borderColor: 'border-red-100' },
            { title: t('summaryCards.totalDue'), value: formatCurrency(totalDue), icon: Receipt, bgColor: 'bg-purple-50', iconColor: 'text-purple-600', borderColor: 'border-purple-100' },
        ];
    }, [dashboardData, totalDue, t]);

    const pipelineData = useMemo(() => {
        if (!dashboardData) return [];
        return [
            { name: t('pipeline.codes.projectedRevenue'), val: dashboardData.projectedRevenue, color: '#1e3a8a', tooltip: t('pipeline.tooltips.projectedRevenue') },
            { name: t('pipeline.codes.tillNowExpected'), val: dashboardData.expectedToDate, color: '#3b82f6', tooltip: t('pipeline.tooltips.tillNowExpected') },
            { name: t('pipeline.codes.tillNowCollected'), val: dashboardData.collectedToDate, color: '#10b981', tooltip: t('pipeline.tooltips.tillNowCollected') },
            { name: t('pipeline.codes.totalOverdue'), val: dashboardData.totalOverdue, color: '#ef4444', tooltip: t('pipeline.tooltips.totalOverdue') },
            { name: t('pipeline.codes.totalDue'), val: totalDue, color: '#a855f7', tooltip: t('pipeline.tooltips.totalDue') }
        ];
    }, [dashboardData, totalDue, t]);

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

        // Aggregate by category (multiple vendors can map to same category)
        const categoryTotals: Partial<Record<VendorCategory, number>> = {};
        let grandTotal = 0;
        for (const entry of dashboardData.paymentModeBreakdown) {
            const category = vendorToCategory(entry.vendor);
            categoryTotals[category] = (categoryTotals[category] || 0) + entry.amount;
            grandTotal += entry.amount;
        }

        if (grandTotal === 0) return [];

        return (Object.entries(categoryTotals) as [VendorCategory, number][])
            .map(([category, amount]) => ({
                name: categoryLabel(category, t),
                value: parseFloat(((amount / grandTotal) * 100).toFixed(1)),
                color: CATEGORY_COLOR_MAP[category] || DEFAULT_COLOR,
            }))
            .sort((a, b) => b.value - a.value);
    }, [dashboardData, t]);

    const gaugeData = useMemo(() => [
        { name: t('gauge.collected'), value: collectionRate, color: '#10b981' },
        { name: t('gauge.remaining'), value: 100 - collectionRate, color: '#e5e7eb' },
    ], [collectionRate, t]);

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
