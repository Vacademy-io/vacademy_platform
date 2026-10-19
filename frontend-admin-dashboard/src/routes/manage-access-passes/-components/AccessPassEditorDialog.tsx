import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { MultiSelect } from '@/components/design-system/multi-select';
import {
    handleGetPaymentDetails,
    PAYMENT_OPTIONS_PAGE_SIZE,
} from '@/routes/manage-students/invite/-components/create-invite/-services/get-payments';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getUserId } from '@/utils/userDetails';
import {
    createAccessPass,
    updateAccessPass,
    type AccessPass,
    type AccessPassAudience,
    type AccessPassCourseScope,
    type AccessPassRequest,
    type ItemRemovalPolicy,
} from '@/services/access-pass';
import { useBatchOptions } from '../-hooks/use-batch-options';
import { CreatePassPricingDialog, type CreatedPricing } from './CreatePassPricingDialog';

interface PaymentOptionLite {
    id: string;
    name: string;
    type?: string;
    status?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Edit when given; create otherwise. */
    pass?: AccessPass;
    onSaved: (pass: AccessPass) => void;
}

/**
 * Create / edit the basics of a pass. Courses are picked here only on create; after
 * that they change through the detail panel, so each change triggers its own holder
 * sync on the backend.
 */
export function AccessPassEditorDialog({ open, onOpenChange, pass, onSaved }: Props) {
    const { t } = useTranslation('manageAccessPasses');
    const isEdit = !!pass;
    const { options: batchOptions } = useBatchOptions();

    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [description, setDescription] = useState('');
    const [coverImageUrl, setCoverImageUrl] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [paymentOptionId, setPaymentOptionId] = useState('');
    const [policy, setPolicy] = useState<ItemRemovalPolicy>('KEEP_FOR_EXISTING');
    const [audience, setAudience] = useState<AccessPassAudience>('B2C');
    const [scope, setScope] = useState<AccessPassCourseScope>('SELECTED');
    const [pricingOpen, setPricingOpen] = useState(false);
    // Options created from this dialog, shown before the list refetch brings them in.
    const [createdOptions, setCreatedOptions] = useState<CreatedPricing[]>([]);
    const [packageSessionIds, setPackageSessionIds] = useState<string[]>([]);
    const [paymentSearch, setPaymentSearch] = useState('');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(pass?.name ?? '');
        setSlug(pass?.slug ?? '');
        setShortDescription(pass?.short_description ?? '');
        setDescription(pass?.description ?? '');
        setCoverImageUrl(pass?.cover_image_url ?? '');
        setTags(pass?.tags ?? []);
        setPaymentOptionId(pass?.payment_option_id ?? '');
        setPolicy(pass?.on_item_removed ?? 'KEEP_FOR_EXISTING');
        setAudience(pass?.audience_type ?? 'B2C');
        setScope(pass?.course_scope ?? 'SELECTED');
        setCreatedOptions([]);
        setPackageSessionIds([]);
        setPaymentSearch('');
    }, [open, pass]);

    const { data: paymentData, isLoading: paymentsLoading } = useQuery({
        ...handleGetPaymentDetails(paymentSearch, PAYMENT_OPTIONS_PAGE_SIZE),
        enabled: open,
    });
    const paymentOptions = useMemo(() => {
        const list = (Array.isArray(paymentData) ? paymentData : []) as PaymentOptionLite[];
        const live = list.filter((p) => (p.status ?? 'ACTIVE').toUpperCase() !== 'DELETED');
        const known = new Set(live.map((p) => p.id));
        return [...createdOptions.filter((c) => !known.has(c.id)), ...live];
    }, [paymentData, createdOptions]);

    const handleCoverUpload = async (file?: File) => {
        if (!file) return;
        try {
            const fileId = await UploadFileInS3(
                file,
                setUploading,
                getUserId() || 'admin',
                'ACCESS_PASS',
                'INSTITUTE',
                true
            );
            const url = await getPublicUrl(fileId);
            if (!url) throw new Error('no url');
            setCoverImageUrl(url);
        } catch {
            toast.error(t('editor.uploadFailed', 'Could not upload the image'));
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error(t('editor.nameRequired', 'Give the pass a name'));
            return;
        }
        if (!paymentOptionId) {
            toast.error(t('editor.paymentRequired', 'Choose how the pass is priced'));
            return;
        }
        if (!isEdit && scope === 'SELECTED' && packageSessionIds.length === 0) {
            toast.error(t('editor.coursesRequired', 'Select at least one course'));
            return;
        }
        const body: AccessPassRequest = {
            name: name.trim(),
            slug: slug.trim() || undefined,
            short_description: shortDescription,
            description,
            cover_image_url: coverImageUrl,
            tags,
            payment_option_id: paymentOptionId,
            on_item_removed: policy,
            course_scope: scope,
        };
        setSaving(true);
        try {
            const saved = isEdit
                ? await updateAccessPass(pass!.id, body)
                : await createAccessPass({
                      ...body,
                      audience_type: audience,
                      package_session_ids: scope === 'SELECTED' ? packageSessionIds : undefined,
                  });
            toast.success(isEdit ? t('editor.updated', 'Pass updated') : t('editor.created', 'Pass created as draft'));
            onSaved(saved);
            onOpenChange(false);
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { ex?: string; message?: string } } })?.response?.data;
            toast.error(msg?.ex || msg?.message || t('editor.saveFailed', 'Could not save the pass'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEdit ? t('editor.editTitle', 'Edit access pass') : t('editor.createTitle', 'New access pass')}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="grid gap-1.5">
                        <Label>{t('editor.audience', 'Who is this pass for?')}</Label>
                        <Select
                            value={audience}
                            onValueChange={(v) => setAudience(v as AccessPassAudience)}
                            disabled={isEdit}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="B2C">
                                    {t('editor.audienceB2C', 'Learners (B2C) — sold on your website')}
                                </SelectItem>
                                <SelectItem value="B2B">
                                    {t('editor.audienceB2B', 'Organisations (B2B) — assigned to sub-orgs')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {isEdit && (
                            <p className="text-xs text-neutral-500">
                                {t('editor.audienceLocked', 'The pass type cannot change after it is created.')}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.name', 'Name')}</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.slug', 'URL key (optional)')}</Label>
                        <Input
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder={t('editor.slugPlaceholder', 'Generated from the name')}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.shortDescription', 'Short description (card)')}</Label>
                        <Input value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.description', 'Description')}</Label>
                        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.cover', 'Cover image')}</Label>
                        {coverImageUrl && (
                            <img src={coverImageUrl} alt="" className="h-32 w-full rounded-md object-cover" />
                        )}
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept="image/*"
                                disabled={uploading}
                                onChange={(e) => handleCoverUpload(e.target.files?.[0])}
                            />
                            {coverImageUrl && (
                                <Button variant="ghost" size="sm" onClick={() => setCoverImageUrl('')}>
                                    {t('editor.removeCover', 'Remove')}
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.tags', 'Tags (catalogue filters)')}</Label>
                        <TagInput tags={tags} onChange={setTags} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.paymentOption', 'Pricing (payment option)')}</Label>
                        <Input
                            placeholder={t('editor.searchPayment', 'Search payment options')}
                            value={paymentSearch}
                            onChange={(e) => setPaymentSearch(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setPricingOpen(true)}>
                                {t('editor.newPricing', '+ Create pricing for this pass')}
                            </Button>
                        </div>
                        <Select value={paymentOptionId} onValueChange={setPaymentOptionId}>
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={
                                        paymentsLoading
                                            ? t('editor.loading', 'Loading…')
                                            : t('editor.choosePayment', 'Choose a payment option')
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {paymentOptions.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} {p.type ? `· ${p.type}` : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isEdit && (
                            <p className="text-xs text-neutral-500">
                                {t(
                                    'editor.repriceHint',
                                    'Changing this re-prices the pass for new buyers only. Current holders keep their plan.'
                                )}
                            </p>
                        )}
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.policy', 'When a course is removed from the pass')}</Label>
                        <Select value={policy} onValueChange={(v) => setPolicy(v as ItemRemovalPolicy)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="KEEP_FOR_EXISTING">
                                    {t('editor.policyKeep', 'Current holders keep it until their plan ends')}
                                </SelectItem>
                                <SelectItem value="REVOKE">
                                    {t('editor.policyRevoke', 'Remove it from current holders too')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>{t('editor.courses', 'Included courses')}</Label>
                        <Select value={scope} onValueChange={(v) => setScope(v as AccessPassCourseScope)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="SELECTED">{t('editor.scopeSelected', 'Selected courses')}</SelectItem>
                                <SelectItem value="ALL_COURSES">
                                    {t('editor.scopeAll', 'All courses (new courses join automatically)')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                        {scope === 'ALL_COURSES' && (
                            <p className="text-xs text-neutral-500">
                                {t(
                                    'editor.scopeAllHint',
                                    'Every live course of the institute is included. Courses you publish later are added to the pass, and to everyone holding it, automatically.'
                                )}
                            </p>
                        )}
                        {scope === 'SELECTED' && !isEdit && (
                            <>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPackageSessionIds(batchOptions.map((o) => o.value))}
                                    >
                                        {t('editor.selectAll', 'Select all')} ({batchOptions.length})
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={packageSessionIds.length === 0}
                                        onClick={() => setPackageSessionIds([])}
                                    >
                                        {t('editor.clear', 'Clear')}
                                    </Button>
                                </div>
                                <MultiSelect
                                    options={batchOptions}
                                    selected={packageSessionIds}
                                    onChange={setPackageSessionIds}
                                    placeholder={t('editor.coursesPlaceholder', 'Select course batches')}
                                    portal={false}
                                    checkboxes
                                />
                            </>
                        )}
                        {scope === 'SELECTED' && isEdit && pass?.course_scope === 'ALL_COURSES' && (
                            <p className="text-xs text-neutral-500">
                                {t(
                                    'editor.scopeToSelectedHint',
                                    "The pass keeps today's courses as its selection; new courses stop joining automatically."
                                )}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        {t('common.cancel', 'Cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={saving || uploading}>
                        {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
            <CreatePassPricingDialog
                open={pricingOpen}
                onOpenChange={setPricingOpen}
                onSaved={(option) => {
                    setCreatedOptions((prev) => [option, ...prev]);
                    setPaymentOptionId(option.id);
                }}
            />
        </Dialog>
    );
}
