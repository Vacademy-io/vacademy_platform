/**
 * Post-Submit Configuration editor — the single UI for "what happens after an
 * audience form is submitted".
 *
 * Deliberately controlled (value + onChange) rather than react-hook-form bound,
 * because it is rendered in two places that own their state differently:
 *
 *   • Audience list → Create/Edit campaign  (react-hook-form, via Controller)
 *   • Settings → Lead Settings → Forms      (plain useState, institute default)
 *
 * Keeping one component means the campaign form and the institute default can
 * never drift into offering different options.
 *
 * The Preview pane renders the same artwork / copy / button structure the
 * learner app renders, so an admin can see the screen they are authoring
 * without publishing the campaign and submitting the form themselves.
 */
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
    CalendarBlank,
    Check,
    Confetti,
    Envelope,
    Heart,
    Plus,
    TrashSimple,
    UploadSimple,
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MyButton } from '@/components/design-system/button';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { cn } from '@/lib/utils';
import {
    AudiencePostSubmitConfiguration,
    createPostSubmitButton,
    isValidPostSubmitUrl,
    MAX_POST_SUBMIT_BUTTONS,
    POST_SUBMIT_ACCENT_LABELS,
    POST_SUBMIT_ACCENTS,
    POST_SUBMIT_ICON_LABELS,
    POST_SUBMIT_ICONS,
    type PostSubmitAccent,
    type PostSubmitButton,
    type PostSubmitIcon,
} from '@/services/audience-post-submit-settings';

interface PostSubmitConfigurationEditorProps {
    value: AudiencePostSubmitConfiguration;
    onChange: (next: AudiencePostSubmitConfiguration) => void;
    /** Rendered under the card title. Differs between campaign and settings. */
    description?: string;
    title?: string;
    /** `false` drops the Card chrome so a host can supply its own. */
    withCard?: boolean;
    disabled?: boolean;
    /** Name shown in the preview for the `{{campaignName}}` token. */
    previewCampaignName?: string;
}

// ─── Token maps ──────────────────────────────────────────────────────────────
// Tailwind only sees class names it can read literally, so these are full
// strings in a lookup rather than `bg-${accent}-100` template interpolation.

const ACCENT_ICON_CLASS: Record<PostSubmitAccent, string> = {
    success: 'bg-success-50 text-success-600',
    primary: 'bg-primary-50 text-primary-500',
    info: 'bg-info-50 text-info-600',
    warning: 'bg-warning-50 text-warning-600',
    neutral: 'bg-neutral-100 text-neutral-600',
};

const ACCENT_SWATCH_CLASS: Record<PostSubmitAccent, string> = {
    success: 'bg-success-500',
    primary: 'bg-primary-500',
    info: 'bg-info-500',
    warning: 'bg-warning-500',
    neutral: 'bg-neutral-400',
};

const ICON_COMPONENTS: Record<Exclude<PostSubmitIcon, 'none'>, typeof Check> = {
    check: Check,
    confetti: Confetti,
    heart: Heart,
    envelope: Envelope,
    calendar: CalendarBlank,
};

/** Preview-only token substitution. The learner app owns the real one. */
const previewTokens = (text: string, campaignName: string): string =>
    text
        .replace(/\{\{\s*name\s*\}\}/g, 'Asha Rao')
        .replace(/\{\{\s*email\s*\}\}/g, 'asha@example.com')
        .replace(/\{\{\s*campaignName\s*\}\}/g, campaignName);

/**
 * TipTap emits `<p></p>` for "nothing typed". Storing that would silently
 * shadow the plain-text message, so an empty document normalizes back to ''.
 */
const normalizeRichText = (html: string): string => {
    const stripped = html.replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, '').trim();
    return stripped ? html : '';
};

// ─── Small building blocks ───────────────────────────────────────────────────

const HelpText = ({ children }: { children: ReactNode }) => (
    <p className="mt-1 text-xs text-neutral-500">{children}</p>
);

const ErrorText = ({ children }: { children: ReactNode }) => (
    <p className="mt-1 text-xs text-danger-600">{children}</p>
);

const SectionTitle = ({ children }: { children: ReactNode }) => (
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{children}</p>
);

