import { useEffect, useState, useCallback } from 'react';
import { useChatbotFlowStore } from '../-stores/chatbot-flow-store';
import { NODE_TYPE_REGISTRY } from '@/types/chatbot-flow/chatbot-flow-types';
import { fetchWhatsAppTemplates, WhatsAppTemplateInfo } from '../-services/chatbot-flow-api';
import { getInstituteId } from '@/constants/helper';
import { Plus, Trash, CaretUp, CaretDown } from '@phosphor-icons/react';

export function NodeConfigPanel() {
    const selectedNodeId = useChatbotFlowStore((s) => s.selectedNodeId);
    const nodes = useChatbotFlowStore((s) => s.nodes);
    const updateNodeConfig = useChatbotFlowStore((s) => s.updateNodeConfig);
    const updateNodeName = useChatbotFlowStore((s) => s.updateNodeName);

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) {
        return (
            <div className="w-80 shrink-0 border-l bg-gray-50 p-4 flex items-center justify-center">
                <p className="text-sm text-gray-400">Select a node to configure</p>
            </div>
        );
    }

    const { nodeType, name, config, color } = selectedNode.data;
    const info = NODE_TYPE_REGISTRY.find((n) => n.type === nodeType);

    const handleConfigChange = (keyOrBatch: string | Record<string, unknown>, value?: unknown) => {
        if (typeof keyOrBatch === 'string') {
            updateNodeConfig(selectedNodeId!, { ...config, [keyOrBatch]: value });
        } else {
            // Batch update: merge all keys at once
            updateNodeConfig(selectedNodeId!, { ...config, ...keyOrBatch });
        }
    };

    return (
        <div className="w-80 shrink-0 border-l bg-gray-50 overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b" style={{ backgroundColor: `${color}10` }}>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{info?.icon}</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        {nodeType.replaceAll('_', ' ')}
                    </span>
                </div>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => updateNodeName(selectedNodeId!, e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border rounded bg-white"
                    placeholder="Node name"
                />
            </div>

            {/* Config form */}
            <div className="p-4 space-y-4">
                {nodeType === 'TRIGGER' && <TriggerConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'SEND_MESSAGE' && <SendMessageConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'SEND_TEMPLATE' && <SendTemplateConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'SEND_INTERACTIVE' && <SendInteractiveConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'CONDITION' && <ConditionConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'DELAY' && <DelayConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'WORKFLOW_ACTION' && <WorkflowConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'HTTP_WEBHOOK' && <WebhookConfig config={config} onChange={handleConfigChange} />}
                {nodeType === 'AI_RESPONSE' && <AiResponseConfig config={config} onChange={handleConfigChange} />}
            </div>
        </div>
    );
}

