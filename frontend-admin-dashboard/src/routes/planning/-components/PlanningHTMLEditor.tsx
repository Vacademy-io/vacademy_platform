import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { loadPlanningTemplate, unwrapContentFromHTML } from '../-utils/templateLoader';
import { Button } from '@/components/ui/button';
import { Eye, Code, Plus, Loader2 } from 'lucide-react';

const TipTapEditor = lazy(() => import('@/components/tiptap/TipTapEditor').then(module => ({ default: module.TipTapEditor })));

interface PlanningHTMLEditorProps {
    value: string;
    onChange: (html: string) => void;
}

export default function PlanningHTMLEditor({ value, onChange }: PlanningHTMLEditorProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [addTableRowTrigger, setAddTableRowTrigger] = useState<{ nonce: number } | undefined>();

    // Check if content contains a table
    const hasTable = useMemo(() => {
        if (!value) return false;
        return value.includes('<table') || value.includes('<TABLE');
    }, [value]);

    // Load template on first render if value is empty
    useEffect(() => {
        if (!value) {
            setIsLoading(true);
            loadPlanningTemplate()
                .then((template) => {
                    onChange(template);
                })
                .catch((error) => {
                    console.error('Failed to load template:', error);
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, []);

    const handleAddRow = () => {
        // Trigger table row insertion in TipTap
        setAddTableRowTrigger({
            nonce: Date.now(),
        });
    };

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading template...</div>;
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {hasTable
                        ? 'Fill in the planning template below. Use the "Add Row" button to add more lessons.'
                        : 'Fill in the planning template below.'}
                </p>
                <div className="flex gap-2">
                    {/* Only show Add Row button if content has a table and not in preview mode */}
                    {!showPreview && hasTable && (
                        <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Row
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                    >
                        {showPreview ? (
                            <>
                                <Code className="mr-2 h-4 w-4" />
                                Edit
                            </>
                        ) : (
                            <>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <Suspense fallback={<div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                {showPreview ? (
                    <div className="rounded-md border">
                        <TipTapEditor
                            value={unwrapContentFromHTML(value)}
                            editable={false}
                            onChange={() => { }}
                        />
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <TipTapEditor
                            value={value}
                            onChange={(html: string) => onChange(html)}
                            placeholder="Fill in the planning template..."
                            addTableRow={addTableRowTrigger}
                        />
                    </div>
                )}
            </Suspense>
        </div>
    );
}
