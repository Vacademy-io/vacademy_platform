import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { BookOpenText, Books, Lock, UploadSimple, X } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getInstituteId } from '@/constants/helper';
import { PUBLISHER_INSTITUTE_ID } from '../../-constants';
import { getCatalogue, getFacetValues } from '../../-services/library-service';
import type {
    CatalogueFilters,
    FacetValues,
    LibraryListing,
    ListingFacets,
} from '../../-types/library';
import { LibraryCover } from './LibraryCover';

const FACET_LABELS: Array<{ key: keyof ListingFacets; label: string }> = [
    { key: 'subject', label: 'Subject' },
    { key: 'level', label: 'Class / Exam' },
    { key: 'board', label: 'Board' },
    { key: 'language', label: 'Language' },
];

const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);

/** One line of honest numbers, skipping anything we don't have. */
const describeSize = (library: LibraryListing): string =>
    [
        library.sources ? `${formatCount(library.sources)} sources` : null,
        library.pages ? `${formatCount(library.pages)} pages` : null,
        library.language,
    ]
        .filter(Boolean)
        .join(' · ');

const LibraryGridCard = ({
    library,
    price,
    onOpen,
}: {
    library: LibraryListing;
    price: number;
    onOpen: () => void;
}) => (
    <button
        type="button"
        onClick={onOpen}
        className="group flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-md"
    >
        <div className="h-28 w-full overflow-hidden bg-neutral-50">
            <LibraryCover
                fileId={library.cover_file_id}
                alt={library.cover_alt}
                title={library.title}
            />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
            <p className="break-words text-body font-semibold text-neutral-700">{library.title}</p>
            <p className="line-clamp-2 break-words text-caption text-neutral-500">
                {library.summary}
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-caption text-neutral-400">
                {[library.subject, library.level, library.board].filter(Boolean).map((chip) => (
                    <span key={chip} className="rounded-sm bg-neutral-50 px-1.5 py-0.5">
                        {chip}
                    </span>
                ))}
            </div>
            <p className="text-caption text-neutral-400">{describeSize(library)}</p>
            <div className="pt-1">
                {library.unlocked ? (
                    <StatusChip
                        status="SUCCESS"
                        text="Unlocked"
                        textSize="text-caption"
                        showIcon={false}
                    />
                ) : (
                    <span className="flex items-center gap-1.5 text-caption font-medium text-primary-500">
                        <Lock size={13} weight="fill" />
                        {price} credits
                    </span>
                )}
            </div>
        </div>
    </button>
);

/**
 * Browse the libraries Vacademy publishes.
 *
 * Deliberately a shop rather than a list: an institute arrives here without
 * knowing what exists, so covers, facets and honest size figures do the work of
 * explaining what each library is before they spend anything on it.
 */
export const LibraryBrowser = () => {
    const navigate = useNavigate();
    const [libraries, setLibraries] = useState<LibraryListing[] | null>(null);
    const [price, setPrice] = useState(0);
    const [facets, setFacets] = useState<FacetValues | null>(null);
    const [filters, setFilters] = useState<CatalogueFilters>({});
    const [search, setSearch] = useState('');

    useEffect(() => {
        getFacetValues()
            .then(setFacets)
            .catch(() => setFacets(null));
    }, []);

    // Debounced so typing a subject name does not fire a request per keystroke.
    useEffect(() => {
        let cancelled = false;
        const handle = setTimeout(
            () => {
                getCatalogue({ ...filters, q: search || undefined })
                    .then((response) => {
                        if (cancelled) return;
                        setLibraries(response.libraries);
                        setPrice(response.unlock_credits);
                    })
                    .catch(() => !cancelled && setLibraries([]));
            },
            search ? 300 : 0
        );
        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [filters, search]);

    const activeFilters = useMemo(
        () => Object.entries(filters).filter(([, v]) => Boolean(v)),
        [filters]
    );

    const setFacet = (key: keyof ListingFacets, value: string) =>
        setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));

    const clearAll = () => {
        setFilters({});
        setSearch('');
    };

    const canPublish = getInstituteId() === PUBLISHER_INSTITUTE_ID;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-2xl text-body text-neutral-500">
                    Ready-made knowledge bases from Vacademy. Unlock one and use it to build
                    question papers and assessments straight away — no uploading, no waiting for a
                    book to process.
                </p>
                {canPublish && (
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => navigate({ to: '/knowledge-base/publish' })}
                    >
                        <UploadSimple className="mr-1 size-4" />
                        Manage library
                    </MyButton>
                )}
            </div>

            <div className="flex flex-col gap-3">
                <MyInput
                    inputType="text"
                    input={search}
                    onChangeFunction={(e) => setSearch(e.target.value)}
                    inputPlaceholder="Search libraries"
                    className="w-full sm:max-w-sm"
                />

                {facets && (
                    <div className="flex flex-col gap-2">
                        {FACET_LABELS.map(({ key, label }) => {
                            const values = facets[key] ?? [];
                            if (values.length === 0) return null;
                            return (
                                <div key={key} className="flex flex-wrap items-center gap-2">
                                    <span className="w-24 shrink-0 text-caption text-neutral-400">
                                        {label}
                                    </span>
                                    {values.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFacet(key, value)}
                                            className={cn(
                                                'rounded-full border px-3 py-1 text-caption transition-colors',
                                                filters[key] === value
                                                    ? 'border-primary-500 bg-primary-50 font-medium text-primary-500'
                                                    : 'border-neutral-200 text-neutral-600 hover:border-primary-300'
                                            )}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}

                {(activeFilters.length > 0 || search) && (
                    <MyButton
                        buttonType="text"
                        scale="small"
                        onClick={clearAll}
                        className="self-start"
                    >
                        <X className="mr-1 size-3.5" />
                        Clear filters
                    </MyButton>
                )}
            </div>

            {libraries === null && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                        <Skeleton key={i} className="h-64 w-full rounded-xl" />
                    ))}
                </div>
            )}

            {libraries?.length === 0 && (
                <Card className="flex flex-col items-center gap-2 p-10 text-center">
                    <Books className="size-7 text-neutral-300" />
                    <p className="text-body text-neutral-600">
                        {activeFilters.length > 0 || search
                            ? 'No libraries match those filters'
                            : 'No libraries published yet'}
                    </p>
                    <p className="text-caption text-neutral-400">
                        {activeFilters.length > 0 || search
                            ? 'Try widening your search.'
                            : 'Vacademy-published libraries will appear here as they are released.'}
                    </p>
                    {(activeFilters.length > 0 || search) && (
                        <MyButton buttonType="secondary" scale="small" onClick={clearAll}>
                            Clear filters
                        </MyButton>
                    )}
                </Card>
            )}

            {libraries && libraries.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {libraries.map((library) => (
                        <LibraryGridCard
                            key={library.knowledge_base_id}
                            library={library}
                            price={price}
                            onOpen={() =>
                                navigate({
                                    to: '/knowledge-base/library/$kbId',
                                    params: { kbId: library.knowledge_base_id },
                                })
                            }
                        />
                    ))}
                </div>
            )}

            {libraries && libraries.length > 0 && (
                <p className="flex items-center gap-1.5 text-caption text-neutral-400">
                    <BookOpenText size={14} />
                    Unlocking a library is a one-time charge and lasts forever, including material
                    we add to it later.
                </p>
            )}
        </div>
    );
};
