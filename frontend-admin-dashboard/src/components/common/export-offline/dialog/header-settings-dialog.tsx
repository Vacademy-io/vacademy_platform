import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColorPicker } from '@/components/ui/color-picker';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useExportSettings } from '../contexts/export-settings-context';
import { TextSectionSettings } from './text-section-settings';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect } from 'react';
import useInstituteLogoStore from '../../layout-container/sidebar/institutelogo-global-zustand';

export function HeaderSettingsDialog() {
    const { settings, updateSettings } = useExportSettings();
    const { headerSettings } = settings;
    const { instituteLogo } = useInstituteLogoStore();

    /* eslint-disable-next-line */
    const updateHeaderSettings = (newSettings: any) => {
        updateSettings({
            ...settings,
            headerSettings: {
                ...headerSettings,
                ...newSettings,
            },
        });
    };

    useEffect(() => {
        updateHeaderSettings({
            logo: { ...headerSettings.logo, url: instituteLogo },
        });
    }, [headerSettings.logo.showInstitutionLogo]);

    return (
        <Tabs defaultValue="left-section" className="space-y-4">
            <TabsList className="w-full">
                <TabsTrigger value="left-section">Left Section</TabsTrigger>
                <TabsTrigger value="center-section">Center Section</TabsTrigger>
                <TabsTrigger value="right-section">Right Section</TabsTrigger>
                <TabsTrigger value="logo">Logo</TabsTrigger>
                <TabsTrigger value="style">General</TabsTrigger>
            </TabsList>

            <TabsContent value="left-section">
                <Card>
                    <CardContent className="pt-6">
                        <TextSectionSettings
                            title="Left Section"
                            settings={headerSettings.leftSection}
                            onChange={(newSettings) =>
                                updateHeaderSettings({ leftSection: newSettings })
                            }
                        />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="center-section">
                <Card>
                    <CardContent className="pt-6">
                        <TextSectionSettings
                            title="Center Section"
                            settings={headerSettings.centerSection}
                            onChange={(newSettings) =>
                                updateHeaderSettings({ centerSection: newSettings })
                            }
                            showSectionNameOption
                        />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="right-section">
                <Card>
                    <CardContent className="pt-6">
                        <TextSectionSettings
                            title="Right Section"
                            settings={headerSettings.rightSection}
                            onChange={(newSettings) =>
                                updateHeaderSettings({ rightSection: newSettings })
                            }
                        />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="logo">
                <Card>
                    <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between">
                            <Label>Show Logo</Label>
                            <Switch
                                checked={headerSettings.logo.visible}
                                onCheckedChange={(checked) =>
                                    updateHeaderSettings({
                                        logo: { ...headerSettings.logo, visible: checked },
                                    })
                                }
                            />
                        </div>

                        {headerSettings.logo.visible && (
                            <div className="ml-4 space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Label>Use Institute Logo</Label>
                                    <Switch
                                        checked={settings.headerSettings.logo.showInstitutionLogo}
                                        onCheckedChange={(checked) =>
                                            updateHeaderSettings({
                                                logo: {
                                                    ...headerSettings.logo,
                                                    showInstitutionLogo: checked,
                                                },
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Logo URL</Label>
                                    <Input
                                        value={headerSettings.logo.url}
                                        onChange={(e) =>
                                            updateHeaderSettings({
                                                logo: {
                                                    ...headerSettings.logo,
                                                    url: e.target.value,
                                                },
                                            })
                                        }
                                        placeholder="Enter logo URL..."
                                    />

                                    <div className="space-y-2">
                                        <Label>Upload Logo</Label>
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    const reader = new FileReader();
                                                    reader.onload = () => {
                                                        updateHeaderSettings({
                                                            logo: {
                                                                ...headerSettings.logo,
                                                                url: reader.result as string,
                                                            },
                                                        });
                                                    };
                                                    reader.readAsDataURL(file);
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Position</Label>
                                    <Select
                                        value={headerSettings.logo.position}
                                        onValueChange={(value) =>
                                            updateHeaderSettings({
                                                logo: { ...headerSettings.logo, position: value },
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="left">Left</SelectItem>
                                            <SelectItem value="right">Right</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Size (px)</Label>
                                    <Input
                                        type="number"
                                        min={20}
                                        max={150}
                                        value={headerSettings.logo.size}
                                        onChange={(e) =>
                                            updateHeaderSettings({
                                                logo: {
                                                    ...headerSettings.logo,
                                                    size: parseInt(e.target.value),
                                                },
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="style">
                <Card>
                    <CardContent className="grid grid-cols-2 place-content-center space-x-4 py-2">
                        <div className="flex items-center space-x-2">
                            <Label>Background Color</Label>
                            <ColorPicker
                                value={headerSettings.style.backgroundColor}
                                onChange={(color) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            backgroundColor: color,
                                        },
                                    })
                                }
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Label>Text Color</Label>
                            <ColorPicker
                                value={headerSettings.style.textColor}
                                onChange={(color) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            textColor: color,
                                        },
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Border Style</Label>
                            <Select
                                value={headerSettings.style.borderStyle}
                                onValueChange={(value) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            borderStyle: value,
                                        },
                                    })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="solid">Solid</SelectItem>
                                    <SelectItem value="dashed">Dashed</SelectItem>
                                    <SelectItem value="dotted">Dotted</SelectItem>
                                    <SelectItem value="double">Double</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Border Width (px)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={10}
                                value={headerSettings.style.borderWidth}
                                onChange={(e) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            borderWidth: parseInt(e.target.value),
                                        },
                                    })
                                }
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <Label>Border Color</Label>
                            <ColorPicker
                                value={headerSettings.style.borderColor}
                                onChange={(color) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            borderColor: color,
                                        },
                                    })
                                }
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Padding (px)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={48}
                                value={headerSettings.style.padding}
                                onChange={(e) =>
                                    updateHeaderSettings({
                                        style: {
                                            ...headerSettings.style,
                                            padding: parseInt(e.target.value),
                                        },
                                    })
                                }
                            />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
