import { useState } from 'react';
import { Tag, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { getInstituteId } from '@/constants/helper';
import { cn } from '@/lib/utils';
import {
    CouponDetail,
    CouponSummary,
    useCouponDetail,
    useCouponsEnabledSetting,
    useUpdateCouponsEnabledSetting,
} from '@/services/coupons';
import {
    getTerminology,
    getTerminologyPlural,
} from '@/components/common/layout-container/sidebar/utils';
import {
    ContentTerms,
    RoleTerms,
    SystemTerms,
} from '@/routes/settings/-components/NamingSettings';
import { CouponFormDialog } from './CouponFormDialog';
import { CouponList } from './CouponList';

/**
 * Settings → Coupons orchestrator. Owns dialog open state + which coupon is
 * being edited, plus the institute-level "Enable coupon redemption" toggle.
 *
 * The toggle is stored in the institute settings JSON under
 * COUPON_ENABLED_SETTING (no migration needed, see services/coupons.ts).
 * When OFF, learners do not see the coupon UI on any of the three checkout
 * surfaces (product page, enroll-by-invite, catalogue dialogs). The list +
 * create UI remain visible so admins can pre-build coupons before flipping
 * the switch on.
 */
const CouponSettings = () => {
    const instituteId = getInstituteId();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: editingDetail } = useCouponDetail(editingId);
    const { data: enabled, isLoading: enabledLoading } = useCouponsEnabledSetting();
    const updateEnabled = useUpdateCouponsEnabledSetting();

    if (!instituteId) {
        return (
            <div className="p-6 text-body text-neutral-500">
                Select an institute to manage coupons.
            </div>
        );
    }

    const openCreate = () => {
        setEditingId(null);
        setDialogOpen(true);
    };

    const openEdit = (coupon: CouponSummary | CouponDetail) => {
        setEditingId(coupon.id);
        setDialogOpen(true);
    };

    const handleToggle = (next: boolean) => {
        updateEnabled.mutate(next, {
            onSuccess: () =>
                toast.success(
                    next ? 'Coupons enabled for learners' : 'Coupons hidden from learners'
                ),
            onError: (e) => {
                const message =
                    (e as { response?: { data?: { message?: string } } })?.response?.data
                        ?.message ??
                    (e as Error).message ??
                    'Could not update coupon setting';
                toast.error(message);
            },
        });
    };

    const isEnabled = enabled === true;
    const isToggleBusy = updateEnabled.isPending || enabledLoading;

    const learnerSingular = getTerminology(RoleTerms.Learner, SystemTerms.Learner);
    const learnerPlural = getTerminologyPlural(RoleTerms.Learner, SystemTerms.Learner);
    const batchPlural = getTerminologyPlural(ContentTerms.Batch, SystemTerms.Batch);
    const enableToggleLabel = `Enable coupon redemption for ${learnerPlural.toLowerCase()}`;

    return (
        <div className="space-y-6 px-2 py-1">
            <header className="flex items-start gap-3">
                <div className="rounded-md bg-primary-50 p-2 text-primary-700">
                    <Tag size={20} weight="fill" />
                </div>
                <div>
                    <h2 className="text-h3 font-semibold text-neutral-800">Coupon Settings</h2>
                    <p className="mt-1 text-body text-neutral-500">
                        Create discount coupons your {learnerPlural.toLowerCase()} can apply at
                        checkout. Scope them to the whole institute or to specific{' '}
                        {batchPlural.toLowerCase()} and invite links.
                    </p>
                </div>
            </header>

            {/* Institute-level enable toggle. Stored under COUPON_ENABLED_SETTING. */}
            <div
                className={cn(
                    'flex items-start gap-4 rounded-lg border p-4',
                    isEnabled
                        ? 'border-primary-100 bg-primary-50/40'
                        : 'border-neutral-200 bg-white'
                )}
            >
                <div className="flex-1">
                    <label
                        htmlFor="coupon-enabled-toggle"
                        className="cursor-pointer text-subtitle font-semibold text-neutral-800"
                    >
                        {enableToggleLabel}
                    </label>
                    <p className="mt-1 text-caption text-neutral-500">
                        When off, coupon fields are hidden on all {learnerSingular.toLowerCase()}{' '}
                        checkout flows. Existing coupons remain stored and resume working as soon as
                        you turn this back on.
                    </p>
                </div>
                <div className="pt-1">
                    <Switch
                        id="coupon-enabled-toggle"
                        checked={isEnabled}
                        disabled={isToggleBusy}
                        onCheckedChange={handleToggle}
                        aria-label={enableToggleLabel}
                    />
                </div>
            </div>

            {/* When OFF: surface a warning banner above the list so admins know
                learners can't actually use anything they create here yet. */}
            {!isEnabled && !enabledLoading && (
                <div className="flex items-start gap-2 rounded-md border border-warning-400 bg-warning-100 px-3 py-2 text-caption text-warning-600">
                    <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
                    <span>
                        Coupons are currently disabled. {learnerPlural} won&apos;t see the coupon
                        field at checkout until you enable the toggle above. You can still create
                        and edit coupons in advance.
                    </span>
                </div>
            )}

            <CouponList onCreate={openCreate} onEdit={openEdit} />

            <CouponFormDialog
                instituteId={instituteId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                editing={editingId ? editingDetail ?? null : null}
            />
        </div>
    );
};

export default CouponSettings;
