import { useState } from 'react';
import { useEditorStore } from '../-stores/editor-store';
import { PAGE_TEMPLATES, PageTemplate, applyPageTemplate, applySectionTemplate } from '../-utils/page-templates';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Layers } from 'lucide-react';

type TemplateCategory = 'page' | 'section';

export const TemplateLibrary = () => {
    const { config, selectedPageId, updateConfig } = useEditorStore();
    const [activeCategory, setActiveCategory] = useState<TemplateCategory>('page');
    const [pendingTemplate, setPendingTemplate] = useState<PageTemplate | null>(null);

    const filteredTemplates = PAGE_TEMPLATES.filter((t) => t.category === activeCategory);

    const applyTemplate = (template: PageTemplate) => {
        if (!config || !selectedPageId) return;

        const newPages = config.pages.map((page) => {
            if (page.id !== selectedPageId) return page;
            return template.category === 'page'
                ? applyPageTemplate(page, template)
                : applySectionTemplate(page, template);
        });

        updateConfig({ ...config, pages: newPages });
        setPendingTemplate(null);
    };

    const handleTemplateClick = (template: PageTemplate) => {
        if (!selectedPageId) return;
        if (template.category === 'page') {
            // Warn before replacing all components
            setPendingTemplate(template);
        } else {
            // Sections just insert — no warning needed
            applyTemplate(template);
        }
    };

    return (
        <div className="flex h-full flex-col">
            {/* Category tabs */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveCategory('page')}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                        activeCategory === 'page'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <FileText className="size-3.5" />
                    Pages
                </button>
                <button
                    onClick={() => setActiveCategory('section')}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                        activeCategory === 'section'
                            ? 'border-b-2 border-blue-500 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Layers className="size-3.5" />
                    Sections
                </button>
            </div>

            {/* Template list */}
            <div className="flex flex-col gap-2 overflow-y-auto p-3">
                {!selectedPageId && (
                    <p className="text-center text-xs text-gray-400 py-4">
                        Select a page first to apply templates
                    </p>
                )}

                {selectedPageId && filteredTemplates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => handleTemplateClick(template)}
                        className="flex flex-col items-start gap-1 rounded border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                    >
                        <span className="text-sm font-medium text-gray-800">{template.name}</span>
                        <span className="text-xs text-gray-500">{template.description}</span>
                        <span className="mt-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                            {template.category === 'page' ? 'Replaces page' : 'Inserts section'}
                        </span>
                    </button>
                ))}
            </div>

            {/* Confirmation dialog for page templates (they replace all components) */}
            <AlertDialog open={!!pendingTemplate} onOpenChange={() => setPendingTemplate(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apply "{pendingTemplate?.name}" template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will replace ALL existing components on the current page with the template
                            components. This action can be undone with Ctrl+Z.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}>
                            Apply Template
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
