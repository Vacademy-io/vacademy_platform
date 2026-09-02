import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CircleNotch, UserGear } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getPackageSettingData, savePackageSettingKey } from '@/services/package-settings';

interface LmsExistingUserPolicyCardProps {
    packageId: string;
    refreshKey?: number;
}

const COURSE_SETTING_KEY = 'COURSE_SETTING';

type CourseSettingData = Record<string, unknown> & {
    lms?: Record<string, unknown> & { editExistingUser?: boolean };
};

/**
 * "When a learner already exists on the LMS, update their details?"
 *
 * Backs `COURSE_SETTING.data.lms.editExistingUser` for this course. The enrolment workflow reads
 * it (course setting first, institute setting as fallback — see `LmsExistingUserEditPolicyService`)
 * and puts the answer on the run context as `lmsEditExistingUser`; the edit-user HTTP node is
 * gated on it.
 *
 * Off by default and off when unset: the enrolment workflow looks the learner up by email and, on
 * a hit, keeps the existing account untouched. Turning this on makes it overwrite that account's
 * name with ours — a write to a system we don't own, so it's opt-in.
 */
export const LmsExistingUserPolicyCard: React.FC<LmsExistingUserPolicyCardProps> = ({
    packageId,
    refreshKey,
}) => {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = (await getPackageSettingData(
                packageId,
                COURSE_SETTING_KEY
            )) as CourseSettingData | null;
            setEnabled(data?.lms?.editExistingUser === true);
        } catch {
            // An unreadable setting means "not configured", which is the same as off. Don't
            // surface an error toast for a card the admin may not even be looking at.
            setEnabled(false);
        } finally {
            setLoading(false);
        }
    }, [packageId]);

    useEffect(() => {
        void load();
    }, [load, refreshKey]);

    const handleToggle = async (next: boolean) => {
        setSaving(true);
        // Optimistic: the switch should move under the finger, not after a round trip.
        setEnabled(next);
        try {
            // Read-modify-write. save-setting replaces the WHOLE COURSE_SETTING data blob, so
            // merging is not optional — writing just { lms: {...} } would wipe every other
            // course setting stored under this key.
            const current = ((await getPackageSettingData(packageId, COURSE_SETTING_KEY)) ??
                {}) as CourseSettingData;
            const merged: CourseSettingData = {
                ...current,
                lms: { ...(current.lms ?? {}), editExistingUser: next },
            };
            await savePackageSettingKey(packageId, COURSE_SETTING_KEY, merged, 'Course settings');
            toast.success(
                next
                    ? 'Existing LMS users will be updated on enrolment for this course.'
                    : 'Existing LMS users will be left untouched for this course.'
            );
        } catch {
            setEnabled(!next);
            toast.error("Couldn't save the setting. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-body font-semibold">
                    <UserGear size={18} weight="duotone" className="text-neutral-500" />
                    Existing LMS users
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="lms-edit-existing-user" className="text-sm">
                            Update their details on enrolment
                        </Label>
                        <p className="max-w-2xl text-caption text-neutral-500">
                            When someone enrols and already has an account on the connected LMS,
                            push their current name from here to that account. Leave this off to
                            enrol them into the course without touching the account they already
                            have.
                        </p>
                        <p className="max-w-2xl text-caption text-neutral-400">
                            Their email is how the LMS account is found, so it is never changed —
                            and their LMS password is never touched.
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-1">
                        {(loading || saving) && (
                            <CircleNotch className="size-4 animate-spin text-neutral-400" />
                        )}
                        <Switch
                            id="lms-edit-existing-user"
                            checked={enabled}
                            disabled={loading || saving}
                            onCheckedChange={(next) => void handleToggle(next)}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
