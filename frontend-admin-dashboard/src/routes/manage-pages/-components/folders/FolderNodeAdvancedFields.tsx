import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { handleFetchCampaignsList } from '@/routes/audience-manager/list/-services/get-campaigns-list';
import { cn } from '@/lib/utils';
import { ColorPickerField } from '../ColorPickerField';
import type { FolderNodeType } from '../../-services/folder-library-service';
import {
    FOLDER_FIELD_LIMITS,
    advancedFieldsFor,
    sanitizeSlugInput,
    slugFromText,
    suggestFolderSlug,
    type FolderAdvancedDraft,
} from './folder-node-advanced';

/**
 * "Advanced" part of the folder item dialog: the fields the header mega menu,
 * the Courses page stream tabs and learning-path cards read — link key, course
 * tag, subtitle, tagline, button label, link, accent colour and coming soon.
 * Everything here is optional; an item that sets nothing keeps behaving
 * exactly as before.
 */

/** Seed colour when the admin first adds an accent; they change it right away. */
const ACCENT_SEED = '#F97316'; // design-lint-ignore: colour-editor seed value

interface FolderNodeAdvancedFieldsProps {
    nodeType: FolderNodeType;
    /** Unsaved item id (or '' for a new item) — the live site's last-resort link key. */
    nodeId: string;
    title: string;
    draft: FolderAdvancedDraft;
    onChange: (patch: Partial<FolderAdvancedDraft>) => void;
    /** Link keys other folders of this library already answer to → their names. */
    takenSlugs: Map<string, string>;
    /** Start expanded (the item already uses some of these fields). */
    defaultOpen?: boolean;
}