const ToggleRow = ({
    label,
    help,
    checked,
    onCheckedChange,
    disabled,
}: {
    label: string;
    help: string;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}) => (
    <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-neutral-200 p-4">
        <div className="space-y-0.5">
            <Label className="text-sm font-semibold">{label}</Label>
            <p className="text-xs text-neutral-500">{help}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
);

// ─── Editor ──────────────────────────────────────────────────────────────────

export const PostSubmitConfigurationEditor = ({
    value,
    onChange,
    description = 'Controls the thank-you screen a respondent sees the moment they submit this form.',
    title = 'Post Submit Configuration',
    withCard = true,
    disabled = false,
    previewCampaignName = 'Your Campaign',
}: PostSubmitConfigurationEditorProps) => {
    const { uploadFile, getPublicUrl } = useFileUpload();
    const [uploadingImage, setUploadingImage] = useState(false);
    // Power users occasionally need markup the toolbar can't build (a pre-baked
    // template, a styled table). The rich editor stays the default; this is the
    // escape hatch, not the primary path.
    const [htmlSourceMode, setHtmlSourceMode] = useState(false);

    const patch = (changes: Partial<AudiencePostSubmitConfiguration>) =>
        onChange({ ...value, ...changes });

    const patchButton = (id: string, changes: Partial<PostSubmitButton>) =>
        patch({
            buttons: value.buttons.map((button) =>
                button.id === id ? { ...button, ...changes } : button
            ),
        });

    const addButton = () =>
        patch({ buttons: [...value.buttons, createPostSubmitButton(value.buttons.length)] });

    const removeButton = (id: string) =>
        patch({ buttons: value.buttons.filter((button) => button.id !== id) });

    const handleImageUpload = async (file: File) => {
        try {
            setUploadingImage(true);
            const fileId = await uploadFile({
                file,
                setIsUploading: setUploadingImage,
                userId: 'post-submit-image',
                source: getCurrentInstituteId() || '',
                sourceId: 'AUDIENCE_POST_SUBMIT',
            });
            if (!fileId) throw new Error('Upload returned no file id');
            const publicUrl = await getPublicUrl(fileId);
            if (!publicUrl) throw new Error('Could not resolve a public URL');
            patch({ imageUrl: publicUrl });
        } catch (error) {
            console.error('Post-submit image upload failed:', error);
            toast.error('Could not upload that image. Paste a URL instead.');
        } finally {
            setUploadingImage(false);
        }
    };

    const redirectInvalid = !isValidPostSubmitUrl(value.redirectUrl);
    const imageInvalid = Boolean(value.imageUrl.trim()) && !isValidPostSubmitUrl(value.imageUrl);
    const PreviewIcon = value.icon === 'none' ? null : ICON_COMPONENTS[value.icon];

    // ── Controls ──
    const controls = (
        <div className="space-y-8">
            {/* ── Artwork ─────────────────────────────────────────────── */}
            <div className="space-y-4">
                <SectionTitle>Artwork</SectionTitle>

                <div>
                    <Label className="text-sm font-semibold">Icon</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {POST_SUBMIT_ICONS.map((icon) => {
                            const IconComponent = icon === 'none' ? null : ICON_COMPONENTS[icon];
                            const selected = value.icon === icon;
                            return (
                                <button
                                    key={icon}
                                    type="button"
                                    disabled={disabled}
                                    aria-pressed={selected}
                                    title={POST_SUBMIT_ICON_LABELS[icon]}
                                    onClick={() => patch({ icon })}
                                    className={cn(
                                        'flex size-10 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                        selected
                                            ? 'border-primary-500 bg-primary-50 text-primary-500'
                                            : 'border-neutral-300 text-neutral-500 hover:border-primary-200'
                                    )}
                                >
                                    {IconComponent ? (
                                        <IconComponent className="size-5" weight="bold" />
                                    ) : (
                                        <span className="text-caption font-semibold">Off</span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div>
                    <Label className="text-sm font-semibold">Accent Colour</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {POST_SUBMIT_ACCENTS.map((accent) => {
                            const selected = value.accent === accent;
                            return (
                                <button
                                    key={accent}
                                    type="button"
                                    disabled={disabled}
                                    aria-pressed={selected}
                                    onClick={() => patch({ accent })}
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                        selected
                                            ? 'border-primary-500 bg-primary-50 font-semibold text-primary-500'
                                            : 'border-neutral-300 text-neutral-600 hover:border-primary-200'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'size-3 rounded-full',
                                            ACCENT_SWATCH_CLASS[accent]
                                        )}
                                    />
                                    {POST_SUBMIT_ACCENT_LABELS[accent]}
                                </button>
                            );
                        })}
                    </div>
                    <HelpText>
                        Tints the icon and the solid button. Uses your institute&apos;s theme
                        colours, so it stays on-brand.
                    </HelpText>
                </div>

                <div>
                    <Label className="text-sm font-semibold">Image (Optional)</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Input
                            value={value.imageUrl}
                            disabled={disabled}
                            placeholder="https://… or upload"
                            onChange={(e) => patch({ imageUrl: e.target.value })}
                        />
                        <label
                            className={cn(
                                'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:border-primary-200',
                                (disabled || uploadingImage) && 'cursor-not-allowed opacity-50'
                            )}
                        >
                            <UploadSimple className="size-4" weight="bold" />
                            {uploadingImage ? 'Uploading…' : 'Upload'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={disabled || uploadingImage}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    // Reset so re-picking the same file re-fires change.
                                    e.target.value = '';
                                    if (file) void handleImageUpload(file);
                                }}
                            />
                        </label>
                    </div>
                    {imageInvalid ? (
                        <ErrorText>Use a relative path or a full http(s) link.</ErrorText>
                    ) : (
                        <HelpText>
                            Shown above the icon — a logo, event banner, QR code or map.
                        </HelpText>
                    )}
                </div>
            </div>

            {/* ── Copy ────────────────────────────────────────────────── */}
            <div className="space-y-4">
                <SectionTitle>Message</SectionTitle>

                <div>
                    <Label className="text-sm font-semibold">Heading</Label>
                    <Input
                        value={value.successTitle}
                        disabled={disabled}
                        placeholder="Registration Successful!"
                        onChange={(e) => patch({ successTitle: e.target.value })}
                        className="mt-2"
                    />
                    <HelpText>Leave blank to hide the heading.</HelpText>
                </div>

                <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="text-sm font-semibold">Body</Label>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setHtmlSourceMode((prev) => !prev)}
                            className="text-xs font-semibold text-primary-500 hover:underline disabled:opacity-50"
                        >
                            {htmlSourceMode ? 'Use rich text editor' : 'Edit HTML source'}
                        </button>
                    </div>
                    {htmlSourceMode ? (
                        <Textarea
                            rows={6}
                            value={value.content}
                            disabled={disabled}
                            placeholder="<p>We'll call you within 24 hours.</p>"
                            onChange={(e) => patch({ content: e.target.value })}
                            className="mt-2 font-mono text-xs"
                        />
                    ) : (
                        <div className="mt-2">
                            <RichTextEditor
                                value={value.content}
                                onChange={(html) => patch({ content: normalizeRichText(html) })}
                                minimalToolbar
                                placeholder="Add formatting, links or images…"
                                minHeight={140}
                            />
                        </div>
                    )}
                    <HelpText>
                        Rich text replaces the plain message below. Supported tokens:{' '}
                        <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>,{' '}
                        <code>{'{{campaignName}}'}</code>.
                    </HelpText>
                </div>

                <div>
                    <Label className="text-sm font-semibold">Plain Message (Fallback)</Label>
                    <Textarea
                        rows={3}
                        value={value.successMessage}
                        disabled={disabled}
                        placeholder="Thank you for your response. Your form has been submitted successfully."
                        onChange={(e) => patch({ successMessage: e.target.value })}
                        className="mt-2"
                    />
                    <HelpText>Used when the rich-text body above is empty.</HelpText>
                </div>
            </div>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="space-y-4">
                <SectionTitle>Buttons</SectionTitle>

                {value.buttons.length === 0 && (
                    <p className="text-xs text-neutral-500">
                        No buttons — the respondent just reads the message. Add one to send them
                        somewhere: a WhatsApp group, a brochure, your course catalogue.
                    </p>
                )}

                {value.buttons.map((button, index) => {
                    const urlInvalid =
                        Boolean(button.url.trim()) && !isValidPostSubmitUrl(button.url);
                    return (
                        <div
                            key={button.id}
                            className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 p-3 sm:grid-cols-12"
                        >
                            <div className="sm:col-span-5">
                                <Label className="text-xs font-semibold">Text</Label>
                                <Input
                                    value={button.text}
                                    disabled={disabled}
                                    placeholder="Explore Courses"
                                    onChange={(e) =>
                                        patchButton(button.id, { text: e.target.value })
                                    }
                                    className="mt-1"
                                />
                            </div>
                            <div className="sm:col-span-5">
                                <Label className="text-xs font-semibold">Link</Label>
                                <Input
                                    value={button.url}
                                    disabled={disabled}
                                    placeholder="https://example.com/courses"
                                    onChange={(e) =>
                                        patchButton(button.id, { url: e.target.value })
                                    }
                                    className="mt-1"
                                />
                                {urlInvalid && (
                                    <ErrorText>Relative path or full http(s) link.</ErrorText>
                                )}
                            </div>
                            <div className="sm:col-span-2">
                                <Label className="text-xs font-semibold">Style</Label>
                                <div className="mt-1 flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() =>
                                            patchButton(button.id, {
                                                variant:
                                                    button.variant === 'primary'
                                                        ? 'secondary'
                                                        : 'primary',
                                            })
                                        }
                                        className="flex-1 rounded-md border border-neutral-300 p-2 text-xs text-neutral-600 hover:border-primary-200 disabled:opacity-50"
                                    >
                                        {button.variant === 'primary' ? 'Solid' : 'Outline'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`Remove button ${index + 1}`}
                                        onClick={() => removeButton(button.id)}
                                        className="rounded-md border border-neutral-300 p-2 text-neutral-500 hover:border-danger-300 hover:text-danger-600 disabled:opacity-50"
                                    >
                                        <TrashSimple className="size-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {value.buttons.length < MAX_POST_SUBMIT_BUTTONS && (
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        disable={disabled}
                        onClick={addButton}
                    >
                        <Plus className="size-4" weight="bold" />
                        Add button
                    </MyButton>
                )}

                <ToggleRow
                    label="Allow Another Response"
                    help="Shows a button that clears the form so the same visitor can submit again — kiosks and event desks."
                    checked={value.allowAnotherResponse}
                    disabled={disabled}
                    onCheckedChange={(checked) => patch({ allowAnotherResponse: checked })}
                />

                {value.allowAnotherResponse && (
                    <div>
                        <Label className="text-xs font-semibold">Button Label</Label>
                        <Input
                            value={value.anotherResponseText}
                            disabled={disabled}
                            placeholder="Submit another response"
                            onChange={(e) => patch({ anotherResponseText: e.target.value })}
                            className="mt-1"
                        />
                    </div>
                )}
            </div>

            {/* ── Redirect ────────────────────────────────────────────── */}
            <div className="space-y-4">
                <SectionTitle>Redirect</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                        <Label className="text-sm font-semibold">Redirect URL (Optional)</Label>
                        <Input
                            value={value.redirectUrl}
                            disabled={disabled}
                            placeholder="/thank-you or https://example.com/thanks"
                            onChange={(e) => patch({ redirectUrl: e.target.value })}
                            className="mt-2"
                        />
                        {redirectInvalid ? (
                            <ErrorText>
                                Use a relative path (/thank-you) or a full http(s) link.
                            </ErrorText>
                        ) : (
                            <HelpText>
                                Tokens are URL-encoded, so <code>?email={'{{email}}'}</code> works.
                            </HelpText>
                        )}
                    </div>
                    <div>
                        <Label className="text-sm font-semibold">Delay</Label>
                        <div className="mt-2 flex items-center gap-2">
                            <Input
                                type="number"
                                min={0}
                                max={60}
                                value={value.redirectDelaySeconds}
                                disabled={disabled || !value.redirectUrl.trim()}
                                onChange={(e) => {
                                    const parsed = Number.parseInt(e.target.value, 10);
                                    patch({
                                        redirectDelaySeconds: Number.isFinite(parsed)
                                            ? Math.min(Math.max(parsed, 0), 60)
                                            : 0,
                                    });
                                }}
                                className="w-24"
                            />
                            <span className="text-xs text-neutral-500">seconds</span>
                        </div>
                        <HelpText>0 = immediate.</HelpText>
                    </div>
                </div>
            </div>
        </div>
    );

    // ── Preview ──
    const previewTitle = previewTokens(value.successTitle, previewCampaignName);
    const previewMessage = previewTokens(value.successMessage, previewCampaignName);
    const previewContent = value.content.trim()
        ? previewTokens(value.content, previewCampaignName)
        : '';

    const preview = (
        <div className="lg:sticky lg:top-4">
            <SectionTitle>Preview</SectionTitle>
            <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-3 py-2">
                    <span className="size-2 rounded-full bg-neutral-300" />
                    <span className="size-2 rounded-full bg-neutral-300" />
                    <span className="size-2 rounded-full bg-neutral-300" />
                    <span className="ml-2 truncate text-xs text-neutral-500">
                        {previewCampaignName}
                    </span>
                </div>
                <div className="space-y-4 bg-white p-6 text-center">
                    {value.imageUrl.trim() && !imageInvalid && (
                        <img
                            src={value.imageUrl}
                            alt=""
                            className="mx-auto max-h-24 w-auto max-w-full rounded-md object-contain"
                        />
                    )}
                    {PreviewIcon && (
                        <div
                            className={cn(
                                'mx-auto flex size-14 items-center justify-center rounded-full',
                                ACCENT_ICON_CLASS[value.accent]
                            )}
                        >
                            <PreviewIcon className="size-7" weight="bold" />
                        </div>
                    )}
                    {previewTitle && (
                        <p className="text-lg font-bold text-neutral-800">{previewTitle}</p>
                    )}
                    {previewContent ? (
                        <div
                            className="text-sm text-neutral-600 [&_a]:text-primary-500 [&_a]:underline [&_img]:mx-auto [&_img]:max-w-full [&_li]:list-inside [&_ol]:list-decimal [&_ul]:list-disc"
                            // Admin-authored copy, previewed for its own author. The
                            // learner renderer is the one that sanitizes before any
                            // visitor sees it.
                            dangerouslySetInnerHTML={{ __html: previewContent }}
                        />
                    ) : (
                        previewMessage && (
                            <p className="whitespace-pre-line text-sm text-neutral-600">
                                {previewMessage}
                            </p>
                        )
                    )}
                    {value.redirectUrl.trim() && value.redirectDelaySeconds > 0 && (
                        <p className="text-xs text-neutral-400">
                            Redirecting in {value.redirectDelaySeconds} seconds…
                        </p>
                    )}
                    {(value.buttons.length > 0 || value.allowAnotherResponse) && (
                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                            {value.buttons.map((button) => (
                                <span
                                    key={button.id}
                                    className={cn(
                                        'rounded-md px-3 py-1.5 text-xs font-semibold',
                                        button.variant === 'primary'
                                            ? 'bg-primary-500 text-white'
                                            : 'border border-neutral-300 text-neutral-600'
                                    )}
                                >
                                    {button.text.trim() || 'Button'}
                                </span>
                            ))}
                            {value.allowAnotherResponse && (
                                <span className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-600">
                                    {value.anotherResponseText.trim() || 'Submit another response'}
                                </span>
                            )}
                        </div>
                    )}
                    {value.redirectUrl.trim() && value.redirectDelaySeconds === 0 && (
                        <p className="text-xs text-neutral-400">
                            Redirects immediately — respondents will not see this screen.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );

    const body = (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="min-w-0">{controls}</div>
            <div className="min-w-0">{preview}</div>
        </div>
    );

    if (!withCard) return body;

    return (
        <Card className="rounded-sm bg-neutral-50/50 shadow-none">
            <CardHeader className="border-b bg-neutral-100/50 p-4">
                <CardTitle className="text-base font-semibold text-neutral-800">{title}</CardTitle>
                <p className="text-xs text-neutral-500">{description}</p>
            </CardHeader>
            <CardContent className="p-4">{body}</CardContent>
        </Card>
    );
};

export default PostSubmitConfigurationEditor;
