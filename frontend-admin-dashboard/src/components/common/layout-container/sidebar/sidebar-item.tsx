import { SidebarItemProps } from '../../../../types/layout-container/layout-container-types';
import { CollapsibleItem } from './collapsible-item';
import { NonCollapsibleItem } from './non-collapsible-item';

export const SidebarItem = ({ icon, title, to, subItems, locked, category }: SidebarItemProps) => {
    if (subItems) {
        return (
            <CollapsibleItem
                icon={icon}
                title={title}
                to={to}
                subItems={subItems}
                locked={locked}
                category={category}
            />
        );
    }

    return (
        <NonCollapsibleItem
            icon={icon}
            title={title}
            to={to}
            locked={locked}
            category={category}
        />
    );
};
