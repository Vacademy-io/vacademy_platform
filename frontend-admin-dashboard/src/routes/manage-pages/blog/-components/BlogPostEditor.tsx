import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowSquareOut, Code, TextAa, X } from '@phosphor-icons/react';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { MyButton } from '@/components/design-system/button';
import { StatusChip } from '@/components/design-system/status-chips';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { TipTapEditor } from '@/components/tiptap/TipTapEditor';
import { MonacoHtmlEditor } from '@/components/ai-video-editor/MonacoHtmlEditor';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { fetchBothInstituteAPIs } from '@/services/student-list-section/getInstituteDetails';
import { ImageUploadField } from '../../-components/ImageUploadField';
import { useCataloguePermissions } from '../../-hooks/use-catalogue-permissions';
import { getCatalogueTags } from '../../-services/catalogue-service';
import { getCatalogueSiteUrl } from '../../-utils/learner-site-url';
import {
    createBlogPost,
    getBlogPost,
    listBlogPosts,
    publishBlogPost,
    slugifyTitle,
    unpublishBlogPost,
    updateBlogPost,
    type BlogPost,
    type BlogPostInput,
    type BlogPostStatus,
} from '../../-services/blog-service';

/**
 * One blog post: metadata on the right, the body on the left.
 *
 * The body is HTML either way — the visual editor (TipTap) and the HTML view
 * (Monaco) edit the SAME string, so an admin can write in the visual editor,
 * flip to HTML to paste an embed or a page an AI wrote, and flip back. Flipping
 * from HTML to visual re-parses through TipTap, which normalises markup it
 * does not model (custom classes, some inline styles), so the switch warns.
 * The learner renderer sanitises whatever is stored at render time.
 *
 * Save never changes status; Publish / Unpublish are separate, deliberate
 * actions. A post written by an AI app over MCP lands here as a DRAFT.
 */

type Mode = 'visual' | 'html';

interface FormState {
    title: string;
    slug: string;
    slugTouched: boolean;
    excerpt: string;
    contentHtml: string;
    coverImageUrl: string;
    authorName: string;
    category: string;
    tagsText: string;
    publishedAt: string; // datetime-local value
    seoTitle: string;
    seoDescription: string;
}

const toLocalInput = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const fromLocalInput = (v: string): string | undefined => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

const emptyForm = (author: string): FormState => ({
    title: '',
    slug: '',
    slugTouched: false,
    excerpt: '',
    contentHtml: '',
    coverImageUrl: '',
    authorName: author,
    category: '',
    tagsText: '',
    publishedAt: '',
    seoTitle: '',
    seoDescription: '',
});

const formFromPost = (p: BlogPost): FormState => ({
    title: p.title || '',
    slug: p.slug || '',
    slugTouched: true,
    excerpt: p.excerpt || '',
    contentHtml: p.content_html || '',
    coverImageUrl: p.cover_image_url || '',
    authorName: p.author_name || '',
    category: p.category || '',
    tagsText: (p.tags || []).join(', '),
    publishedAt: toLocalInput(p.published_at),
    seoTitle: p.seo_title || '',
    seoDescription: p.seo_description || '',
});

const statusChip = (status?: BlogPostStatus) => {
    if (status === 'PUBLISHED') return <StatusChip text="Published" textSize="text-xs" status="SUCCESS" />;
    if (status === 'ARCHIVED') return <StatusChip text="Archived" textSize="text-xs" status="INFO" showIcon={false} />;
    return <StatusChip text="Draft" textSize="text-xs" status="WARNING" showIcon={false} />;
};

