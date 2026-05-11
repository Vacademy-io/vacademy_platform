import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import {
    getAllRoles,
    type CustomRole,
} from '@/routes/manage-custom-teams/-services/custom-team-services';
import { mapRoleToCustomName } from '@/utils/roleUtils';

interface Props {
    // The role name (uppercased) whose toggle should be locked on to prevent
    // accidentally hiding the viewer's own role from the team picker.
    selfRoleName: string;
    // Current map of role-name -> visible. Missing keys are treated as visible.
    visibleRoles: Record<string, boolean>;
    // Called with the new map on any toggle change.
    onChange: (next: Record<string, boolean>) => void;
}

export function TeamRoleVisibilityCard({ selfRoleName, visibleRoles, onChange }: Props) {
    const [roles, setRoles] = useState<CustomRole[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const selfKey = selfRoleName.toUpperCase();

    useEffect(() => {
        let cancelled = false;
        getAllRoles()
            .then((r: CustomRole[]) => {
                if (!cancelled) setRoles(r || []);
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load roles');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const teamRoles = (roles || []).filter((r) => r.name.toUpperCase() !== 'STUDENT');

    return (
        <Card>
            <CardHeader>
                <CardTitle>Team Tab — Role Visibility</CardTitle>
                <CardDescription>
                    Choose which roles appear in the Team tab&apos;s role filter and the Invite
                    User &quot;Role Type&quot; dropdown for this role. Hidden roles cannot be
                    selected when inviting or filtering team members.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {error ? (
                    <div className="text-sm text-destructive">{error}</div>
                ) : roles === null ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading roles…
                    </div>
                ) : teamRoles.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No roles available.</div>
                ) : (
                    teamRoles.map((r) => {
                        const key = r.name.toUpperCase();
                        const isSelf = key === selfKey;
                        const checked = isSelf ? true : visibleRoles[key] !== false;
                        return (
                            <div
                                key={r.id}
                                className="flex items-center justify-between rounded border p-3"
                            >
                                <div>
                                    <div className="text-sm font-medium">
                                        {mapRoleToCustomName(r.name)}
                                    </div>
                                    {isSelf && (
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            Locked on — you can&apos;t hide your own role.
                                        </div>
                                    )}
                                </div>
                                <Switch
                                    checked={checked}
                                    disabled={isSelf}
                                    onCheckedChange={(c) =>
                                        onChange({ ...visibleRoles, [key]: c })
                                    }
                                />
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
