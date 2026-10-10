import { useTranslation } from 'react-i18next';
import { SearchableSelect } from '@/components/design-system/searchable-select';
import { Checkbox } from '@/components/ui/checkbox';
import { useInstituteDetailsStore } from '@/stores/students/students-list/useInstituteDetailsStore';
import { moveItem } from './catalog-discovery-props';
import {
    objectOf,
    objectsOf,
    patchItem,
    stringsOf,
    textOf,
    toggleSlug,
    uniqueId,
    type Props,
    type StreamOption,
} from './catalog-design-props';
import {
    AddButton,
    DesignGroup,
    ItemBox,
    RowActions,
    SelectField,
    SubHeading,
    TextField,
    ToggleField,
} from './design-fields';

/**
 * courseCatalog.columnSections: the rows above and below the course grid
 * ("New here? Start free", the flagship spotlight, "Coming soon"). One box per
 * row with its texts and pickers. Ids the site needs but an editor never
 * types (the spotlight's course, invite and session ids, a row's id) stay in
 * "Edit as JSON". See the learner's catalog-sections-types.ts.
 */

const MAX_STEPS = 4;
const MAX_SLIDES = 6;
const PLACEMENTS = ['before-grid', 'after-grid'] as const;

export const CatalogSectionsGroup = ({
    props,
    patch,
    streams,
}: {
    props: Props;
    patch: (next: Props) => void;
    streams: StreamOption[];
}) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const rows = objectsOf(props.columnSections);
    const setRows = (list: Props[]) => patch({ columnSections: list });
    const updateRow = (index: number, next: Props) => setRows(patchItem(rows, index, next));

    return (
        <DesignGroup title={t('catalogDesign.rows.group')} hint={t('catalogDesign.rows.groupHint')}>
            {rows.map((row, index) => {
                const kind = textOf(row.kind);
                const kindName = t(`catalogDesign.rows.kinds.${kind}`, {
                    defaultValue: t('options.customValue', { value: kind }),
                });
                const name = `${index + 1}. ${kindName}`;
                return (
                    <ItemBox
                        key={textOf(row.id) || index}
                        title={textOf(row.title) ? `${name}: ${textOf(row.title)}` : name}
                        actions={
                            <RowActions
                                index={index}
                                count={rows.length}
                                item={name}
                                onMove={(d) => setRows(moveItem(rows, index, d))}
                            />
                        }
                    >
                        <SelectField
                            label={t('catalogDesign.rows.placement')}
                            // The site's default: coming soon below the grid, the others above it.
                            value={
                                textOf(row.placement) ||
                                (kind === 'coming-soon' ? 'after-grid' : 'before-grid')
                            }
                            options={PLACEMENTS.map((p) => ({
                                value: p,
                                label: t(`catalogDesign.rows.placements.${p}`),
                            }))}
                            onChange={(v) => updateRow(index, { placement: v })}
                        />
                        <TextField
                            label={t('catalogDesign.common.heading')}
                            value={textOf(row.title)}
                            onChange={(v) => updateRow(index, { title: v })}
                        />
                        <TextField
                            label={t('catalogDesign.rows.subtitle')}
                            value={textOf(row.subtitle)}
                            onChange={(v) => updateRow(index, { subtitle: v })}
                        />
                        {kind === 'free-courses' && (
                            <FreeCoursesFields
                                row={row}
                                update={(next) => updateRow(index, next)}
                            />
                        )}
                        {kind === 'spotlight' && (
                            <SpotlightFields row={row} update={(next) => updateRow(index, next)} />
                        )}
                        {kind === 'coming-soon' && (
                            <ComingSoonFields
                                row={row}
                                streams={streams}
                                update={(next) => updateRow(index, next)}
                            />
                        )}
                    </ItemBox>
                );
            })}
        </DesignGroup>
    );
};

type RowFieldsProps = { row: Props; update: (next: Props) => void };

