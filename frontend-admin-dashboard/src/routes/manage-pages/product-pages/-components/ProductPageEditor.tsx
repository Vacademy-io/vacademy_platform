import { useParams, useNavigate } from '@tanstack/react-router';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, AlertCircle, Copy, Check, Link } from 'lucide-react';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { useState } from 'react';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { useProductPageEditor } from '../-hooks/use-product-page-editor';
import { CourseSessionSelector } from './CourseSessionSelector';
import { ProductPageSettingsCard } from './ProductPageSettingsCard';
import { CouponManager } from './CouponManager';
import { ProductPagePreview } from './ProductPagePreview';
import { MyButton } from '@/components/design-system/button';
import { PageDesignEditor } from './PageDesignEditor';

const TABS = [
    { id: 'design', label: 'Page Design' },
    { id: 'courses', label: 'Courses' },
    { id: 'settings', label: 'Settings' },
    { id: 'coupons', label: 'Coupons' },
    { id: 'preview', label: 'Preview' },
] as const;

export const ProductPageEditor = () => {
    const { productPageId } = useParams({
        from: '/manage-pages/product-pages/editor/$productPageId',
    });
    const navigate = useNavigate();
    const { toast } = useToast();
    const instituteId = getCurrentInstituteId() || '';
    const { instituteDetails } = useInstituteDetailsStore();
    const [codeCopied, setCodeCopied] = useState(false);

    const {
        page,
        isLoading,
        name,
        status,
        settings,
        pageJson,
        mappingRows,
        isDirty,
        activeTab,
        setActiveTab,
        updateName,
        updateStatus,
        updateSettings,
        updatePageJson,
        addRow: _addRow,
        addRowWithData,
        updateRow,
        removeRow,
        save,
        isSaving,
        saveError,
    } = useProductPageEditor(productPageId);
    void _addRow; // unused — CourseSessionSelector uses addRowWithData directly

    const handleSave = () => {
        save(undefined, {
            onSuccess: () =>
                toast({ title: 'Saved', description: 'Product page saved successfully' }),
            onError: () =>
                toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' }),
        });
    };

    const getLearnerUrl = () => {
        if (!page?.code) return '';
        const tab = settings?.defaultStep ?? 'CATALOG';
        const rawCustomDomain = instituteDetails?.learner_portal_base_url;
        if (rawCustomDomain) {
            const base = rawCustomDomain.startsWith('http')
                ? rawCustomDomain
                : `https://${rawCustomDomain}`;
            return `${base}/product-pages/${page.code}?defaultTab=${tab}`;
        }
        return `${BASE_URL_LEARNER_DASHBOARD}/product-pages/${page.code}?instituteId=${instituteId}&defaultTab=${tab}`;
    };

    const copyCode = () => {
        const url = getLearnerUrl();
        if (!url) return;
        navigator.clipboard.writeText(url);
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-4 border-neutral-200 border-t-primary-500" />
            </div>
        );
    }

    if (!page && !isLoading) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
                <AlertCircle className="size-10 text-neutral-400" />
                <p className="text-neutral-500">Product page not found.</p>
                <MyButton
                    buttonType="secondary"
                    scale="medium"
                    onClick={() => navigate({ to: '/manage-pages/product-pages' })}
                >
                    Back to list
                </MyButton>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden md:h-[calc(100vh-4.5rem)]">
            {/* Top bar */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-6 py-3">
                <button
                    onClick={() => navigate({ to: '/manage-pages/product-pages' })}
                    className="flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-700"
                >
                    <ArrowLeft className="size-4" />
                    Back
                </button>

                <div className="h-4 w-px bg-neutral-200" />

                {/* Name inline edit */}
                <Input
                    value={name}
                    onChange={(e) => updateName(e.target.value)}
                    className="h-8 max-w-xs border-transparent bg-transparent text-sm font-semibold text-neutral-800 shadow-none hover:border-neutral-200 focus:border-neutral-300"
                    placeholder="Page name"
                />

                {/* Shareable link badge */}
                {page?.code && (
                    <button
                        onClick={copyCode}
                        className="flex items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-100"
                        title="Copy shareable link"
                    >
                        {codeCopied ? (
                            <>
                                <Check className="size-3 text-success-600" />
                                <span className="font-medium text-success-600">Copied!</span>
                            </>
                        ) : (
                            <>
                                <span className="font-medium">Copy Link</span>
                                <Copy className="size-3 text-neutral-300" />
                            </>
                        )}
                    </button>
                )}

                {/* Status toggle */}
                <select
                    value={status}
                    onChange={(e) => updateStatus(e.target.value as 'DRAFT' | 'ACTIVE')}
                    className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 shadow-sm focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                </select>

                <div className="ml-auto flex items-center gap-2">
                    {isDirty && (
                        <span className="text-xs font-medium text-warning-600">
                            Unsaved changes
                        </span>
                    )}
                    {saveError && <span className="text-xs text-danger-600">Save failed</span>}
                    <MyButton
                        scale="small"
                        buttonType="primary"
                        onClick={handleSave}
                        disable={isSaving || !isDirty}
                    >
                        <Save className="size-3.5" />
                        {isSaving ? 'Saving...' : 'Save'}
                    </MyButton>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex shrink-0 items-center gap-0 border-b border-neutral-200 bg-white px-6">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-neutral-500 hover:text-neutral-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content — design tab is full-height with no padding; others scroll */}
            {activeTab === 'design' ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <PageDesignEditor pageJson={pageJson} onChange={updatePageJson} />
                </div>
            ) : (
                <div className="flex-1 overflow-auto p-6 lg:p-8">
                    {activeTab === 'courses' && (
                        <div className="mx-auto max-w-3xl">
                            <div className="mb-4">
                                <h2 className="text-sm font-semibold text-neutral-800">Courses</h2>
                                <p className="mt-0.5 text-xs text-neutral-500">
                                    Select package sessions to include. Each uses its default invite
                                    — you can change it per session.
                                </p>
                            </div>
                            <CourseSessionSelector
                                mappingRows={mappingRows}
                                suggestions={pageJson?.suggestions ?? {}}
                                onUpdateSuggestions={(s) =>
                                    updatePageJson({ ...pageJson, suggestions: s })
                                }
                                onAdd={addRowWithData}
                                onUpdate={updateRow}
                                onRemove={removeRow}
                            />
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="mx-auto max-w-2xl">
                            <ProductPageSettingsCard
                                settings={settings}
                                onChange={updateSettings}
                            />
                        </div>
                    )}

                    {activeTab === 'coupons' && (
                        <div className="mx-auto max-w-2xl">
                            <CouponManager productPageId={productPageId} />
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="mx-auto max-w-5xl">
                            <ProductPagePreview
                                productPageCode={page?.code || ''}
                                instituteId={instituteId}
                                preselectedCourseIds={mappingRows
                                    .filter((r) => r.preselected && r.packageSessionId)
                                    .map((r) => r.packageSessionId)}
                                defaultStep={settings?.defaultStep}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
