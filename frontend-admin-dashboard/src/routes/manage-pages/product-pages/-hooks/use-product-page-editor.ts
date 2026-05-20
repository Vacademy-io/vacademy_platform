import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getProductPage, updateProductPage } from '../-services/product-pages-service';
import {
    DEFAULT_PRODUCT_PAGE_SETTINGS,
    DEFAULT_PAGE_JSON,
    ProductPageSettings,
    PageJson,
    MappingRow,
    ProductPageResponse,
} from '../-types/product-page-types';

function parseSafeJson<T>(jsonStr: string | null | undefined, fallback: T): T {
    if (!jsonStr) return fallback;
    try {
        return JSON.parse(jsonStr) as T;
    } catch {
        return fallback;
    }
}

function mappingResponseToRow(m: ProductPageResponse['mappings'][number], idx: number): MappingRow {
    return {
        rowId: m.id || `row-${Date.now()}-${idx}`,
        inviteId: m.enroll_invite_id || '',
        inviteName: '',
        psInvitePaymentOptionId: m.ps_invite_payment_option_id || '',
        packageSessionId: m.package_session_id || '',
        paymentPlanId: m.payment_plan_id || '',
        paymentPlanName: m.payment_plan?.name || '',
        paymentPlanPrice: m.payment_plan?.actual_price || 0,
        currency: m.payment_plan?.currency || '',
        preselected: m.preselected ?? false,
        displayOrder: m.display_order ?? idx,
    };
}

export const useProductPageEditor = (productPageId: string) => {
    const [isDirty, setIsDirty] = useState(false);
    const [activeTab, setActiveTab] = useState<'design' | 'courses' | 'settings' | 'coupons' | 'preview'>(
        'design'
    );

    // Server state
    const {
        data: page,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ['productPage', productPageId],
        queryFn: () => getProductPage(productPageId),
        enabled: !!productPageId,
        staleTime: 60 * 1000,
    });

    // Local editor state — initialised from server when page loads
    const [name, setName] = useState('');
    const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>('DRAFT');
    const [settings, setSettings] = useState<ProductPageSettings>(DEFAULT_PRODUCT_PAGE_SETTINGS);
    const [pageJson, setPageJson] = useState<PageJson>(DEFAULT_PAGE_JSON);
    const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
    const [initialized, setInitialized] = useState(false);

    // One-shot init from fetched data
    if (page && !initialized) {
        setName(page.name);
        setStatus((page.status as 'DRAFT' | 'ACTIVE') || 'DRAFT');
        setSettings({
            ...DEFAULT_PRODUCT_PAGE_SETTINGS,
            ...parseSafeJson(page.settings_json, DEFAULT_PRODUCT_PAGE_SETTINGS),
        });
        setPageJson(parseSafeJson(page.page_json, DEFAULT_PAGE_JSON));
        setMappingRows((page.mappings || []).map(mappingResponseToRow));
        setInitialized(true);
    }

    const markDirty = useCallback(() => setIsDirty(true), []);

    const updateName = useCallback(
        (v: string) => {
            setName(v);
            markDirty();
        },
        [markDirty]
    );

    const updateStatus = useCallback(
        (v: 'DRAFT' | 'ACTIVE') => {
            setStatus(v);
            markDirty();
        },
        [markDirty]
    );

    const updateSettings = useCallback(
        (updated: ProductPageSettings) => {
            setSettings(updated);
            markDirty();
        },
        [markDirty]
    );

    const updatePageJson = useCallback(
        (updated: PageJson) => {
            setPageJson(updated);
            markDirty();
        },
        [markDirty]
    );

    const addRow = useCallback(() => {
        setMappingRows((prev) => [
            ...prev,
            {
                rowId: `new-${Date.now()}`,
                inviteId: '',
                inviteName: '',
                psInvitePaymentOptionId: '',
                packageSessionId: '',
                paymentPlanId: '',
                paymentPlanName: '',
                paymentPlanPrice: 0,
                currency: '',
                preselected: false,
                displayOrder: prev.length,
            },
        ]);
        markDirty();
    }, [markDirty]);

    const addRowWithData = useCallback(
        (row: MappingRow) => {
            setMappingRows((prev) => [...prev, { ...row, displayOrder: prev.length }]);
            markDirty();
        },
        [markDirty]
    );

    const updateRow = useCallback(
        (rowId: string, updated: MappingRow) => {
            setMappingRows((prev) => prev.map((r) => (r.rowId === rowId ? updated : r)));
            markDirty();
        },
        [markDirty]
    );

    const removeRow = useCallback(
        (rowId: string) => {
            setMappingRows((prev) =>
                prev.filter((r) => r.rowId !== rowId).map((r, i) => ({ ...r, displayOrder: i }))
            );
            markDirty();
        },
        [markDirty]
    );

    const saveMutation = useMutation({
        mutationFn: () =>
            updateProductPage(productPageId, {
                name,
                status,
                page_json: JSON.stringify(pageJson),
                settings_json: JSON.stringify(settings),
                mappings: mappingRows
                    .filter((r) => r.psInvitePaymentOptionId && r.paymentPlanId)
                    .map((r, i) => ({
                        ps_invite_payment_option_id: r.psInvitePaymentOptionId,
                        payment_plan_id: r.paymentPlanId,
                        preselected: r.preselected,
                        display_order: i,
                    })),
            }),
        onSuccess: () => {
            setIsDirty(false);
            refetch();
        },
    });

    const totalPrice = mappingRows
        .filter((r) => r.paymentPlanPrice > 0)
        .reduce((sum, r) => sum + r.paymentPlanPrice, 0);

    return {
        page,
        isLoading,
        name,
        status,
        settings,
        pageJson,
        mappingRows,
        isDirty,
        activeTab,
        totalPrice,
        setActiveTab,
        updateName,
        updateStatus,
        updateSettings,
        updatePageJson,
        addRow,
        addRowWithData,
        updateRow,
        removeRow,
        save: saveMutation.mutate,
        isSaving: saveMutation.isPending,
        saveError: saveMutation.isError,
    };
};
