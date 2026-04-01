import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { Upload, X, Eye, Loader2, Crop } from 'lucide-react';
import { ReportBrandingSettings, DEFAULT_REPORT_BRANDING } from '@/types/assessment-settings';
import { Slider } from '@/components/ui/slider';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { getPublicUrl } from '@/services/upload_file';
import { UploadFileInS3 } from '@/services/upload_file';
import { toast } from 'sonner';
import { ImageCropperDialog } from '@/components/design-system/image-cropper-dialog';

interface Props {
    settings: ReportBrandingSettings;
    onChange: (updated: ReportBrandingSettings) => void;
}

const ReportBrandingSettingsSection = ({ settings, onChange }: Props) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [letterheadUrl, setLetterheadUrl] = useState<string>('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingLetterhead, setUploadingLetterhead] = useState(false);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [cropperSrc, setCropperSrc] = useState<string>('');
    const [cropperField, setCropperField] = useState<'letterhead_file_id' | 'logo_file_id'>('letterhead_file_id');
    const instituteDetails = useInstituteDetailsStore((s) => s.instituteDetails);

    const update = (partial: Partial<ReportBrandingSettings>) => {
        onChange({ ...settings, ...partial });
    };

    const s = { ...DEFAULT_REPORT_BRANDING, ...settings };

    // Resolve file IDs to URLs for display
    useEffect(() => {
        const resolveUrls = async () => {
            // Resolve logo
            const logoId = s.logo_file_id || (instituteDetails as any)?.institute_logo_file_id;
            if (logoId && !logoId.startsWith('data:')) {
                const url = await getPublicUrl(logoId);
                if (url) setLogoUrl(url);
            } else if (logoId?.startsWith('data:')) {
                setLogoUrl(logoId);
            }

            // Resolve letterhead
            const lhId = s.letterhead_file_id || (instituteDetails as any)?.letter_head_file_id;
            if (lhId && !lhId.startsWith('data:')) {
                const url = await getPublicUrl(lhId);
                if (url) setLetterheadUrl(url);
            } else if (lhId?.startsWith('data:')) {
                setLetterheadUrl(lhId);
            }

            // If settings don't have file IDs yet but institute does, pre-fill them
            if (!s.logo_file_id && (instituteDetails as any)?.institute_logo_file_id) {
                update({ logo_file_id: (instituteDetails as any).institute_logo_file_id });
            }
            if (!s.letterhead_file_id && (instituteDetails as any)?.letter_head_file_id) {
                update({ letterhead_file_id: (instituteDetails as any).letter_head_file_id });
            }
        };
        resolveUrls();
    }, [s.logo_file_id, s.letterhead_file_id, instituteDetails]);

    const handleImageSelect = (
        field: 'letterhead_file_id' | 'logo_file_id',
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;
        // Read file as data URL and open cropper
        const reader = new FileReader();
        reader.onloadend = () => {
            setCropperSrc(reader.result as string);
            setCropperField(field);
            setCropperOpen(true);
        };
        reader.readAsDataURL(file);
        // Reset input so the same file can be selected again
        event.target.value = '';
    };

    const handleCroppedUpload = async (croppedFile: File) => {
        const setUploading = cropperField === 'logo_file_id' ? setUploadingLogo : setUploadingLetterhead;
        setUploading(true);

        try {
            const fileId = await UploadFileInS3(
                croppedFile,
                () => {},
                'SYSTEM',
                'REPORT_BRANDING',
                'INSTITUTE'
            );
            if (fileId) {
                update({ [cropperField]: fileId });
                const url = await getPublicUrl(fileId);
                if (cropperField === 'logo_file_id') setLogoUrl(url);
                else setLetterheadUrl(url);
                toast.success(`${cropperField === 'logo_file_id' ? 'Logo' : 'Letterhead'} uploaded`);
            }
        } catch {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveImage = (field: 'letterhead_file_id' | 'logo_file_id') => {
        update({ [field]: null });
        if (field === 'logo_file_id') setLogoUrl('');
        else setLetterheadUrl('');
    };

    // Replace template placeholders for preview
    const resolveTemplate = (html: string) =>
        html.replace(/\{\{assessment_name\}\}/g, 'Sample Maths Test');

    return (
        <div className="flex flex-col gap-4">
            {/* Colors */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Report Colors</CardTitle>
                    <CardDescription>
                        Set primary and secondary colors used in the assessment report PDF and
                        UI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-6">
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm">Primary Color</Label>
                            <div className="flex items-center gap-3">
                                <ColorPicker
                                    value={s.primary_color}
                                    onChange={(val) => update({ primary_color: val })}
                                />
                                <Input
                                    value={s.primary_color}
                                    onChange={(e) =>
                                        update({ primary_color: e.target.value })
                                    }
                                    className="w-28"
                                    maxLength={7}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-sm">Secondary Color</Label>
                            <div className="flex items-center gap-3">
                                <ColorPicker
                                    value={s.secondary_color}
                                    onChange={(val) => update({ secondary_color: val })}
                                />
                                <Input
                                    value={s.secondary_color}
                                    onChange={(e) =>
                                        update({ secondary_color: e.target.value })
                                    }
                                    className="w-28"
                                    maxLength={7}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logo & Letterhead */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Logo & Letterhead</CardTitle>
                    <CardDescription>
                        Your institute logo and letterhead are shown below. You can change them
                        or upload new ones.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    {/* Logo */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-sm font-medium">
                                    Show Logo in Header
                                </Label>
                                <p className="text-xs text-gray-500">
                                    Display institute logo at the top of the report
                                </p>
                            </div>
                            {logoUrl ? (
                                <div className="relative">
                                    <img
                                        src={logoUrl}
                                        alt="Logo"
                                        className="h-12 w-12 rounded border object-contain p-0.5"
                                    />
                                    <button
                                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                                        onClick={() => handleRemoveImage('logo_file_id')}
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed text-xs text-gray-400">
                                    No logo
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                id="report-logo-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleImageSelect('logo_file_id', e)}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={uploadingLogo}
                                onClick={() =>
                                    document.getElementById('report-logo-upload')?.click()
                                }
                            >
                                {uploadingLogo ? (
                                    <Loader2 size={14} className="mr-1 animate-spin" />
                                ) : (
                                    <Upload size={14} className="mr-1" />
                                )}
                                {logoUrl ? 'Change' : 'Upload Logo'}
                            </Button>
                            <Switch
                                checked={s.show_logo_in_header}
                                onCheckedChange={(v) => update({ show_logo_in_header: v })}
                            />
                        </div>
                    </div>

                    {/* Letterhead */}
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <Label className="text-sm font-medium">
                                    Show Letterhead Background
                                </Label>
                                <p className="text-xs text-gray-500">
                                    Use a full-page letterhead image as the report background
                                </p>
                            </div>
                            {letterheadUrl ? (
                                <div className="relative">
                                    <img
                                        src={letterheadUrl}
                                        alt="Letterhead"
                                        className="h-12 w-20 rounded border object-contain p-0.5"
                                    />
                                    <button
                                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                                        onClick={() =>
                                            handleRemoveImage('letterhead_file_id')
                                        }
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex h-12 w-20 items-center justify-center rounded border border-dashed text-xs text-gray-400">
                                    No letterhead
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                id="report-letterhead-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                    handleImageSelect('letterhead_file_id', e)
                                }
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={uploadingLetterhead}
                                onClick={() =>
                                    document
                                        .getElementById('report-letterhead-upload')
                                        ?.click()
                                }
                            >
                                {uploadingLetterhead ? (
                                    <Loader2 size={14} className="mr-1 animate-spin" />
                                ) : (
                                    <Upload size={14} className="mr-1" />
                                )}
                                {letterheadUrl ? 'Change' : 'Upload Letterhead'}
                            </Button>
                            {letterheadUrl && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setCropperSrc(letterheadUrl);
                                        setCropperField('letterhead_file_id');
                                        setCropperOpen(true);
                                    }}
                                >
                                    <Crop size={14} className="mr-1" />
                                    Crop
                                </Button>
                            )}
                            <Switch
                                checked={s.show_letterhead}
                                onCheckedChange={(v) => update({ show_letterhead: v })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Watermark */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Watermark</CardTitle>
                    <CardDescription>
                        Add a diagonal watermark text across each page of the report.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="flex flex-col gap-1">
                            <Label className="text-sm font-medium">Enable Watermark</Label>
                        </div>
                        <Switch
                            checked={s.show_watermark}
                            onCheckedChange={(v) => update({ show_watermark: v })}
                        />
                    </div>
                    {s.show_watermark && (
                        <div className="flex flex-col gap-3 pl-2">
                            <div className="flex flex-col gap-1">
                                <Label className="text-sm">Watermark Text</Label>
                                <Input
                                    value={s.watermark_text}
                                    onChange={(e) =>
                                        update({ watermark_text: e.target.value })
                                    }
                                    placeholder="e.g. CONFIDENTIAL or your institute name"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-sm">
                                    Opacity ({Math.round(s.watermark_opacity * 100)}%)
                                </Label>
                                <Slider
                                    value={[s.watermark_opacity * 100]}
                                    onValueChange={([v = 5]) =>
                                        update({ watermark_opacity: v / 100 })
                                    }
                                    min={1}
                                    max={30}
                                    step={1}
                                    className="w-60"
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Header & Footer */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Header & Footer</CardTitle>
                    <CardDescription>
                        Custom HTML for the report header and footer. These appear on every page.
                        Use <code className="rounded bg-gray-100 px-1 text-xs">{'{{assessment_name}}'}</code> as
                        a placeholder — it will be replaced with the actual assessment name in the report.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <Label className="text-sm">Footer Text</Label>
                        <Input
                            value={s.footer_text}
                            onChange={(e) => update({ footer_text: e.target.value })}
                            placeholder="Footer text shown at the bottom of the report"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-sm">Custom Header HTML</Label>
                        <Textarea
                            value={s.header_html}
                            onChange={(e) => update({ header_html: e.target.value })}
                            placeholder='<div style="text-align:center;">{{assessment_name}}</div>'
                            rows={3}
                            className="font-mono text-xs"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <Label className="text-sm">Custom Footer HTML</Label>
                        <Textarea
                            value={s.footer_html}
                            onChange={(e) => update({ footer_html: e.target.value })}
                            placeholder='<div style="text-align:center; font-size:10px; color:#999;">Powered by MyInstitute</div>'
                            rows={3}
                            className="font-mono text-xs"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Preview */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                    <Button
                        variant="outline"
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="flex items-center gap-2"
                    >
                        <Eye size={16} />
                        {previewOpen ? 'Hide Preview' : 'Show Preview'}
                    </Button>
                    {previewOpen && (
                        <div className="mt-4 rounded-lg border shadow-sm">
                            <div
                                className="relative mx-auto"
                                style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    minHeight: 400,
                                    background: '#fff',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                            >
                                {/* Letterhead background */}
                                {s.show_letterhead && letterheadUrl && (
                                    <img
                                        src={letterheadUrl}
                                        alt=""
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            opacity: 0.15,
                                            pointerEvents: 'none',
                                        }}
                                    />
                                )}

                                {/* Watermark */}
                                {s.show_watermark && s.watermark_text && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform:
                                                'translate(-50%, -50%) rotate(-35deg)',
                                            fontSize: 48,
                                            fontWeight: 'bold',
                                            color: s.primary_color,
                                            opacity: s.watermark_opacity,
                                            pointerEvents: 'none',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {s.watermark_text}
                                    </div>
                                )}

                                {/* Content */}
                                <div
                                    style={{
                                        position: 'relative',
                                        zIndex: 1,
                                        padding: 24,
                                    }}
                                >
                                    {/* Header */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            marginBottom: 16,
                                            borderBottom: `2px solid ${s.primary_color}`,
                                            paddingBottom: 12,
                                        }}
                                    >
                                        {s.show_logo_in_header && logoUrl && (
                                            <img
                                                src={logoUrl}
                                                alt="Logo"
                                                style={{
                                                    height: 40,
                                                    width: 40,
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        )}
                                        {s.header_html ? (
                                            <div
                                                dangerouslySetInnerHTML={{
                                                    __html: resolveTemplate(s.header_html),
                                                }}
                                                style={{ flex: 1 }}
                                            />
                                        ) : (
                                            <div style={{ flex: 1 }}>
                                                <div
                                                    style={{
                                                        fontSize: 18,
                                                        fontWeight: 'bold',
                                                        color: s.primary_color,
                                                    }}
                                                >
                                                    Sample Maths Test
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 12,
                                                        color: '#666',
                                                    }}
                                                >
                                                    Student Performance Analysis
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Sample content */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: 8,
                                            marginBottom: 16,
                                        }}
                                    >
                                        {['Score: 72/100', 'Rank: #3', 'Percentile: 85%'].map(
                                            (text) => (
                                                <div
                                                    key={text}
                                                    style={{
                                                        flex: 1,
                                                        padding: '12px 8px',
                                                        background: `${s.primary_color}10`,
                                                        borderRadius: 8,
                                                        textAlign: 'center',
                                                        border: `1px solid ${s.primary_color}30`,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            fontSize: 16,
                                                            fontWeight: 'bold',
                                                            color: s.primary_color,
                                                        }}
                                                    >
                                                        {text.split(': ')[1]}
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: 10,
                                                            color: '#888',
                                                            marginTop: 2,
                                                        }}
                                                    >
                                                        {text.split(': ')[0]}
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Sample section header */}
                                    <div
                                        style={{
                                            background: s.secondary_color,
                                            color: '#fff',
                                            padding: '6px 12px',
                                            borderRadius: 4,
                                            fontSize: 13,
                                            fontWeight: 600,
                                            marginBottom: 8,
                                        }}
                                    >
                                        Section Wise Performance
                                    </div>
                                    <div
                                        style={{
                                            height: 60,
                                            background: '#f8f8f8',
                                            borderRadius: 4,
                                            marginBottom: 16,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ccc',
                                            fontSize: 12,
                                        }}
                                    >
                                        Section data table preview
                                    </div>

                                    {/* Footer */}
                                    <div
                                        style={{
                                            borderTop: `1px solid ${s.primary_color}40`,
                                            paddingTop: 8,
                                            marginTop: 'auto',
                                        }}
                                    >
                                        {s.footer_html ? (
                                            <div
                                                dangerouslySetInnerHTML={{
                                                    __html: resolveTemplate(s.footer_html),
                                                }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    fontSize: 10,
                                                    color: '#999',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {s.footer_text}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* Image Cropper Dialog */}
            <ImageCropperDialog
                open={cropperOpen}
                onOpenChange={setCropperOpen}
                src={cropperSrc}
                aspectRatio={cropperField === 'letterhead_file_id' ? 210 / 297 : 1}
                title={cropperField === 'letterhead_file_id' ? 'Crop Letterhead' : 'Crop Logo'}
                onCropped={handleCroppedUpload}
                confirmLabel="Crop & Upload"
            />
        </div>
    );
};

export default ReportBrandingSettingsSection;
