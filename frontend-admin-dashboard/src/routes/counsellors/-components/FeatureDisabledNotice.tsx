import { Lock } from '@phosphor-icons/react';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';

interface Props {
    title: string;
    settingsLabel: string;
}

/**
 * Render this when a route is being visited but its display-settings flag
 * is off. The route file imports this and short-circuits its own render so
 * a direct URL hit (deep link, browser refresh, bookmark) cannot expose a
 * feature the institute hasn't opted into.
 */
export function FeatureDisabledNotice({ title, settingsLabel }: Props) {
    return (
        <LayoutContainer>
            <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 p-12 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-neutral-100">
                    <Lock size={24} className="text-neutral-500" />
                </div>
                <h2 className="text-h3 font-medium text-neutral-900">{title}</h2>
                <p className="text-subtitle text-neutral-500">
                    This feature is currently disabled for your institute. An admin can turn it
                    on under <span className="font-medium">Settings → Admin Display Settings →{' '}
                    {settingsLabel}</span>.
                </p>
            </div>
        </LayoutContainer>
    );
}
