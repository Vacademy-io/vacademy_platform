import { useEditorStore } from '../-stores/editor-store';
import { Component } from '../-types/editor-types';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PageCanvas = () => {
    const {
        config,
        selectedPageId,
        selectComponent,
        selectedComponentId,
        selectedGlobalSettings,
        deleteComponent,
        duplicateComponent,
    } = useEditorStore();

    if (!config) return null;

    // Show global settings (header/footer)
    if (selectedGlobalSettings) {
        const header = config.globalSettings?.layout?.header;
        const footer = config.globalSettings?.layout?.footer;

        return (
            <div
                className="flex min-h-full w-full flex-1 flex-col gap-3 bg-white p-4"
                onClick={() => selectComponent(null)}
            >
                <div className="mb-2 border-b pb-3">
                    <h2 className="text-lg font-semibold text-gray-800">Global Settings</h2>
                    <p className="text-sm text-gray-500">
                        Configure header, footer, and global properties
                    </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                    {/* Header Section */}
                    {header && (
                        <div
                            className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md
                                ${selectedComponentId === 'global-header' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                selectComponent('global-header');
                            }}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <span className="rounded-md bg-blue-100 px-3 py-1.5 text-xs font-bold uppercase text-blue-700">
                                    Header
                                </span>
                                {selectedComponentId === 'global-header' && (
                                    <span className="text-xs font-medium text-blue-600">
                                        ● Selected
                                    </span>
                                )}
                            </div>
                            <ComponentSummary component={header as Component} />
                        </div>
                    )}

                    {/* Footer Section */}
                    {footer && (
                        <div
                            className={`cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md
                                ${selectedComponentId === 'global-footer' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                selectComponent('global-footer');
                            }}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <span className="rounded-md bg-purple-100 px-3 py-1.5 text-xs font-bold uppercase text-purple-700">
                                    Footer
                                </span>
                                {selectedComponentId === 'global-footer' && (
                                    <span className="text-xs font-medium text-blue-600">
                                        ● Selected
                                    </span>
                                )}
                            </div>
                            <ComponentSummary component={footer as Component} />
                        </div>
                    )}
                </div>

                {/* Other Global Settings Info */}
                <div className="mt-2 rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Settings className="size-4" />
                        Configuration Overview
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Catalogue Type</div>
                            <div className="font-medium text-gray-900">
                                {config.globalSettings?.courseCatalogeType?.value || 'N/A'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Theme Mode</div>
                            <div className="font-medium capitalize text-gray-900">
                                {config.globalSettings?.mode || 'light'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Font Family</div>
                            <div className="font-medium text-gray-900">
                                {config.globalSettings?.fonts?.family || 'Default'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Payment</div>
                            <div
                                className={`font-medium ${config.globalSettings?.payment?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.payment?.enabled
                                    ? '✓ Enabled'
                                    : '✗ Disabled'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Lead Collection</div>
                            <div
                                className={`font-medium ${config.globalSettings?.leadCollection?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.leadCollection?.enabled
                                    ? '✓ Enabled'
                                    : '✗ Disabled'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">Enquiry</div>
                            <div
                                className={`font-medium ${config.globalSettings?.enrquiry?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.enrquiry?.enabled
                                    ? '✓ Enabled'
                                    : '✗ Disabled'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show page components
    const page = config.pages.find((p) => p.id === selectedPageId);
    if (!page) return <div className="p-8 text-center text-gray-500">Page not found</div>;

    return (
        <div
            className="flex min-h-full w-full flex-1 flex-col gap-3 bg-white p-4"
            onClick={() => selectComponent(null)}
        >
            <div className="mb-2 border-b pb-3">
                <h2 className="text-lg font-semibold text-gray-800">{page.title || page.route}</h2>
                <p className="text-sm text-gray-500">
                    Page components • {page.components.length} component
                    {page.components.length !== 1 ? 's' : ''}
                </p>
            </div>

            {page.components.map((comp) => (
                <div
                    key={comp.id}
                    className={`group relative cursor-pointer rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow-md
                        ${selectedComponentId === comp.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        selectComponent(comp.id);
                    }}
                >
                    {/* Component Actions */}
                    <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                duplicateComponent(page.id, comp.id);
                            }}
                            title="Duplicate Component"
                        >
                            <Copy className="size-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this component?')) {
                                    deleteComponent(page.id, comp.id);
                                }
                            }}
                            title="Delete Component"
                        >
                            <Trash2 className="size-3" />
                        </Button>
                    </div>

                    <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-md bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase text-indigo-700">
                            {comp.type}
                        </span>
                        {selectedComponentId === comp.id && (
                            <span className="text-xs text-blue-500">Selected</span>
                        )}
                    </div>

                    <ComponentSummary component={comp} />
                </div>
            ))}

            {page.components.length === 0 && (
                <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-16 text-gray-400">
                    <div className="text-lg font-medium">No components on this page</div>
                    <div className="mt-1 text-sm">Drag components from the library to add them</div>
                </div>
            )}
        </div>
    );
};

const ComponentSummary = ({ component }: { component: Component }) => {
    const { type, props } = component;
    const [isExpanded, setIsExpanded] = useState(false);

    const getSummaryContent = () => {
        switch (type) {
            case 'heroSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.heading || 'Hero Section'}
                        </div>
                        {props.subheading && (
                            <div className="text-sm text-gray-600">{props.subheading}</div>
                        )}
                    </div>
                );

            case 'bookCatalogue':
            case 'courseCatalog':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.title || 'Course Catalogue'}
                        </div>
                        <div className="text-xs text-gray-500">
                            Layout: {props.render?.layout || 'grid'} • Filters:{' '}
                            {props.showFilters ? 'Enabled' : 'Disabled'}
                            {props.filtersConfig && ` • ${props.filtersConfig.length} filter(s)`}
                        </div>
                    </div>
                );

            case 'bookDetails':
            case 'courseDetails':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">Course Details Page</div>
                        <div className="text-xs text-gray-500">
                            {props.showEnquiry && 'Enquiry • '}
                            {props.showPayment && 'Payment • '}
                            {props.showAddToCart && 'Add to Cart'}
                        </div>
                    </div>
                );

            case 'cartComponent':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">Shopping Cart</div>
                        <div className="text-xs text-gray-500">
                            {props.showQuantitySelector && 'Quantity controls • '}
                            {props.showPrice && 'Pricing enabled'}
                        </div>
                    </div>
                );

            case 'MediaShowcaseComponent':
            case 'mediaShowcase':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">Media Showcase</div>
                        <div className="text-xs text-gray-500">
                            Layout: {props.layout || 'slider'} •{props.slides?.length || 0} slides
                            {props.autoplay && ' • Autoplay'}
                        </div>
                    </div>
                );

            case 'buyRentSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.heading || 'Buy/Rent Section'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {props.buy?.buttonLabel || 'Buy'} • {props.rent?.buttonLabel || 'Rent'}
                        </div>
                    </div>
                );

            case 'statsHighlights':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">Stats Highlights</div>
                        <div className="text-xs text-gray-500">
                            {props.stats?.length || 0} statistics
                        </div>
                    </div>
                );

            case 'testimonialSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.title || 'Testimonials'}
                        </div>
                        <div className="text-xs text-gray-500">
                            {props.testimonials?.length || 0} testimonials • Layout:{' '}
                            {props.layout || 'grid'}
                        </div>
                    </div>
                );

            case 'policyRenderer':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.policies?.shipping?.title || 'Policy Content'}
                        </div>
                        <div className="text-xs text-gray-500">Policy page</div>
                    </div>
                );

            case 'header':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">{props.title || 'Header'}</div>
                        <div className="text-xs text-gray-500">
                            {props.navigation?.length || 0} nav items
                        </div>
                    </div>
                );

            case 'footer':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">Footer</div>
                        <div className="text-xs text-gray-500">
                            Layout: {props.layout || 'default'}
                        </div>
                    </div>
                );

            default:
                // Fallback for unknown component types
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">{type}</div>
                        <div className="max-h-20 overflow-hidden text-xs text-gray-500">
                            {Object.keys(props).slice(0, 3).join(', ')}
                            {Object.keys(props).length > 3 && '...'}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-2">
            {getSummaryContent()}

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                }}
                className="flex items-center gap-1 text-xs text-blue-600 transition-colors hover:text-blue-800"
            >
                {isExpanded ? (
                    <>
                        <ChevronUp className="size-3" />
                        Hide details
                    </>
                ) : (
                    <>
                        <ChevronDown className="size-3" />
                        Show details
                    </>
                )}
            </button>

            {isExpanded && (
                <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-semibold text-gray-700">
                        Full Configuration:
                    </div>
                    <pre className="max-h-96 overflow-auto text-xs text-gray-600">
                        {JSON.stringify(props, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};
