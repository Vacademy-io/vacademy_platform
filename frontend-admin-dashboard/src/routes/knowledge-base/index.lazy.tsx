import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import { Helmet } from 'react-helmet';
import { useEffect, useState } from 'react';
import {
    Books,
    BookOpen,
    FileText,
    Plus,
    Sparkle,
    Spinner,
    WarningCircle,
} from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { MyButton } from '@/components/design-system/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/design-system/status-chips';
import { LANGUAGE_LABEL, PURPOSE_OPTIONS } from './-constants';
import { useKnowledgeBases } from './-hooks';
import { CreateKbDialog } from './-components/CreateKbDialog';
import type { KnowledgeBase } from './-types';

export const Route = createLazyFileRoute('/knowledge-base/')({
    component: KnowledgeBaseListPage,
});

const formatCount = (n: number) => new Intl.NumberFormat('en-IN').format(n);

function KbCard({ kb }: { kb: KnowledgeBase }) {
    const navigate = useNavigate();
    const open = () => navigate({ to: '/knowledge-base/$kbId', params: { kbId: kb.id } });
    const purposeLabel =
        PURPOSE_OPTIONS.find((p) => p.value === kb.purpose)?.label ??
        (kb.purpose === 'institute_info' ? 'Institute info' : 'General reference');
    const pages = kb.stats?.pages ?? 0;
    const figures = kb.stats?.figures ?? 0;

    return (
        <Card
            role="button"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            }}
            className="flex cursor-pointer flex-col gap-3 p-4 transition-colors hover:border-primary-200"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate text-subtitle font-semibold text-neutral-700">
                        {kb.name}
                    </p>
                    <p className="mt-0.5 text-caption text-neutral-400">{purposeLabel}</p>
                </div>
                {kb.owner_type === 'PLATFORM' && (
                    <StatusChip
                        status="INFO"
                        text="Shared library"
                        textSize="text-caption"
                        showIcon={false}
                    />
                )}
            </div>

            {kb.description && (
                <p className="line-clamp-2 text-body text-neutral-500">{kb.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-neutral-500">
                <span className="flex items-center gap-1">
                    <FileText className="size-4 text-neutral-400" />
                    {formatCount(kb.source_count)} {kb.source_count === 1 ? 'source' : 'sources'}
                </span>
                {pages > 0 && (
                    <span className="flex items-center gap-1">
                        <BookOpen className="size-4 text-neutral-400" />
                        {formatCount(pages)} pages
                    </span>
                )}
                {figures > 0 && <span>{formatCount(figures)} diagrams &amp; tables</span>}
                {kb.language_hint && (
                    <span>{LANGUAGE_LABEL[kb.language_hint] ?? kb.language_hint}</span>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {kb.processing_count > 0 ? (
                    <span className="flex items-center gap-1.5 text-caption text-primary-500">
                        <Spinner className="size-4 animate-spin" />
                        Reading {kb.processing_count}{' '}
                        {kb.processing_count === 1 ? 'source' : 'sources'}…
                    </span>
                ) : kb.source_count === 0 ? (
                    <span className="text-caption text-neutral-400">Nothing added yet</span>
                ) : (
                    <StatusChip
                        status="SUCCESS"
                        text="Ready to use"
                        textSize="text-caption"
                        showIcon={false}
                    />
                )}
                {kb.review_pages > 0 && (
                    <span className="flex items-center gap-1 text-caption text-warning-600">
                        <WarningCircle className="size-4" />
                        {formatCount(kb.review_pages)} pages need a look
                    </span>
                )}
            </div>
        </Card>
    );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <Card className="flex flex-col items-center gap-5 px-6 py-12 text-center">
            <div className="rounded-lg bg-primary-50 p-3">
                <Books className="size-8 text-primary-500" />
            </div>
            <div className="max-w-xl">
                <p className="text-title font-semibold text-neutral-700">
                    Teach the AI what your institute teaches
                </p>
                <p className="mt-2 text-body text-neutral-500">
                    Upload your textbooks, notes and past papers once. The AI reads them — including
                    the diagrams, tables and formulas — and can then answer questions from them, and
                    build courses and question papers grounded in your own material instead of
                    generic internet content.
                </p>
            </div>

            <div className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
                {[
                    {
                        title: 'Class 9 Science',
                        body: 'Two NCERT books and your teachers’ notes.',
                    },
                    {
                        title: 'JEE previous years',
                        body: 'Ten years of question papers with solutions.',
                    },
                    {
                        title: 'Institute info',
                        body: 'Fee policy, timings, exam rules and FAQs.',
                    },
                ].map((example) => (
                    <div
                        key={example.title}
                        className="rounded-md border border-neutral-200 bg-neutral-50 p-3"
                    >
                        <p className="text-caption font-semibold text-neutral-600">
                            {example.title}
                        </p>
                        <p className="mt-1 text-caption text-neutral-500">{example.body}</p>
                    </div>
                ))}
            </div>

            <MyButton buttonType="primary" scale="large" onClick={onCreate}>
                <Plus className="mr-1 size-4" />
                Create your first knowledge base
            </MyButton>
        </Card>
    );
}

function KnowledgeBaseListPage() {
    const { setNavHeading } = useNavHeadingStore();
    const navigate = useNavigate();
    const [createOpen, setCreateOpen] = useState(false);
    const { data: bases, isLoading, isError, refetch } = useKnowledgeBases();

    useEffect(() => {
        setNavHeading('Knowledge Base');
    }, [setNavHeading]);

    return (
        <LayoutContainer>
            <Helmet>
                <title>Knowledge Base</title>
                <meta
                    name="description"
                    content="Upload your institute's books, notes and past papers so the AI can teach, test and answer from your own material."
                />
            </Helmet>

            <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-title font-semibold text-neutral-700">Knowledge bases</p>
                        <p className="mt-1 max-w-2xl text-body text-neutral-500">
                            Your own books, notes and papers, read and indexed so the AI can work
                            from them.
                        </p>
                    </div>
                    {(bases?.length ?? 0) > 0 && (
                        <MyButton
                            buttonType="primary"
                            scale="medium"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-1 size-4" />
                            New knowledge base
                        </MyButton>
                    )}
                </div>

                {isLoading && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="h-40 w-full rounded-lg" />
                        ))}
                    </div>
                )}

                {isError && (
                    <Card className="flex flex-col items-center gap-3 p-8 text-center">
                        <WarningCircle className="size-7 text-danger-500" />
                        <p className="text-body text-neutral-600">
                            Could not load your knowledge bases.
                        </p>
                        <MyButton buttonType="secondary" scale="medium" onClick={() => refetch()}>
                            Try again
                        </MyButton>
                    </Card>
                )}

                {!isLoading && !isError && (bases?.length ?? 0) === 0 && (
                    <EmptyState onCreate={() => setCreateOpen(true)} />
                )}

                {!isLoading && !isError && (bases?.length ?? 0) > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {bases?.map((kb) => <KbCard key={kb.id} kb={kb} />)}
                    </div>
                )}

                {!isLoading && !isError && (bases?.length ?? 0) > 0 && (
                    <Card className="flex items-start gap-3 border-primary-100 bg-primary-50 p-4">
                        <Sparkle className="mt-0.5 size-5 shrink-0 text-primary-500" />
                        <p className="text-caption text-neutral-600">
                            Open a knowledge base and use <strong>Ask this knowledge base</strong>{' '}
                            to check what it has actually understood before you build courses or
                            question papers from it.
                        </p>
                    </Card>
                )}
            </div>

            <CreateKbDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(kbId) => navigate({ to: '/knowledge-base/$kbId', params: { kbId } })}
            />
        </LayoutContainer>
    );
}
