import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Settings {
    visible: boolean;
    content: string;
    fontSize: number;
    fontWeight: string;
    fontStyle: string;
    textAlign: string;
    useSectionName?: boolean;
}
interface TextSectionSettingsProps {
    title: string;
    settings: Settings;
    onChange: (settings: Settings) => void;
    showSectionNameOption?: boolean;
}

export function TextSectionSettings({
    title,
    settings,
    onChange,
    showSectionNameOption = false,
}: TextSectionSettingsProps) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label>{title}</Label>
                <Switch
                    checked={settings.visible}
                    onCheckedChange={(checked) => onChange({ ...settings, visible: checked })}
                />
            </div>

            {settings.visible && (
                <div className="ml-4 space-y-4">
                    {showSectionNameOption && (
                        <div className="flex items-center space-x-2">
                            <Switch
                                checked={settings.useSectionName}
                                onCheckedChange={(checked) =>
                                    onChange({ ...settings, useSectionName: checked })
                                }
                            />
                            <Label>Use Section Name</Label>
                        </div>
                    )}

                    {(!showSectionNameOption || !settings.useSectionName) && (
                        <div className="space-y-2">
                            <Label>Content</Label>
                            <Textarea
                                value={settings.content}
                                onChange={(e) => onChange({ ...settings, content: e.target.value })}
                                placeholder="Enter content..."
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Font Size (px)</Label>
                            <Input
                                type="number"
                                min={10}
                                max={36}
                                value={settings.fontSize}
                                onChange={(e) =>
                                    onChange({ ...settings, fontSize: parseInt(e.target.value) })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Font Weight</Label>
                            <Select
                                value={settings.fontWeight}
                                onValueChange={(value) =>
                                    onChange({ ...settings, fontWeight: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="bold">Bold</SelectItem>
                                    <SelectItem value="lighter">Lighter</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Font Style</Label>
                            <Select
                                value={settings.fontStyle}
                                onValueChange={(value) =>
                                    onChange({ ...settings, fontStyle: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="italic">Italic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Text Alignment</Label>
                            <Select
                                value={settings.textAlign}
                                onValueChange={(value) =>
                                    onChange({ ...settings, textAlign: value })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="left">Left</SelectItem>
                                    <SelectItem value="center">Center</SelectItem>
                                    <SelectItem value="right">Right</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
