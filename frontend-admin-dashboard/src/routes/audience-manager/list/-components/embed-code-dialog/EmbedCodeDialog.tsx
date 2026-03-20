import { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Copy, Code2, Frame, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { CampaignItem } from '../../-services/get-campaigns-list';
import createCampaignLink from '../../-utils/createCampaignLink';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';

interface EmbedCodeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: CampaignItem;
}

interface EmbedCustomization {
    buttonText: string;
    buttonBgColor: string;
    buttonTextColor: string;
    buttonBorderRadius: string;
    popupTitle: string;
    iframeWidth: string;
    iframeHeight: string;
}

const DEFAULT_CUSTOMIZATION: EmbedCustomization = {
    buttonText: 'Register Now',
    buttonBgColor: '#6366f1',
    buttonTextColor: '#ffffff',
    buttonBorderRadius: '8',
    popupTitle: 'Registration Form',
    iframeWidth: '100%',
    iframeHeight: '600',
};

export const EmbedCodeDialog = ({ isOpen, onClose, campaign }: EmbedCodeDialogProps) => {
    const [copiedSection, setCopiedSection] = useState<string | null>(null);
    const [customization, setCustomization] = useState<EmbedCustomization>(DEFAULT_CUSTOMIZATION);
    const { instituteDetails } = useInstituteDetailsStore();

    const campaignId = campaign.id || campaign.campaign_id || campaign.audience_id || '';
    const formUrl = useMemo(() => {
        return createCampaignLink(campaignId, instituteDetails?.learner_portal_base_url);
    }, [campaignId, instituteDetails?.learner_portal_base_url]);

    const handleCopy = async (text: string, section: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSection(section);
            toast.success('Copied to clipboard!');
            setTimeout(() => setCopiedSection(null), 2000);
        } catch (error) {
            toast.error('Failed to copy');
        }
    };

    // Button + Popup Embed Code
    const buttonPopupCode = useMemo(() => {
        return `<!-- Vacademy Form Embed - Button with Popup -->
<style>
  .vacademy-embed-btn {
    background-color: ${customization.buttonBgColor};
    color: ${customization.buttonTextColor};
    border: none;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    border-radius: ${customization.buttonBorderRadius}px;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  .vacademy-embed-btn:hover {
    opacity: 0.9;
  }
  .vacademy-modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    justify-content: center;
    align-items: center;
  }
  .vacademy-modal-overlay.active {
    display: flex;
  }
  .vacademy-modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  .vacademy-modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .vacademy-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }
  .vacademy-modal-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    line-height: 1;
  }
  .vacademy-modal-close:hover {
    color: #111827;
  }
  .vacademy-modal-body {
    height: 500px;
  }
  .vacademy-modal-body iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
</style>

<button class="vacademy-embed-btn" onclick="document.getElementById('vacademy-modal-${campaignId.slice(0, 8)}').classList.add('active')">
  ${customization.buttonText}
</button>

<div id="vacademy-modal-${campaignId.slice(0, 8)}" class="vacademy-modal-overlay" onclick="if(event.target === this) this.classList.remove('active')">
  <div class="vacademy-modal-content">
    <div class="vacademy-modal-header">
      <h3 class="vacademy-modal-title">${customization.popupTitle}</h3>
      <button class="vacademy-modal-close" onclick="document.getElementById('vacademy-modal-${campaignId.slice(0, 8)}').classList.remove('active')">&times;</button>
    </div>
    <div class="vacademy-modal-body">
      <iframe src="${formUrl}" title="${campaign.campaign_name} Form"></iframe>
    </div>
  </div>
</div>`;
    }, [customization, campaignId, formUrl, campaign.campaign_name]);

    // Direct iFrame Embed Code
    const iframeCode = useMemo(() => {
        return `<!-- Vacademy Form Embed - Direct iFrame -->
<iframe
  src="${formUrl}"
  title="${campaign.campaign_name} Form"
  width="${customization.iframeWidth}"
  height="${customization.iframeHeight}"
  frameborder="0"
  style="border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);"
  allow="clipboard-write"
></iframe>`;
    }, [formUrl, campaign.campaign_name, customization.iframeWidth, customization.iframeHeight]);

    const updateCustomization = (key: keyof EmbedCustomization, value: string) => {
        setCustomization((prev) => ({ ...prev, [key]: value }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl overflow-hidden sm:w-[90vw]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Code2 className="size-5" />
                        Embed Code - {campaign.campaign_name}
                    </DialogTitle>
                    <DialogDescription>
                        Embed this form on your website or any webpage to collect responses.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="button-popup" className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="button-popup" className="flex items-center gap-2">
                            <Palette className="size-4" />
                            Button + Popup
                        </TabsTrigger>
                        <TabsTrigger value="iframe" className="flex items-center gap-2">
                            <Frame className="size-4" />
                            Direct Embed
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="button-popup" className="mt-4">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Customization Panel */}
                            <div className="space-y-4 rounded-lg border bg-neutral-50 p-4">
                                <h4 className="flex items-center gap-2 font-medium">
                                    <Palette className="size-4" />
                                    Customize Button
                                </h4>

                                <div className="space-y-3">
                                    <div>
                                        <Label htmlFor="buttonText">Button Text</Label>
                                        <Input
                                            id="buttonText"
                                            value={customization.buttonText}
                                            onChange={(e) =>
                                                updateCustomization('buttonText', e.target.value)
                                            }
                                            placeholder="Register Now"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="buttonBgColor">Background Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="buttonBgColor"
                                                    type="color"
                                                    value={customization.buttonBgColor}
                                                    onChange={(e) =>
                                                        updateCustomization(
                                                            'buttonBgColor',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-10 w-14 cursor-pointer p-1"
                                                />
                                                <Input
                                                    value={customization.buttonBgColor}
                                                    onChange={(e) =>
                                                        updateCustomization(
                                                            'buttonBgColor',
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="#6366f1"
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <Label htmlFor="buttonTextColor">Text Color</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    id="buttonTextColor"
                                                    type="color"
                                                    value={customization.buttonTextColor}
                                                    onChange={(e) =>
                                                        updateCustomization(
                                                            'buttonTextColor',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="h-10 w-14 cursor-pointer p-1"
                                                />
                                                <Input
                                                    value={customization.buttonTextColor}
                                                    onChange={(e) =>
                                                        updateCustomization(
                                                            'buttonTextColor',
                                                            e.target.value
                                                        )
                                                    }
                                                    placeholder="#ffffff"
                                                    className="flex-1"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="buttonBorderRadius">
                                            Border Radius (px)
                                        </Label>
                                        <Input
                                            id="buttonBorderRadius"
                                            type="number"
                                            value={customization.buttonBorderRadius}
                                            onChange={(e) =>
                                                updateCustomization(
                                                    'buttonBorderRadius',
                                                    e.target.value
                                                )
                                            }
                                            placeholder="8"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="popupTitle">Popup Title</Label>
                                        <Input
                                            id="popupTitle"
                                            value={customization.popupTitle}
                                            onChange={(e) =>
                                                updateCustomization('popupTitle', e.target.value)
                                            }
                                            placeholder="Registration Form"
                                        />
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="mt-4 rounded-lg border bg-white p-4">
                                    <p className="mb-2 text-xs font-medium text-neutral-500">
                                        Preview
                                    </p>
                                    <button
                                        style={{
                                            backgroundColor: customization.buttonBgColor,
                                            color: customization.buttonTextColor,
                                            borderRadius: `${customization.buttonBorderRadius}px`,
                                            border: 'none',
                                            padding: '12px 24px',
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {customization.buttonText}
                                    </button>
                                </div>
                            </div>

                            {/* Code Output */}
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute right-2 top-2 z-10"
                                    onClick={() => handleCopy(buttonPopupCode, 'button-popup')}
                                >
                                    {copiedSection === 'button-popup' ? (
                                        <>
                                            <Check className="mr-2 size-4" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 size-4" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                                <pre className="max-h-[400px] overflow-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
                                    <code>{buttonPopupCode}</code>
                                </pre>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="iframe" className="mt-4">
                        <div className="grid gap-6 lg:grid-cols-2">
                            {/* Customization Panel */}
                            <div className="space-y-4 rounded-lg border bg-neutral-50 p-4">
                                <h4 className="flex items-center gap-2 font-medium">
                                    <Frame className="size-4" />
                                    Customize iFrame
                                </h4>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="iframeWidth">Width</Label>
                                            <Input
                                                id="iframeWidth"
                                                value={customization.iframeWidth}
                                                onChange={(e) =>
                                                    updateCustomization(
                                                        'iframeWidth',
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="100%"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="iframeHeight">Height (px)</Label>
                                            <Input
                                                id="iframeHeight"
                                                value={customization.iframeHeight}
                                                onChange={(e) =>
                                                    updateCustomization(
                                                        'iframeHeight',
                                                        e.target.value
                                                    )
                                                }
                                                placeholder="600"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="mt-4 rounded-lg border bg-white p-4">
                                    <p className="mb-2 text-xs font-medium text-neutral-500">
                                        Preview (scaled)
                                    </p>
                                    <div
                                        className="overflow-hidden rounded border bg-neutral-100"
                                        style={{
                                            width: '100%',
                                            height: '150px',
                                        }}
                                    >
                                        <iframe
                                            src={formUrl}
                                            title="Form Preview"
                                            style={{
                                                width: '200%',
                                                height: '300px',
                                                transform: 'scale(0.5)',
                                                transformOrigin: 'top left',
                                                border: 'none',
                                            }}
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-neutral-500">
                                    Tip: Use <code>100%</code> for responsive width, or specify
                                    pixels like <code>600</code>.
                                </p>
                            </div>

                            {/* Code Output */}
                            <div className="relative">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="absolute right-2 top-2 z-10"
                                    onClick={() => handleCopy(iframeCode, 'iframe')}
                                >
                                    {copiedSection === 'iframe' ? (
                                        <>
                                            <Check className="mr-2 size-4" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 size-4" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                                <pre className="max-h-[400px] overflow-auto rounded-lg bg-neutral-900 p-4 text-xs text-neutral-100">
                                    <code>{iframeCode}</code>
                                </pre>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
