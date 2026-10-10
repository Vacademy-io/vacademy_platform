import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CampaignPicker } from '../CampaignPicker';
import { ImageUploadField } from '../ImageUploadField';
import { LinkPicker } from '../LinkPicker';
import { HeaderToggle } from '../header/HeaderEditorFields';
import { LookChoice, OptionalColorField, TextField, obj } from './chrome-controls';

/** Banner props are hand- or AI-written JSON: read them as unknown and narrow. */
type Props = Record<string, unknown>;

export interface CtaBandFieldsProps {
    /** The ctaBanner props. */
    props: Props;
    /** Writes one prop, keeping every other prop. */
    updateProp: (key: string, value: unknown) => void;
    /** Writes several props in one edit, keeping every other prop. */
    patchProps: (next: Props) => void;
}

/**
 * One button of the band banner. `full` edits everything (the second
 * button); without it only the band's extras are shown (style, arrow, form
 * title), for the first button whose text and action the banner editor
 * already edits. Every write spreads the button object.
 */
export const BandButtonFields = ({
    title,
    button,
    onChange,
    full = false,
}: {
    title: string;
    button: unknown;
    onChange: (next: Props) => void;
    full?: boolean;
}) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const b = obj(button);
    const set = (next: Props) => onChange({ ...b, ...next });
    // The site shows a button unless enabled is false (and it has text).
    const enabled = full ? !!button && b.enabled !== false : true;
    const action = b.action === 'openForm' ? 'openForm' : 'navigate';

    return (
        <div className="space-y-3 rounded border bg-gray-50 p-3">
            <h5 className="text-xs font-semibold">{title}</h5>
            {full && (
                <HeaderToggle
                    label={t('ctaBanner.showButton')}
                    checked={enabled}
                    onChange={(on) => set({ enabled: on })}
                />
            )}
            {enabled && (
                <>
                    {full && (
                        <>
                            <TextField
                                label={t('mediaShowcase.buttonTextPlaceholder')}
                                value={b.text}
                                onChange={(v) => set({ text: v })}
                            />
                            <LookChoice
                                label={t('header.onClick')}
                                stored={b.action}
                                fallback="navigate"
                                options={[
                                    { value: 'navigate', label: t('options.openLink') },
                                    { value: 'openForm', label: t('options.openFormPopup') },
                                ]}
                                onChange={(v) => set({ action: v })}
                            />
                            {action === 'openForm' ? (
                                <CampaignPicker
                                    label={t('header.formToOpen')}
                                    allowEmpty={false}
                                    value={typeof b.audienceId === 'string' ? b.audienceId : ''}
                                    onChange={(id) => set({ audienceId: id })}
                                />
                            ) : (
                                <LinkPicker
                                    label={t('mediaShowcase.buttonLink')}
                                    value={typeof b.target === 'string' ? b.target : ''}
                                    onChange={(v) => set({ target: v })}
                                />
                            )}
                        </>
                    )}
                    {action === 'openForm' && (
                        <TextField
                            label={t('ctaBand.formTitle')}
                            value={b.formTitle}
                            placeholder={t('ctaBand.formTitlePlaceholder')}
                            onChange={(v) => set({ formTitle: v })}
                        />
                    )}
                    <LookChoice
                        label={t('ctaBand.buttonStyle')}
                        stored={b.style}
                        fallback="primary"
                        options={[
                            { value: 'primary', label: t('ctaBand.stylePrimary') },
                            { value: 'olive', label: t('ctaBand.styleOlive') },
                            { value: 'outline-light', label: t('ctaBand.styleOutlineLight') },
                            { value: 'outline-dark', label: t('ctaBand.styleOutlineDark') },
                        ]}
                        onChange={(v) => set({ style: v })}
                    />
                    <HeaderToggle
                        label={t('ctaBand.arrow')}
                        checked={b.icon === 'arrow'}
                        onChange={(on) => set({ icon: on ? 'arrow' : 'none' })}
                    />
                </>
            )}
        </div>
    );
};

/**
 * Fields of the "band" banner (eyebrow, second button, button styles, phone
 * mockup, band size). PropertyPanel mounts it for every ctaBanner: the
 * Classic/Band choice shows for all, the band fields only when props.variant
 * is 'band'.
 */
export const CtaBandFields: FC<CtaBandFieldsProps> = ({ props, updateProp }) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    const isBand = props.variant === 'band';
    const mockup = obj(props.mockup);
    const hasMockup = props.mockup !== undefined && props.mockup !== null;
    const setMockup = (next: Props) => updateProp('mockup', { ...mockup, ...next });

    return (
        <div className="space-y-4">
            <LookChoice
                label={t('ctaBand.style')}
                hint={t('ctaBand.styleHint')}
                stored={props.variant}
                fallback="classic"
                options={[
                    { value: 'classic', label: t('ctaBand.styleClassic') },
                    { value: 'band', label: t('ctaBand.styleBand') },
                ]}
                onChange={(v) => updateProp('variant', v === 'classic' ? undefined : v)}
            />
            {isBand && (
                <>
                    <div className="space-y-3 rounded border bg-gray-50 p-3">
                        <h5 className="text-xs font-semibold">{t('ctaBand.textHeading')}</h5>
                        <TextField
                            label={t('ctaBand.eyebrow')}
                            value={props.eyebrow}
                            placeholder={t('ctaBand.eyebrowPlaceholder')}
                            onChange={(v) => updateProp('eyebrow', v)}
                        />
                        <OptionalColorField
                            label={t('ctaBand.eyebrowColor')}
                            value={props.eyebrowColor}
                            onChange={(c) => updateProp('eyebrowColor', c)}
                        />
                        <OptionalColorField
                            label={t('ctaBand.subheadingColor')}
                            value={props.subheadingColor}
                            onChange={(c) => updateProp('subheadingColor', c)}
                        />
                        <LookChoice
                            label={t('ctaBand.bandSize')}
                            stored={props.bandSize}
                            fallback="md"
                            options={[
                                { value: 'md', label: t('ctaBand.sizeStandard') },
                                { value: 'lg', label: t('ctaBand.sizeLarge') },
                            ]}
                            onChange={(v) => updateProp('bandSize', v)}
                        />
                    </div>
                    <BandButtonFields
                        title={t('ctaBand.firstButtonLook')}
                        button={props.button}
                        onChange={(next) => updateProp('button', next)}
                    />
                    <BandButtonFields
                        full
                        title={t('ctaBand.secondButton')}
                        button={props.secondaryButton}
                        onChange={(next) => updateProp('secondaryButton', next)}
                    />
                    <div className="space-y-3 rounded border bg-gray-50 p-3">
                        <h5 className="text-xs font-semibold">{t('ctaBand.phoneHeading')}</h5>
                        <HeaderToggle
                            label={t('ctaBand.phoneShow')}
                            hint={t('ctaBand.phoneHint')}
                            checked={hasMockup}
                            onChange={(on) =>
                                updateProp('mockup', on ? { kind: 'phone' } : undefined)
                            }
                        />
                        {hasMockup && (
                            <>
                                <ImageUploadField
                                    label={t('ctaBand.phoneImage')}
                                    value={typeof mockup.image === 'string' ? mockup.image : ''}
                                    onChange={(url) => setMockup({ image: url })}
                                />
                                <TextField
                                    label={t('hero.altText')}
                                    value={mockup.alt}
                                    onChange={(v) => setMockup({ alt: v })}
                                />
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
