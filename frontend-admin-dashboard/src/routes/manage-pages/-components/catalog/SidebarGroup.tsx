import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ImageUploadField } from '../ImageUploadField';
import { LinkPicker } from '../LinkPicker';
import { moveItem } from './catalog-discovery-props';
import {
    movedGroupOrder,
    objectOf,
    objectsOf,
    optionIdFrom,
    parseTagList,
    patchItem,
    sidebarGroupRows,
    stringsOf,
    textOf,
    uniqueId,
    type Props,
} from './catalog-design-props';
import {
    AddButton,
    DesignGroup,
    ItemBox,
    RowActions,
    SubHeading,
    TextField,
    ToggleField,
} from './design-fields';

/**
 * courseCatalog.filterSidebar / customFilters: the order of the filter
 * groups (and which show), the extra option groups (FORMAT, FOR…) and the app
 * promo card under the filters. See the learner's catalog-sidebar-types.ts.
 */

export const sidebarGroupApplies = (props: Props): boolean =>
    !!props.filterSidebar || Array.isArray(props.customFilters);

export const SidebarGroup = ({
    props,
    patch,
    setNested,
}: {
    props: Props;
    patch: (next: Props) => void;
    setNested: (key: string, next: Props) => void;
}) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const sidebar = props.filterSidebar ? objectOf(props.filterSidebar) : null;
    const setSidebar = (next: Props) => setNested('filterSidebar', next);
    const rows = sidebarGroupRows(props);
    // Edited in place: entries the editor skips (not an object) stay where they are.
    const rawFilters: unknown[] = Array.isArray(props.customFilters) ? props.customFilters : [];
    const setFilter = (index: number, next: Props) =>
        patch({
            customFilters: rawFilters.map((f, i) =>
                i === index ? { ...objectOf(f), ...next } : f
            ),
        });
    const groupName = (id: string, label: string) =>
        label || t(`catalogDesign.sidebar.builtIn.${id}`, { defaultValue: id });
    const promo = sidebar?.promo ? objectOf(sidebar.promo) : null;
    const setPromo = (next: Props) => setSidebar({ promo: { ...promo, ...next } });
    const button = objectOf(promo?.button);

    return (
        <DesignGroup
            title={t('catalogDesign.sidebar.group')}
            hint={t('catalogDesign.sidebar.groupHint')}
        >
            {sidebar && (
                <>
                    <TextField
                        label={t('catalogDesign.sidebar.title')}
                        value={textOf(sidebar.title)}
                        placeholder={t('catalogDesign.common.builtInText')}
                        onChange={(v) => setSidebar({ title: v })}
                    />
                    <TextField
                        label={t('catalogDesign.sidebar.clearAll')}
                        value={textOf(sidebar.clearAllLabel)}
                        placeholder={t('catalogDesign.common.builtInText')}
                        onChange={(v) => setSidebar({ clearAllLabel: v })}
                    />
                    <SubHeading
                        title={t('catalogDesign.sidebar.order')}
                        hint={t('catalogDesign.sidebar.orderHint')}
                    />
                    {rows.map((row, index) => {
                        const name = groupName(row.id, row.label);
                        return (
                            <div
                                key={row.id}
                                className="flex items-center gap-2 rounded border border-neutral-200 px-2 py-1"
                            >
                                <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">
                                    {name}
                                </span>
                                <Switch
                                    checked={row.shown}
                                    aria-label={t('catalogDesign.sidebar.show', { item: name })}
                                    onCheckedChange={(v) =>
                                        row.filterKey
                                            ? setNested(row.filterKey, { enabled: v })
                                            : setFilter(row.customIndex!, { enabled: v })
                                    }
                                />
                                <RowActions
                                    index={index}
                                    count={rows.length}
                                    item={name}
                                    onMove={(d) =>
                                        setSidebar({
                                            order: movedGroupOrder(rows, index, d, sidebar.order),
                                        })
                                    }
                                />
                            </div>
                        );
                    })}
                </>
            )}

            {rawFilters.map((raw, index) => {
                if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
                return (
                    <ExtraFilterFields
                        key={index}
                        filter={raw as Props}
                        takenIds={rows
                            .map((r) => r.id)
                            .filter((id) => id !== textOf((raw as Props).id))}
                        update={(next) => setFilter(index, next)}
                    />
                );
            })}
            {Array.isArray(props.customFilters) && (
                <AddButton
                    label={t('catalogDesign.sidebar.addFilter')}
                    onClick={() =>
                        patch({
                            customFilters: [...rawFilters, { id: '', label: '', options: [] }],
                        })
                    }
                />
            )}

            {promo && (
                <>
                    <SubHeading
                        title={t('catalogDesign.sidebar.promo')}
                        hint={t('catalogDesign.sidebar.promoHint')}
                    />
                    <ToggleField
                        label={t('catalogDesign.sidebar.promoOn')}
                        checked={promo.enabled === true}
                        onChange={(v) => setPromo({ enabled: v })}
                    />
                    <ImageUploadField
                        label={t('catalogDesign.sidebar.screenImage')}
                        value={textOf(promo.screenImage)}
                        onChange={(url) => setPromo({ screenImage: url })}
                    />
                    <ImageUploadField
                        label={t('catalogDesign.sidebar.image')}
                        value={textOf(promo.image)}
                        onChange={(url) => setPromo({ image: url })}
                    />
                    <p className="text-caption text-neutral-500">
                        {t('catalogDesign.sidebar.imageHint')}
                    </p>
                    <TextField
                        label={t('catalogDesign.sidebar.imageAlt')}
                        value={textOf(promo.imageAlt)}
                        onChange={(v) => setPromo({ imageAlt: v })}
                    />
                    <TextField
                        label={t('catalogDesign.rows.eyebrow')}
                        value={textOf(promo.eyebrow)}
                        onChange={(v) => setPromo({ eyebrow: v })}
                    />
                    <TextField
                        label={t('catalogDesign.common.heading')}
                        value={textOf(promo.title)}
                        onChange={(v) => setPromo({ title: v })}
                    />
                    <TextField
                        label={t('catalogDesign.common.text')}
                        value={textOf(promo.text)}
                        onChange={(v) => setPromo({ text: v })}
                        multiline
                    />
                    <TextField
                        label={t('catalogDesign.rows.buttonText')}
                        value={textOf(button.text)}
                        onChange={(v) => setPromo({ button: { ...button, text: v } })}
                    />
                    <LinkPicker
                        label={t('catalogDesign.sidebar.buttonLink')}
                        value={textOf(button.target)}
                        onChange={(v) => setPromo({ button: { ...button, target: v } })}
                    />
                </>
            )}
        </DesignGroup>
    );
};

