import { useState, useCallback, useEffect } from 'react';
import { PaperPlaneRight, FileText, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { sendReply } from '../-services/inbox-api';
import { useInboxStore } from '../-stores/inbox-store';
import { getInstituteId } from '@/constants/helper';
import { sendNotification } from '@/services/unified-send-service';
import { listTemplates, type WhatsAppTemplateDTO } from '@/routes/communication/whatsapp-templates/-services/template-api';

interface Props {
    phone: string;
}

export function ReplyBox({ phone }: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState<WhatsAppTemplateDTO[]>([]);
    const [templateSearch, setTemplateSearch] = useState('');
    const appendMessage = useInboxStore((s) => s.appendMessage);
    const updateConversationLastMessage = useInboxStore((s) => s.updateConversationLastMessage);
    const instituteId = getInstituteId() || '';

    // Load templates when panel opens
    useEffect(() => {
        if (showTemplates && templates.length === 0) {
            listTemplates(instituteId)
                .then((data) => setTemplates(data.filter((t) => t.status === 'APPROVED')))
                .catch(() => toast.error('Failed to load templates'));
        }
    }, [showTemplates]);

    const handleSend = useCallback(async () => {
        if (!text.trim() || sending) return;

        setSending(true);
        try {
            const sent = await sendReply(phone, text.trim(), instituteId);
            appendMessage(sent);
            updateConversationLastMessage(phone, text.trim(), 'OUTGOING');
            setText('');
        } catch (err) {
            console.error(err);
            toast.error('Failed to send message. Session may have expired (24hr window).');
        } finally {
            setSending(false);
        }
    }, [text, phone, sending, appendMessage, updateConversationLastMessage, instituteId]);

    const handleSendTemplate = useCallback(async (template: WhatsAppTemplateDTO) => {
        setSending(true);
        try {
            // Build variables: use sample values, variable names, or count from body text
            const variables: Record<string, string> = {};
            if (template.bodySampleValues && template.bodySampleValues.length > 0) {
                template.bodySampleValues.forEach((val, i) => {
                    variables[String(i + 1)] = val;
                });
            } else if (template.bodyVariableNames && template.bodyVariableNames.length > 0) {
                template.bodyVariableNames.forEach((name, i) => {
                    variables[String(i + 1)] = name;
                });
            } else if (template.bodyText) {
                // Count {{N}} placeholders in body text and fill with empty strings
                const matches = template.bodyText.match(/\{\{\d+\}\}/g);
                if (matches) {
                    matches.forEach((_, i) => {
                        variables[String(i + 1)] = '';
                    });
                }
            }

            // If template has params but all are empty, warn user
            const paramCount = Object.keys(variables).length;
            const hasEmptyParams = paramCount > 0 && Object.values(variables).every(v => !v);
            if (hasEmptyParams) {
                const userInput = prompt(
                    `Template "${template.name}" requires ${paramCount} parameter(s).\nEnter values (comma-separated):`
                );
                if (userInput === null) { setSending(false); return; } // cancelled
                const parts = userInput.split(',').map(s => s.trim());
                parts.forEach((val, i) => {
                    if (i < paramCount) variables[String(i + 1)] = val || '';
                });
            }

            const response = await sendNotification({
                instituteId,
                channel: 'WHATSAPP',
                templateName: template.name,
                languageCode: template.language || 'en',
                recipients: [{ phone, variables }],
                options: { source: 'inbox-template-send' },
            });

            if (response.status === 'COMPLETED' && response.accepted > 0) {
                toast.success(`Template "${template.name}" sent`);
                // Add to message list
                appendMessage({
                    id: Date.now().toString(),
                    body: `[Template: ${template.name}] ${template.bodyText || ''}`,
                    direction: 'OUTGOING',
                    timestamp: new Date().toISOString(),
                    source: 'unified-send',
                });
                updateConversationLastMessage(phone, `[Template] ${template.name}`, 'OUTGOING');
                setShowTemplates(false);
            } else {
                toast.error(`Failed to send template: ${response.results?.[0]?.error || 'Unknown error'}`);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to send template');
        } finally {
            setSending(false);
        }
    }, [phone, instituteId, appendMessage, updateConversationLastMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const filteredTemplates = templates.filter(
        (t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
               (t.bodyText || '').toLowerCase().includes(templateSearch.toLowerCase())
    );

    return (
        <div className="relative shrink-0">
            {/* Template picker dropdown */}
            {showTemplates && (
                <div className="absolute bottom-full left-0 right-0 bg-white border-t shadow-lg max-h-72 flex flex-col">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                        <span className="text-xs font-semibold text-gray-600">Send Template (outside 24hr window)</span>
                        <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-gray-100 rounded">
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-3 py-1.5">
                        <input
                            type="text"
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            placeholder="Search templates..."
                            className="w-full px-2 py-1 text-xs border rounded"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredTemplates.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">No approved templates found</p>
                        ) : (
                            filteredTemplates.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => handleSendTemplate(t)}
                                    disabled={sending}
                                    className="w-full text-left px-3 py-2 hover:bg-green-50 border-b border-gray-50 disabled:opacity-50"
                                >
                                    <p className="text-xs font-medium text-gray-800">{t.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{t.bodyText}</p>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Reply bar */}
            <div className="px-4 py-3 bg-white border-t flex items-end gap-2">
                <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg shrink-0"
                    title="Send template (for messages outside 24hr window)"
                >
                    <FileText size={20} />
                </button>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-green-400 max-h-24"
                    style={{ minHeight: '40px' }}
                />
                <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                    <PaperPlaneRight size={18} weight="fill" />
                </button>
            </div>
        </div>
    );
}
