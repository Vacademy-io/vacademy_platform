import { useState, useMemo } from 'react';
import { ArrowLeft, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import { createTemplateDraft, updateTemplate, submitToMeta, WhatsAppTemplateDTO, TemplateButton } from '../-services/template-api';

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

export function TemplateBuilder({ template, onClose }: Props) {
    const isEditing = !!template?.id;
    const instituteId = getInstituteId() || '';

    const [name, setName] = useState(template?.name || '');
    const [language, setLanguage] = useState(template?.language || 'en');
    const [category, setCategory] = useState(template?.category || 'MARKETING');
    const [headerType, setHeaderType] = useState(template?.headerType || 'NONE');
    const [headerText, setHeaderText] = useState(template?.headerText || '');
    const [headerSampleUrl, setHeaderSampleUrl] = useState(template?.headerSampleUrl || '');
    const [bodyText, setBodyText] = useState(template?.bodyText || '');
    const [footerText, setFooterText] = useState(template?.footerText || '');
    const [buttons, setButtons] = useState<TemplateButton[]>(template?.buttons || []);
    const [bodySampleValues, setBodySampleValues] = useState<string[]>(template?.bodySampleValues || []);
    const [saving, setSaving] = useState(false);

    // Count placeholders in body
    const placeholderCount = useMemo(() => {
        const matches = bodyText.match(/\{\{\d+}}/g);
        return matches ? matches.length : 0;
    }, [bodyText]);

    // Auto-adjust sample values array size
    const adjustedSamples = useMemo(() => {
        const arr = [...bodySampleValues];
        while (arr.length < placeholderCount) arr.push('');
        return arr.slice(0, placeholderCount);
    }, [bodySampleValues, placeholderCount]);

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
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        language,
        category,
        headerType,
        headerText: headerType === 'TEXT' ? headerText : undefined,
        headerSampleUrl: headerType !== 'NONE' && headerType !== 'TEXT' ? headerSampleUrl : undefined,
        bodyText,
        footerText: footerText || undefined,
        buttons: buttons.length > 0 ? buttons : undefined,
        bodySampleValues: adjustedSamples.length > 0 ? adjustedSamples : undefined,
    });

    const handleSaveDraft = async () => {
        if (!name || !bodyText) { toast.error('Name and body text are required'); return; }
        setSaving(true);
        try {
            if (isEditing) {
                await updateTemplate(template!.id!, buildDTO());
            } else {
                await createTemplateDraft(buildDTO());
            }
            toast.success('Draft saved');
            onClose();
        } catch (err) {
            toast.error('Failed to save');
        } finally { setSaving(false); }
    };

    const handleSubmit = async () => {
        if (!name || !bodyText) { toast.error('Name and body text are required'); return; }
        if (placeholderCount > 0 && adjustedSamples.some((s) => !s.trim())) {
            toast.error('Fill all sample values (required by Meta for approval)');
            return;
        }
        setSaving(true);
        try {
            let id = template?.id;
            if (isEditing) {
                await updateTemplate(id!, buildDTO());
            } else {
                const created = await createTemplateDraft(buildDTO());
                id = created.id;
            }
            await submitToMeta(id!);
            toast.success('Template submitted to Meta for approval!');
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg || 'Submit failed');
        } finally { setSaving(false); }
    };

    const addButton = (type: string) => {
        if (buttons.length >= 3) { toast.error('Maximum 3 buttons'); return; }
        setButtons([...buttons, { type, text: '', url: type === 'URL' ? 'https://' : undefined }]);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><ArrowLeft size={20} /></button>
                    <h2 className="text-lg font-semibold">{isEditing ? 'Edit Template' : 'Create Template'}</h2>
                </div>
                <div className="flex gap-2">
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

            {/* Builder + Preview split */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Builder (left) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {/* Meta info */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600">Template Name</label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="order_confirmation"
                                className="w-full mt-1 px-2 py-1.5 text-sm border rounded" />
                            <p className="text-[10px] text-gray-400 mt-0.5">Lowercase, underscores only</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Category</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)}
                                className="w-full mt-1 px-2 py-1.5 text-sm border rounded">
                                <option value="MARKETING">Marketing</option>
                                <option value="UTILITY">Utility</option>
                                <option value="AUTHENTICATION">Authentication</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600">Language</label>
                            <select value={language} onChange={(e) => setLanguage(e.target.value)}
                                className="w-full mt-1 px-2 py-1.5 text-sm border rounded">
                                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Header */}
                    <div className="p-3 border rounded bg-white">
                        <label className="text-xs font-semibold text-gray-600">Header</label>
                        <select value={headerType} onChange={(e) => setHeaderType(e.target.value)}
                            className="w-full mt-1 px-2 py-1.5 text-sm border rounded">
                            <option value="NONE">None</option>
                            <option value="TEXT">Text</option>
                            <option value="IMAGE">Image</option>
                            <option value="VIDEO">Video</option>
                            <option value="DOCUMENT">Document</option>
                        </select>
                        {headerType === 'TEXT' && (
                            <input type="text" value={headerText} onChange={(e) => setHeaderText(e.target.value)}
                                placeholder="Header text (max 60 chars)" maxLength={60}
                                className="w-full mt-2 px-2 py-1.5 text-sm border rounded" />
                        )}
                        {headerType !== 'NONE' && headerType !== 'TEXT' && (
                            <input type="text" value={headerSampleUrl} onChange={(e) => setHeaderSampleUrl(e.target.value)}
                                placeholder={`Sample ${headerType.toLowerCase()} URL (for Meta approval)`}
                                className="w-full mt-2 px-2 py-1.5 text-sm border rounded" />
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
                            className="w-full mt-1 px-2 py-1.5 text-sm border rounded h-24 resize-y"
                            maxLength={1024} />
                        <p className="text-[10px] text-gray-400 mt-0.5">{bodyText.length}/1024 characters</p>

                        {/* Sample values */}
                        {placeholderCount > 0 && (
                            <div className="mt-2 space-y-1">
                                <p className="text-xs text-gray-500">Sample values (required by Meta for approval):</p>
                                {adjustedSamples.map((val, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400 w-10">{`{{${i + 1}}}`}</span>
                                        <input type="text" value={val}
                                            onChange={(e) => {
                                                const arr = [...adjustedSamples];
                                                arr[i] = e.target.value;
                                                setBodySampleValues(arr);
                                            }}
                                            placeholder="Sample value"
                                            className="flex-1 px-2 py-1 text-xs border rounded" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border rounded bg-white">
                        <label className="text-xs font-semibold text-gray-600">Footer (optional)</label>
                        <input type="text" value={footerText} onChange={(e) => setFooterText(e.target.value)}
                            placeholder="Thank you for your business!" maxLength={60}
                            className="w-full mt-1 px-2 py-1.5 text-sm border rounded" />
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
                                            placeholder="Button text" className="w-full px-2 py-1 text-xs border rounded" />
                                        {btn.type === 'URL' && (
                                            <input type="text" value={btn.url || ''}
                                                onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, url: e.target.value }; setButtons(u); }}
                                                placeholder="https://example.com/track/{{1}}" className="w-full px-2 py-1 text-xs border rounded" />
                                        )}
                                        {btn.type === 'PHONE_NUMBER' && (
                                            <input type="text" value={btn.phoneNumber || ''}
                                                onChange={(e) => { const u = [...buttons]; u[i] = { ...btn, phoneNumber: e.target.value }; setButtons(u); }}
                                                placeholder="+919876543210" className="w-full px-2 py-1 text-xs border rounded" />
                                        )}
                                    </div>
                                    <button onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                                        className="text-red-400 hover:text-red-600 mt-1"><Trash size={14} /></button>
                                </div>
                            ))}
                        </div>
                        {buttons.length < 3 && (
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => addButton('QUICK_REPLY')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ Quick Reply</button>
                                <button onClick={() => addButton('URL')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ URL Button</button>
                                <button onClick={() => addButton('PHONE_NUMBER')} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">+ Phone</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Preview (right) */}
                <div className="w-96 shrink-0 border-l bg-[#e5ddd5] p-6 overflow-y-auto flex items-start justify-center">
                    <div className="w-72">
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