/** "New here? Start free": the courses shown first, in order, and the button texts. */
const FreeCoursesFields = ({ row, update }: RowFieldsProps) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const { getCourseFromPackage } = useInstituteDetailsStore();
    const courses = getCourseFromPackage();
    const ids = stringsOf(row.courseIds);
    const setIds = (list: string[]) => update({ courseIds: list });
    const nameOf = (id: string) => courses.find((c) => c.id === id)?.name || id;
    const rules = objectsOf(row.ctaRules);
    const options = (keep: string) =>
        courses
            .filter((c) => c.id === keep || !ids.includes(c.id))
            .map((c) => ({ value: c.id, label: c.name }));

    return (
        <>
            <SubHeading
                title={t('catalogDesign.rows.freeCourses')}
                hint={t('catalogDesign.rows.freeCoursesHint')}
            />
            {ids.map((id, index) => {
                const name = t('catalogDesign.rows.courseN', { n: index + 1 });
                const known = courses.some((c) => c.id === id);
                return (
                    <div key={`${id}-${index}`} className="flex items-center gap-1">
                        <div className="min-w-0 flex-1">
                            <SearchableSelect
                                options={
                                    known ? options(id) : [{ value: id, label: id }, ...options(id)]
                                }
                                value={id}
                                onChange={(v) => setIds(ids.map((x, i) => (i === index ? v : x)))}
                                placeholder={nameOf(id)}
                                searchPlaceholder={t('catalogDesign.common.searchCourses')}
                                emptyText={t('catalogDesign.common.noCourses')}
                                triggerClassName="h-8 text-xs"
                            />
                        </div>
                        <RowActions
                            index={index}
                            count={ids.length}
                            item={name}
                            onMove={(d) => setIds(moveItem(ids, index, d))}
                            onRemove={() => setIds(ids.filter((_, i) => i !== index))}
                        />
                    </div>
                );
            })}
            <SearchableSelect
                options={options('')}
                value=""
                onChange={(v) => v && setIds([...ids, v])}
                placeholder={t('catalogDesign.rows.addCourse')}
                searchPlaceholder={t('catalogDesign.common.searchCourses')}
                emptyText={t('catalogDesign.common.noCourses')}
                triggerClassName="h-8 text-xs"
            />
            <TextField
                label={t('catalogDesign.rows.ctaLabel')}
                value={textOf(row.ctaLabel)}
                placeholder={t('catalogDesign.common.builtInText')}
                onChange={(v) => update({ ctaLabel: v })}
            />
            {rules.map((rule, index) => (
                <TextField
                    key={index}
                    label={t('catalogDesign.rows.ctaRule', {
                        formats: [...stringsOf(rule.formats), ...stringsOf(rule.tags)].join(', '),
                    })}
                    value={textOf(rule.label)}
                    onChange={(v) => update({ ctaRules: patchItem(rules, index, { label: v }) })}
                />
            ))}
            <TextField
                label={t('catalogDesign.rows.seeAllLabel')}
                value={textOf(row.seeAllLabel)}
                placeholder={t('catalogDesign.common.builtInText')}
                hint={t('catalogDesign.rows.seeAllHint')}
                onChange={(v) => update({ seeAllLabel: v })}
            />
        </>
    );
};