/** Every (site, page) that carries a Blog section — where a post will show. */
const useBlogPlacements = (instituteId: string | null | undefined) => {
    const { data: tags } = useQuery({
        queryKey: ['catalogueTags', instituteId],
        queryFn: () => getCatalogueTags(instituteId!),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    return useMemo(() => {
        const out: Array<{ tagName: string; route: string; status: string }> = [];
        for (const tag of tags || []) {
            try {
                const cfg = JSON.parse((tag as { catalogueJson?: string }).catalogueJson || '{}');
                for (const page of cfg?.pages || []) {
                    const hasBlog = (page?.components || []).some(
                        (c: { type?: string; enabled?: boolean }) => c?.type === 'blog' && c.enabled !== false
                    );
                    if (hasBlog) {
                        const route = String(page.route || '').replace(/^\//, '');
                        out.push({ tagName: tag.tagName, route, status: tag.status });
                    }
                }
            } catch {
                /* a site with unparsable JSON simply has no placements */
            }
        }
        return out;
    }, [tags]);
};

export const BlogPostEditor = () => {
    const { postId } = useParams({ strict: false }) as { postId: string };
    const isNew = !postId || postId === 'new';
    const instituteId = getCurrentInstituteId();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { canWrite, canPublish } = useCataloguePermissions();
    const { instituteDetails, setInstituteDetails } = useInstituteDetailsStore();

    const authorDefault = useMemo(() => {
        const token = getTokenFromCookie(TokenKey.accessToken);
        return (token && getTokenDecodedData(token)?.fullname) || '';
    }, []);

    const [form, setForm] = useState<FormState>(() => emptyForm(authorDefault));
    const [mode, setMode] = useState<Mode>('visual');
    const [dirty, setDirty] = useState(false);

    // Needed for "view on site" links on the institute's own learner domain.
    useEffect(() => {
        if (!instituteDetails) {
            fetchBothInstituteAPIs().then(setInstituteDetails).catch(() => {});
        }
    }, [instituteDetails, setInstituteDetails]);

    const { data: post, isLoading } = useQuery({
        queryKey: ['catalogue-blog-post', instituteId, postId],
        queryFn: () => getBlogPost(instituteId!, postId),
        enabled: !!instituteId && !isNew,
    });

    const { data: library } = useQuery({
        queryKey: ['catalogue-blog-posts', instituteId, 'categories'],
        queryFn: () => listBlogPosts(instituteId!, { status: 'ALL', size: 1 }),
        enabled: !!instituteId,
        staleTime: 60_000,
    });
    const categories = library?.categories ?? [];
    const placements = useBlogPlacements(instituteId);

    useEffect(() => {
        if (post) {
            setForm(formFromPost(post));
            setDirty(false);
            // A body that TipTap cannot faithfully represent opens in HTML view
            // so nothing is silently normalised on first save.
            setMode(/<(iframe|figure|table|style|div)[\s>]/i.test(post.content_html || '') ? 'html' : 'visual');
        }
    }, [post]);

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
        setDirty(true);
    };

    const effectiveSlug = form.slugTouched && form.slug ? form.slug : slugifyTitle(form.title);

    const payload = (): BlogPostInput => ({
        title: form.title.trim(),
        slug: effectiveSlug || undefined,
        excerpt: form.excerpt,
        content_html: form.contentHtml,
        cover_image_url: form.coverImageUrl,
        author_name: form.authorName,
        category: form.category.trim(),
        tags: form.tagsText
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        published_at: fromLocalInput(form.publishedAt) ?? null,
        seo_title: form.seoTitle,
        seo_description: form.seoDescription,
    });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['catalogue-blog-posts', instituteId] });
        queryClient.invalidateQueries({ queryKey: ['catalogue-blog-post', instituteId, postId] });
    };

    const saveMutation = useMutation({
        mutationFn: async (thenPublish: boolean) => {
            const body = payload();
            const saved = isNew
                ? await createBlogPost(instituteId!, body)
                : await updateBlogPost(instituteId!, postId, body);
            return thenPublish && saved.status !== 'PUBLISHED' ? publishBlogPost(instituteId!, saved.id) : saved;
        },
        onSuccess: (saved, thenPublish) => {
            setDirty(false);
            invalidate();
            toast({
                title: thenPublish ? 'Published' : 'Saved',
                description: thenPublish ? 'The post is live on every site with a Blog section.' : undefined,
            });
            if (isNew) {
                navigate({ to: '/manage-pages/blog/editor/$postId', params: { postId: saved.id }, replace: true });
            }
        },
        onError: (err: unknown) => {
            const message =
                (err as { response?: { data?: { ex?: string; message?: string } } })?.response?.data?.ex ||
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'The post could not be saved';
            toast({ title: 'Error', description: message, variant: 'destructive' });
        },
    });

    const unpublishMutation = useMutation({
        mutationFn: () => unpublishBlogPost(instituteId!, postId),
        onSuccess: () => {
            invalidate();
            toast({ title: 'Moved to drafts' });
        },
        onError: () => toast({ title: 'Error', description: 'The post could not be unpublished', variant: 'destructive' }),
    });

    const switchMode = (next: Mode) => {
        if (next === mode) return;
        if (
            next === 'visual' &&
            /<(iframe|figure|table|style|div)[\s>]/i.test(form.contentHtml) &&
            !window.confirm(
                'The visual editor may simplify embeds, tables or custom markup in this HTML. Switch anyway? (Your HTML is kept until you edit in visual mode.)'
            )
        ) {
            return;
        }
        setMode(next);
    };

    if (!instituteId) return <div className="p-6 text-neutral-500">No institute selected</div>;
    if (!isNew && isLoading) return <DashboardLoader />;
    if (!isNew && !post) return <div className="p-6 text-neutral-500">Post not found</div>;

    const status = post?.status;
    const canSave = canWrite && form.title.trim().length > 0 && !saveMutation.isPending;
    const liveLinks =
        status === 'PUBLISHED' && post
            ? placements
                  .filter((p) => p.status === 'ACTIVE' || p.status === 'active')
                  .map((p) => {
                      const base = getCatalogueSiteUrl(p.tagName, instituteDetails?.learner_portal_base_url);
                      const isHome = p.route === '' || p.route === 'home' || p.route === 'homepage';
                      return {
                          label: `${p.tagName}${isHome ? '' : `/${p.route}`}`,
                          href: isHome
                              ? `${base}?post=${encodeURIComponent(post.slug)}`
                              : `${base}/${p.route}/${encodeURIComponent(post.slug)}`,
                      };
                  })
            : [];

    return (
        <div className="flex min-h-screen flex-col bg-neutral-50">
            {/* Top bar */}
            <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 lg:px-6">
                <button
                    type="button"
                    onClick={() => {
                        if (dirty && !window.confirm('Discard unsaved changes?')) return;
                        navigate({ to: '/manage-pages/blog' });
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
                >
                    <ArrowLeft className="size-4" /> Blog
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-neutral-800">
                        {isNew ? 'New post' : form.title || 'Untitled post'}
                    </span>
                    {!isNew && statusChip(status)}
                    {dirty && <span className="text-xs text-neutral-400">Unsaved changes</span>}
                </div>
                <div className="flex items-center gap-2">
                    {liveLinks.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-500 hover:underline"
                            title="Open the live article"
                        >
                            <ArrowSquareOut className="size-3.5" /> {l.label}
                        </a>
                    ))}
                    {canPublish && status === 'PUBLISHED' && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            disable={unpublishMutation.isPending}
                            onClick={() => unpublishMutation.mutate()}
                        >
                            Unpublish
                        </MyButton>
                    )}
                    <MyButton buttonType="secondary" scale="small" disable={!canSave} onClick={() => saveMutation.mutate(false)}>
                        {status === 'PUBLISHED' ? 'Save changes' : 'Save draft'}
                    </MyButton>
                    {canPublish && status !== 'PUBLISHED' && (
                        <MyButton buttonType="primary" scale="small" disable={!canSave} onClick={() => saveMutation.mutate(true)}>
                            {isNew ? 'Save & publish' : 'Publish'}
                        </MyButton>
                    )}
                </div>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
                {/* Body */}
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                            value={form.title}
                            onChange={(e) => set('title', e.target.value)}
                            placeholder="e.g. How to plan your last 30 days before NEET"
                            className="text-base font-semibold"
                        />
                        <p className="text-xs text-neutral-500">
                            Address:{' '}
                            <span className="font-mono">
                                …/{'<blog page>'}/{effectiveSlug || 'your-title'}
                            </span>
                        </p>
                    </div>

                    <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                            <span className="text-xs font-medium text-neutral-600">Body</span>
                            <div className="flex rounded-md border border-neutral-200 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => switchMode('visual')}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${mode === 'visual' ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                >
                                    <TextAa className="size-3.5" /> Visual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => switchMode('html')}
                                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ${mode === 'html' ? 'bg-neutral-800 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                >
                                    <Code className="size-3.5" /> HTML
                                </button>
                            </div>
                        </div>
                        {mode === 'visual' ? (
                            <div className="p-3">
                                <TipTapEditor
                                    value={form.contentHtml}
                                    onChange={(html) => set('contentHtml', html)}
                                    placeholder="Write your article…"
                                    minHeight={480}
                                    stickyToolbar
                                />
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col">
                                {/* Grows with the column (the meta rail sets the row height), never below a token height. */}
                                <div className="min-h-96 flex-1 bg-neutral-900">
                                    <MonacoHtmlEditor value={form.contentHtml} onChange={(html) => set('contentHtml', html)} />
                                </div>
                                <p className="border-t border-neutral-200 px-3 py-2 text-caption text-neutral-500">
                                    Paste any HTML — from an AI, a document export, an old site. Scripts, forms and
                                    unknown embeds are removed when the article renders; YouTube and Vimeo embeds are kept.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Meta */}
                <aside className="flex flex-col gap-5">
                    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-neutral-800">Card & listing</h3>
                        <ImageUploadField label="Cover image" value={form.coverImageUrl} onChange={(url) => set('coverImageUrl', url)} />
                        <div className="space-y-2">
                            <Label>Excerpt</Label>
                            <Textarea
                                rows={3}
                                value={form.excerpt}
                                onChange={(e) => set('excerpt', e.target.value)}
                                placeholder="One or two sentences shown on the card and as the default description."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Input
                                list="blog-categories"
                                value={form.category}
                                onChange={(e) => set('category', e.target.value)}
                                placeholder="e.g. Study tips"
                            />
                            <datalist id="blog-categories">
                                {categories.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                            <p className="text-xs text-neutral-500">A Blog section can be pinned to one category.</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Tags</Label>
                            <Input
                                value={form.tagsText}
                                onChange={(e) => set('tagsText', e.target.value)}
                                placeholder="Comma-separated, e.g. NEET, Biology"
                            />
                            {form.tagsText.trim() && (
                                <div className="flex flex-wrap gap-1.5">
                                    {form.tagsText
                                        .split(',')
                                        .map((t) => t.trim())
                                        .filter(Boolean)
                                        .map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-caption text-neutral-700"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    aria-label={`Remove ${tag}`}
                                                    onClick={() =>
                                                        set(
                                                            'tagsText',
                                                            form.tagsText
                                                                .split(',')
                                                                .map((t) => t.trim())
                                                                .filter((t) => t && t !== tag)
                                                                .join(', ')
                                                        )
                                                    }
                                                >
                                                    <X className="size-3" />
                                                </button>
                                            </span>
                                        ))}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Author</Label>
                            <Input value={form.authorName} onChange={(e) => set('authorName', e.target.value)} />
                        </div>
                    </section>

                    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-neutral-800">Address & schedule</h3>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                value={form.slugTouched ? form.slug : effectiveSlug}
                                onChange={(e) => {
                                    setForm((f) => ({ ...f, slug: slugifyTitle(e.target.value) || e.target.value, slugTouched: true }));
                                    setDirty(true);
                                }}
                                className="font-mono text-xs"
                            />
                            <p className="text-xs text-neutral-500">
                                Made from the title until you edit it. Changing a published slug breaks links already shared.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Publish date</Label>
                            <Input
                                type="datetime-local"
                                value={form.publishedAt}
                                onChange={(e) => set('publishedAt', e.target.value)}
                            />
                            <p className="text-xs text-neutral-500">
                                Leave empty to use the moment you publish. A future date keeps a published post
                                hidden until then; a past date back-dates it.
                            </p>
                        </div>
                    </section>

                    <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-neutral-800">Search & sharing</h3>
                        <div className="space-y-2">
                            <Label>SEO title</Label>
                            <Input value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder={form.title || 'Defaults to the title'} />
                        </div>
                        <div className="space-y-2">
                            <Label>Meta description</Label>
                            <Textarea
                                rows={3}
                                value={form.seoDescription}
                                onChange={(e) => set('seoDescription', e.target.value)}
                                placeholder={form.excerpt || 'Defaults to the excerpt'}
                            />
                            <p className="text-xs text-neutral-500">{form.seoDescription.length}/160 recommended</p>
                        </div>
                    </section>

                    <section className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4">
                        <h3 className="text-sm font-semibold text-neutral-800">Where it appears</h3>
                        {placements.length === 0 ? (
                            <p className="text-xs text-neutral-500">
                                No website page has a Blog section yet. Open a site in Manage Pages and add
                                “Blog” from Answers &amp; text to a page (a dedicated page such as /blog gives
                                every article its own clean URL).
                            </p>
                        ) : (
                            <ul className="space-y-1 text-xs text-neutral-600">
                                {placements.map((p) => (
                                    <li key={`${p.tagName}/${p.route}`} className="font-mono">
                                        {p.tagName}/{p.route || ''}
                                        {p.status !== 'ACTIVE' && p.status !== 'active' && (
                                            <span className="ml-1 font-sans text-neutral-400">(site not published)</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {post?.source === 'MCP' && (
                            <p className="rounded-md bg-primary-50 px-2 py-1.5 text-caption text-primary-500">
                                Written by an AI app connected over MCP. Review before publishing.
                            </p>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
};
