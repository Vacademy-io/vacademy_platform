import { useEffect, useMemo, useState } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { addWeeks } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CaretUpDown, Check, FunnelSimple, UsersThree } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { MyButton } from '@/components/design-system/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNavHeadingStore } from '@/stores/layout-container/useNavHeadingStore';
import { getInstituteId } from '@/constants/helper';
import { useMeetingsScope, useTeamCalendar } from '../-hooks/use-meetings';
import { toIsoWithOffset } from '../-utils/meetings-utils';
import { MeetingsList } from '../-components/meetings-list';
import { WeekNavigator, weekBoundsFor } from '../-components/week-navigator';

export const Route = createLazyFileRoute('/meetings/team/')({
    component: TeamMeetingsRoute,
});

const ALL_HOSTS_VALUE = '__ALL_HOSTS__';

function TeamMeetingsRoute() {
    return (
        <LayoutContainer>
            <TeamMeetingsPage />
        </LayoutContainer>
    );
}

function TeamMeetingsPage() {
    const { t } = useTranslation('meetingsTeamIndexLazy');
    const { setNavHeading } = useNavHeadingStore();
    useEffect(() => {
        setNavHeading(<h1 className="text-lg">{t('navHeading')}</h1>);
    }, [setNavHeading, t]);

    const instituteId = getInstituteId();
    const [weekAnchor, setWeekAnchor] = useState(() => new Date());
    const [hostFilter, setHostFilter] = useState(ALL_HOSTS_VALUE);
    const { start } = weekBoundsFor(weekAnchor);

    // Host options derive from the visible week's bookings — a filter carried
    // across navigation could point at a host with no rows and strand the page.
    const handleWeekChange = (anchor: Date) => {
        setWeekAnchor(anchor);
        setHostFilter(ALL_HOSTS_VALUE);
    };

    const { data: scope, isLoading: scopeLoading, error: scopeError } = useMeetingsScope(instituteId);
    const canViewTeam = !!scope && (scope.is_admin || scope.is_team_manager);

    // Exact local week window as ISO offset datetimes: start = local week
    // start 00:00, end = exclusive next week start 00:00.
    const {
        data: bookings,
        isLoading,
        error,
    } = useTeamCalendar(
        instituteId,
        toIsoWithOffset(start),
        toIsoWithOffset(addWeeks(start, 1)),
        canViewTeam
    );

    // Host filter options built from the distinct hosts in the current result.
    const hostOptions = useMemo(() => {
        const byId = new Map<string, string>();
        for (const booking of bookings ?? []) {
            if (booking.host_user_id) {
                byId.set(booking.host_user_id, booking.host_name || t('unknownHost'));
            }
        }
        return [...byId.entries()].map(([id, name]) => ({ id, name }));
    }, [bookings, t]);

    const filteredBookings = useMemo(() => {
        const all = bookings ?? [];
        if (hostFilter === ALL_HOSTS_VALUE) return all;
        return all.filter((booking) => booking.host_user_id === hostFilter);
    }, [bookings, hostFilter]);

    if (scopeLoading) {
        return (
            <div className="flex min-h-60 items-center justify-center">
                <DashboardLoader />
            </div>
        );
    }

    if (!scopeError && !canViewTeam) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white py-16 text-center">
                <UsersThree className="size-10 text-neutral-300" />
                <p className="text-body font-semibold text-neutral-700">{t('noTeamTitle')}</p>
                <p className="max-w-md text-caption text-neutral-500">{t('noTeamDescription')}</p>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">{t('heading')}</h1>
                    <p className="mt-0.5 text-sm text-neutral-500">{t('subtitle')}</p>
                </div>
                {hostOptions.length > 0 && (
                    <HostFilter
                        options={hostOptions}
                        value={hostFilter}
                        onChange={setHostFilter}
                    />
                )}
            </div>

            <WeekNavigator weekStart={start} onChange={handleWeekChange} />

            <MeetingsList
                bookings={filteredBookings}
                isLoading={isLoading}
                error={scopeError ?? error}
                showHost
                emptyTitle={t('emptyTitle')}
                emptyDescription={t('emptyDescription')}
            />
        </div>
    );
}

/** Searchable host filter — type to find a host instead of scrolling a long dropdown. */
function HostFilter({
    options,
    value,
    onChange,
}: {
    options: { id: string; name: string }[];
    value: string;
    onChange: (next: string) => void;
}) {
    const { t } = useTranslation('meetingsTeamIndexLazy');
    const [open, setOpen] = useState(false);
    const allHostsLabel = t('allHosts', { count: options.length });
    const selectedLabel =
        value === ALL_HOSTS_VALUE
            ? allHostsLabel
            : (options.find((o) => o.id === value)?.name ?? t('filterByHost'));

    const select = (next: string) => {
        onChange(next);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="medium"
                    className="w-full justify-between font-normal sm:w-56 sm:min-w-0"
                    aria-label={t('hostFilterAriaLabel')}
                >
                    <span className="flex min-w-0 items-center gap-2">
                        <FunnelSimple size={16} className="shrink-0 text-neutral-400" />
                        <span className="truncate">{selectedLabel}</span>
                    </span>
                    <CaretUpDown size={14} className="shrink-0 text-neutral-400" />
                </MyButton>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
                <Command>
                    <CommandInput placeholder={t('searchHostPlaceholder')} />
                    <CommandList>
                        <CommandEmpty>{t('noHostFound')}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={allHostsLabel}
                                onSelect={() => select(ALL_HOSTS_VALUE)}
                                className="gap-2"
                            >
                                <Check
                                    size={14}
                                    className={cn(
                                        value === ALL_HOSTS_VALUE ? 'opacity-100' : 'opacity-0'
                                    )}
                                />
                                {allHostsLabel}
                            </CommandItem>
                            {options.map((host) => (
                                <CommandItem
                                    key={host.id}
                                    value={host.name}
                                    onSelect={() => select(host.id)}
                                    className="gap-2"
                                >
                                    <Check
                                        size={14}
                                        className={cn(
                                            value === host.id ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <span className="truncate">{host.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