/** The flagship panel: per slide its texts, button text, price and steps. */
const SpotlightFields = ({ row, update }: RowFieldsProps) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const slides = objectsOf(row.slides);
    const setSlides = (list: Props[]) => update({ slides: list });
    const updateSlide = (index: number, next: Props) => setSlides(patchItem(slides, index, next));

    return (
        <>
            <SubHeading
                title={t('catalogDesign.rows.slides')}
                hint={t('catalogDesign.rows.slidesHint')}
            />
            {slides.map((slide, index) => {
                const name = t('catalogDesign.rows.slideN', { n: index + 1 });
                const cta = objectOf(slide.cta);
                const steps = objectsOf(slide.steps);
                const setCta = (next: Props) => updateSlide(index, { cta: { ...cta, ...next } });
                const setSteps = (list: Props[]) => updateSlide(index, { steps: list });
                return (
                    <ItemBox
                        key={textOf(slide.id) || index}
                        title={textOf(slide.title) || name}
                        actions={
                            <RowActions
                                index={index}
                                count={slides.length}
                                item={name}
                                onMove={(d) => setSlides(moveItem(slides, index, d))}
                                onRemove={() => setSlides(slides.filter((_, i) => i !== index))}
                            />
                        }
                    >
                        <TextField
                            label={t('catalogDesign.rows.eyebrow')}
                            value={textOf(slide.eyebrow)}
                            onChange={(v) => updateSlide(index, { eyebrow: v })}
                        />
                        <TextField
                            label={t('catalogDesign.common.heading')}
                            value={textOf(slide.title)}
                            onChange={(v) => updateSlide(index, { title: v })}
                        />
                        <TextField
                            label={t('catalogDesign.rows.titleNative')}
                            value={textOf(slide.titleNative)}
                            hint={t('catalogDesign.rows.titleNativeHint')}
                            onChange={(v) => updateSlide(index, { titleNative: v })}
                        />
                        <TextField
                            label={t('catalogDesign.rows.description')}
                            value={textOf(slide.description)}
                            onChange={(v) => updateSlide(index, { description: v })}
                            multiline
                        />
                        {slide.cta !== undefined && (
                            <>
                                <TextField
                                    label={t('catalogDesign.rows.buttonText')}
                                    value={textOf(cta.label)}
                                    hint={t('catalogDesign.rows.priceToken')}
                                    onChange={(v) => setCta({ label: v })}
                                />
                                <TextField
                                    label={t('catalogDesign.rows.price')}
                                    value={textOf(cta.price)}
                                    hint={t('catalogDesign.rows.priceHint')}
                                    onChange={(v) => setCta({ price: v })}
                                />
                            </>
                        )}
                        <SubHeading title={t('catalogDesign.rows.steps')} />
                        {steps.map((step, s) => {
                            const stepName = t('catalogDesign.rows.stepN', { n: s + 1 });
                            return (
                                <ItemBox
                                    key={s}
                                    title={stepName}
                                    actions={
                                        <RowActions
                                            index={s}
                                            count={steps.length}
                                            item={stepName}
                                            onMove={(d) => setSteps(moveItem(steps, s, d))}
                                            onRemove={() =>
                                                setSteps(steps.filter((_, i) => i !== s))
                                            }
                                        />
                                    }
                                >
                                    <TextField
                                        label={t('catalogDesign.common.text')}
                                        value={textOf(step.title)}
                                        onChange={(v) =>
                                            setSteps(patchItem(steps, s, { title: v }))
                                        }
                                    />
                                    <TextField
                                        label={t('catalogDesign.rows.stepMeta')}
                                        value={textOf(step.meta)}
                                        hint={t('catalogDesign.rows.priceToken')}
                                        onChange={(v) => setSteps(patchItem(steps, s, { meta: v }))}
                                    />
                                    <ToggleField
                                        label={t('catalogDesign.rows.stepAccent')}
                                        checked={step.tone === 'accent'}
                                        onChange={(v) =>
                                            setSteps(
                                                patchItem(steps, s, {
                                                    tone: v ? 'accent' : 'default',
                                                })
                                            )
                                        }
                                    />
                                </ItemBox>
                            );
                        })}
                        <AddButton
                            label={t('catalogDesign.rows.addStep')}
                            disabled={steps.length >= MAX_STEPS}
                            onClick={() => setSteps([...steps, { title: '' }])}
                        />
                    </ItemBox>
                );
            })}
            <AddButton
                label={t('catalogDesign.rows.addSlide')}
                disabled={slides.length >= MAX_SLIDES}
                onClick={() =>
                    setSlides([
                        ...slides,
                        {
                            id: uniqueId(
                                'slide',
                                slides.map((s) => textOf(s.id))
                            ),
                            title: '',
                        },
                    ])
                }
            />
        </>
    );
};

/** "Coming soon": the button text and which categories it lists, picked from the stream folders. */
const ComingSoonFields = ({
    row,
    update,
    streams,
}: RowFieldsProps & { streams: StreamOption[] }) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const picked = stringsOf(row.categorySlugs);
    const known = new Set(streams.flatMap((s) => s.categories.map((c) => c.slug)));
    const unknown = picked.filter((slug) => !known.has(slug));
    const toggle = (slug: string) => update({ categorySlugs: toggleSlug(picked, slug) });
    const box = (key: string, slug: string, label: string) => (
        <label key={key} className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox checked={picked.includes(slug)} onCheckedChange={() => toggle(slug)} />
            <span>{label}</span>
        </label>
    );

    return (
        <>
            <TextField
                label={t('catalogDesign.rows.notifyLabel')}
                value={textOf(row.notifyLabel)}
                placeholder={t('catalogDesign.common.builtInText')}
                onChange={(v) => update({ notifyLabel: v })}
            />
            <SubHeading
                title={t('catalogDesign.rows.categories')}
                hint={t('catalogDesign.rows.categoriesHint')}
            />
            {streams.length === 0 && (
                <p className="text-caption text-neutral-500">
                    {t('catalogDesign.common.noStreams')}
                </p>
            )}
            {streams
                .filter((s) => s.categories.length > 0)
                .map((s) => (
                    <div key={s.slug} className="space-y-1">
                        <p className="text-caption font-medium text-neutral-600">{s.label}</p>
                        {s.categories.map((c) => box(`${s.slug}/${c.slug}`, c.slug, c.label))}
                    </div>
                ))}
            {unknown.map((slug) => box(slug, slug, t('options.customValue', { value: slug })))}
        </>
    );
};
