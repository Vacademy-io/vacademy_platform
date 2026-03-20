import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import React from 'react';
import { SidebarItemProps } from '../../../../types/layout-container/layout-container-types';
import { Link } from '@tanstack/react-router';
import { useRouter } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { LockKey } from '@phosphor-icons/react';
import { useNavigate } from '@tanstack/react-router';
import { getCategoryColors } from './sidebar-colors';
import { recordRecentTab } from './recent-tabs-store';

export const CollapsibleItem = ({
    icon,
    title,
    to,
    subItems,
    locked,
    category,
}: SidebarItemProps) => {
    const [hover, setHover] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const router = useRouter();
    const colors = getCategoryColors(category as 'CRM' | 'LMS' | 'AI');

    const currentRoute = router.state.location.pathname;
    const routeMatches =
        subItems?.some((item) => item.subItemLink && currentRoute.includes(item.subItemLink)) ||
        currentRoute === to;

    const handleLockedClick = (e: React.MouseEvent, featureName: string) => {
        if (locked) {
            e.preventDefault();
            e.stopPropagation();
            navigate({ to: '/locked-feature', search: { feature: featureName } });
        }
    };

    const handleLockedSubItemClick = (
        e: React.MouseEvent,
        featureName: string,
        isSubLocked?: boolean
    ) => {
        if (isSubLocked) {
            e.preventDefault();
            e.stopPropagation();
            navigate({ to: '/locked-feature', search: { feature: featureName } });
        }
    };

    const handleSubItemClick = (subItem: { subItem?: string; subItemLink?: string }) => {
        if (subItem.subItemLink && subItem.subItem) {
            recordRecentTab({
                id: `${title}-${subItem.subItem}`,
                label: subItem.subItem,
                route: subItem.subItemLink,
                category: (category as 'CRM' | 'LMS' | 'AI') || 'CRM',
                parentId: title,
                parentLabel: title,
            });
        }
    };

    useEffect(() => {
        if (routeMatches) {
            setIsOpen(true);
        }
    }, [routeMatches]);

    // Locked state
    if (locked) {
        return (
            <div
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-full px-3 py-1.5 transition-colors hover:bg-neutral-100"
                onClick={(e) => handleLockedClick(e, title)}
            >
                <LockKey className="size-[18px] text-neutral-400" weight="duotone" />
                <span className="text-[13px] text-neutral-400">{title}</span>
            </div>
        );
    }

    // Normal expanded panel rendering
    return (
        <Collapsible
            className="group/collapsible"
            open={isOpen}
            onOpenChange={setIsOpen}
        >
            <CollapsibleTrigger
                className="flex w-full items-center"
                onClick={() => setIsOpen((prev) => !prev)}
            >
                <div
                    className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 rounded-full px-3 py-1.5 transition-all duration-150',
                        routeMatches
                            ? cn(colors.pillBg, colors.pillText)
                            : 'text-neutral-600 hover:bg-neutral-100'
                    )}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                >
                    {/* Icon */}
                    {icon &&
                        React.createElement(icon, {
                            size: 18,
                            weight: hover || routeMatches ? 'fill' : 'regular',
                            className: cn(
                                'flex-shrink-0 transition-colors duration-150',
                                hover || routeMatches ? (routeMatches ? colors.pillText : colors.text) : 'text-neutral-500'
                            ),
                        })}

                    {/* Title */}
                    <span
                        className={cn(
                            'flex-1 truncate text-left text-[13px] transition-colors duration-150',
                            routeMatches
                                ? cn(colors.pillText, 'font-medium')
                                : hover
                                    ? cn(colors.text, 'font-medium')
                                    : 'text-neutral-600'
                        )}
                    >
                        {title}
                    </span>

                    {/* Chevron */}
                    <ChevronDown
                        className={cn(
                            'size-3.5 flex-shrink-0 transition-transform duration-200',
                            isOpen && 'rotate-180',
                            hover || routeMatches ? (routeMatches ? colors.pillText : colors.text) : 'text-neutral-400'
                        )}
                    />
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <div className="ml-5 flex flex-col gap-0.5 border-l border-neutral-200 py-1 pl-4">
                    {subItems?.map((obj, key) => {
                        const isSubActive =
                            obj.subItemLink && currentRoute.includes(obj.subItemLink);
                        return (
                            <Link
                                to={obj.subItemLink}
                                key={key}
                                onClick={(e) => {
                                    handleLockedSubItemClick(
                                        e,
                                        obj.subItem || '',
                                        obj.locked
                                    );
                                    handleSubItemClick(obj);
                                }}
                            >
                                <div
                                    className={cn(
                                        'flex cursor-pointer items-center gap-2 rounded-full px-3 py-1 text-[13px] transition-all duration-150',
                                        isSubActive
                                            ? cn(colors.pillText, 'font-medium', colors.pillBg)
                                            : cn(
                                                  'text-neutral-500',
                                                  colors.hoverText,
                                                  'hover:bg-neutral-50'
                                              )
                                    )}
                                >
                                    <span className="truncate">{obj.subItem}</span>
                                    {obj.locked && (
                                        <LockKey
                                            size={12}
                                            className="ml-auto flex-shrink-0 text-neutral-400"
                                        />
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
