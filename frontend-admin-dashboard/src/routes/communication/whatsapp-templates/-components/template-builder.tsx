import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { cn } from '@/lib/utils';
import { getBackendErrorBody, reportApiError } from '@/lib/report-api-error';
import { createTemplateDraft, updateTemplate, submitToMeta, WhatsAppTemplateDTO, TemplateButton } from '../-services/template-api';
import {
    normalizeTemplateName,
    placeholderIndexes,
    problemFields,
    validateDraft,
    validateForSubmit,
    type TemplateProblem,
} from '../-utils/template-validation';

interface Props {
    template: WhatsAppTemplateDTO | null; // null = creating new
    onClose: () => void;
}

const LANGUAGES = [
    { code: 'en', label: 'English' }, { code: 'en_US', label: 'English (US)' },
    { code: 'hi', label: 'Hindi' }, { code: 'es', label: 'Spanish' },
    { code: 'pt_BR', label: 'Portuguese (BR)' }, { code: 'ar', label: 'Arabic' },
    { code: 'fr', label: 'French' }, { code: 'de', label: 'German' },
    { code: 'id', label: 'Indonesian' }, { code: 'it', label: 'Italian' },
    { code: 'ja', label: 'Japanese' }, { code: 'ko', label: 'Korean' },
    { code: 'zh_CN', label: 'Chinese (Simplified)' },
];

const fieldClass = 'w-full mt-1 px-2 py-1.5 text-sm border rounded';
const buttonFieldClass = 'w-full px-2 py-1 text-xs border rounded';
/** Applied to whichever input the local check or the server pointed at. */
const invalidClass = 'border-danger-400 bg-danger-50 focus:border-danger-500';

