import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ColorPickerFieldProps {
    label: string;
    value: string;
    onChange: (color: string) => void;
}

export const ColorPickerField = ({ label, value, onChange }: ColorPickerFieldProps) => {
    const [localValue, setLocalValue] = useState(value || '#ffffff');

    // Sync when external value changes
    useEffect(() => {
        setLocalValue(value || '#ffffff');
    }, [value]);

    const handlePickerChange = (color: string) => {
        setLocalValue(color);
        onChange(color);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setLocalValue(v);
        // Only call onChange when hex is complete and valid
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            onChange(v);
        }
    };

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            className="size-9 shrink-0 rounded border border-gray-300 shadow-sm transition-shadow hover:shadow-md"
                            style={{ backgroundColor: localValue || '#ffffff' }}
                            title="Pick a color"
                        />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                        <HexColorPicker color={localValue} onChange={handlePickerChange} />
                        <div className="mt-2">
                            <Input
                                value={localValue}
                                onChange={handleInputChange}
                                placeholder="#ffffff"
                                className="font-mono text-sm"
                            />
                        </div>
                    </PopoverContent>
                </Popover>
                <Input
                    value={localValue}
                    onChange={handleInputChange}
                    placeholder="#ffffff"
                    className="font-mono text-sm"
                />
            </div>
        </div>
    );
};
