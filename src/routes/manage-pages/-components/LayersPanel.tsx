/**
 * LayersPanel — shows the component stack of the currently selected page.
 * Allows click-to-select and eye toggle (show/hide) for each component.
 * Supports nested layout components (columnLayout) with an expandable tree.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { useEditorStore } from '../-stores/editor-store';
import { Component } from '../-types/editor-types';

// Component type → short human-readable label
const TYPE_LABEL: Record<string, string> = {
    header: 'Header',
    heroSection: 'Hero Section',
    courseCatalog: 'Course Catalog',
    bookCatalogue: 'Book Catalogue',
    footer: 'Footer',
    mediaShowcase: 'Media Showcase',
    statsHighlights: 'Stats',
    testimonialSection: 'Testimonials',
    cartComponent: 'Cart',
    buyRentSection: 'Buy / Rent',
    policyRenderer: 'Policy',
    courseDetails: 'Course Details',
    bookDetails: 'Book Details',
    faqSection: 'FAQ',
    videoEmbed: 'Video Embed',
    ctaBanner: 'CTA Banner',
    pricingTable: 'Pricing Table',
    contactForm: 'Contact Form',
    teamSection: 'Team',
    announcementFeed: 'Announcements',
    imageGallery: 'Image Gallery',
    columnLayout: 'Column Layout',
};

const getLabel = (component: Component) =>
    TYPE_LABEL[component.type] || component.type.replace(/([A-Z])/g, ' $1').trim();

/** Renders a single layer row (used for both top-level and nested components) */
const LayerRow = ({
    component,
    index,
    depth,
    pageId,
}: {
    component: Component;
    index: number;
    depth: number;
    pageId: string;
}) => {
    const { selectedComponentId, selectComponent, updateComponent } = useEditorStore();
    const [expanded, setExpanded] = useState(true);

    const isSelected = component.id === selectedComponentId;
    const isEnabled = component.enabled !== false;
    const isLayout = component.type === 'columnLayout';
    const label = getLabel(component);
    const slots: Component[][] = isLayout ? ((component.props?.slots as Component[][]) ?? []) : [];

    return (
        <>
            <button
                onClick={() => selectComponent(component.id)}
                className={`group flex w-full items-center gap-1.5 py-1.5 text-left text-sm transition-colors ${
                    isSelected
                        ? isLayout
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                } ${!isEnabled ? 'opacity-50' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 8 }}
            >
                {/* Expand/collapse for layout containers */}
                {isLayout ? (
                    <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((v) => !v);
                        }}
                        className="shrink-0 text-teal-400 hover:text-teal-600"
                    >
                        {expanded ? (
                            <ChevronDown className="size-3" />
                        ) : (
                            <ChevronRight className="size-3" />
                        )}
                    </span>
                ) : (
                    <span className="w-3 shrink-0 text-center text-[10px] text-gray-300">
                        {index + 1}
                    </span>
                )}

                {isLayout && <LayoutGrid className="size-3 shrink-0 text-teal-400" />}

                <span className="flex-1 truncate font-medium">{label}</span>

                {/* Eye toggle */}
                <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                        e.stopPropagation();
                        updateComponent(pageId, component.id, { enabled: !isEnabled });
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            updateComponent(pageId, component.id, { enabled: !isEnabled });
                        }
                    }}
                    className="shrink-0 text-gray-300 transition-colors hover:text-gray-600 group-hover:text-gray-400"
                    title={isEnabled ? 'Hide' : 'Show'}
                >
                    {isEnabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </span>
            </button>

            {/* Nested slots */}
            {isLayout &&
                expanded &&
                slots.map((slotComps, slotIdx) => (
                    <div key={slotIdx}>
                        {/* Slot label */}
                        <div
                            className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-teal-400 select-none"
                            style={{
                                paddingLeft: `${12 + (depth + 1) * 16}px`,
                                paddingTop: 2,
                                paddingBottom: 2,
                            }}
                        >
                            └ Slot {slotIdx + 1}
                            {slotComps.length === 0 && (
                                <span className="ml-1 normal-case font-normal text-gray-300">
                                    empty
                                </span>
                            )}
                        </div>
                        {slotComps.map((child, childIdx) => (
                            <LayerRow
                                key={child.id}
                                component={child}
                                index={childIdx}
                                depth={depth + 2}
                                pageId={pageId}
                            />
                        ))}
                    </div>
                ))}
        </>
    );
};

export const LayersPanel = () => {
    const { config, selectedPageId } = useEditorStore();

    if (!config || !selectedPageId) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
                Select a page to see its layers
            </div>
        );
    }

    const page = config.pages.find((p) => p.id === selectedPageId);
    if (!page) return null;

    const { components } = page;

    if (components.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-400">
                No components on this page.
                <br />
                Add one from the Components tab.
            </div>
        );
    }

    return (
        <div className="flex flex-col overflow-y-auto">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                {components.length} layer{components.length !== 1 ? 's' : ''}
            </p>
            {components.map((component, index) => (
                <LayerRow
                    key={component.id}
                    component={component}
                    index={index}
                    depth={0}
                    pageId={selectedPageId}
                />
            ))}
        </div>
    );
};
