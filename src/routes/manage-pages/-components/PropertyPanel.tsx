import { useEditorStore } from '../-stores/editor-store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { useState } from 'react';
import { ColorPickerField } from './ColorPickerField';
import { ImageUploadField } from './ImageUploadField';
import { VariantSwitcher } from './VariantSwitcher';
import { RichTextField } from './RichTextField';

export const PropertyPanel = () => {
    const {
        config,
        selectedComponentId,
        selectedPageId,
        selectedGlobalSettings,
        updateComponent,
        updateGlobalSettings,
        deleteComponent,
        duplicateComponent,
        reorderComponents,
        togglePagePublished,
        updatePageSeo,
    } = useEditorStore();

    if (!config) return null;

    // Global Settings Editor
    if (selectedGlobalSettings) {
        return <GlobalSettingsEditor config={config} updateGlobalSettings={updateGlobalSettings} />;
    }

    if (selectedComponentId) {
        // Find component
        let component: (typeof config.pages)[number]['components'][number] | null = null;
        let pageId = '';
        for (const p of config.pages) {
            const c = p.components.find((c) => c.id === selectedComponentId);
            if (c) {
                component = c;
                pageId = p.id;
                break;
            }
        }

        if (!component) return <div className="p-4">Component not found</div>;

        // Compute position within page for reorder
        const pageComponents = config.pages.find((p) => p.id === pageId)?.components ?? [];
        const componentIndex = pageComponents.findIndex((c) => c.id === component!.id);
        const isFirst = componentIndex === 0;
        const isLast = componentIndex === pageComponents.length - 1;

        const moveUp = () => {
            if (isFirst) return;
            const next = [...pageComponents];
            [next[componentIndex - 1], next[componentIndex]] = [next[componentIndex]!, next[componentIndex - 1]!];
            reorderComponents(pageId, next);
        };

        const moveDown = () => {
            if (isLast) return;
            const next = [...pageComponents];
            [next[componentIndex], next[componentIndex + 1]] = [next[componentIndex + 1]!, next[componentIndex]!];
            reorderComponents(pageId, next);
        };

        return (
            <div className="flex flex-col gap-6 p-4">
                {/* Component Header + Action Bar */}
                <div className="border-b pb-4">
                    <div className="mb-2 flex items-start justify-between">
                        <div>
                            <h3 className="text-base font-semibold capitalize">{component.type}</h3>
                            <div className="text-xs text-gray-400">ID: {component.id}</div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-gray-900"
                                disabled={isFirst}
                                onClick={moveUp}
                                title="Move up"
                            >
                                <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-gray-900"
                                disabled={isLast}
                                onClick={moveDown}
                                title="Move down"
                            >
                                <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-blue-600"
                                onClick={() => duplicateComponent(pageId, component!.id)}
                                title="Duplicate"
                            >
                                <Copy className="size-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="size-7 p-0 text-gray-500 hover:text-red-600"
                                onClick={() => deleteComponent(pageId, component!.id)}
                                title="Delete"
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label htmlFor="enabled-switch">Enabled</Label>
                    <Switch
                        id="enabled-switch"
                        checked={component.enabled}
                        onCheckedChange={(c) =>
                            updateComponent(pageId, component!.id, { enabled: c })
                        }
                    />
                </div>

                {/* Component-specific editors */}
                <ComponentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            </div>
        );
    }

    if (selectedPageId) {
        const page = config.pages.find((p) => p.id === selectedPageId);
        if (page) {
            return (
                <div className="flex flex-col gap-5 p-4">
                    <h3 className="text-base font-semibold">Page Settings</h3>

                    {/* Publish status */}
                    <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
                        <div>
                            <div className="flex items-center gap-1.5 font-medium text-sm">
                                <span className={`size-2 rounded-full ${page.published ? 'bg-green-500' : 'bg-gray-300'}`} />
                                {page.published ? 'Published' : 'Draft'}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                                {page.published ? 'Visible to visitors' : 'Hidden from visitors'}
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant={page.published ? 'outline' : 'default'}
                            onClick={() => togglePagePublished(page.id)}
                        >
                            {page.published ? 'Unpublish' : 'Publish'}
                        </Button>
                    </div>

                    {/* Basic info (read-only) */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label>Page Title</Label>
                            <Input value={page.title || ''} readOnly disabled />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Route Slug</Label>
                            <Input value={page.route} readOnly disabled />
                        </div>
                    </div>

                    {/* SEO */}
                    <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">SEO</h4>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Meta Title</Label>
                            <Input
                                value={page.seo?.metaTitle || ''}
                                placeholder={page.title || page.route}
                                onChange={(e) => updatePageSeo(page.id, { metaTitle: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Meta Description</Label>
                            <Textarea
                                rows={2}
                                value={page.seo?.metaDescription || ''}
                                placeholder="Brief page description for search engines..."
                                onChange={(e) => updatePageSeo(page.id, { metaDescription: e.target.value })}
                            />
                        </div>
                        <ImageUploadField
                            label="OG Image"
                            value={page.seo?.ogImage || ''}
                            onChange={(url) => updatePageSeo(page.id, { ogImage: url })}
                            placeholder="Social share image URL"
                        />
                    </div>
                </div>
            );
        }
    }

    return <div className="p-8 text-center text-gray-400">Select an item to edit</div>;
};

// Global Settings Editor Component
const GlobalSettingsEditor = ({
    config,
    updateGlobalSettings,
}: {
    config: any;
    updateGlobalSettings: (updates: any) => void;
}) => {
    const gs = config.globalSettings || {};

    const updateField = (path: string, value: any) => {
        const keys = path.split('.');
        const key0 = keys[0] as string;
        const key1 = keys[1] as string | undefined;
        const key2 = keys[2] as string | undefined;

        if (keys.length === 1) {
            updateGlobalSettings({ [key0]: value });
        } else if (keys.length === 2 && key1) {
            updateGlobalSettings({
                [key0]: {
                    ...gs[key0],
                    [key1]: value,
                },
            });
        } else if (keys.length === 3 && key1 && key2) {
            updateGlobalSettings({
                [key0]: {
                    ...gs[key0],
                    [key1]: {
                        ...gs[key0]?.[key1],
                        [key2]: value,
                    },
                },
            });
        }
    };

    return (
        <div className="flex flex-col gap-6 overflow-auto p-4">
            <div className="flex items-center gap-2 border-b pb-4">
                <Settings className="size-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">Global Settings</h3>
            </div>

            {/* Catalogue Type */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Catalogue Type</h4>
                <div className="flex items-center justify-between">
                    <Label>Type</Label>
                    <select
                        className="rounded border px-3 py-1.5 text-sm"
                        value={gs.courseCatalogeType?.value || 'Course'}
                        onChange={(e) => updateField('courseCatalogeType.value', e.target.value)}
                    >
                        <option value="Course">Course</option>
                        <option value="Product">Product</option>
                    </select>
                </div>
            </div>

            {/* Theme Settings */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Theme</h4>
                <div className="flex items-center justify-between">
                    <Label>Mode</Label>
                    <select
                        className="rounded border px-3 py-1.5 text-sm"
                        value={gs.mode || 'light'}
                        onChange={(e) => updateField('mode', e.target.value)}
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
                <div className="flex items-center justify-between">
                    <Label>Compactness</Label>
                    <select
                        className="rounded border px-3 py-1.5 text-sm"
                        value={gs.compactness || 'medium'}
                        onChange={(e) => updateField('compactness', e.target.value)}
                    >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                    </select>
                </div>
            </div>

            {/* Fonts */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Typography</h4>
                <div className="flex items-center justify-between">
                    <Label>Custom Fonts</Label>
                    <Switch
                        checked={gs.fonts?.enabled || false}
                        onCheckedChange={(c) => updateField('fonts.enabled', c)}
                    />
                </div>
                {gs.fonts?.enabled && (
                    <div className="space-y-2">
                        <Label className="text-xs">Font Family</Label>
                        <select
                            className="w-full rounded border px-3 py-1.5 text-sm"
                            value={gs.fonts?.family || 'Inter, sans-serif'}
                            onChange={(e) => updateField('fonts.family', e.target.value)}
                        >
                            <option value="Inter, sans-serif">Inter</option>
                            <option value="Roboto, sans-serif">Roboto</option>
                            <option value="Mulish, sans-serif">Mulish</option>
                            <option value="Outfit, sans-serif">Outfit</option>
                            <option value="Poppins, sans-serif">Poppins</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Payment Settings */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Payment</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Payments</Label>
                    <Switch
                        checked={gs.payment?.enabled || false}
                        onCheckedChange={(c) => updateField('payment.enabled', c)}
                    />
                </div>
                {gs.payment?.enabled && (
                    <div className="space-y-2">
                        <Label className="text-xs">Provider</Label>
                        <select
                            className="w-full rounded border px-3 py-1.5 text-sm"
                            value={gs.payment?.provider || 'razorpay'}
                            onChange={(e) => updateField('payment.provider', e.target.value)}
                        >
                            <option value="razorpay">Razorpay</option>
                            <option value="stripe">Stripe</option>
                            <option value="PHONEPE">PhonePe</option>
                            <option value="paypal">PayPal</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Lead Collection */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Lead Collection</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Lead Form</Label>
                    <Switch
                        checked={gs.leadCollection?.enabled || false}
                        onCheckedChange={(c) => updateField('leadCollection.enabled', c)}
                    />
                </div>
                {gs.leadCollection?.enabled && (
                    <>
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Mandatory</Label>
                            <Switch
                                checked={gs.leadCollection?.mandatory || false}
                                onCheckedChange={(c) => updateField('leadCollection.mandatory', c)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">Invite Link</Label>
                            <Input
                                value={gs.leadCollection?.inviteLink || ''}
                                onChange={(e) =>
                                    updateField('leadCollection.inviteLink', e.target.value)
                                }
                                placeholder="Optional invite link"
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Enquiry */}
            <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <h4 className="font-medium text-gray-700">Enquiry</h4>
                <div className="flex items-center justify-between">
                    <Label>Enable Enquiry</Label>
                    <Switch
                        checked={gs.enrquiry?.enabled || false}
                        onCheckedChange={(c) => updateField('enrquiry.enabled', c)}
                    />
                </div>
            </div>
        </div>
    );
};

// Component-specific editor
const ComponentEditor = ({ component, pageId, updateComponent }: any) => {
    const { type } = component;

    switch (type) {
        case 'header':
            return (
                <HeaderEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'footer':
            return (
                <FooterEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'heroSection':
            return (
                <HeroSectionEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'MediaShowcaseComponent':
        case 'mediaShowcase':
            return (
                <MediaShowcaseEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'bookCatalogue':
        case 'courseCatalog':
            return (
                <BookCatalogueEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'bookDetails':
            return (
                <BookDetailsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'cartComponent':
            return (
                <CartComponentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'buyRentSection':
            return (
                <BuyRentEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'statsHighlights':
            return (
                <StatsHighlightsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'testimonialSection':
            return (
                <TestimonialsEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'policyRenderer':
            return (
                <PolicyRendererEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );

        case 'faqSection':
            return <FaqSectionEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'videoEmbed':
            return <VideoEmbedEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'ctaBanner':
            return <CtaBannerEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'pricingTable':
            return <PricingTableEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'contactForm':
            return <ContactFormEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'teamSection':
            return <TeamSectionEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'announcementFeed':
            return <AnnouncementFeedEditor component={component} pageId={pageId} updateComponent={updateComponent} />;
        case 'imageGallery':
            return <ImageGalleryEditor component={component} pageId={pageId} updateComponent={updateComponent} />;

        default:
            return (
                <GenericEditor
                    component={component}
                    pageId={pageId}
                    updateComponent={updateComponent}
                />
            );
    }
};

// Media Showcase Editor with slide management
const MediaShowcaseEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedSlide, setExpandedSlide] = useState<number | null>(null);

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addSlide = () => {
        const newSlide = {
            backgroundImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
            heading: 'New Slide',
            description: 'Add your description here',
            button: {
                enabled: false,
                text: 'Learn More',
                action: 'navigate',
                target: 'homepage',
            },
        };
        updateProp('slides', [...(props.slides || []), newSlide]);
    };

    const deleteSlide = (index: number) => {
        const newSlides = props.slides.filter((_: any, i: number) => i !== index);
        updateProp('slides', newSlides);
        if (expandedSlide === index) setExpandedSlide(null);
    };

    const updateSlide = (index: number, field: string, value: any) => {
        const newSlides = [...props.slides];
        if (field.startsWith('button.')) {
            const buttonField = field.split('.')[1] as string;
            newSlides[index] = {
                ...newSlides[index],
                button: {
                    ...newSlides[index].button,
                    [buttonField]: value,
                },
            };
        } else {
            newSlides[index] = {
                ...newSlides[index],
                [field]: value,
            };
        }
        updateProp('slides', newSlides);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Showcase Settings</h4>

            <VariantSwitcher
                componentType="mediaShowcase"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'slider'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="slider">Slider</option>
                    <option value="grid">Grid</option>
                </select>
            </div>

            <div className="flex items-center justify-between">
                <Label>Autoplay</Label>
                <Switch
                    checked={props.autoplay || false}
                    onCheckedChange={(c) => updateProp('autoplay', c)}
                />
            </div>

            {props.autoplay && (
                <div className="space-y-2">
                    <Label>Autoplay Interval (ms)</Label>
                    <Input
                        type="number"
                        value={props.autoplayInterval || 3000}
                        onChange={(e) => updateProp('autoplayInterval', parseInt(e.target.value))}
                    />
                </div>
            )}

            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-medium">Slides ({props.slides?.length || 0})</h4>
                    <Button size="sm" onClick={addSlide}>
                        <Plus className="mr-1 size-4" />
                        Add Slide
                    </Button>
                </div>

                <div className="space-y-2">
                    {props.slides?.map((slide: any, index: number) => (
                        <div key={index} className="rounded border bg-gray-50 p-3">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() =>
                                        setExpandedSlide(expandedSlide === index ? null : index)
                                    }
                                    className="flex flex-1 items-center gap-2 text-left text-sm font-medium"
                                >
                                    {expandedSlide === index ? (
                                        <ChevronUp className="size-4" />
                                    ) : (
                                        <ChevronDown className="size-4" />
                                    )}
                                    Slide {index + 1}: {slide.heading}
                                </button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteSlide(index)}
                                    className="size-8 p-0 text-red-600 hover:text-red-700"
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>

                            {expandedSlide === index && (
                                <div className="mt-3 space-y-3 border-t pt-3">
                                    <ImageUploadField
                                        label="Background Image"
                                        value={slide.backgroundImage || ''}
                                        onChange={(url) =>
                                            updateSlide(index, 'backgroundImage', url)
                                        }
                                    />

                                    <div className="space-y-2">
                                        <Label className="text-xs">Heading</Label>
                                        <Input
                                            value={slide.heading}
                                            onChange={(e) =>
                                                updateSlide(index, 'heading', e.target.value)
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs">Description</Label>
                                        <Textarea
                                            value={slide.description}
                                            onChange={(e) =>
                                                updateSlide(index, 'description', e.target.value)
                                            }
                                            rows={2}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Button</Label>
                                            <Switch
                                                checked={slide.button?.enabled || false}
                                                onCheckedChange={(c) =>
                                                    updateSlide(index, 'button.enabled', c)
                                                }
                                            />
                                        </div>

                                        {slide.button?.enabled && (
                                            <div className="ml-4 space-y-2">
                                                <Input
                                                    placeholder="Button text"
                                                    value={slide.button.text}
                                                    onChange={(e) =>
                                                        updateSlide(
                                                            index,
                                                            'button.text',
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                                <Input
                                                    placeholder="Target route"
                                                    value={slide.button.target}
                                                    onChange={(e) =>
                                                        updateSlide(
                                                            index,
                                                            'button.target',
                                                            e.target.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Book Catalogue Editor
const BookCatalogueEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Catalogue Settings</h4>

            <VariantSwitcher
                componentType={component.type}
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Title</Label>
                <Input
                    value={props.title || ''}
                    onChange={(e) => updateProp('title', e.target.value)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Filters</Label>
                <Switch
                    checked={props.showFilters || false}
                    onCheckedChange={(c) => updateProp('showFilters', c)}
                />
            </div>

            <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                Advanced filter configuration and cart settings coming soon.
            </div>
        </div>
    );
};

// Buy/Rent Section Editor
const BuyRentEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (path: string, value: any) => {
        const keys = path.split('.');
        const key0 = keys[0] as string;
        const key1 = keys[1] as string | undefined;
        let newProps = { ...props };

        if (keys.length === 2 && key1) {
            newProps = {
                ...newProps,
                [key0]: {
                    ...newProps[key0],
                    [key1]: value,
                },
            };
        } else {
            newProps[path] = value;
        }

        updateComponent(pageId, component.id, { props: newProps });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Buy/Rent Settings</h4>

            <div className="space-y-2">
                <Label>Heading</Label>
                <Input
                    value={props.heading || ''}
                    onChange={(e) => updateProp('heading', e.target.value)}
                />
            </div>

            <div className="border-t pt-4">
                <h5 className="mb-2 text-xs font-semibold">Buy Option</h5>
                <div className="space-y-2">
                    <Input
                        placeholder="Button label"
                        value={props.buy?.buttonLabel || ''}
                        onChange={(e) => updateProp('buy.buttonLabel', e.target.value)}
                    />
                    <Input
                        placeholder="Level filter value"
                        value={props.buy?.levelFilterValue || ''}
                        onChange={(e) => updateProp('buy.levelFilterValue', e.target.value)}
                    />
                </div>
            </div>

            <div className="border-t pt-4">
                <h5 className="mb-2 text-xs font-semibold">Rent Option</h5>
                <div className="space-y-2">
                    <Input
                        placeholder="Button label"
                        value={props.rent?.buttonLabel || ''}
                        onChange={(e) => updateProp('rent.buttonLabel', e.target.value)}
                    />
                    <Input
                        placeholder="Level filter value"
                        value={props.rent?.levelFilterValue || ''}
                        onChange={(e) => updateProp('rent.levelFilterValue', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

// Generic editor for other components
const GenericEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Properties</h4>
            {Object.entries(props).map(([key, value]) => {
                if (typeof value === 'string' || typeof value === 'number') {
                    return (
                        <div key={key} className="space-y-2">
                            <Label className="capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Label>
                            <Input
                                value={value}
                                onChange={(e) =>
                                    updateComponent(pageId, component.id, {
                                        props: {
                                            ...props,
                                            [key]: e.target.value,
                                        },
                                    })
                                }
                            />
                        </div>
                    );
                }
                if (typeof value === 'boolean') {
                    return (
                        <div key={key} className="flex items-center justify-between">
                            <Label className="capitalize">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </Label>
                            <Switch
                                checked={value}
                                onCheckedChange={(c) =>
                                    updateComponent(pageId, component.id, {
                                        props: {
                                            ...props,
                                            [key]: c,
                                        },
                                    })
                                }
                            />
                        </div>
                    );
                }
                return null;
            })}
            {Object.values(props).some((v) => typeof v === 'object') && (
                <div className="rounded border border-yellow-100 bg-yellow-50 p-4 text-xs text-yellow-800">
                    Some complex properties are hidden. Expand component details to view full JSON.
                </div>
            )}
        </div>
    );
};

// Header Editor
const HeaderEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedNav, setExpandedNav] = useState<number | null>(null);

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addNavItem = () => {
        const newItem = { label: 'New Link', route: '/', openInSameTab: true };
        updateProp('navigation', [...(props.navigation || []), newItem]);
    };

    const updateNavItem = (index: number, field: string, value: any) => {
        const newNav = [...(props.navigation || [])];
        newNav[index] = { ...newNav[index], [field]: value };
        updateProp('navigation', newNav);
    };

    const deleteNavItem = (index: number) => {
        updateProp(
            'navigation',
            props.navigation.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Header Settings</h4>

            <VariantSwitcher
                componentType="header"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <ImageUploadField
                label="Logo"
                value={props.logo || ''}
                onChange={(url) => updateProp('logo', url)}
                placeholder="https://example.com/logo.png"
            />

            <div className="space-y-2">
                <Label>Title</Label>
                <Input
                    value={props.title || ''}
                    onChange={(e) => updateProp('title', e.target.value)}
                />
            </div>

            <ColorPickerField
                label="Background Color"
                value={props.backgroundColor || '#ffffff'}
                onChange={(c) => updateProp('backgroundColor', c)}
            />

            <ColorPickerField
                label="Text Color"
                value={props.textColor || '#000000'}
                onChange={(c) => updateProp('textColor', c)}
            />

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Navigation Items</Label>
                    <Button size="sm" variant="outline" onClick={addNavItem}>
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                {props.navigation?.map((item: any, index: number) => (
                    <div key={index} className="rounded border bg-gray-50 p-2">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setExpandedNav(expandedNav === index ? null : index)}
                                className="flex-1 text-left text-sm font-medium"
                            >
                                {expandedNav === index ? (
                                    <ChevronUp className="mr-1 inline size-3" />
                                ) : (
                                    <ChevronDown className="mr-1 inline size-3" />
                                )}
                                {item.label}
                            </button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteNavItem(index)}
                                className="size-6 p-0 text-red-600"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        {expandedNav === index && (
                            <div className="mt-2 space-y-2">
                                <Input
                                    placeholder="Label"
                                    value={item.label}
                                    onChange={(e) => updateNavItem(index, 'label', e.target.value)}
                                />
                                <Input
                                    placeholder="Route"
                                    value={item.route}
                                    onChange={(e) => updateNavItem(index, 'route', e.target.value)}
                                />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Open in same tab</Label>
                                    <Switch
                                        checked={item.openInSameTab}
                                        onCheckedChange={(c) =>
                                            updateNavItem(index, 'openInSameTab', c)
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Footer Editor
const FooterEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const updateLeftSection = (field: string, value: any) => {
        updateProp('leftSection', { ...props.leftSection, [field]: value });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Footer Settings</h4>

            <VariantSwitcher
                componentType="footer"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'four-column'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="two-column">Two Column</option>
                    <option value="three-column">Three Column</option>
                    <option value="four-column">Four Column</option>
                </select>
            </div>

            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Left Section</h5>
                <div className="space-y-2">
                    <Label className="text-xs">Title</Label>
                    <Input
                        value={props.leftSection?.title || ''}
                        onChange={(e) => updateLeftSection('title', e.target.value)}
                    />
                </div>
                <RichTextField
                    label="Description"
                    value={props.leftSection?.text || ''}
                    onChange={(html) => updateLeftSection('text', html)}
                    placeholder="Platform description..."
                />
            </div>

            <div className="space-y-2">
                <Label>Bottom Note</Label>
                <Input
                    value={props.bottomNote || ''}
                    onChange={(e) => updateProp('bottomNote', e.target.value)}
                />
            </div>
        </div>
    );
};

// Hero Section Editor
const HeroSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const updateLeft = (field: string, value: any) => {
        updateProp('left', { ...props.left, [field]: value });
    };

    const updateRight = (field: string, value: any) => {
        updateProp('right', { ...props.right, [field]: value });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Hero Section Settings</h4>

            <VariantSwitcher
                componentType="heroSection"
                currentProps={props}
                onApply={(newProps) => updateComponent(pageId, component.id, { props: newProps })}
            />

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'split'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="split">Split</option>
                    <option value="centered">Centered</option>
                    <option value="fullwidth">Full Width</option>
                </select>
            </div>

            <ImageUploadField
                label="Background Image"
                value={props.backgroundImage || ''}
                onChange={(url) => updateProp('backgroundImage', url)}
            />

            <ColorPickerField
                label="Background Color"
                value={props.backgroundColor || '#ffffff'}
                onChange={(c) => updateProp('backgroundColor', c)}
            />

            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Left Content</h5>
                <div className="space-y-2">
                    <Label className="text-xs">Title</Label>
                    <Input
                        value={props.left?.title || ''}
                        onChange={(e) => updateLeft('title', e.target.value)}
                    />
                </div>
                <RichTextField
                    label="Description"
                    value={props.left?.description || ''}
                    onChange={(html) => updateLeft('description', html)}
                    placeholder="Enter section description..."
                />
            </div>

            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Right Image</h5>
                <ImageUploadField
                    label="Image"
                    value={props.right?.image || ''}
                    onChange={(url) => updateRight('image', url)}
                />
                <div className="space-y-2">
                    <Label className="text-xs">Alt Text</Label>
                    <Input
                        value={props.right?.alt || ''}
                        onChange={(e) => updateRight('alt', e.target.value)}
                    />
                </div>
            </div>
        </div>
    );
};

// Book Details Editor
const BookDetailsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Book Details Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Show Enquiry</Label>
                <Switch
                    checked={props.showEnquiry || false}
                    onCheckedChange={(c) => updateProp('showEnquiry', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Payment</Label>
                <Switch
                    checked={props.showPayment || false}
                    onCheckedChange={(c) => updateProp('showPayment', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Add to Cart</Label>
                <Switch
                    checked={props.showAddToCart || false}
                    onCheckedChange={(c) => updateProp('showAddToCart', c)}
                />
            </div>
        </div>
    );
};

// Cart Component Editor
const CartComponentEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Cart Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Show Item Image</Label>
                <Switch
                    checked={props.showItemImage ?? true}
                    onCheckedChange={(c) => updateProp('showItemImage', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Item Title</Label>
                <Switch
                    checked={props.showItemTitle ?? true}
                    onCheckedChange={(c) => updateProp('showItemTitle', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Quantity Selector</Label>
                <Switch
                    checked={props.showQuantitySelector ?? true}
                    onCheckedChange={(c) => updateProp('showQuantitySelector', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Remove Button</Label>
                <Switch
                    checked={props.showRemoveButton ?? true}
                    onCheckedChange={(c) => updateProp('showRemoveButton', c)}
                />
            </div>

            <div className="flex items-center justify-between">
                <Label>Show Price</Label>
                <Switch
                    checked={props.showPrice ?? true}
                    onCheckedChange={(c) => updateProp('showPrice', c)}
                />
            </div>

            <div className="space-y-2">
                <Label>Empty State Message</Label>
                <Input
                    value={props.emptyStateMessage || ''}
                    onChange={(e) => updateProp('emptyStateMessage', e.target.value)}
                />
            </div>
        </div>
    );
};

// Stats Highlights Editor
const StatsHighlightsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addStat = () => {
        const newStat = { label: 'New Stat', value: '0' };
        updateProp('stats', [...(props.stats || []), newStat]);
    };

    const updateStat = (index: number, field: string, value: string) => {
        const newStats = [...(props.stats || [])];
        newStats[index] = { ...newStats[index], [field]: value };
        updateProp('stats', newStats);
    };

    const deleteStat = (index: number) => {
        updateProp(
            'stats',
            props.stats.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Stats Highlights Settings</h4>

            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                    value={props.headerText || ''}
                    onChange={(e) => updateProp('headerText', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Style</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.style || 'card'}
                    onChange={(e) => updateProp('style', e.target.value)}
                >
                    <option value="circle">Circle</option>
                    <option value="card">Card</option>
                    <option value="minimal">Minimal</option>
                </select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Stats</Label>
                    <Button size="sm" variant="outline" onClick={addStat}>
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                {props.stats?.map((stat: any, index: number) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 rounded border bg-gray-50 p-2"
                    >
                        <Input
                            placeholder="Label"
                            value={stat.label}
                            onChange={(e) => updateStat(index, 'label', e.target.value)}
                            className="flex-1"
                        />
                        <Input
                            placeholder="Value"
                            value={stat.value}
                            onChange={(e) => updateStat(index, 'value', e.target.value)}
                            className="w-24"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteStat(index)}
                            className="size-8 p-0 text-red-600"
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Testimonials Editor
const TestimonialsEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updateProp = (key: string, value: any) => {
        updateComponent(pageId, component.id, {
            props: { ...props, [key]: value },
        });
    };

    const addTestimonial = () => {
        const newItem = {
            name: 'Customer Name',
            role: 'Role',
            feedback: 'Great experience!',
            avatar: '',
        };
        updateProp('testimonials', [...(props.testimonials || []), newItem]);
    };

    const updateTestimonial = (index: number, field: string, value: string) => {
        const newItems = [...(props.testimonials || [])];
        newItems[index] = { ...newItems[index], [field]: value };
        updateProp('testimonials', newItems);
    };

    const deleteTestimonial = (index: number) => {
        updateProp(
            'testimonials',
            props.testimonials.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Testimonials Settings</h4>

            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input
                    value={props.headerText || ''}
                    onChange={(e) => updateProp('headerText', e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label>Layout</Label>
                <select
                    className="w-full rounded border px-3 py-2 text-sm"
                    value={props.layout || 'carousel'}
                    onChange={(e) => updateProp('layout', e.target.value)}
                >
                    <option value="carousel">Carousel</option>
                    <option value="grid-scroll">Grid Scroll</option>
                    <option value="static-grid">Static Grid</option>
                </select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Testimonials</Label>
                    <Button size="sm" variant="outline" onClick={addTestimonial}>
                        <Plus className="mr-1 size-3" /> Add
                    </Button>
                </div>
                {props.testimonials?.map((item: any, index: number) => (
                    <div key={index} className="space-y-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Testimonial {index + 1}</span>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteTestimonial(index)}
                                className="size-6 p-0 text-red-600"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                        <Input
                            placeholder="Name"
                            value={item.name}
                            onChange={(e) => updateTestimonial(index, 'name', e.target.value)}
                        />
                        <Input
                            placeholder="Role"
                            value={item.role}
                            onChange={(e) => updateTestimonial(index, 'role', e.target.value)}
                        />
                        <Textarea
                            placeholder="Feedback"
                            rows={2}
                            value={item.feedback}
                            onChange={(e) => updateTestimonial(index, 'feedback', e.target.value)}
                        />
                        <Input
                            placeholder="Avatar URL"
                            value={item.avatar}
                            onChange={(e) => updateTestimonial(index, 'avatar', e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

// Policy Renderer Editor
const PolicyRendererEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;

    const updatePolicy = (policyKey: string, field: string, value: string) => {
        const policies = props.policies || {};
        updateComponent(pageId, component.id, {
            props: {
                ...props,
                policies: {
                    ...policies,
                    [policyKey]: {
                        ...policies[policyKey],
                        [field]: value,
                    },
                },
            },
        });
    };

    const addPolicy = () => {
        const key = `policy_${Date.now()}`;
        const policies = props.policies || {};
        updateComponent(pageId, component.id, {
            props: {
                ...props,
                policies: {
                    ...policies,
                    [key]: { title: 'New Policy', content: '<p>Policy content here...</p>' },
                },
            },
        });
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Policy Settings</h4>

            <div className="flex items-center justify-between">
                <Label>Policies</Label>
                <Button size="sm" variant="outline" onClick={addPolicy}>
                    <Plus className="mr-1 size-3" /> Add
                </Button>
            </div>

            {Object.entries(props.policies || {}).map(([key, policy]: [string, any]) => (
                <div key={key} className="space-y-2 rounded border bg-gray-50 p-3">
                    <div className="space-y-2">
                        <Label className="text-xs">Title</Label>
                        <Input
                            value={policy.title || ''}
                            onChange={(e) => updatePolicy(key, 'title', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Content (HTML)</Label>
                        <Textarea
                            rows={4}
                            value={policy.content || ''}
                            onChange={(e) => updatePolicy(key, 'content', e.target.value)}
                            className="font-mono text-xs"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

// FAQ Section Editor
const FaqSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addFaq = () => updateProp('faqs', [...(props.faqs || []), { question: 'New Question', answer: 'Answer here.' }]);
    const deleteFaq = (i: number) => updateProp('faqs', props.faqs.filter((_: any, idx: number) => idx !== i));
    const updateFaq = (i: number, field: string, value: string) => {
        const next = [...(props.faqs || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('faqs', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">FAQ Settings</h4>
            <div className="space-y-2">
                <Label>Header Text</Label>
                <Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Subheading</Label>
                <Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} />
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#F9FAFB'} onChange={(c) => updateProp('backgroundColor', c)} />
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Questions ({props.faqs?.length || 0})</Label>
                    <Button size="sm" onClick={addFaq}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.faqs?.map((faq: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedFaq === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {faq.question}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteFaq(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedFaq === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Question" value={faq.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} />
                                <Textarea placeholder="Answer" rows={2} value={faq.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Video Embed Editor
const VideoEmbedEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Video Embed Settings</h4>
            <div className="space-y-2">
                <Label>YouTube / Vimeo URL</Label>
                <Input value={props.url || ''} placeholder="https://youtu.be/..." onChange={(e) => updateProp('url', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Title</Label>
                <Input value={props.title || ''} onChange={(e) => updateProp('title', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Caption</Label>
                <Input value={props.caption || ''} placeholder="Optional caption below video" onChange={(e) => updateProp('caption', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.aspectRatio || '16:9'} onChange={(e) => updateProp('aspectRatio', e.target.value)}>
                    <option value="16:9">16:9 (Widescreen)</option>
                    <option value="4:3">4:3 (Standard)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="9:16">9:16 (Vertical)</option>
                </select>
            </div>
            <div className="flex items-center justify-between">
                <Label>Autoplay</Label>
                <Switch checked={props.autoplay || false} onCheckedChange={(c) => updateProp('autoplay', c)} />
            </div>
        </div>
    );
};

// CTA Banner Editor
const CtaBannerEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">CTA Banner Settings</h4>
            <div className="space-y-2">
                <Label>Heading</Label>
                <Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Subheading</Label>
                <Textarea rows={2} value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Layout</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.layout || 'centered'} onChange={(e) => updateProp('layout', e.target.value)}>
                    <option value="centered">Centered</option>
                    <option value="split">Split (text left, button right)</option>
                </select>
            </div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#3B82F6'} onChange={(c) => updateProp('backgroundColor', c)} />
            <ColorPickerField label="Text Color" value={props.textColor || '#FFFFFF'} onChange={(c) => updateProp('textColor', c)} />
            <div className="space-y-3 rounded border bg-gray-50 p-3">
                <h5 className="text-xs font-semibold">Button</h5>
                <div className="flex items-center justify-between">
                    <Label className="text-xs">Show Button</Label>
                    <Switch checked={props.button?.enabled || false} onCheckedChange={(c) => updateProp('button', { ...props.button, enabled: c })} />
                </div>
                {props.button?.enabled && (
                    <>
                        <Input placeholder="Button text" value={props.button?.text || ''} onChange={(e) => updateProp('button', { ...props.button, text: e.target.value })} />
                        <Input placeholder="Target route" value={props.button?.target || ''} onChange={(e) => updateProp('button', { ...props.button, target: e.target.value })} />
                    </>
                )}
            </div>
        </div>
    );
};

// Pricing Table Editor
const PricingTableEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addPlan = () => updateProp('plans', [...(props.plans || []), { name: 'New Plan', price: '₹0', period: '/month', description: '', features: ['Feature 1'], highlighted: false, buttonText: 'Get Started', buttonTarget: '' }]);
    const deletePlan = (i: number) => updateProp('plans', props.plans.filter((_: any, idx: number) => idx !== i));
    const updatePlan = (i: number, field: string, value: any) => {
        const next = [...(props.plans || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('plans', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Pricing Table Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Plans ({props.plans?.length || 0})</Label>
                    <Button size="sm" onClick={addPlan}><Plus className="mr-1 size-3" />Add Plan</Button>
                </div>
                {props.plans?.map((plan: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedPlan(expandedPlan === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedPlan === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {plan.name} — {plan.price}{plan.period}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deletePlan(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedPlan === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Plan name" value={plan.name} onChange={(e) => updatePlan(i, 'name', e.target.value)} />
                                <div className="flex gap-2">
                                    <Input placeholder="Price (e.g. ₹999)" value={plan.price} onChange={(e) => updatePlan(i, 'price', e.target.value)} className="flex-1" />
                                    <Input placeholder="/month" value={plan.period} onChange={(e) => updatePlan(i, 'period', e.target.value)} className="w-24" />
                                </div>
                                <Input placeholder="Description" value={plan.description || ''} onChange={(e) => updatePlan(i, 'description', e.target.value)} />
                                <div className="space-y-1">
                                    <Label className="text-xs">Features (one per line)</Label>
                                    <Textarea rows={3} value={(plan.features || []).join('\n')} onChange={(e) => updatePlan(i, 'features', e.target.value.split('\n').filter(Boolean))} />
                                </div>
                                <Input placeholder="Button text" value={plan.buttonText || ''} onChange={(e) => updatePlan(i, 'buttonText', e.target.value)} />
                                <Input placeholder="Button target route" value={plan.buttonTarget || ''} onChange={(e) => updatePlan(i, 'buttonTarget', e.target.value)} />
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs">Highlighted (recommended)</Label>
                                    <Switch checked={plan.highlighted || false} onCheckedChange={(c) => updatePlan(i, 'highlighted', c)} />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Contact Form Editor
const ContactFormEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Contact Form Settings</h4>
            <div className="space-y-2"><Label>Heading</Label><Input value={props.heading || ''} onChange={(e) => updateProp('heading', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="space-y-2"><Label>Submit Button Label</Label><Input value={props.submitLabel || 'Send Message'} onChange={(e) => updateProp('submitLabel', e.target.value)} /></div>
            <div className="space-y-2"><Label>Success Message</Label><Input value={props.successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} /></div>
            <ColorPickerField label="Background Color" value={props.backgroundColor || '#FFFFFF'} onChange={(c) => updateProp('backgroundColor', c)} />
            <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                Form submissions are sent as enquiries. Configure the Enquiry setting in Global Settings.
            </div>
        </div>
    );
};

// Team Section Editor
const TeamSectionEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedMember, setExpandedMember] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addMember = () => updateProp('members', [...(props.members || []), { name: 'Team Member', role: 'Role', bio: '', avatar: '' }]);
    const deleteMember = (i: number) => updateProp('members', props.members.filter((_: any, idx: number) => idx !== i));
    const updateMember = (i: number, field: string, value: string) => {
        const next = [...(props.members || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('members', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Team Section Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Subheading</Label><Input value={props.subheading || ''} onChange={(e) => updateProp('subheading', e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Columns</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.columns || 3} onChange={(e) => updateProp('columns', parseInt(e.target.value))}>
                    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                </select>
            </div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Members ({props.members?.length || 0})</Label>
                    <Button size="sm" onClick={addMember}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.members?.map((m: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedMember(expandedMember === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedMember === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {m.name} — {m.role}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteMember(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedMember === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <ImageUploadField label="Avatar" value={m.avatar || ''} onChange={(url) => updateMember(i, 'avatar', url)} />
                                <Input placeholder="Name" value={m.name} onChange={(e) => updateMember(i, 'name', e.target.value)} />
                                <Input placeholder="Role / Title" value={m.role} onChange={(e) => updateMember(i, 'role', e.target.value)} />
                                <Textarea placeholder="Short bio" rows={2} value={m.bio || ''} onChange={(e) => updateMember(i, 'bio', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Announcement Feed Editor
const AnnouncementFeedEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addAnnouncement = () => updateProp('announcements', [...(props.announcements || []), { title: 'New Announcement', date: new Date().toISOString().slice(0, 10), summary: 'Summary here.', tag: 'News' }]);
    const deleteAnnouncement = (i: number) => updateProp('announcements', props.announcements.filter((_: any, idx: number) => idx !== i));
    const updateAnnouncement = (i: number, field: string, value: string) => {
        const next = [...(props.announcements || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('announcements', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Announcement Feed Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2"><Label>Layout</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.layout || 'list'} onChange={(e) => updateProp('layout', e.target.value)}>
                    <option value="list">List</option><option value="grid">Grid</option>
                </select>
            </div>
            <div className="flex items-center justify-between"><Label>Show Date</Label><Switch checked={props.showDate ?? true} onCheckedChange={(c) => updateProp('showDate', c)} /></div>
            <div className="flex items-center justify-between"><Label>Show Tag</Label><Switch checked={props.showTag ?? true} onCheckedChange={(c) => updateProp('showTag', c)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Announcements ({props.announcements?.length || 0})</Label>
                    <Button size="sm" onClick={addAnnouncement}><Plus className="mr-1 size-3" />Add</Button>
                </div>
                {props.announcements?.map((a: any, i: number) => (
                    <div key={i} className="mb-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setExpandedItem(expandedItem === i ? null : i)} className="flex flex-1 items-center gap-2 text-left text-sm font-medium">
                                {expandedItem === i ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                                {a.title}
                            </button>
                            <Button size="sm" variant="ghost" onClick={() => deleteAnnouncement(i)} className="size-7 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        {expandedItem === i && (
                            <div className="mt-3 space-y-2 border-t pt-3">
                                <Input placeholder="Title" value={a.title} onChange={(e) => updateAnnouncement(i, 'title', e.target.value)} />
                                <Input type="date" value={a.date || ''} onChange={(e) => updateAnnouncement(i, 'date', e.target.value)} />
                                <Input placeholder="Tag (e.g. News, Update)" value={a.tag || ''} onChange={(e) => updateAnnouncement(i, 'tag', e.target.value)} />
                                <Textarea placeholder="Summary" rows={2} value={a.summary || ''} onChange={(e) => updateAnnouncement(i, 'summary', e.target.value)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Image Gallery Editor
const ImageGalleryEditor = ({ component, pageId, updateComponent }: any) => {
    const { props } = component;
    const updateProp = (key: string, value: any) =>
        updateComponent(pageId, component.id, { props: { ...props, [key]: value } });

    const addImage = () => updateProp('images', [...(props.images || []), { src: '', alt: '', caption: '' }]);
    const deleteImage = (i: number) => updateProp('images', props.images.filter((_: any, idx: number) => idx !== i));
    const updateImage = (i: number, field: string, value: string) => {
        const next = [...(props.images || [])];
        next[i] = { ...next[i], [field]: value };
        updateProp('images', next);
    };

    return (
        <div className="space-y-4">
            <h4 className="text-sm font-medium">Image Gallery Settings</h4>
            <div className="space-y-2"><Label>Header Text</Label><Input value={props.headerText || ''} onChange={(e) => updateProp('headerText', e.target.value)} /></div>
            <div className="space-y-2">
                <Label>Columns</Label>
                <select className="w-full rounded border px-3 py-2 text-sm" value={props.columns || 3} onChange={(e) => updateProp('columns', parseInt(e.target.value))}>
                    <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                </select>
            </div>
            <div className="flex items-center justify-between"><Label>Show Captions</Label><Switch checked={props.showCaptions || false} onCheckedChange={(c) => updateProp('showCaptions', c)} /></div>
            <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                    <Label>Images ({props.images?.length || 0})</Label>
                    <Button size="sm" onClick={addImage}><Plus className="mr-1 size-3" />Add Image</Button>
                </div>
                {props.images?.map((img: any, i: number) => (
                    <div key={i} className="mb-2 space-y-2 rounded border bg-gray-50 p-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Image {i + 1}</span>
                            <Button size="sm" variant="ghost" onClick={() => deleteImage(i)} className="size-6 p-0 text-red-600"><Trash2 className="size-3" /></Button>
                        </div>
                        <ImageUploadField label="Image" value={img.src || ''} onChange={(url) => updateImage(i, 'src', url)} />
                        <Input placeholder="Alt text" value={img.alt || ''} onChange={(e) => updateImage(i, 'alt', e.target.value)} />
                        {props.showCaptions && <Input placeholder="Caption" value={img.caption || ''} onChange={(e) => updateImage(i, 'caption', e.target.value)} />}
                    </div>
                ))}
            </div>
        </div>
    );
};
