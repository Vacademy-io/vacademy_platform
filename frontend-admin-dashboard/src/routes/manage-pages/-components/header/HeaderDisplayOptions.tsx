import { useTranslation } from 'react-i18next';
import { HeaderChoice, HeaderToggle } from './HeaderEditorFields';

/**
 * Header-wide options: how the current page's nav item is marked, the site
 * search icon and the language switch. Each is off (or the original pill)
 * until set, so existing headers look as they always have.
 */
export const HeaderDisplayOptions = ({
    props,
    onChange,
}: {
    props: Record<string, unknown>;
    onChange: (key: 'activeStyle' | 'showSearch' | 'showLanguageSwitcher', value: unknown) => void;
}) => {
    const { t } = useTranslation('managePagesPropertyPanel');
    return (
        <div className="space-y-3 rounded border border-neutral-200 p-3">
            <p className="text-sm font-medium">{t('headerExtras.heading')}</p>
            <HeaderChoice
                label={t('headerExtras.currentPage')}
                value={props.activeStyle === 'underline' ? 'underline' : 'pill'}
                options={[
                    { value: 'pill', label: t('headerExtras.tintedPill') },
                    { value: 'underline', label: t('headerExtras.underline') },
                ]}
                onChange={(v) => onChange('activeStyle', v)}
            />
            <HeaderToggle
                label={t('headerExtras.search')}
                hint={t('headerExtras.searchHint')}
                checked={props.showSearch === true}
                onChange={(v) => onChange('showSearch', v)}
            />
            <HeaderToggle
                label={t('headerExtras.languageSwitch')}
                hint={t('headerExtras.languageSwitchHint')}
                checked={props.showLanguageSwitcher === true}
                onChange={(v) => onChange('showLanguageSwitcher', v)}
            />
        </div>
    );
};

export default HeaderDisplayOptions;
