import { SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { CollapsibleItem } from "./collapsible-item";
import { NonCollapsibleItem } from "./non-collapsible-item";
import { SidebarItemProps } from "@/types/layout-container-types";

export const SidebarItem = ({ icon, title, to, subItems }: SidebarItemProps) => {
    const { state } = useSidebar();

    return (
        <SidebarMenuItem className={`transition-all duration-200 ${state === "expanded" ? "w-full" : "w-fit"}`}>
            {subItems && subItems.length > 0 ? (
                <CollapsibleItem icon={icon} title={title} to={to} subItems={subItems} />
            ) : (
                <NonCollapsibleItem icon={icon} title={title} to={to} />
            )}
        </SidebarMenuItem>
    );
};
