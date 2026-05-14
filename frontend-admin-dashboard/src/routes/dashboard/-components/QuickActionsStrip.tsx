import { useNavigate } from '@tanstack/react-router';
import { quickActionsForRoles, type QuickAction } from '../-config/dashboard-quick-actions';

interface QuickActionsStripProps {
    roles: string[];
}

export default function QuickActionsStrip({ roles }: QuickActionsStripProps) {
    const navigate = useNavigate();
    const actions = quickActionsForRoles(roles);
    if (actions.length === 0) return null;

    return (
        <div className="no-scrollbar -mx-2 flex gap-2 overflow-x-auto px-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {actions.map((a: QuickAction) => {
                const Icon = a.icon;
                return (
                    <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                            navigate(
                                a.search
                                    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      ({ to: a.to, search: a.search } as any)
                                    : { to: a.to }
                            )
                        }
                        className="group flex shrink-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md"
                    >
                        <span className="flex size-6 items-center justify-center rounded-lg bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-100">
                            <Icon size={14} weight="duotone" />
                        </span>
                        <span className="group-hover:text-primary-700">{a.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
