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
}) => (
    <div className="space-y-3 rounded border border-neutral-200 p-3">
        <p className="text-sm font-medium">Header extras</p>
        <HeaderChoice
            label="Current page"
            value={props.activeStyle === 'underline' ? 'underline' : 'pill'}
            options={[
                { value: 'pill', label: 'Tinted pill' },
                { value: 'underline', label: 'Underline' },
            ]}
            onChange={(v) => onChange('activeStyle', v)}
        />
        <HeaderToggle
            label="Search"
            hint="A search icon that finds courses, pages and mega-menu streams."
            checked={props.showSearch === true}
            onChange={(v) => onChange('showSearch', v)}
        />
        <HeaderToggle
            label="Language switch"
            hint="हिन्दी | EN — appears once the site has more than one language (Global Settings)."
            checked={props.showLanguageSwitcher === true}
            onChange={(v) => onChange('showLanguageSwitcher', v)}
        />
    </div>
);

export default HeaderDisplayOptions;
