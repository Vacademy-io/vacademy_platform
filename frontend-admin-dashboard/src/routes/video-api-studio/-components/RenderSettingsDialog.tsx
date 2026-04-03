import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import {
    type RenderSettings,
    type RenderResolution,
    type RenderFps,
    type CaptionSize,
    type CaptionPosition,
    DEFAULT_RENDER_SETTINGS,
} from '../-services/video-generation';

const STORAGE_KEY = 'video-render-settings';

function loadSettings(): RenderSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return { ...DEFAULT_RENDER_SETTINGS, ...JSON.parse(saved) };
    } catch {
        /* ignore */
    }
    return DEFAULT_RENDER_SETTINGS;
}

function saveSettings(s: RenderSettings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ---------------------------------------------------------------------------
// Toggle-button helper
// ---------------------------------------------------------------------------

function ToggleGroup<T extends string | number>({
    options,
    value,
    onChange,
    labels,
}: {
    options: T[];
    value: T;
    onChange: (v: T) => void;
    labels?: Record<string, string>;
}) {
    return (
        <div className="flex gap-1">
            {options.map((opt) => (
                <button
                    key={String(opt)}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        value === opt
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                >
                    {labels?.[String(opt)] ?? String(opt)}
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface RenderSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (settings: RenderSettings) => void;
    isPortrait?: boolean;
}

export function RenderSettingsDialog({
    open,
    onOpenChange,
    onConfirm,
    isPortrait = false,
}: RenderSettingsDialogProps) {
    const [settings, setSettings] = useState<RenderSettings>(loadSettings);

    // Reload from localStorage when dialog opens
    useEffect(() => {
        if (open) setSettings(loadSettings());
    }, [open]);

    const update = <K extends keyof RenderSettings>(key: K, val: RenderSettings[K]) =>
        setSettings((prev) => ({ ...prev, [key]: val }));

    const handleConfirm = () => {
        saveSettings(settings);
        onConfirm(settings);
        onOpenChange(false);
    };

    const resolutionLabel = (r: RenderResolution) => {
        if (r === '720p') return isPortrait ? '720p (720×1280)' : '720p (1280×720)';
        return isPortrait ? '1080p (1080×1920)' : '1080p (1920×1080)';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Render Settings</DialogTitle>
                    <DialogDescription>Configure video output before rendering.</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Resolution */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Resolution</Label>
                        <ToggleGroup<RenderResolution>
                            options={['720p', '1080p']}
                            value={settings.resolution}
                            onChange={(v) => update('resolution', v)}
                            labels={{
                                '720p': resolutionLabel('720p'),
                                '1080p': resolutionLabel('1080p'),
                            }}
                        />
                    </div>

                    {/* FPS */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium">Frame Rate</Label>
                        <ToggleGroup<RenderFps>
                            options={[15, 20, 25]}
                            value={settings.fps}
                            onChange={(v) => update('fps', v)}
                            labels={{ '15': '15 fps', '20': '20 fps', '25': '25 fps' }}
                        />
                    </div>

                    <hr className="border-border" />

                    {/* Captions toggle */}
                    <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Captions</Label>
                        <Switch
                            checked={settings.captions}
                            onCheckedChange={(v) => update('captions', v)}
                        />
                    </div>

                    {/* Caption options (visible when captions enabled) */}
                    {settings.captions && (
                        <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
                            {/* Position */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Position</Label>
                                <ToggleGroup<CaptionPosition>
                                    options={['top', 'bottom']}
                                    value={settings.captionPosition}
                                    onChange={(v) => update('captionPosition', v)}
                                    labels={{ top: 'Top', bottom: 'Bottom' }}
                                />
                            </div>

                            {/* Size */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Size</Label>
                                <ToggleGroup<CaptionSize>
                                    options={['S', 'M', 'L']}
                                    value={settings.captionSize}
                                    onChange={(v) => update('captionSize', v)}
                                    labels={{ S: 'Small', M: 'Medium', L: 'Large' }}
                                />
                            </div>

                            {/* Text color */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Text Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={settings.captionTextColor}
                                        onChange={(e) => update('captionTextColor', e.target.value)}
                                        className="h-8 w-8 cursor-pointer rounded border border-border p-0.5"
                                    />
                                    <span className="text-xs font-mono text-muted-foreground">
                                        {settings.captionTextColor}
                                    </span>
                                </div>
                            </div>

                            {/* Background color + opacity */}
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Background</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={settings.captionBgColor}
                                        onChange={(e) => update('captionBgColor', e.target.value)}
                                        className="h-8 w-8 cursor-pointer rounded border border-border p-0.5"
                                    />
                                    <span className="text-xs font-mono text-muted-foreground">
                                        {settings.captionBgColor}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                    Background Opacity: {settings.captionBgOpacity}%
                                </Label>
                                <Slider
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={[settings.captionBgOpacity]}
                                    onValueChange={([v]) => update('captionBgOpacity', v)}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} className="gap-2">
                        <Download className="size-4" />
                        Start Render
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
