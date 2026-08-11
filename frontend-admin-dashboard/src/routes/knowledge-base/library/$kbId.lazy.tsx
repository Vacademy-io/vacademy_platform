import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowLeft,
    CaretRight,
    CheckCircle,
    Exam,
    FileText,
    GraduationCap,
    Lock,
    Sparkle,
} from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getListing, unlockLibrary } from '../-services/library-service';
import { getTopics } from '../-services/paper-service';
import type { LibraryListingDetail } from '../-types/library';
import type { KbTopic } from '../-types/paper';
import { LibraryCover } from '../-components/library/LibraryCover';

export const Route = createLazyFileRoute('/knowledge-base/library/$kbId')({
    component: LibraryDetailPage,
});

const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);

const errorMessage = (error: unknown, fallback: string): string => {
    const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })
        ?.response;
    const detail = response?.data?.detail;
    if (detail && typeof detail === 'object' && 'message' in detail) {
        return String((detail as { message: unknown }).message);
    }
    return typeof detail === 'string' ? detail : fallback;
};

/** What a library can be turned into. Grows as capabilities land. */
const CAPABILITIES = [
    { icon: Exam, label: 'Question papers', available: true },
    { icon: FileText, label: 'Assessment sections', available: true },
    { icon: GraduationCap, label: 'Courses', available: false },
];

