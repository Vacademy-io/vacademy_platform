import { useEditorStore } from '../-stores/editor-store';
import { Component } from '../-types/editor-types';
import { useState } from 'react';
import { CaretDown, CaretUp, Gear, Copy, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export const PageCanvas = () => {
    const { t } = useTranslation('managePagesPageCanvas');
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
                    <h2 className="text-lg font-semibold text-gray-800">
                        {t('globalSettings.title')}
                    </h2>
                    <p className="text-sm text-gray-500">{t('globalSettings.description')}</p>
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
                                    {t('globalSettings.header')}
                                </span>
                                {selectedComponentId === 'global-header' && (
                                    <span className="text-xs font-medium text-blue-600">
                                        {t('globalSettings.selectedIndicator')}
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
                                    {t('globalSettings.footer')}
                                </span>
                                {selectedComponentId === 'global-footer' && (
                                    <span className="text-xs font-medium text-blue-600">
                                        {t('globalSettings.selectedIndicator')}
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
                        <Gear className="size-4" />
                        {t('globalSettings.overview.title')}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.catalogueType')}
                            </div>
                            <div className="font-medium text-gray-900">
                                {config.globalSettings?.courseCatalogeType?.value ||
                                    t('globalSettings.overview.notAvailable')}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.themeMode')}
                            </div>
                            <div className="font-medium capitalize text-gray-900">
                                {config.globalSettings?.mode || 'light'}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.fontFamily')}
                            </div>
                            <div className="font-medium text-gray-900">
                                {config.globalSettings?.fonts?.family ||
                                    t('globalSettings.overview.defaultFont')}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.payment')}
                            </div>
                            <div
                                className={`font-medium ${config.globalSettings?.payment?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.payment?.enabled
                                    ? t('globalSettings.overview.enabledBadge')
                                    : t('globalSettings.overview.disabledBadge')}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.leadCollection')}
                            </div>
                            <div
                                className={`font-medium ${config.globalSettings?.leadCollection?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.leadCollection?.enabled
                                    ? t('globalSettings.overview.enabledBadge')
                                    : t('globalSettings.overview.disabledBadge')}
                            </div>
                        </div>
                        <div className="rounded-md bg-white p-3 shadow-sm">
                            <div className="text-xs text-gray-500">
                                {t('globalSettings.overview.enquiry')}
                            </div>
                            <div
                                className={`font-medium ${config.globalSettings?.enrquiry?.enabled ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {config.globalSettings?.enrquiry?.enabled
                                    ? t('globalSettings.overview.enabledBadge')
                                    : t('globalSettings.overview.disabledBadge')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show page components
    const page = config.pages.find((p) => p.id === selectedPageId);
    if (!page)
        return <div className="p-8 text-center text-gray-500">{t('page.notFound')}</div>;

    return (
        <div
            className="flex min-h-full w-full flex-1 flex-col gap-3 bg-white p-4"
            onClick={() => selectComponent(null)}
        >
            <div className="mb-2 border-b pb-3">
                <h2 className="text-lg font-semibold text-gray-800">{page.title || page.route}</h2>
                <p className="text-sm text-gray-500">
                    {t('page.componentsCount', { count: page.components.length })}
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
                            title={t('page.duplicateComponentTitle')}
                        >
                            <Copy className="size-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="size-7 p-0 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('page.confirmDeleteComponent'))) {
                                    deleteComponent(page.id, comp.id);
                                }
                            }}
                            title={t('page.deleteComponentTitle')}
                        >
                            <Trash className="size-3" />
                        </Button>
                    </div>

                    <div className="mb-3 flex items-center justify-between">
                        <span className="rounded-md bg-indigo-100 px-3 py-1.5 text-xs font-bold uppercase text-indigo-700">
                            {comp.type}
                        </span>
                        {selectedComponentId === comp.id && (
                            <span className="text-xs text-blue-500">{t('page.selected')}</span>
                        )}
                    </div>

                    <ComponentSummary component={comp} />
                </div>
            ))}

            {page.components.length === 0 && (
                <div className="m-4 flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-16 text-gray-400">
                    <div className="text-lg font-medium">{t('page.empty.title')}</div>
                    <div className="mt-1 text-sm">{t('page.empty.hint')}</div>
                </div>
            )}
        </div>
    );
};

const ComponentSummary = ({ component }: { component: Component }) => {
    const { t } = useTranslation('managePagesPageCanvas');
    const { type, props } = component;
    const [isExpanded, setIsExpanded] = useState(false);

    const getSummaryContent = () => {
        switch (type) {
            case 'heroSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.heading || t('summary.hero.fallbackTitle')}
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
                            {props.title || t('summary.catalogue.fallbackTitle')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.catalogue.layoutLine', {
                                layout: props.render?.layout || 'grid',
                                filters: props.showFilters
                                    ? t('summary.catalogue.filtersEnabled')
                                    : t('summary.catalogue.filtersDisabled'),
                            })}
                            {props.filtersConfig &&
                                t('summary.catalogue.filterCountSuffix', {
                                    count: props.filtersConfig.length,
                                })}
                        </div>
                    </div>
                );

            case 'bookDetails':
            case 'courseDetails':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {t('summary.courseDetails.title')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {props.showEnquiry && t('summary.courseDetails.enquirySuffix')}
                            {props.showPayment && t('summary.courseDetails.paymentSuffix')}
                            {props.showAddToCart && t('summary.courseDetails.addToCart')}
                        </div>
                    </div>
                );

            case 'cartComponent':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {t('summary.cart.title')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {props.showQuantitySelector &&
                                t('summary.cart.quantityControlsSuffix')}
                            {props.showPrice && t('summary.cart.pricingEnabled')}
                        </div>
                    </div>
                );

            case 'MediaShowcaseComponent':
            case 'mediaShowcase':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {t('summary.mediaShowcase.title')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.mediaShowcase.layoutSlides', {
                                layout: props.layout || 'slider',
                                count: props.slides?.length || 0,
                            })}
                            {props.autoplay && t('summary.mediaShowcase.autoplaySuffix')}
                        </div>
                    </div>
                );

            case 'buyRentSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.heading || t('summary.buyRent.fallbackTitle')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.buyRent.buyRentLine', {
                                buy: props.buy?.buttonLabel || t('summary.buyRent.buyFallback'),
                                rent: props.rent?.buttonLabel || t('summary.buyRent.rentFallback'),
                            })}
                        </div>
                    </div>
                );

            case 'statsHighlights':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {t('summary.stats.title')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.stats.count', { count: props.stats?.length || 0 })}
                        </div>
                    </div>
                );

            case 'testimonialSection':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.title || t('summary.testimonials.fallbackTitle')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.testimonials.countLayout', {
                                count: props.testimonials?.length || 0,
                                layout: props.layout || 'grid',
                            })}
                        </div>
                    </div>
                );

            case 'policyRenderer':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.policies?.shipping?.title || t('summary.policy.fallbackTitle')}
                        </div>
                        <div className="text-xs text-gray-500">{t('summary.policy.subtitle')}</div>
                    </div>
                );

            case 'header':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {props.title || t('summary.header.fallbackTitle')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.header.navItems', {
                                count: props.navigation?.length || 0,
                            })}
                        </div>
                    </div>
                );

            case 'footer':
                return (
                    <div className="space-y-1">
                        <div className="font-semibold text-gray-800">
                            {t('summary.footer.title')}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t('summary.footer.layout', { layout: props.layout || 'default' })}
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
                        <CaretUp className="size-3" />
                        {t('summary.hideDetails')}
                    </>
                ) : (
                    <>
                        <CaretDown className="size-3" />
                        {t('summary.showDetails')}
                    </>
                )}
            </button>

            {isExpanded && (
                <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-semibold text-gray-700">
                        {t('summary.fullConfigurationLabel')}
                    </div>
                    <pre className="max-h-96 overflow-auto text-xs text-gray-600">
                        {JSON.stringify(props, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
};
