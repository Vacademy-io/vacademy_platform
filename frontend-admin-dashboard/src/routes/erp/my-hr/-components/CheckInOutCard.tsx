import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, MapPin, SignIn, SignOut, WarningCircle } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { reportApiError } from '@/lib/report-api-error';
import type { AttendanceRecordDTO } from '@/routes/erp/-shared/hr-types';
import { formatClockTime } from '@/routes/erp/attendance/-components/attendance-meta';
import { useCheckInOut } from '@/routes/erp/my-hr/-hooks/use-my-hr';

interface CheckInOutCardProps {
    /** Today's attendance row, if one exists yet. */
    today: AttendanceRecordDTO | undefined;
    employeeId: string | null;
    isLoading: boolean;
}

/**
 * The employee's own check in / check out for today.
 *
 * One button, three states, driven entirely by today's record: no check-in yet →
 * Check in; checked in but not out → Check out; both stamped → a closed-day
 * summary with no button at all. A second control for the action you cannot take
 * is just a thing to misclick.
 *
 * **Location.** Coordinates are asked for but never waited on past a few seconds
 * and never required — see `readCoordinates`. Whether a geo-fence applies is the
 * institute's setting and the backend's decision, and an ordinary employee
 * cannot even read that setting (the config endpoint is HR-only), so this card
 * makes no prediction: it sends what it has and prints the backend's refusal
 * word for word. "You are outside the allowed geo-fence area" tells someone what
 * to do; a client-side guess does not.
 */
export const CheckInOutCard = ({ today, employeeId, isLoading }: CheckInOutCardProps) => {
    const mutation = useCheckInOut(employeeId);
    const [refusal, setRefusal] = useState<string | null>(null);

    const checkedInAt = today?.check_in_time;
    const checkedOutAt = today?.check_out_time;
    const direction: 'IN' | 'OUT' | null = !checkedInAt ? 'IN' : !checkedOutAt ? 'OUT' : null;

    const act = async () => {
        if (!direction) return;
        setRefusal(null);
        try {
            const message = await mutation.mutateAsync(direction);
            toast.success(
                typeof message === 'string' && message.trim()
                    ? message
                    : direction === 'IN'
                      ? 'Checked in'
                      : 'Checked out'
            );
        } catch (error) {
            // showToast: false — a geo-fence or payroll-lock refusal is the whole
            // answer to what just happened, and it should stay on screen.
            setRefusal(
                reportApiError(error, {
                    feature: 'erp-my-hr',
                    tags: { action: direction === 'IN' ? 'check-in' : 'check-out' },
                    fallbackMessage:
                        direction === 'IN' ? 'Could not check you in.' : 'Could not check you out.',
                    showToast: false,
                })
            );
        }
    };

    return (
        <Card className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Clock size={18} className="text-primary-500" />
                    <h2 className="text-title text-foreground">Today</h2>
                </div>
                <p className="text-caption text-muted-foreground">
                    Your attendance for today. Checking in stamps the time on your record — your HR
                    team sees the same one.
                </p>
            </div>

            {isLoading ? (
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-10 w-40" />
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-caption text-muted-foreground">Checked in</span>
                            <span className="text-subtitle font-medium tabular-nums text-foreground">
                                {checkedInAt ? formatClockTime(checkedInAt) : '—'}
                            </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-caption text-muted-foreground">Checked out</span>
                            <span className="text-subtitle font-medium tabular-nums text-foreground">
                                {checkedOutAt ? formatClockTime(checkedOutAt) : '—'}
                            </span>
                        </div>
                        {today?.total_hours != null && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-caption text-muted-foreground">Hours</span>
                                <span className="text-subtitle font-medium tabular-nums text-foreground">
                                    {String(today.total_hours)}
                                </span>
                            </div>
                        )}
                    </div>

                    {direction ? (
                        <div className="flex flex-col gap-2">
                            <MyButton
                                buttonType="primary"
                                scale="large"
                                type="button"
                                className="w-full sm:w-auto"
                                onAsyncClick={act}
                                loadingText={
                                    direction === 'IN' ? 'Checking you in…' : 'Checking you out…'
                                }
                            >
                                {direction === 'IN' ? <SignIn size={18} /> : <SignOut size={18} />}
                                {direction === 'IN' ? 'Check in' : 'Check out'}
                            </MyButton>
                            <p className="flex items-start gap-2 text-caption text-muted-foreground">
                                <MapPin size={14} className="mt-0.5 shrink-0" />
                                If your browser offers to share your location, allowing it lets your
                                institute confirm you checked in on site. You can decline — we send
                                the check-in either way, and you&apos;ll be told here if your
                                institute needs the location.
                            </p>
                        </div>
                    ) : (
                        <p className="text-body text-success-600">
                            Checked out at {formatClockTime(checkedOutAt)}. Your day is recorded —
                            nothing more to do.
                        </p>
                    )}

                    {refusal && (
                        <div className="flex items-start gap-2 rounded-md border border-danger-200 bg-danger-50 p-3">
                            <WarningCircle
                                size={16}
                                weight="fill"
                                className="mt-0.5 shrink-0 text-danger-600"
                            />
                            <p className="text-body text-danger-600">{refusal}</p>
                        </div>
                    )}
                </>
            )}
        </Card>
    );
};