function LibraryDetailPage() {
    const { kbId } = Route.useParams();
    const navigate = useNavigate();
    const { setNavHeading } = useNavHeadingStore();

    const [listing, setListing] = useState<LibraryListingDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [topics, setTopics] = useState<KbTopic[] | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [unlocking, setUnlocking] = useState(false);

    useEffect(() => {
        setNavHeading('Library');
    }, [setNavHeading]);

    useEffect(() => {
        let cancelled = false;
        getListing(kbId)
            .then((data) => !cancelled && setListing(data))
            .catch(() => !cancelled && setNotFound(true));
        // The topic tree is the preview: it is readable before paying, and it is
        // the only evidence of coverage an institute gets before deciding.
        getTopics(kbId)
            .then((data) => !cancelled && setTopics(data))
            .catch(() => !cancelled && setTopics([]));
        return () => {
            cancelled = true;
        };
    }, [kbId]);

    const unlock = async () => {
        if (!listing) return;
        setUnlocking(true);
        try {
            const result = await unlockLibrary(kbId);
            setListing({ ...listing, unlocked: true });
            toast.success(
                result.already_owned
                    ? 'You already have this library'
                    : `${listing.title} is yours. It will not be charged again.`
            );
        } catch (error) {
            toast.error(errorMessage(error, 'Could not unlock this library'));
        } finally {
            setUnlocking(false);
        }
    };

    const toggleTopic = (id: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    if (notFound) {
        return (
            <LayoutContainer>
                <Card className="flex flex-col items-center gap-3 p-10 text-center">
                    <Lock className="size-7 text-neutral-300" />
                    <p className="text-body text-neutral-600">This library is not available</p>
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => navigate({ to: '/knowledge-base' })}
                    >
                        Back to Knowledge Base
                    </MyButton>
                </Card>
            </LayoutContainer>
        );
    }

    if (!listing) {
        return (
            <LayoutContainer>
                <div className="flex flex-col gap-4">
                    <Skeleton className="h-40 w-full rounded-xl" />
                    <Skeleton className="h-64 w-full rounded-xl" />
                </div>
            </LayoutContainer>
        );
    }

    const facts = [
        listing.sources ? `${formatCount(listing.sources)} sources` : null,
        listing.pages ? `${formatCount(listing.pages)} pages` : null,
        listing.language,
        listing.board,
    ].filter(Boolean) as string[];

    return (
        <LayoutContainer>
            <Helmet>
                <title>{listing.title} — Library</title>
            </Helmet>

            <div className="flex flex-col gap-5">
                <MyButton
                    buttonType="text"
                    scale="small"
                    className="self-start"
                    onClick={() => navigate({ to: '/knowledge-base' })}
                >
                    <ArrowLeft className="mr-1 size-4" />
                    Library
                </MyButton>

                {/* ---- Header ---- */}
                <Card className="overflow-hidden">
                    <div className="h-36 w-full overflow-hidden bg-neutral-50">
                        <LibraryCover
                            fileId={listing.cover_file_id}
                            alt={listing.cover_alt}
                            title={listing.title}
                        />
                    </div>
                    <div className="flex flex-col gap-3 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="break-words text-h3 font-semibold text-neutral-700">
                                    {listing.title}
                                </h1>
                                <p className="mt-1 break-words text-body text-neutral-500">
                                    {listing.summary}
                                </p>
                            </div>
                            {listing.unlocked && (
                                <StatusChip
                                    status="SUCCESS"
                                    text="Unlocked"
                                    textSize="text-caption"
                                    showIcon={false}
                                />
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {[listing.subject, listing.level, ...(listing.tags || [])]
                                .filter(Boolean)
                                .map((chip) => (
                                    <span
                                        key={chip as string}
                                        className="rounded-full bg-neutral-50 px-2.5 py-1 text-caption text-neutral-600"
                                    >
                                        {chip}
                                    </span>
                                ))}
                        </div>

                        {facts.length > 0 && (
                            <p className="text-caption text-neutral-400">{facts.join(' · ')}</p>
                        )}
                    </div>
                </Card>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="flex flex-col gap-5 lg:col-span-2">
                        {listing.description && (
                            <Card className="p-5">
                                <h2 className="mb-2 text-body font-semibold text-neutral-700">
                                    About this library
                                </h2>
                                <p className="whitespace-pre-line break-words text-body text-neutral-600">
                                    {listing.description}
                                </p>
                            </Card>
                        )}

                        {/* ---- The topic tree does the convincing ---- */}
                        <Card className="p-5">
                            <h2 className="mb-1 text-body font-semibold text-neutral-700">
                                What&apos;s inside
                            </h2>
                            <p className="mb-3 text-caption text-neutral-500">
                                Every topic this library covers. Questions are written from these,
                                and each one cites the page it came from.
                            </p>

                            {topics === null && <Skeleton className="h-40 w-full rounded-lg" />}

                            {topics?.length === 0 && (
                                <p className="text-caption text-neutral-400">
                                    Topics for this library are still being prepared.
                                </p>
                            )}

                            {topics && topics.length > 0 && (
                                <ul className="flex flex-col divide-y divide-neutral-100">
                                    {topics.map((topic) => {
                                        const open = expanded.has(topic.id);
                                        const children = topic.subtopics ?? [];
                                        return (
                                            <li key={topic.id} className="py-2">
                                                {children.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleTopic(topic.id)}
                                                        className="flex w-full items-center gap-2 text-left"
                                                        aria-expanded={open}
                                                    >
                                                        <CaretRight
                                                            size={14}
                                                            className={
                                                                open
                                                                    ? 'shrink-0 rotate-90 text-neutral-400 transition-transform'
                                                                    : 'shrink-0 text-neutral-400 transition-transform'
                                                            }
                                                        />
                                                        <span className="break-words text-body text-neutral-700">
                                                            {topic.title}
                                                        </span>
                                                        <span className="ml-auto shrink-0 text-caption text-neutral-400">
                                                            {children.length}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="flex items-center gap-2 break-words pl-5 text-body text-neutral-700">
                                                        {topic.title}
                                                    </span>
                                                )}
                                                {open && children.length > 0 && (
                                                    <ul className="mt-1 flex flex-col gap-1 pl-9">
                                                        {children.map((sub) => (
                                                            <li
                                                                key={sub.id}
                                                                className="break-words text-caption text-neutral-500"
                                                            >
                                                                {sub.title}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Card>
                    </div>

                    {/* ---- Unlock panel ---- */}
                    <div className="flex flex-col gap-4">
                        <Card className="flex flex-col gap-3 p-5">
                            {listing.unlocked ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <CheckCircle
                                            size={18}
                                            weight="fill"
                                            className="text-success-500"
                                        />
                                        <p className="text-body font-medium text-neutral-700">
                                            Yours to use
                                        </p>
                                    </div>
                                    <p className="text-caption text-neutral-500">
                                        This library is available wherever you build question papers
                                        or assessments.
                                    </p>
                                    <MyButton
                                        buttonType="primary"
                                        scale="medium"
                                        onClick={() =>
                                            navigate({
                                                to: '/knowledge-base/paper/$kbId',
                                                params: { kbId },
                                                search: {},
                                            })
                                        }
                                    >
                                        <Sparkle className="mr-1.5 size-4" />
                                        Create a question paper
                                    </MyButton>
                                </>
                            ) : (
                                <>
                                    <p className="text-h3 font-semibold text-neutral-700">
                                        {listing.unlock_credits} credits
                                    </p>
                                    <p className="text-caption text-neutral-500">
                                        One-time. Yours permanently, including material we add to
                                        this library later.
                                    </p>
                                    <MyButton
                                        buttonType="primary"
                                        scale="medium"
                                        disable={unlocking}
                                        onClick={unlock}
                                    >
                                        {unlocking ? 'Unlocking…' : 'Unlock this library'}
                                    </MyButton>
                                    <p className="text-caption text-neutral-400">
                                        Generating papers uses credits as usual on top of this.
                                    </p>
                                </>
                            )}
                        </Card>

                        <Card className="flex flex-col gap-2 p-5">
                            <h2 className="text-body font-semibold text-neutral-700">
                                What you can make
                            </h2>
                            {CAPABILITIES.map(({ icon: Icon, label, available }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <Icon
                                        size={16}
                                        className={
                                            available ? 'text-primary-500' : 'text-neutral-300'
                                        }
                                    />
                                    <span
                                        className={
                                            available
                                                ? 'text-caption text-neutral-600'
                                                : 'text-caption text-neutral-400'
                                        }
                                    >
                                        {label}
                                    </span>
                                    {!available && (
                                        <span className="ml-auto text-caption text-neutral-400">
                                            Coming soon
                                        </span>
                                    )}
                                </div>
                            ))}
                        </Card>
                    </div>
                </div>
            </div>
        </LayoutContainer>
    );
}