// ==================== Section Label ====================
function SectionLabel({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">{children}</label>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-medium text-gray-600 mt-2">{children}</label>;
}

// ==================== TRIGGER ====================
function TriggerConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    return (
        <>
            <SectionLabel>Trigger Settings</SectionLabel>
            <FieldLabel>Trigger Type</FieldLabel>
            <select value={(config.triggerType as string) || 'KEYWORD_MATCH'} onChange={(e) => onChange('triggerType', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="KEYWORD_MATCH">Keyword Match</option>
                <option value="FIRST_CONTACT">First Contact (new user)</option>
                <option value="BUTTON_REPLY">Button Reply</option>
            </select>

            {config.triggerType !== 'FIRST_CONTACT' && (
                <>
                    <FieldLabel>Keywords (comma-separated)</FieldLabel>
                    <input type="text" value={((config.keywords as string[]) || []).join(', ')} onChange={(e) => onChange('keywords', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="hello, hi, start" />

                    <FieldLabel>Match Type</FieldLabel>
                    <select value={(config.matchType as string) || 'contains'} onChange={(e) => onChange('matchType', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                        <option value="exact">Exact match</option>
                        <option value="contains">Contains</option>
                        <option value="regex">Regex pattern</option>
                    </select>
                </>
            )}

            <FieldLabel>Priority (higher = checked first)</FieldLabel>
            <input type="number" value={(config.priority as number) || 10} onChange={(e) => onChange('priority', parseInt(e.target.value) || 10)} className="w-full px-2 py-1.5 text-sm border rounded" min={1} max={100} />
        </>
    );
}

// ==================== SEND_MESSAGE (free-form, no template needed) ====================
function SendMessageConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    const msgType = (config.messageType as string) || 'text';

    return (
        <>
            <SectionLabel>Session Message</SectionLabel>
            <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                No template needed — sends directly within the 24hr session window.
            </div>

            <FieldLabel>Message Type</FieldLabel>
            <select value={msgType} onChange={(e) => onChange('messageType', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="text">Text Message</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="document">Document (PDF, etc.)</option>
                <option value="audio">Audio</option>
            </select>

            {msgType === 'text' ? (
                <>
                    <FieldLabel>Message Text</FieldLabel>
                    <textarea
                        value={(config.text as string) || ''}
                        onChange={(e) => onChange('text', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded h-24 resize-y"
                        placeholder={"Hello {{user.name}}! 👋\n\nWelcome to our service. How can I help you today?"}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Supports WhatsApp formatting: *bold*, _italic_, ~strikethrough~, ```code```
                    </p>
                    <p className="text-xs text-gray-400">
                        Use {'{{variable}}'} for dynamic values: {'{{user.name}}'}, {'{{phone}}'}, {'{{session.varName}}'}
                    </p>
                </>
            ) : (
                <>
                    <FieldLabel>Media URL</FieldLabel>
                    <input
                        type="text"
                        value={(config.mediaUrl as string) || ''}
                        onChange={(e) => onChange('mediaUrl', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded"
                        placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Must be a publicly accessible HTTPS URL. Use {'{{variable}}'} for dynamic URLs.
                    </p>

                    {msgType !== 'audio' && (
                        <>
                            <FieldLabel>Caption (optional)</FieldLabel>
                            <input
                                type="text"
                                value={(config.mediaCaption as string) || ''}
                                onChange={(e) => onChange('mediaCaption', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border rounded"
                                placeholder="Check out this image!"
                            />
                        </>
                    )}

                    {msgType === 'document' && (
                        <>
                            <FieldLabel>Filename</FieldLabel>
                            <input
                                type="text"
                                value={(config.filename as string) || ''}
                                onChange={(e) => onChange('filename', e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border rounded"
                                placeholder="brochure.pdf"
                            />
                        </>
                    )}
                </>
            )}
        </>
    );
}

// ==================== SEND_TEMPLATE (with picker) ====================
function SendTemplateConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    const [templates, setTemplates] = useState<WhatsAppTemplateInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const loadTemplates = useCallback(async () => {
        setLoading(true);
        try {
            const instituteId = getInstituteId() || '';
            const data = await fetchWhatsAppTemplates(instituteId);
            setTemplates(data);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTemplates(); }, [loadTemplates]);

    const selectedTemplate = templates.find((t) => t.name === config.templateName);
    const filteredTemplates = templates.filter((t) =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectTemplate = (tmpl: WhatsAppTemplateInfo) => {
        // Build entire config update at once to avoid stale closure issues
        const bodyParams: Array<{ index: number; value: string }> = [];
        for (let i = 1; i <= tmpl.bodyParamCount; i++) {
            bodyParams.push({ index: i, value: '' });
        }

        const headerConfig = (tmpl.headerType !== 'none' && tmpl.headerType !== 'text')
            ? { type: tmpl.headerType, url: '', filename: '' }
            : { type: 'none' };

        let buttonConfig: Array<Record<string, unknown>> = [];
        if (tmpl.buttons && tmpl.buttons.length > 0) {
            buttonConfig = tmpl.buttons
                .filter((b) => b.hasDynamicUrl || b.type === 'QUICK_REPLY')
                .map((b, i) => ({
                    type: b.hasDynamicUrl ? 'url' : 'quick_reply',
                    index: i, urlSuffix: '', payload: '', text: b.text,
                }));
        }

        // Single batch update — avoids stale closure
        onChange({
            templateName: tmpl.name,
            languageCode: tmpl.language || 'en',
            bodyParams,
            headerConfig,
            buttonConfig,
        });
    };

    // Current body params
    const bodyParams = (config.bodyParams as Array<{ index: number; value: string }>) || [];
    const headerConfig = (config.headerConfig as Record<string, string>) || { type: 'none' };
    const buttonConfig = (config.buttonConfig as Array<Record<string, unknown>>) || [];

    return (
        <>
            <SectionLabel>Template</SectionLabel>

            {/* Template picker */}
            <FieldLabel>Search & Select Template</FieldLabel>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Search templates..." />

            {loading ? (
                <p className="text-xs text-gray-400 py-2">Loading templates...</p>
            ) : (
                <div className="max-h-40 overflow-y-auto border rounded mt-1">
                    {filteredTemplates.length === 0 ? (
                        <p className="text-xs text-gray-400 p-2">No templates found. Type name manually below.</p>
                    ) : (
                        filteredTemplates.map((t) => (
                            <button key={`${t.name}-${t.language}`} onClick={() => handleSelectTemplate(t)} className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 border-b last:border-0 ${t.name === config.templateName ? 'bg-blue-50 font-medium' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <span className="truncate">{t.name}</span>
                                    <span className="text-gray-400 ml-1">{t.language}</span>
                                </div>
                                {t.bodyText && <p className="text-gray-400 truncate mt-0.5">{t.bodyText.substring(0, 60)}...</p>}
                            </button>
                        ))
                    )}
                </div>
            )}

            <FieldLabel>Template Name</FieldLabel>
            <input type="text" value={(config.templateName as string) || ''} onChange={(e) => onChange('templateName', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="welcome_message" />

            <FieldLabel>Language</FieldLabel>
            <input type="text" value={(config.languageCode as string) || 'en'} onChange={(e) => onChange('languageCode', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="en" />

            {/* Template preview */}
            {selectedTemplate && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                    <p className="font-medium text-green-800">Preview</p>
                    {selectedTemplate.headerType !== 'none' && (
                        <p className="text-green-600">Header: [{selectedTemplate.headerType.toUpperCase()}]</p>
                    )}
                    {selectedTemplate.bodyText && <p className="text-green-700 mt-1 whitespace-pre-wrap">{selectedTemplate.bodyText}</p>}
                    {selectedTemplate.footerText && <p className="text-green-500 mt-1 italic">{selectedTemplate.footerText}</p>}
                    {selectedTemplate.buttons && (
                        <div className="mt-1 space-y-0.5">
                            {selectedTemplate.buttons.map((b, i) => (
                                <span key={i} className="inline-block mr-1 px-2 py-0.5 bg-green-200 rounded text-green-800">{b.text}</span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Header config */}
            {headerConfig.type !== 'none' && (
                <>
                    <SectionLabel>Header ({headerConfig.type})</SectionLabel>
                    <FieldLabel>{headerConfig.type === 'document' ? 'Document URL' : `${headerConfig.type} URL`}</FieldLabel>
                    <input type="text" value={headerConfig.url || ''} onChange={(e) => onChange('headerConfig', { ...headerConfig, url: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="https://..." />
                    {headerConfig.type === 'document' && (
                        <>
                            <FieldLabel>Filename</FieldLabel>
                            <input type="text" value={headerConfig.filename || ''} onChange={(e) => onChange('headerConfig', { ...headerConfig, filename: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="brochure.pdf" />
                        </>
                    )}
                </>
            )}

            {/* Body params */}
            {bodyParams.length > 0 && (
                <>
                    <SectionLabel>Body Parameters</SectionLabel>
                    <p className="text-xs text-gray-400">Use {'{{variable}}'} syntax or type static values</p>
                    {bodyParams.map((p, i) => (
                        <div key={i} className="flex items-center gap-1 mt-1">
                            <span className="text-xs text-gray-500 w-8">{`{{${p.index}}}`}</span>
                            <input type="text" value={p.value} onChange={(e) => {
                                const updated = [...bodyParams];
                                updated[i] = { ...p, value: e.target.value };
                                onChange('bodyParams', updated);
                            }} className="flex-1 px-2 py-1 text-sm border rounded" placeholder="{{user.name}} or static text" />
                        </div>
                    ))}
                    <button onClick={() => onChange('bodyParams', [...bodyParams, { index: bodyParams.length + 1, value: '' }])} className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1">
                        <Plus size={12} /> Add parameter
                    </button>
                </>
            )}

            {/* Button config */}
            {buttonConfig.length > 0 && (
                <>
                    <SectionLabel>Button Parameters</SectionLabel>
                    {buttonConfig.map((btn, i) => (
                        <div key={i} className="p-2 border rounded mt-1 bg-white">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-medium">{(btn.text as string) || `Button ${i}`}</span>
                                <span className="text-xs text-gray-400">{btn.type as string}</span>
                            </div>
                            {btn.type === 'url' && (
                                <>
                                    <FieldLabel>URL suffix</FieldLabel>
                                    <input type="text" value={(btn.urlSuffix as string) || ''} onChange={(e) => {
                                        const updated = [...buttonConfig];
                                        updated[i] = { ...btn, urlSuffix: e.target.value };
                                        onChange('buttonConfig', updated);
                                    }} className="w-full px-2 py-1 text-sm border rounded" placeholder="{{user.trackingId}}" />
                                </>
                            )}
                            {btn.type === 'quick_reply' && (
                                <>
                                    <FieldLabel>Payload</FieldLabel>
                                    <input type="text" value={(btn.payload as string) || ''} onChange={(e) => {
                                        const updated = [...buttonConfig];
                                        updated[i] = { ...btn, payload: e.target.value };
                                        onChange('buttonConfig', updated);
                                    }} className="w-full px-2 py-1 text-sm border rounded" placeholder="INTERESTED_YES" />
                                </>
                            )}
                        </div>
                    ))}
                </>
            )}
        </>
    );
}

// ==================== SEND_INTERACTIVE ====================
function SendInteractiveConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    const interactiveType = (config.interactiveType as string) || 'button';
    const buttons = (config.buttons as Array<{ id: string; title: string }>) || [];
    const sections = (config.sections as Array<{ title: string; rows: Array<{ id: string; title: string; description: string }> }>) || [];

    return (
        <>
            <SectionLabel>Interactive Message</SectionLabel>
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                Requires 24hr session window. Configure a fallback template below.
            </div>

            <FieldLabel>Type</FieldLabel>
            <select value={interactiveType} onChange={(e) => onChange('interactiveType', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="button">Reply Buttons (max 3)</option>
                <option value="list">List Menu</option>
            </select>

            <FieldLabel>Body Text</FieldLabel>
            <textarea value={(config.body as string) || ''} onChange={(e) => onChange('body', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded h-16 resize-none" placeholder="Please select an option..." />

            <FieldLabel>Footer (optional)</FieldLabel>
            <input type="text" value={(config.footer as string) || ''} onChange={(e) => onChange('footer', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Powered by..." />

            {interactiveType === 'button' && (
                <>
                    <SectionLabel>Buttons</SectionLabel>
                    {buttons.map((btn, i) => (
                        <div key={i} className="flex items-center gap-1 mt-1">
                            <input type="text" value={btn.id} onChange={(e) => {
                                const updated = [...buttons];
                                updated[i] = { ...btn, id: e.target.value };
                                onChange('buttons', updated);
                            }} className="w-20 px-2 py-1 text-xs border rounded" placeholder="btn_id" />
                            <input type="text" value={btn.title} onChange={(e) => {
                                const updated = [...buttons];
                                updated[i] = { ...btn, title: e.target.value };
                                onChange('buttons', updated);
                            }} className="flex-1 px-2 py-1 text-xs border rounded" placeholder="Button Title" />
                            <button onClick={() => onChange('buttons', buttons.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash size={14} /></button>
                        </div>
                    ))}
                    {buttons.length < 3 && (
                        <button onClick={() => onChange('buttons', [...buttons, { id: `btn_${buttons.length + 1}`, title: '' }])} className="text-xs text-blue-600 hover:text-blue-800 mt-1 flex items-center gap-1">
                            <Plus size={12} /> Add Button
                        </button>
                    )}
                </>
            )}

            {interactiveType === 'list' && (
                <>
                    <FieldLabel>Menu Button Text</FieldLabel>
                    <input type="text" value={(config.listButtonText as string) || 'Select'} onChange={(e) => onChange('listButtonText', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="View Options" />

                    <SectionLabel>Sections</SectionLabel>
                    {sections.map((section, si) => (
                        <div key={si} className="border rounded p-2 mt-1 bg-white">
                            <div className="flex justify-between items-center">
                                <input type="text" value={section.title} onChange={(e) => {
                                    const updated = [...sections];
                                    updated[si] = { ...section, title: e.target.value };
                                    onChange('sections', updated);
                                }} className="flex-1 px-2 py-1 text-xs font-medium border rounded" placeholder="Section Title" />
                                <button onClick={() => onChange('sections', sections.filter((_, j) => j !== si))} className="ml-1 text-red-400 hover:text-red-600"><Trash size={14} /></button>
                            </div>
                            {section.rows.map((row, ri) => (
                                <div key={ri} className="flex items-center gap-1 mt-1 ml-2">
                                    <input type="text" value={row.title} onChange={(e) => {
                                        const updatedSections = [...sections];
                                        const updatedRows = [...section.rows];
                                        updatedRows[ri] = { ...row, title: e.target.value };
                                        updatedSections[si] = { ...section, rows: updatedRows };
                                        onChange('sections', updatedSections);
                                    }} className="flex-1 px-2 py-0.5 text-xs border rounded" placeholder="Row Title" />
                                    <button onClick={() => {
                                        const updatedSections = [...sections];
                                        updatedSections[si] = { ...section, rows: section.rows.filter((_, j) => j !== ri) };
                                        onChange('sections', updatedSections);
                                    }} className="text-red-400"><Trash size={12} /></button>
                                </div>
                            ))}
                            <button onClick={() => {
                                const updatedSections = [...sections];
                                updatedSections[si] = { ...section, rows: [...section.rows, { id: `row_${Date.now()}`, title: '', description: '' }] };
                                onChange('sections', updatedSections);
                            }} className="text-xs text-blue-600 mt-1 ml-2 flex items-center gap-1">
                                <Plus size={10} /> Add Row
                            </button>
                        </div>
                    ))}
                    <button onClick={() => onChange('sections', [...sections, { title: '', rows: [] }])} className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Plus size={12} /> Add Section
                    </button>
                </>
            )}

            <FieldLabel>Fallback Template (if 24hr window expired)</FieldLabel>
            <input type="text" value={(config.fallbackTemplateName as string) || ''} onChange={(e) => onChange('fallbackTemplateName', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="fallback_template_name" />
        </>
    );
}

// ==================== CONDITION ====================
function ConditionConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    const branches = (config.branches as Array<{ id: string; label: string; matchType: string; matchValue: string; isDefault?: boolean }>) || [];

    const addBranch = () => {
        const newBranch = { id: `branch_${Date.now()}`, label: '', matchType: 'contains', matchValue: '', isDefault: false };
        onChange('branches', [...branches, newBranch]);
    };

    const updateBranch = (index: number, field: string, value: unknown) => {
        const updated = [...branches];
        updated[index] = { ...updated[index], [field]: value } as any;
        onChange('branches', updated);
    };

    const removeBranch = (index: number) => {
        onChange('branches', branches.filter((_, i) => i !== index));
    };

    const moveBranch = (index: number, direction: -1 | 1) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= branches.length) return;
        const updated = [...branches];
        const temp = updated[index]!;
        updated[index] = updated[newIndex]!;
        updated[newIndex] = temp;
        onChange('branches', updated);
    };

    return (
        <>
            <SectionLabel>Condition Branches</SectionLabel>
            <p className="text-xs text-gray-400">Each branch creates an outgoing edge. Connect them to the next nodes on the canvas.</p>

            <FieldLabel>Condition Type</FieldLabel>
            <select value={(config.conditionType as string) || 'USER_RESPONSE'} onChange={(e) => onChange('conditionType', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="USER_RESPONSE">User Text Response</option>
                <option value="BUTTON_REPLY">Interactive Button Reply</option>
                <option value="LIST_REPLY">List Selection Reply</option>
            </select>

            <div className="space-y-2 mt-2">
                {branches.map((branch, i) => (
                    <div key={branch.id} className={`p-2 border rounded ${branch.isDefault ? 'border-yellow-300 bg-yellow-50' : 'bg-white'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <input type="text" value={branch.label} onChange={(e) => updateBranch(i, 'label', e.target.value)} className="flex-1 px-2 py-0.5 text-xs font-medium border rounded" placeholder="Branch label" />
                            <div className="flex items-center gap-0.5 ml-1">
                                <button onClick={() => moveBranch(i, -1)} className="text-gray-400 hover:text-gray-600"><CaretUp size={12} /></button>
                                <button onClick={() => moveBranch(i, 1)} className="text-gray-400 hover:text-gray-600"><CaretDown size={12} /></button>
                                <button onClick={() => removeBranch(i)} className="text-red-400 hover:text-red-600"><Trash size={12} /></button>
                            </div>
                        </div>

                        <label className="flex items-center gap-1 text-xs mb-1">
                            <input type="checkbox" checked={branch.isDefault || false} onChange={(e) => updateBranch(i, 'isDefault', e.target.checked)} />
                            Default (fallback)
                        </label>

                        {!branch.isDefault && (
                            <div className="flex gap-1">
                                <select value={branch.matchType || 'contains'} onChange={(e) => updateBranch(i, 'matchType', e.target.value)} className="w-24 px-1 py-0.5 text-xs border rounded">
                                    <option value="exact">Exact</option>
                                    <option value="contains">Contains</option>
                                    <option value="regex">Regex</option>
                                    <option value="button_id">Button ID</option>
                                    <option value="list_id">List Row ID</option>
                                    <option value="payload">Payload</option>
                                </select>
                                <input type="text" value={branch.matchValue || ''} onChange={(e) => updateBranch(i, 'matchValue', e.target.value)} className="flex-1 px-2 py-0.5 text-xs border rounded" placeholder="Match value..." />
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button onClick={addBranch} className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1">
                <Plus size={12} /> Add Branch
            </button>
        </>
    );
}

// ==================== DELAY ====================
function DelayConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    return (
        <>
            <SectionLabel>Delay Settings</SectionLabel>
            <FieldLabel>Duration</FieldLabel>
            <div className="flex gap-2">
                <input type="number" value={(config.delayValue as number) || 5} onChange={(e) => onChange('delayValue', parseInt(e.target.value) || 1)} className="w-20 px-2 py-1.5 text-sm border rounded" min={1} />
                <select value={(config.delayUnit as string) || 'MINUTES'} onChange={(e) => onChange('delayUnit', e.target.value)} className="flex-1 px-2 py-1.5 text-sm border rounded">
                    <option value="SECONDS">Seconds</option>
                    <option value="MINUTES">Minutes</option>
                    <option value="HOURS">Hours</option>
                    <option value="DAYS">Days</option>
                </select>
            </div>
        </>
    );
}

// ==================== WORKFLOW ====================
function WorkflowConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    return (
        <>
            <SectionLabel>Workflow Action</SectionLabel>
            <FieldLabel>Workflow ID</FieldLabel>
            <input type="text" value={(config.workflowId as string) || ''} onChange={(e) => onChange('workflowId', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="workflow-id" />
            <p className="text-xs text-gray-400 mt-1">The workflow will receive phone, instituteId, userId, and messageText as context.</p>
        </>
    );
}

// ==================== HTTP WEBHOOK ====================
function WebhookConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    return (
        <>
            <SectionLabel>HTTP Webhook</SectionLabel>
            <FieldLabel>URL</FieldLabel>
            <input type="text" value={(config.url as string) || ''} onChange={(e) => onChange('url', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="https://example.com/webhook" />
            <FieldLabel>Method</FieldLabel>
            <select value={(config.method as string) || 'POST'} onChange={(e) => onChange('method', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="POST">POST</option>
                <option value="GET">GET</option>
            </select>
            <FieldLabel>Result Variable Name</FieldLabel>
            <input type="text" value={(config.successVariable as string) || 'webhookResult'} onChange={(e) => onChange('successVariable', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="webhookResult" />
            <p className="text-xs text-gray-400 mt-1">Response stored as {'{{session.webhookResult}}'} for use in later nodes.</p>
        </>
    );
}

// ==================== AI RESPONSE ====================
function AiResponseConfig({ config, onChange }: { config: Record<string, unknown>; onChange: (keyOrBatch: string | Record<string, unknown>, value?: unknown) => void }) {
    return (
        <>
            <SectionLabel>AI Conversation</SectionLabel>
            <FieldLabel>Model</FieldLabel>
            <select value={(config.modelId as string) || 'google/gemini-2.0-flash-001'} onChange={(e) => onChange('modelId', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded">
                <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (fast)</option>
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                <option value="deepseek/deepseek-v3.2">DeepSeek V3.2</option>
            </select>

            <FieldLabel>System Prompt</FieldLabel>
            <textarea value={(config.systemPrompt as string) || ''} onChange={(e) => onChange('systemPrompt', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded h-24 resize-y" placeholder="You are a helpful assistant for {{institute.name}}. Answer questions about courses and enrollment..." />

            <div className="flex gap-2 mt-2">
                <div className="flex-1">
                    <FieldLabel>Max Tokens</FieldLabel>
                    <input type="number" value={(config.maxTokens as number) || 500} onChange={(e) => onChange('maxTokens', parseInt(e.target.value) || 500)} className="w-full px-2 py-1.5 text-sm border rounded" min={50} max={4096} />
                </div>
                <div className="flex-1">
                    <FieldLabel>Max Turns</FieldLabel>
                    <input type="number" value={(config.maxTurns as number) || 10} onChange={(e) => onChange('maxTurns', parseInt(e.target.value) || 10)} className="w-full px-2 py-1.5 text-sm border rounded" min={1} max={50} />
                </div>
            </div>

            <FieldLabel>Temperature</FieldLabel>
            <input type="range" min={0} max={1} step={0.1} value={(config.temperature as number) || 0.7} onChange={(e) => onChange('temperature', parseFloat(e.target.value))} className="w-full" />
            <span className="text-xs text-gray-500">{(config.temperature as number) || 0.7}</span>

            <FieldLabel>Exit Keywords (comma-separated)</FieldLabel>
            <input type="text" value={((config.exitKeywords as string[]) || []).join(', ')} onChange={(e) => onChange('exitKeywords', e.target.value.split(',').map((k) => k.trim()).filter(Boolean))} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="agent, human, stop" />

            <FieldLabel>Fallback Message (on error/max turns)</FieldLabel>
            <input type="text" value={(config.fallbackMessage as string) || ''} onChange={(e) => onChange('fallbackMessage', e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Let me connect you with a human agent." />
        </>
    );
}
