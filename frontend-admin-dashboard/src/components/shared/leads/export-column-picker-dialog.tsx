import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface ExportColumnOption {
    key: string;
    label: string;
}

interface ExportColumnPickerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    columns: ExportColumnOption[];
    selected: Set<string>;
    onSelectedChange: (selected: Set<string>) => void;
    onExport: () => void;
    isExporting?: boolean;
}

export function ExportColumnPickerDialog({
    open,
    onOpenChange,
    columns,
    selected,
    onSelectedChange,
    onExport,
    isExporting,
}: ExportColumnPickerDialogProps) {
    const toggle = (key: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(key);
        else next.delete(key);
        onSelectedChange(next);
    };

    const footer = (
        <div className="flex w-full items-center justify-between">
            <span className="text-caption text-neutral-500">
                {selected.size} of {columns.length} columns
            </span>
            <div className="flex gap-2">
                <MyButton buttonType="secondary" scale="small" onClick={() => onOpenChange(false)}>
                    Cancel
                </MyButton>
                <MyButton
                    buttonType="primary"
                    scale="small"
                    onClick={onExport}
                    disable={selected.size === 0 || isExporting}
                >
                    {isExporting ? 'Exporting…' : 'Export'}
                </MyButton>
            </div>
        </div>
    );

    return (
        <MyDialog
            heading="Choose export columns"
            open={open}
            onOpenChange={onOpenChange}
            footer={footer}
        >
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-caption">
                    <button
                        type="button"
                        onClick={() => onSelectedChange(new Set(columns.map((c) => c.key)))}
                        className="text-primary-600 hover:underline"
                    >
                        Select all
                    </button>
                    <span className="text-neutral-300">·</span>
                    <button
                        type="button"
                        onClick={() => onSelectedChange(new Set())}
                        className="text-primary-600 hover:underline"
                    >
                        Deselect all
                    </button>
                </div>
                <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto rounded-md border border-neutral-200 p-2">
                    {columns.map((col) => (
                        <label
                            key={col.key}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body hover:bg-neutral-100"
                        >
                            <Checkbox
                                checked={selected.has(col.key)}
                                onCheckedChange={(chk) => toggle(col.key, chk === true)}
                            />
                            {col.label}
                        </label>
                    ))}
                </div>
            </div>
        </MyDialog>
    );
}
