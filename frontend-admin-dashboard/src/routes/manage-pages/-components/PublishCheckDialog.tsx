import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { WarningCircle, CheckCircle, Info } from '@phosphor-icons/react';
import type { PublishIssue } from '../-utils/publish-checks';

/**
 * Shown when the admin hits Publish and the site has issues worth a second
 * look. Warns, never blocks — "Publish anyway" is always available, because
 * the admin knows things the checker doesn't.
 */
export const PublishCheckDialog = ({
    open,
    onOpenChange,
    issues,
    onConfirm,
    onJumpTo,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    issues: PublishIssue[];
    onConfirm: () => void;
    onJumpTo?: (issue: PublishIssue) => void;
}) => {
    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {errors.length > 0 ? (
                            <WarningCircle className="size-5 text-danger-600" weight="fill" />
                        ) : (
                            <Info className="size-5 text-warning-600" weight="fill" />
                        )}
                        Before you publish
                    </DialogTitle>
                </DialogHeader>

                <p className="text-sm text-gray-600">
                    {errors.length > 0
                        ? `${errors.length} thing${errors.length === 1 ? '' : 's'} on your site won’t work for visitors.`
                        : 'A few suggestions — none of these stop your site from working.'}
                </p>

                <div className="max-h-96 space-y-2 overflow-y-auto">
                    {[...errors, ...warnings].map((issue, i) => (
                        <div
                            key={i}
                            className={`rounded border p-2.5 ${issue.severity === 'error' ? 'border-danger-200 bg-danger-50' : 'border-warning-200 bg-warning-50'}`}
                        >
                            <p className="text-sm font-medium text-gray-800">{issue.title}</p>
                            <p className="mt-0.5 text-caption text-gray-600">{issue.fix}</p>
                            <div className="mt-1 flex items-center gap-2">
                                {issue.pageName && (
                                    <span className="text-caption text-gray-400">on “{issue.pageName}”</span>
                                )}
                                {onJumpTo && issue.pageId && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onJumpTo(issue);
                                            onOpenChange(false);
                                        }}
                                        className="text-caption font-medium text-primary-500 hover:underline"
                                    >
                                        Take me there
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                        Keep editing
                    </Button>
                    <Button size="sm" onClick={onConfirm}>
                        <CheckCircle className="mr-1.5 size-4" />
                        Publish anyway
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PublishCheckDialog;
