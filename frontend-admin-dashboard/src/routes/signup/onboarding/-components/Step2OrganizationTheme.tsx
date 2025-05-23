import { MyButton } from '@/components/design-system/button';
import { OrganizationOnboardingProps } from '..';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/theme/theme-provider';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useOrganizationStore from '../-zustand-store/step1OrganizationZustand';
import themeData from '@/constants/themes/theme.json';

// Predefined themes with their base colors
const presetThemes = [
    { name: 'Orange', code: 'primary' },
    { name: 'Blue', code: 'blue' },
    { name: 'Green', code: 'green' },
    { name: 'Purple', code: 'purple' },
    { name: 'Red', code: 'red' },
    { name: 'Pink', code: 'pink' },
    { name: 'Indigo', code: 'indigo' },
    { name: 'Yellow', code: 'amber' },
    { name: 'Cyan', code: 'cyan' },
];

const organizationThemeSetup = z.object({
    instituteThemeCode: z.union([z.string(), z.undefined()]),
});

type FormValues = z.infer<typeof organizationThemeSetup>;

const Step2OrganizationTheme: React.FC<OrganizationOnboardingProps> = ({
    currentStep,
    handleCompleteCurrentStep,
    completedSteps,
}) => {
    const [selectedTheme, setSelectedTheme] = useState(presetThemes[0]?.code || 'primary');
    // const [customColor, setCustomColor] = useState('#ED7424');
    // const [openCustomDialog, setOpenCustomDialog] = useState(false);
    const { formData, setFormData } = useOrganizationStore();
    const form = useForm<FormValues>({
        resolver: zodResolver(organizationThemeSetup),
        defaultValues: {
            instituteThemeCode: formData.instituteThemeCode ?? '',
        },
        mode: 'onChange',
    });
    const { setPrimaryColor } = useTheme();

    console.log('Current step:', currentStep);
    console.log('Completed steps:', completedSteps);

    // Get theme shades from theme.json instead of generating them
    const getThemeShades = (code: string) => {
        const theme = themeData.themes.find((theme) => theme.code === code);
        if (theme && theme.colors) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            return Object.entries(theme.colors).map(([key, color]) => color);
        }
        return [];
    };

    const handleThemeSelect = (code: string) => {
        setSelectedTheme(code);
        setPrimaryColor(code);
        setFormData({ ...formData, instituteThemeCode: code });
        form.setValue('instituteThemeCode', code);
    };

    // const handleCustomColorSubmit = () => {
    //     setSelectedTheme(customColor);
    //     setPrimaryColor(customColor);
    //     setFormData({ ...formData, instituteThemeCode: customColor });
    //     form.setValue('instituteThemeCode', customColor);
    //     setOpenCustomDialog(false);
    // };

    return (
        <div className="my-6 flex w-3/4 flex-col items-center justify-center gap-4 p-4">
            <h1 className="mb-4 text-[1.6rem]">Set your organization theme</h1>

            <div className="mb-2 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {presetThemes.map((theme) => {
                    const shades = getThemeShades(theme.code);
                    return (
                        <div
                            key={theme.name}
                            role="button"
                            onClick={() => handleThemeSelect(theme.code)}
                            className={cn(
                                'overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-md',
                                selectedTheme === theme.code
                                    ? 'ring-2 ring-primary-500 ring-offset-2'
                                    : 'ring-1 ring-gray-200'
                            )}
                            aria-label={`Select ${theme.name} theme`}
                        >
                            <div className="flex flex-col">
                                {shades?.map((shade, index) => (
                                    <div
                                        key={index}
                                        className="h-7"
                                        style={{ backgroundColor: shade }}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* //TODO: Implement custom theme */}

            {/* <Dialog open={openCustomDialog} onOpenChange={setOpenCustomDialog}>
                <DialogTrigger asChild>
                    <button className="mb-8 font-medium text-primary-400 hover:text-primary-500">
                        Custom Color
                    </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Custom Theme</DialogTitle>
                    </DialogHeader>
                    <Tabs defaultValue="picker" className="mt-4 w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="picker">Color Picker</TabsTrigger>
                            <TabsTrigger value="hex">Hex Code</TabsTrigger>
                        </TabsList>
                        <TabsContent value="picker" className="w-full py-4">
                            <HexColorPicker
                                color={customColor}
                                onChange={(color) => {
                                    setCustomColor(color);
                                }}
                                className="w-full "
                            />
                        </TabsContent>
                        <TabsContent value="hex" className="py-4">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={customColor}
                                    onChange={(e) => {
                                        // Validate hex code format
                                        const hex = e.target.value;
                                        if (hex.match(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
                                            setCustomColor(hex);
                                        } else if (hex.match(/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
                                            setCustomColor(`#${hex}`);
                                        } else if (hex.startsWith('#') && hex.length <= 7) {
                                            setCustomColor(hex);
                                        } else if (hex.length <= 6) {
                                            setCustomColor(`#${hex}`);
                                        }
                                    }}
                                    placeholder="#RRGGBB"
                                />
                                <div
                                    className="size-10 rounded-md border border-gray-200"
                                    style={{ backgroundColor: customColor }}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                    <div className="mt-4">
                        <h3 className="mb-2 text-sm font-medium">Preview</h3>
                        <div className="overflow-hidden rounded-lg">
                            {getCustomColorShades(customColor).map((shade, index) => (
                                <div
                                    key={index}
                                    className="h-8"
                                    style={{ backgroundColor: shade }}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button
                            style={{ color: customColor, border: `1px solid ${customColor}` }}
                            onClick={handleCustomColorSubmit}
                        >
                            Apply
                        </Button>
                    </div>
                </DialogContent>
            </Dialog> */}

            <MyButton
                type="button"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                onClick={() => {
                    handleCompleteCurrentStep();
                }}
                className="mt-4"
            >
                Continue
            </MyButton>
        </div>
    );
};

// For custom colors, we still need a function to generate shades
// This is only used for the preview in the custom color dialog
// const getCustomColorShades = (hexColor: string) => {
//     // Convert hex to RGB
//     const r = Number.parseInt(hexColor.slice(1, 3), 16);
//     const g = Number.parseInt(hexColor.slice(3, 5), 16);
//     const b = Number.parseInt(hexColor.slice(5, 7), 16);

//     return [
//         hexColor, // Original
//         `rgb(${Math.floor(r * 0.8)}, ${Math.floor(g * 0.8)}, ${Math.floor(b * 0.8)})`, // Darker
//         `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`, // Even darker
//         `rgb(${Math.floor(r * 0.4)}, ${Math.floor(g * 0.4)}, ${Math.floor(b * 0.4)})`,
//         `rgb(${Math.floor(r * 0.2)}, ${Math.floor(g * 0.2)}, ${Math.floor(b * 0.2)})`,
//     ];
// };

export default Step2OrganizationTheme;
