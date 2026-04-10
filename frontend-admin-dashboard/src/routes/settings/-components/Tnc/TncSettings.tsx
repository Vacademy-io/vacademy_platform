import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MyButton } from '@/components/design-system/button';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { GET_INSITITUTE_SETTINGS } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { FileUploader } from '@/routes/instructor-copilot/-components/FileUploader';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface TncSettingsData {
    settingEnabled: boolean;
    fileMediaId: string | null;
}

const DEFAULT_TNC_SETTINGS: TncSettingsData = {
    settingEnabled: false,
    fileMediaId: null,
};

const SETTING_KEY = 'STUDENT_TNC_SETTING';
const SAVE_URL = GET_INSITITUTE_SETTINGS.replace('/get', '/save-setting');

const fetchTncSettings = async (): Promise<TncSettingsData> => {
    const instituteId = getCurrentInstituteId();
    const response = await authenticatedAxiosInstance({
        method: 'GET',
        url: GET_INSITITUTE_SETTINGS,
        params: { instituteId, settingKey: SETTING_KEY },
    });
    return response.data?.data ?? DEFAULT_TNC_SETTINGS;
};

const saveTncSettings = async (data: TncSettingsData): Promise<void> => {
    const instituteId = getCurrentInstituteId();
    await authenticatedAxiosInstance.post(
        SAVE_URL,
        { setting_name: 'Student T&C', setting_data: data },
        { params: { instituteId, settingKey: SETTING_KEY } }
    );
};

export default function TncSettings() {
    const queryClient = useQueryClient();
    const { currentUser } = useCurrentUser();
    const { uploadFile, getPublicUrl } = useFileUpload();
    const [settings, setSettings] = useState<TncSettingsData>(DEFAULT_TNC_SETTINGS);
    const [hasChanges, setHasChanges] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['tnc-settings'],
        queryFn: fetchTncSettings,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (data) {
            setSettings(data);
            setHasChanges(false);
            if (data.fileMediaId) {
                getPublicUrl(data.fileMediaId).then((res: any) => {
                    const urlStr = typeof res === 'string' ? res : res?.data;
                    if (urlStr) setFileUrl(urlStr);
                }).catch(console.error);
            }
        }
    }, [data, getPublicUrl]);

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: saveTncSettings,
        onSuccess: () => {
            toast.success('Terms & Conditions settings saved');
            setHasChanges(false);
            queryClient.invalidateQueries({ queryKey: ['tnc-settings'] });
        },
        onError: () => {
            toast.error('Failed to save T&C settings');
        },
    });

    const update = (patch: Partial<TncSettingsData>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        setHasChanges(true);
    };

    const handleSave = () => {
        if (settings.settingEnabled && !settings.fileMediaId) {
            toast.error('Please upload a PDF file to enable Terms & Conditions');
            return;
        }
        save(settings);
    };

    const handleFileSelected = async (file: File) => {
        if (file.type !== 'application/pdf') {
            toast.error('Only PDF files are supported');
            return;
        }
        
        try {
            await uploadFile({
                file,
                setIsUploading: setIsUploadingMedia,
                userId: currentUser?.id || 'admin',
                publicUrl: true,
            }).then((uploadRes: any) => {
                 const fileId = uploadRes.id || uploadRes;
                 update({ fileMediaId: fileId });
                 getPublicUrl(fileId).then((res: any) => {
                     const urlStr = typeof res === 'string' ? res : res?.data;
                     if (urlStr) setFileUrl(urlStr);
                 });
                 toast.success('PDF uploaded successfully');
            });
        } catch (error) {
            toast.error('Failed to upload PDF file');
            console.error(error);
        }
    };

    if (isLoading) {
        return <div className="p-6 text-sm text-muted-foreground">Loading T&C settings...</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Student Terms & Conditions</CardTitle>
                    <CardDescription>
                        Enable Terms & Conditions to require learners to digitally sign the agreement
                        before they can access their dashboard content.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="tnc-enabled"
                            checked={settings.settingEnabled}
                            onCheckedChange={(v) => update({ settingEnabled: v })}
                        />
                        <Label htmlFor="tnc-enabled" className="cursor-pointer">
                            {settings.settingEnabled ? 'Enabled' : 'Disabled'}
                        </Label>
                    </div>

                    <div className="space-y-4">
                        <Label>Terms and Conditions PDF</Label>
                        <p className="text-sm text-muted-foreground">
                            Upload the base PDF document. When a learner accepts it, their name and date will be appended as a new page.
                        </p>
                        
                        {settings.fileMediaId && fileUrl ? (
                            <div className="flex flex-col gap-2 rounded-md border p-4 bg-muted/20">
                                <span className="text-sm font-medium">Currently Uploaded PDF</span>
                                <div className="flex items-center gap-4">
                                     <a href={fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm truncate flex-1">
                                        View T&C Document
                                     </a>
                                     <MyButton buttonType="secondary" scale="small" onClick={() => {
                                         update({ fileMediaId: null });
                                         setFileUrl(null);
                                     }}>
                                         Remove
                                     </MyButton>
                                </div>
                            </div>
                        ) : (
                            <FileUploader 
                                onFileSelected={handleFileSelected} 
                                maxSize={10} 
                                acceptFormats={{ 'application/pdf': ['.pdf'] }}
                                acceptMsg="Supported format: PDF"
                            />
                        )}
                        {isUploadingMedia && <p className="text-xs text-primary">Uploading PDF...</p>}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <MyButton
                    buttonType="primary"
                    scale="medium"
                    onClick={handleSave}
                    disable={saving || !hasChanges || isUploadingMedia}
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </MyButton>
            </div>
        </div>
    );
}