/** One extra option group: its heading and, unless it lists the course formats, its options. */
const ExtraFilterFields = ({
    filter,
    takenIds,
    update,
}: {
    filter: Props;
    takenIds: string[];
    update: (next: Props) => void;
}) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const options = objectsOf(filter.options);
    const setOptions = (list: Props[]) => update({ options: list });
    const label = textOf(filter.label);
    const fromFormats = filter.source === 'courseFormats';

    return (
        <ItemBox
            title={t('catalogDesign.sidebar.filterTitle', {
                name: label || textOf(filter.id) || '…',
            })}
        >
            <TextField
                label={t('catalogDesign.common.heading')}
                value={label}
                onChange={(v) => update({ label: v })}
                // A new group gets its URL key (?for=…) from its first heading; an existing key never
                // changes, so links to it keep working.
                onBlur={() => {
                    const key = optionIdFrom(label);
                    if (!textOf(filter.id) && key) update({ id: uniqueId(key, takenIds) });
                }}
            />
            {fromFormats ? (
                <p className="text-caption text-neutral-500">
                    {t('catalogDesign.sidebar.formatsNote')}
                </p>
            ) : (
                <>
                    {options.map((option, index) => {
                        const name = t('catalogDesign.sidebar.optionN', { n: index + 1 });
                        return (
                            <ItemBox
                                key={index}
                                title={textOf(option.label) || name}
                                actions={
                                    <RowActions
                                        index={index}
                                        count={options.length}
                                        item={name}
                                        onMove={(d) => setOptions(moveItem(options, index, d))}
                                        onRemove={() =>
                                            setOptions(options.filter((_, i) => i !== index))
                                        }
                                    />
                                }
                            >
                                <TextField
                                    label={t('catalogDesign.common.text')}
                                    value={textOf(option.label)}
                                    onChange={(v) =>
                                        setOptions(patchItem(options, index, { label: v }))
                                    }
                                    onBlur={() => {
                                        const key = optionIdFrom(textOf(option.label));
                                        const taken = options
                                            .filter((_, i) => i !== index)
                                            .map((o) => textOf(o.id));
                                        if (!textOf(option.id) && key)
                                            setOptions(
                                                patchItem(options, index, {
                                                    id: uniqueId(key, taken),
                                                })
                                            );
                                    }}
                                />
                                <TagListField
                                    label={t('catalogDesign.sidebar.tags')}
                                    hint={t('catalogDesign.sidebar.tagsHint')}
                                    tags={stringsOf(option.tags)}
                                    onCommit={(tags) =>
                                        setOptions(patchItem(options, index, { tags }))
                                    }
                                />
                            </ItemBox>
                        );
                    })}
                    <AddButton
                        label={t('catalogDesign.sidebar.addOption')}
                        onClick={() => setOptions([...options, { id: '', label: '', tags: [] }])}
                    />
                </>
            )}
        </ItemBox>
    );
};

/** Comma-separated course tags, saved when the field loses focus (so commas and spaces can be typed). */
const TagListField = ({
    label,
    hint,
    tags,
    onCommit,
}: {
    label: string;
    hint: string;
    tags: string[];
    onCommit: (tags: string[]) => void;
}) => {
    const id = useId();
    const shown = tags.join(', ');
    return (
        <div>
            <Label htmlFor={id} className="text-xs">
                {label}
            </Label>
            <Input
                id={id}
                // Re-mount when the stored list changes so the box shows it tidied.
                key={shown}
                className="mt-1 h-8 text-xs"
                defaultValue={shown}
                aria-describedby={`${id}-hint`}
                onBlur={(e) => {
                    const next = parseTagList(e.target.value);
                    if (next.join(',') !== tags.join(',')) onCommit(next);
                }}
            />
            <p id={`${id}-hint`} className="mt-1 text-caption text-neutral-500">
                {hint}
            </p>
        </div>
    );
};
