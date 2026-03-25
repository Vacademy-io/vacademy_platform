import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ExternalLink, FileText, Search } from 'lucide-react';
import { useEditorStore } from '../-stores/editor-store';

interface LinkPickerProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    /** Show same-tab / new-tab toggle */
    showTarget?: boolean;
    target?: string;
    onTargetChange?: (target: string) => void;
    placeholder?: string;
}

/**
 * Smart link picker that lets users:
 * 1. Pick from existing pages (internal routes)
 * 2. Enter an external URL
 *
 * Internal pages are stored as the route slug (e.g. "about-us").
 * External URLs are stored as full URLs (e.g. "https://example.com").
 */
export const LinkPicker = ({
    label = 'Link',
    value,
    onChange,
    showTarget = false,
    target,
    onTargetChange,
    placeholder = 'Select a page or enter URL',
}: LinkPickerProps) => {
    const config = useEditorStore((s) => s.config);
    const pages = config?.pages || [];

    const isExternal = value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:') || value.startsWith('tel:');
    const [mode, setMode] = useState<'page' | 'url'>(isExternal ? 'url' : 'page');
    const [search, setSearch] = useState('');

    // Find currently selected page
    const selectedPage = pages.find(
        (p) => p.route === value || p.id === value || value === 'homepage' && (p.id === 'home' || p.route === 'homepage' || p.route === '/' || p.route === ''),
    );

    const filteredPages = search
        ? pages.filter((p) => {
              const q = search.toLowerCase();
              return (p.title || '').toLowerCase().includes(q) || p.route.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
          })
        : pages;

    return (
        <div className="space-y-2">
            {label && <Label className="text-xs">{label}</Label>}

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button
                    type="button"
                    onClick={() => { setMode('page'); if (isExternal) onChange(''); }}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        mode === 'page' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <FileText className="size-3" />
                    Page
                </button>
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors ${
                        mode === 'url' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <ExternalLink className="size-3" />
                    External URL
                </button>
            </div>

            {mode === 'page' ? (
                <div className="space-y-1.5">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-gray-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search pages..."
                            className="h-7 pl-7 text-xs"
                        />
                    </div>

                    {/* Page list */}
                    <div className="max-h-48 overflow-y-auto rounded border border-gray-100 bg-gray-50">
                        {filteredPages.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-gray-400">
                                {search ? 'No pages match your search' : 'No pages created yet'}
                            </div>
                        ) : (
                            filteredPages.map((page) => {
                                const isHome = page.id === 'home' || page.route === 'homepage' || page.route === '/' || page.route === '';
                                const routeSlug = isHome ? 'homepage' : (page.route || page.id);
                                const isSelected = value === routeSlug || value === page.route || value === page.id || (isHome && value === 'homepage');

                                return (
                                    <button
                                        key={page.id}
                                        type="button"
                                        onClick={() => onChange(routeSlug)}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                                            isSelected
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'hover:bg-gray-100 text-gray-700'
                                        }`}
                                    >
                                        <FileText className="size-3 shrink-0 text-gray-400" />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-medium">
                                                {page.title || page.route || page.id}
                                                {isHome && <span className="ml-1 text-[10px] text-gray-400">(Home)</span>}
                                            </div>
                                            <div className="truncate text-[10px] text-gray-400">
                                                /{routeSlug}
                                            </div>
                                        </div>
                                        {page.published && (
                                            <span className="size-1.5 shrink-0 rounded-full bg-green-500" title="Published" />
                                        )}
                                        {isSelected && (
                                            <span className="text-[10px] font-medium text-blue-500">Selected</span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Current value display */}
                    {value && !isExternal && (
                        <div className="flex items-center justify-between rounded bg-blue-50 px-2 py-1">
                            <span className="text-[10px] text-blue-600">
                                Links to: <strong>/{value}</strong>
                            </span>
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="text-[10px] text-blue-400 hover:text-blue-600"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* External URL mode */
                <div className="space-y-1.5">
                    <Input
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={placeholder || 'https://example.com'}
                        className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-gray-400">
                        Enter a full URL (https://...) or mailto:/tel: link
                    </p>
                </div>
            )}

            {/* Target selector */}
            {showTarget && onTargetChange && (
                <div className="flex gap-1">
                    {[
                        { label: 'Same Tab', value: '_self' },
                        { label: 'New Tab', value: '_blank' },
                    ].map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => onTargetChange(t.value)}
                            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                (target || '_self') === t.value
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
