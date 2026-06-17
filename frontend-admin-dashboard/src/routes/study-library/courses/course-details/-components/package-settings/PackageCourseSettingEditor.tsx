import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { MyButton } from '@/components/design-system/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { AlertTriangle, Braces, Loader2, RotateCcw, Save, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
    EMPTY_COURSE_SETTING,
    getPackageCourseSettingRaw,
    savePackageCourseSettingRaw,
    validateCourseSettingJson,
} from '@/services/package-settings';

interface PackageCourseSettingEditorProps {
    packageId: string;
    /** Notified after a successful save (e.g. to refresh the LMS badge). */
    onSaved?: () => void;
}

// Scaffolds for common keys workflows read. Admins tweak the values inline —
// these just remove the boilerplate of the double-`data` envelope shape.
const SNIPPETS: Record<string, { key: string; name: string; data: unknown }> = {
    'Moodle (MOODLE_SETTING)': {
        key: 'MOODLE_SETTING',
        name: 'Moodle Integration Settings',
        data: { data: { moodleToken: '', moodleBaseUrl: '', moodleCourseId: '' } },
    },
    'LearnDash (LMS_SETTING)': {
        key: 'LMS_SETTING',
        name: 'LMS Settings',
        data: { data: { activeLms: 'LEARNDASH', learndash_base_url: '' } },
    },
    'Course settings (COURSE_SETTING)': {
        key: 'COURSE_SETTING',
        name: 'Course Settings',
        data: { retentionPeriod: 0, lmsUrl: '' },
    },
};

export const PackageCourseSettingEditor: React.FC<PackageCourseSettingEditorProps> = ({
    packageId,
    onSaved,
}) => {
    const [original, setOriginal] = useState<string>(EMPTY_COURSE_SETTING);
    const [value, setValue] = useState<string>(EMPTY_COURSE_SETTING);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        getPackageCourseSettingRaw(packageId)
            .then((raw) => {
                if (!active) return;
                let pretty = raw;
                try {
                    pretty = JSON.stringify(JSON.parse(raw), null, 2);
                } catch {
                    /* leave server string as-is if it isn't parseable */
                }
                setOriginal(pretty);
                setValue(pretty);
            })
            .catch((e) => {
                console.error('Failed to load course settings JSON', e);
                toast.error('Failed to load course settings');
            })
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [packageId]);

    const validationError = useMemo<string | null>(() => {
        try {
            validateCourseSettingJson(value);
            return null;
        } catch (e) {
            return e instanceof Error ? e.message : 'Invalid JSON';
        }
    }, [value]);

    const isValid = validationError === null;
    const hasChanges = value !== original;

    const handleFormat = () => {
        try {
            setValue(validateCourseSettingJson(value));
        } catch {
            toast.error('Cannot format — fix the JSON error first');
        }
    };

    const handleInsertSnippet = (label: string) => {
        const snippet = SNIPPETS[label];
        if (!snippet) return;
        let root: { setting?: Record<string, unknown>; [k: string]: unknown } = { setting: {} };
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                root = parsed;
            }
        } catch {
            // start from an empty envelope if the current text isn't parseable
        }
        const settingObj: Record<string, unknown> =
            root.setting && typeof root.setting === 'object' && !Array.isArray(root.setting)
                ? (root.setting as Record<string, unknown>)
                : {};
        settingObj[snippet.key] = {
            key: snippet.key,
            name: snippet.name,
            data: snippet.data,
        };
        root.setting = settingObj;
        setValue(JSON.stringify(root, null, 2));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const pretty = validateCourseSettingJson(value);
            await savePackageCourseSettingRaw(packageId, pretty);
            setOriginal(pretty);
            setValue(pretty);
            toast.success('Course settings JSON saved');
            onSaved?.();
        } catch (e) {
            console.error('Failed to save course settings JSON', e);
            toast.error(e instanceof Error ? e.message : 'Failed to save course settings');
        } finally {
            setSaving(false);
            setConfirmOpen(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2">
                        <Braces className="size-5 text-primary-500" />
                        Advanced Settings (JSON)
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleFormat} disabled={loading || saving || !isValid}>
                            Format
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setValue(original)}
                            disabled={loading || saving || !hasChanges}
                        >
                            <RotateCcw className="mr-2 size-4" />
                            Reset
                        </Button>
                        <MyButton
                            onClick={() => setConfirmOpen(true)}
                            disabled={loading || saving || !isValid || !hasChanges}
                            className="bg-primary-500"
                        >
                            <Save className="mr-2 size-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </MyButton>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    These settings are stored on this course and read by workflows (LMS config, retention,
                    completion thresholds, etc.). Edit the raw JSON below — it must stay wrapped in a{' '}
                    <code>{'{ "setting": { ... } }'}</code> envelope.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Insert template:</span>
                    {Object.keys(SNIPPETS).map((label) => (
                        <Button
                            key={label}
                            size="sm"
                            variant="outline"
                            onClick={() => handleInsertSnippet(label)}
                            disabled={loading || saving}
                        >
                            + {label}
                        </Button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground">
                        <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
                    </div>
                ) : (
                    <>
                        <Textarea
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            spellCheck={false}
                            className="min-h-[360px] font-mono text-xs leading-relaxed"
                        />
                        {validationError ? (
                            <Alert variant="destructive">
                                <AlertTriangle className="size-4" />
                                <AlertDescription>Invalid JSON: {validationError}</AlertDescription>
                            </Alert>
                        ) : (
                            <p className="flex items-center gap-1.5 text-xs text-green-700">
                                <CheckCircle className="size-3.5" /> Valid JSON
                            </p>
                        )}
                    </>
                )}
            </CardContent>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <AlertDialogContent className="z-[10001]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Overwrite course settings JSON?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This replaces the settings JSON used by this course&apos;s workflows (LMS,
                            retention, completion, etc.). Make sure the keys are correct — this takes effect
                            immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleSave();
                            }}
                            disabled={saving}
                            className="bg-primary-500"
                        >
                            {saving ? 'Saving…' : 'Yes, save'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};