const Field = ({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) => (
    <div>
        <Label className="text-xs">{label}</Label>
        <div className="mt-1">{children}</div>
        {hint && <p className="mt-1 text-caption text-neutral-500">{hint}</p>}
    </div>
);

export const FolderNodeAdvancedFields = ({
    nodeType,
    nodeId,
    title,
    draft,
    onChange,
    takenSlugs,
    defaultOpen = false,
}: FolderNodeAdvancedFieldsProps) => {
    const [open, setOpen] = useState(defaultOpen);
    const offered = advancedFieldsFor(nodeType);
    const isFolder = nodeType === 'FOLDER';
    const instituteId = getCurrentInstituteId();

    const { data: campaignsPage, isLoading: campaignsLoading } = useQuery({
        ...handleFetchCampaignsList({ institute_id: instituteId || '', status: 'ACTIVE', page: 0, size: 100 }),
        enabled: open && isFolder && draft.comingSoon && !!instituteId,
    });
    const campaigns = (campaignsPage?.content || [])
        .map((c) => ({ id: c.id || c.audience_id || c.campaign_id || '', name: c.campaign_name }))
        .filter((c) => c.id);
    const campaignMissing = !!(
        draft.audienceId &&
        !campaignsLoading &&
        campaignsPage &&
        !campaigns.some((c) => c.id === draft.audienceId)
    );

    const suggestion = suggestFolderSlug(draft.subtitle, title);
    // The live site's rule (learner folderSlug): the key, else one made from the
    // subtitle when there is one, else from the title, else the internal id.
    const typedKey = draft.slug.trim();
    const derivedKey = slugFromText(draft.subtitle || title);
    const keyIsId = !typedKey && !derivedKey;
    const liveKey = typedKey || derivedKey || nodeId;
    const displayKey = liveKey || 'key';
    const clashKey = typedKey || derivedKey;
    const clash = isFolder && clashKey ? takenSlugs.get(clashKey) : undefined;

    const summary = [
        draft.comingSoon && offered.has('comingSoon') ? 'Coming soon' : '',
        typedKey && offered.has('slug') ? `Link key: ${typedKey}` : '',
        draft.subtitle.trim(),
    ].filter(Boolean);

    return (
        <div className="rounded-md border border-neutral-200">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start"
            >
                <span>
                    <span className="block text-sm font-medium text-neutral-700">Advanced</span>
                    <span className="block text-caption text-neutral-500">
                        {summary.length
                            ? summary.join(' · ')
                            : isFolder
                              ? 'Link key, course tag, subtitle, button, colour, coming soon'
                              : 'Subtitle, tagline, button label and colour on cards'}
                    </span>
                </span>
                {open ? (
                    <CaretDown className="size-4 shrink-0 text-neutral-500" />
                ) : (
                    <CaretRight className="size-4 shrink-0 text-neutral-500" />
                )}
            </button>

            {open && (
                <div className="space-y-4 border-t border-neutral-100 px-3 pb-3 pt-3">
                    {!isFolder && (
                        <p className="text-caption text-neutral-500">
                            Used where this product page is shown as a card, for example in a list of learning
                            paths.
                        </p>
                    )}

                    <Field
                        label="Subtitle (optional)"
                        hint="A second line under the title — for example the English name under a Hindi title (EDUCATION)."
                    >
                        <Input
                            value={draft.subtitle}
                            maxLength={FOLDER_FIELD_LIMITS.subtitle}
                            onChange={(e) => onChange({ subtitle: e.target.value })}
                            placeholder="e.g. EDUCATION"
                        />
                    </Field>

                    {offered.has('slug') && (
                        <Field
                            label="Link key (optional)"
                            hint="Used in addresses such as /courses?stream=shiksha. Lowercase letters, numbers and dashes."
                        >
                            <Input
                                value={draft.slug}
                                maxLength={FOLDER_FIELD_LIMITS.slug}
                                onChange={(e) => onChange({ slug: sanitizeSlugInput(e.target.value) })}
                                placeholder={suggestion || 'e.g. shiksha'}
                                className="font-mono"
                            />
                            {!typedKey && (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <p className={cn('text-caption', keyIsId ? 'text-warning-600' : 'text-neutral-500')}>
                                        {keyIsId
                                            ? 'Links fall back to this folder’s internal id. Add a link key so addresses stay readable.'
                                            : `Links use “${derivedKey}”, made from the ${draft.subtitle.trim() ? 'subtitle' : 'title'}. Set it here so renaming the folder never breaks a link.`}
                                    </p>
                                    {suggestion && (
                                        <MyButton
                                            buttonType="text"
                                            scale="small"
                                            onClick={() => onChange({ slug: suggestion })}
                                        >
                                            Use “{suggestion}”
                                        </MyButton>
                                    )}
                                </div>
                            )}
                            {clash && (
                                <p className="mt-1 text-caption text-warning-600">
                                    “{clash}” already uses the link key “{clashKey}”. Links would open whichever comes
                                    first — pick a different key.
                                </p>
                            )}
                        </Field>
                    )}

                    {offered.has('courseTag') && (
                        <Field
                            label="Course tag (optional)"
                            hint="The course tag this folder stands for: choosing it on the Courses page shows the courses carrying this tag. Leave empty to use the link key."
                        >
                            <Input
                                value={draft.courseTag}
                                maxLength={FOLDER_FIELD_LIMITS.courseTag}
                                onChange={(e) => onChange({ courseTag: e.target.value })}
                                placeholder={displayKey}
                            />
                        </Field>
                    )}

                    <Field
                        label="Tagline (optional)"
                        hint={
                            isFolder
                                ? 'The headline when this folder is featured, e.g. in the mega menu’s detail panel.'
                                : 'A one-line pitch on the card.'
                        }
                    >
                        <Input
                            value={draft.tagline}
                            maxLength={FOLDER_FIELD_LIMITS.tagline}
                            onChange={(e) => onChange({ tagline: e.target.value })}
                            placeholder="e.g. Learn the Indian way of learning."
                        />
                    </Field>

                    <Field label="Button label (optional)" hint="Text of the call-to-action button, e.g. Explore Education.">
                        <Input
                            value={draft.ctaLabel}
                            maxLength={FOLDER_FIELD_LIMITS.ctaLabel}
                            onChange={(e) => onChange({ ctaLabel: e.target.value })}
                            placeholder="e.g. Explore Education"
                        />
                    </Field>

                    {offered.has('linkUrl') && (
                        <Field
                            label="Link (optional)"
                            hint="A page on your site (/courses?stream=shiksha) or a full https:// address. Empty: a stream opens /courses?stream=<its key>, a category /courses?stream=<stream>&category=<its key>."
                        >
                            <Input
                                value={draft.linkUrl}
                                onChange={(e) => onChange({ linkUrl: e.target.value })}
                                placeholder={`/courses?stream=${displayKey}`}
                            />
                        </Field>
                    )}

                    {offered.has('accentColor') && (
                        <div>
                            {draft.accentColor ? (
                                <div className="space-y-1">
                                    <ColorPickerField
                                        label="Accent colour"
                                        value={draft.accentColor}
                                        onChange={(c) => onChange({ accentColor: c })}
                                    />
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-caption text-neutral-500">
                                            Shown behind the round image or icon.
                                        </p>
                                        <MyButton buttonType="text" scale="small" onClick={() => onChange({ accentColor: '' })}>
                                            Remove colour
                                        </MyButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <Label className="text-xs">Accent colour</Label>
                                        <p className="text-caption text-neutral-500">
                                            None — the site’s own colours are used.
                                        </p>
                                    </div>
                                    <MyButton buttonType="secondary" scale="small" onClick={() => onChange({ accentColor: ACCENT_SEED })}>
                                        Add colour
                                    </MyButton>
                                </div>
                            )}
                        </div>
                    )}

                    {offered.has('comingSoon') && (
                        <div className="space-y-3 rounded-md border border-neutral-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium text-neutral-700">Coming soon</p>
                                    <p className="text-caption text-neutral-500">
                                        Shown with a coming-soon mark but does not open yet. It stays on the site even
                                        while empty, and visitors can leave their email to hear when it launches.
                                    </p>
                                </div>
                                <Switch
                                    checked={draft.comingSoon}
                                    onCheckedChange={(v) => onChange({ comingSoon: v })}
                                    aria-label="Coming soon"
                                />
                            </div>
                            {draft.comingSoon && (
                                <div>
                                    <Label className="text-xs">Collect “notify me” sign-ups in</Label>
                                    <select
                                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-2 py-2 text-sm"
                                        value={draft.audienceId}
                                        onChange={(e) => onChange({ audienceId: e.target.value })}
                                    >
                                        <option value="">
                                            {campaignsLoading ? 'Loading campaigns…' : 'No sign-ups — just show the mark'}
                                        </option>
                                        {campaignMissing && (
                                            <option value={draft.audienceId}>A campaign not in your active list</option>
                                        )}
                                        {campaigns.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p
                                        className={cn(
                                            'mt-1 text-caption',
                                            draft.audienceId && !campaignMissing ? 'text-neutral-500' : 'text-warning-600'
                                        )}
                                    >
                                        {campaignMissing
                                            ? 'That campaign is not among your active campaigns (paused or archived?), so sign-ups may go nowhere. Pick another.'
                                            : draft.audienceId
                                              ? 'Sign-ups arrive as leads in this Audience Manager campaign.'
                                              : 'Without a campaign visitors see the mark but cannot ask to be told. Campaigns live in Audience Manager.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