export function TemplateBuilder({ template, onClose }: Props) {
    const isEditing = !!template?.id;
    const instituteId = getInstituteId() || '';

    const [name, setName] = useState(template?.name || '');
    const [language, setLanguage] = useState(template?.language || 'en');
    const [category, setCategory] = useState(template?.category || 'MARKETING');
    const [headerType, setHeaderType] = useState(template?.headerType || 'NONE');
    const [headerText, setHeaderText] = useState(template?.headerText || '');
    const [headerSampleUrl, setHeaderSampleUrl] = useState(template?.headerSampleUrl || '');
    const [headerSampleValues, setHeaderSampleValues] = useState<string[]>(
        template?.headerSampleValues || []
    );
    const [bodyText, setBodyText] = useState(template?.bodyText || '');
    const [footerText, setFooterText] = useState(template?.footerText || '');
    const [buttons, setButtons] = useState<TemplateButton[]>(template?.buttons || []);
    const [bodySampleValues, setBodySampleValues] = useState<string[]>(template?.bodySampleValues || []);
    const [bodyVariableNames, setBodyVariableNames] = useState<string[]>(template?.bodyVariableNames || []);
    const [saving, setSaving] = useState(false);
    const [problems, setProblems] = useState<TemplateProblem[]>([]);
    // A submit is create-then-submit. If the submit leg fails, the draft is already saved — hold on
    // to its id so a retry updates that row instead of creating a second one and hitting the
    // duplicate-name 409, which used to strand the admin with an invisible orphan draft.
    const [draftId, setDraftId] = useState<string | undefined>(template?.id);

    const invalidFields = useMemo(() => problemFields(problems), [problems]);
    const isInvalid = (field: string) => invalidFields.has(field);

    // How many distinct variables the body declares: {{1}} … {{N}}. Uses the highest index rather
    // than the match count so a body that repeats {{1}} still asks for exactly one sample.
    const placeholderCount = useMemo(() => {
        const indexes = placeholderIndexes(bodyText);
        return indexes.length ? Math.max(...indexes) : 0;
    }, [bodyText]);

    // Auto-adjust sample values array size
    const adjustedSamples = useMemo(() => {
        const arr = [...bodySampleValues];
        while (arr.length < placeholderCount) arr.push('');
        return arr.slice(0, placeholderCount);
    }, [bodySampleValues, placeholderCount]);

    // Auto-adjust variable names array size
    const adjustedVarNames = useMemo(() => {
        const arr = [...bodyVariableNames];
        while (arr.length < placeholderCount) arr.push('');
        return arr.slice(0, placeholderCount);
    }, [bodyVariableNames, placeholderCount]);

    const insertPlaceholder = () => {
        const nextNum = placeholderCount + 1;
        setBodyText((prev) => prev + `{{${nextNum}}}`);
    };

    const previewBody = useMemo(() => {
        let text = bodyText;
        adjustedSamples.forEach((val, i) => {
            text = text.replace(`{{${i + 1}}}`, val || `[Variable ${i + 1}]`);
        });
        return text;
    }, [bodyText, adjustedSamples]);

    const buildDTO = (): WhatsAppTemplateDTO => ({
        instituteId,
        name: normalizeTemplateName(name.trim()),
        language,
        category,
        headerType,
        headerText: headerType === 'TEXT' ? headerText : undefined,
        headerSampleUrl: headerType !== 'NONE' && headerType !== 'TEXT' ? headerSampleUrl : undefined,
        headerSampleValues:
            headerType === 'TEXT' && headerSampleValues.some((v) => v.trim())
                ? headerSampleValues
                : undefined,
        bodyText,
        footerText: footerText || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
        bodySampleValues: adjustedSamples.length > 0 ? adjustedSamples : undefined,
        bodyVariableNames: adjustedVarNames.some(v => v.trim()) ? adjustedVarNames : undefined,
    });

    /**
     * Put the server's verdict back on the form. The template endpoints return
     * `{ message, hint, field, code }`, so a rejection can highlight the offending input rather than
     * just flashing a toast the admin has to interpret.
     */
    const applyServerProblem = (err: unknown, feature: string, fallbackMessage: string) => {
        const body = getBackendErrorBody(err);
        // reportApiError shows the toast (message + hint) and logs/reports the failure.
        const shown = reportApiError(err, { feature, fallbackMessage });
        setProblems(body?.field ? [{ field: body.field, message: shown }] : []);
    };

    const showLocalProblems = (found: TemplateProblem[]) => {
        setProblems(found);
        toast.error(
            found.length === 1
                ? found[0]!.message
                : `${found.length} things need fixing before this can be saved — see the list above.`
        );
    };

    const handleSaveDraft = async () => {
        const found = validateDraft({ name, category, bodyText });
        if (found.length > 0) { showLocalProblems(found); return; }

        setSaving(true);
        try {
            // Reuse the id from a previous partial attempt so re-saving updates rather than
            // duplicating.
            const saved = draftId
                ? await updateTemplate(draftId, buildDTO())
                : await createTemplateDraft(buildDTO());
            setDraftId(saved.id);
            setProblems([]);
            toast.success('Draft saved');
            onClose();
        } catch (err) {
            applyServerProblem(err, 'whatsapp-template-save', 'Could not save the draft.');
        } finally { setSaving(false); }
    };

    const handleSubmit = async () => {
        const found = validateForSubmit({
            name,
            language,
            category,
            headerType,
            headerText,
            headerSampleUrl,
            headerSampleValues,
            bodyText,
            footerText,
            buttons,
            bodySampleValues: adjustedSamples,
        });
        if (found.length > 0) { showLocalProblems(found); return; }

        setSaving(true);
        // Two calls, two different failures to report. Saving succeeds far more often than the Meta
        // submit does, so they're reported separately — "Meta rejected the body" must never read as
        // "could not save".
        let id = draftId;
        try {
            const saved = id
                ? await updateTemplate(id, buildDTO())
                : await createTemplateDraft(buildDTO());
            id = saved.id;
            setDraftId(id);
        } catch (err) {
            applyServerProblem(err, 'whatsapp-template-save', 'Could not save the template.');
            setSaving(false);
            return;
        }

        try {
            const submitted = await submitToMeta(id!);
            setProblems([]);
            toast.success(
                submitted.status === 'APPROVED'
                    ? 'Template approved by Meta and ready to use.'
                    : 'Template submitted to Meta for approval.'
            );
            onClose();
        } catch (err) {
            // The draft is saved; only the Meta hand-off failed. Say so, or the admin re-enters
            // everything and then collides with their own draft.
            applyServerProblem(
                err,
                'whatsapp-template-submit',
                'Meta rejected the template. Your draft has been saved.'
            );
            toast.info('Your draft is saved — fix the problem above and submit again.');
        } finally { setSaving(false); }
    };

    const addButton = (type: string) => {
        if (buttons.length >= 3) { toast.error('Maximum 3 buttons'); return; }
        setButtons([...buttons, { type, text: '', url: type === 'URL' ? 'https://' : undefined }]);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b bg-white shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 shrink-0"><ArrowLeft size={20} /></button>
                    <h2 className="text-lg font-semibold truncate">{isEditing ? 'Edit Template' : 'Create Template'}</h2>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={handleSaveDraft} disabled={saving}
                        className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
                        Save Draft
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                        {saving ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                </div>
            </div>

            {/* Builder + Preview split. Stacks vertically on mobile. */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
                {/* Builder (left) */}
                <div className="flex-1 md:overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {/* What went wrong. Everything Meta would reject is listed at once so the admin
                        fixes it in one pass instead of discovering problems one submit at a time. */}
                    {problems.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3"
                            role="alert">
                            <WarningCircle size={18} className="mt-0.5 shrink-0 text-danger-600" />
                            <div className="min-w-0 text-sm text-danger-600">
                                <p className="font-medium">
                                    {problems.length === 1
                                        ? 'This template needs a fix'
                                        : `${problems.length} things need fixing`}
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                    {problems.map((p, i) => (
                                        <li key={`${p.field}-${i}`}>{p.message}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Meta info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600">Template Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="order_confirmation"
                                aria-invalid={isInvalid('name')}
                                className={cn(fieldClass, isInvalid('name') && invalidClass)} />
                            <p className="text-[10px] text-gray-400 mt-0.5">Lowercase, underscores only</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Category</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)}
                                className={cn(fieldClass, isInvalid('category') && invalidClass)}>
                                <option value="MARKETING">Marketing</option>
                                <option value="UTILITY">Utility</option>
                                <option value="AUTHENTICATION">Authentication</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)}
                                className={cn(fieldClass, isInvalid('language') && invalidClass)}>
                                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="p-3 border rounded bg-white">
                        <label className="text-xs font-semibold text-gray-600">Header</label>
                        <select value={headerType} onChange={(e) => setHeaderType(e.target.value)}
                            className={cn(fieldClass, isInvalid('headerType') && invalidClass)}>
                            <option value="NONE">None</option>
                            <option value="TEXT">Text</option>
                            <option value="IMAGE">Image</option>
                            <option value="VIDEO">Video</option>
                            <option value="DOCUMENT">Document</option>
                        </select>
                        {headerType === 'TEXT' && (
                            <input type="text" value={headerText} onChange={(e) => setHeaderText(e.target.value)}
                                placeholder="Header text (max 60 chars)" maxLength={60}
                                aria-invalid={isInvalid('headerText')}
                                className={cn(fieldClass, 'mt-2', isInvalid('headerText') && invalidClass)} />
                        )}
                        {/* A header variable is only reviewable by Meta with an example filled in,
                            so the field appears as soon as one is typed. */}
                        {headerType === 'TEXT' && placeholderIndexes(headerText).length > 0 && (
                            <input type="text" value={headerSampleValues[0] || ''}
                                onChange={(e) => setHeaderSampleValues([e.target.value])}
                                placeholder="Sample value for the header variable (e.g. October)"
                                aria-invalid={isInvalid('headerSampleValues')}
                                className={cn(fieldClass, 'mt-2', isInvalid('headerSampleValues') && invalidClass)} />
                        )}
                        {headerType !== 'NONE' && headerType !== 'TEXT' && (
                            <input type="text" value={headerSampleUrl} onChange={(e) => setHeaderSampleUrl(e.target.value)}
                                placeholder={`Sample ${headerType.toLowerCase()} URL (for Meta approval)`}
                                aria-invalid={isInvalid('headerSampleUrl')}
                                className={cn(fieldClass, 'mt-2', isInvalid('headerSampleUrl') && invalidClass)} />
                        )}
                    </div>

                    {/* Body */}
                    <div className="p-3 border rounded bg-white">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-gray-600">Body Text</label>
                            <button onClick={insertPlaceholder}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                                <Plus size={12} /> Add Variable {`{{${placeholderCount + 1}}}`}
                            </button>
                        </div>
                        <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                            placeholder="Hello {{1}}, your order {{2}} is confirmed for {{3}}."
                            aria-invalid={isInvalid('bodyText')}
                            className={cn(fieldClass, 'h-24 resize-y', isInvalid('bodyText') && invalidClass)}
                            maxLength={1024} />
                        <p className="text-[10px] text-gray-400 mt-0.5">{bodyText.length}/1024 characters</p>

                        {/* Variable names + Sample values */}
                        {placeholderCount > 0 && (
                            <div className="mt-2 space-y-1">
                                <p className="text-xs text-gray-500">Variable configuration:</p>
                                {adjustedSamples.map((val, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-xs text-gray-400 w-10 shrink-0 pt-1.5">{`{{${i + 1}}}`}</span>
                                        <div className="flex flex-col sm:flex-row gap-2 flex-1 min-w-0">
                                            <input type="text" value={adjustedVarNames[i] || ''}
                                                onChange={(e) => {
                                                    const arr = [...adjustedVarNames];
                                                    arr[i] = e.target.value;
                                                    setBodyVariableNames(arr);
                                                }}
                                                placeholder="Variable name (e.g. name, course)"
                                                className="flex-1 min-w-0 px-2 py-1 text-xs border rounded" />
                                            <input type="text" value={val}
                                                onChange={(e) => {
                                                    const arr = [...adjustedSamples];
                                                    arr[i] = e.target.value;
                                                    setBodySampleValues(arr);
                                                }}
                                                placeholder="Sample value (e.g. John)"
                                                aria-invalid={isInvalid('bodySampleValues') && !val.trim()}
                                                className={cn(
                                                    'flex-1 min-w-0 px-2 py-1 text-xs border rounded',
                                                    isInvalid('bodySampleValues') && !val.trim() && invalidClass
                                                )} />
                                        </div>
                                    </div>
                                ))}
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Variable names let you use named params in the API: {`{"name": "John"}`} instead of {`{"1": "John"}`}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border rounded bg-white">
                        <label className="text-xs font-semibold text-gray-600">Footer (optional)</label>
                        <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)}
                            placeholder="Thank you for your business!" maxLength={60}
                            aria-invalid={isInvalid('footerText')}
                            className={cn(fieldClass, isInvalid('footerText') && invalidClass)} />
                    </div>

                    {/* Buttons */}
                    <div className="p-3 border rounded bg-white">
                        <label className="text-xs font-semibold text-gray-600">Buttons (max 3)</label>
                        <div className="space-y-2 mt-2">
                            {buttons.map((btn, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                                    <div className="flex-1 space-y-1">
                                        <span className="text-[10px] text-gray-400">{btn.type}</span>
                                        <input type="text" value={btn.text}
                                            onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, text: e.target.value }; setButtons(u); }}
                                            placeholder="Button text" maxLength={25}
                                            aria-invalid={isInvalid(`buttons.${i}.text`)}
                                            className={cn(buttonFieldClass, isInvalid(`buttons.${i}.text`) && invalidClass)} />
                                        {btn.type === 'URL' && (
                                            <input type="text" value={btn.url || ''}
                                                onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, url: e.target.value }; setButtons(u); }}
                                                placeholder="https://example.com/track/{{1}}"
                                                aria-invalid={isInvalid(`buttons.${i}.url`)}
                                                className={cn(buttonFieldClass, isInvalid(`buttons.${i}.url`) && invalidClass)} />
                                        )}
                                        {/* Meta reviews a dynamic link by following a filled-in example, so a
                                            URL with {{1}} is rejected without one. */}
                                        {btn.type === 'URL' && placeholderIndexes(btn.url || '').length > 0 && (
                                            <input type="text" value={btn.example?.[0] || ''}
                                                onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, example: [e.target.value] }; setButtons(u); }}
                                                placeholder="Sample full URL (e.g. https://example.com/track/A123)"
                                                aria-invalid={isInvalid(`buttons.${i}.example`)}
                                                className={cn(buttonFieldClass, isInvalid(`buttons.${i}.example`) && invalidClass)} />
                                        )}
                                        {btn.type === 'PHONE_NUMBER' && (
                                            <input type="text" value={btn.phoneNumber || ''}
                                                onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, phoneNumber: e.target.value }; setButtons(u); }}
                                                placeholder="+919876543210"
                                                aria-invalid={isInvalid(`buttons.${i}.phoneNumber`)}
                                                className={cn(buttonFieldClass, isInvalid(`buttons.${i}.phoneNumber`) && invalidClass)} />
                                        )}
                                    </div>
                                    <button onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                                        className="text-red-400 hover:text-red-600 mt-1"><Trash size={14} /></button>
                                </div>
                            ))}
                        </div>
                        {buttons.length < 3 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                <button onClick={() => addButton('QUICK_REPLY')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ Quick Reply</button>
                                <button onClick={() => addButton('URL')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ URL Button</button>
                                <button onClick={() => addButton('PHONE_NUMBER')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ Phone</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview (right) */}
                <div className="w-full md:w-96 shrink-0 border-t md:border-t-0 md:border-l bg-[#e5ddd5] p-6 md:overflow-y-auto flex items-start justify-center">
                    <div className="w-72 max-w-full">
                        <p className="text-xs text-center text-gray-500 mb-3">WhatsApp Preview</p>
                        <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            {/* Header preview */}
                            {headerType !== 'NONE' && (
                                <div className="bg-gray-100 p-3">
                                    {headerType === 'TEXT' && (
                                        <p className="text-sm font-semibold text-gray-800">{headerText || 'Header text'}</p>
                                    )}
                                    {headerType === 'IMAGE' && (
                                        <div className="h-32 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                            {headerSampleUrl ? <img src={headerSampleUrl} alt="" className="h-full w-full object-cover rounded" /> : '📷 Image'}
                                        </div>
                                    )}
                                    {headerType === 'VIDEO' && (
                                        <div className="h-32 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">🎬 Video</div>
                                    )}
                                    {headerType === 'DOCUMENT' && (
                                        <div className="h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">📄 Document</div>
                                    )}
                                </div>
                            )}

                            {/* Body preview */}
                            <div className="p-3">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewBody || 'Your message body will appear here...'}</p>
                            </div>

                            {/* Footer preview */}
                            {footerText && (
                                <div className="px-3 pb-2">
                                    <p className="text-xs text-gray-400">{footerText}</p>
                                </div>
                            )}

                            {/* Buttons preview */}
                            {buttons.length > 0 && (
                                <div className="border-t">
                                    {buttons.map((btn, i) => (
                                        <div key={i} className="border-b last:border-0 py-2 text-center">
                                            <span className="text-sm text-blue-500 font-medium">
                                                {btn.type === 'URL' && '🔗 '}
                                                {btn.type === 'PHONE_NUMBER' && '📞 '}
                                                {btn.text || `Button ${i + 1}`}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Timestamp */}
                            <div className="px-3 pb-2 text-right">
                                <span className="text-[10px] text-gray-400">
                                    {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} ✓✓
                                </span>
                            </div>
                        </div>

                        {/* Info */}
                        <div className="mt-3 p-2 bg-white/80 rounded text-[10px] text-gray-500 space-y-0.5">
                            <p><strong>Category:</strong> {category}</p>
                            <p><strong>Language:</strong> {language}</p>
                            <p><strong>Placeholders:</strong> {placeholderCount}</p>
                            <p><strong>Buttons:</strong> {buttons.length}/3</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
