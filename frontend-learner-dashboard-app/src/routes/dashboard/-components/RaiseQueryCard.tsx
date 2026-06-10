import { Card, CardContent } from '@/components/ui/card';
import { Question, CaretRight } from '@phosphor-icons/react';
import { useDoubtManagementSetting } from '@/services/doubt-management-settings';
import { useQueryDialogStore } from '@/stores/useQueryDialogStore';

/**
 * Dashboard entry point for the general query intake. Renders only when the institute enabled the
 * dashboard card under Doubt Settings. Opens the shared global QueryDialog (rendered in the navbar).
 */
export const RaiseQueryCard = () => {
    const { showDashboardCard } = useDoubtManagementSetting();
    const open = useQueryDialogStore((s) => s.open);

    if (!showDashboardCard) return null;

    return (
        <Card
            onClick={open}
            className="cursor-pointer transition-shadow hover:shadow-md"
        >
            <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
                        <Question weight="duotone" size={22} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                            Need help? Raise a query
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Ask a doubt or report a technical / payment issue.
                        </p>
                    </div>
                </div>
                <CaretRight size={16} className="text-muted-foreground" />
            </CardContent>
        </Card>
    );
};
