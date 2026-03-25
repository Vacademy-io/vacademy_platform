import { useEffect, useState } from 'react';
import { BASE_URL_LEARNER_DASHBOARD } from '@/constants/urls';
import { useStudentSidebar } from '@/routes/manage-students/students-list/-context/selected-student-sidebar-context';
import {
    fetchSubOrgAdmins,
    fetchSubOrgMembers,
    SubOrgAdmin,
    SubOrgMember,
} from '@/routes/manage-students/students-list/-services/sub-org-service';
import { DashboardLoader } from '@/components/core/dashboard-loader';
import { Users, User, Buildings, ShieldCheck, ArrowSquareOut, Copy, Check, Key } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useStudentCredentialsStore } from '@/stores/students/students-list/useStudentCredentialsStore';
import { useUsersCredentials } from '@/routes/manage-students/students-list/-services/usersCredentials';

export const StudentSubOrg = ({ isSubmissionTab }: { isSubmissionTab?: boolean }) => {
    const { selectedStudent } = useStudentSidebar();
    const [isLoading, setIsLoading] = useState(false);
    const [admins, setAdmins] = useState<SubOrgAdmin[] | null>(null);
    const [members, setMembers] = useState<SubOrgMember[] | null>(null);
    const [copiedUsername, setCopiedUsername] = useState(false);
    const [copiedPassword, setCopiedPassword] = useState(false);

    // Credentials logic
    const { getCredentials } = useStudentCredentialsStore();
    const { mutate: fetchCredentials } = useUsersCredentials();


    // Helper to determine if current selected user is an admin in the sub-org
    const isSubOrgAdmin = () => {
        if (!selectedStudent?.comma_separated_org_roles) return false;
        // Check if any role is ADMIN. Roles might be comma separated strings.
        const roles = selectedStudent.comma_separated_org_roles
            .split(',')
            .map((r) => r.trim().toUpperCase());
        return roles.includes('ADMIN');
    };

    const userId = isSubmissionTab ? selectedStudent?.id : selectedStudent?.user_id;

    // Fetch credentials if not available
    const credentials = userId ? getCredentials(userId) : null;

    useEffect(() => {
        if (userId && !credentials && isSubOrgAdmin()) {
            fetchCredentials({ userIds: [userId] });
        }
    }, [userId, credentials, fetchCredentials]);

    const handleCopy = (text: string, type: 'username' | 'password') => {
        navigator.clipboard.writeText(text);
        if (type === 'username') {
            setCopiedUsername(true);
            setTimeout(() => setCopiedUsername(false), 2000);
        } else {
            setCopiedPassword(true);
            setTimeout(() => setCopiedPassword(false), 2000);
        }
        toast.success(`${type === 'username' ? 'Username' : 'Password'} copied!`);
    };

    useEffect(() => {
        const fetchDetails = async () => {
            if (!selectedStudent || !selectedStudent.sub_org_id || !userId) return;

            setIsLoading(true);
            try {
                if (isSubOrgAdmin()) {
                    // Fetch members
                    const response = await fetchSubOrgMembers(
                        selectedStudent.package_session_id,
                        selectedStudent.sub_org_id
                    );
                    setMembers(response.student_mappings);
                } else {
                    // Fetch admins
                    const response = await fetchSubOrgAdmins(
                        userId,
                        selectedStudent.package_session_id,
                        selectedStudent.sub_org_id
                    );
                    setAdmins(response.admins);
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to fetch sub-organization details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetails();
    }, [selectedStudent, userId]);

    if (!selectedStudent?.sub_org_name) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-neutral-500">
                <Buildings className="mb-2 size-8 opacity-50" />
                <p>No Sub-Organization Associated</p>
            </div>
        );
    }

    if (isLoading) return <DashboardLoader />;

    return (
        <div className="animate-fadeIn space-y-4 text-neutral-600">
            {/* Header Card with SubOrg Details */}
            <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <Buildings className="size-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-800">
                            {selectedStudent.sub_org_name}
                        </h3>
                        <p className="text-xs text-neutral-500">Sub-Organization</p>
                    </div>
                </div>
            </div>

            {/* Content Based on Role */}
            {isSubOrgAdmin() ? (
                <div className="space-y-3">
                    {/* Admin Actions & Credentials Card */}
                    <div className="overflow-hidden rounded-xl border border-primary-100 bg-gradient-to-br from-primary-50/50 to-white shadow-sm">
                        <div className="border-b border-primary-100 bg-primary-50 px-4 py-3">
                            <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-700">
                                <Key className="size-4" />
                                Admin Access
                            </h4>
                        </div>
                        <div className="space-y-3 p-4">
                            <div className="flex flex-col gap-3 rounded-lg bg-white p-3 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-neutral-500">
                                        Username
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                                            {credentials?.username || selectedStudent.username || 'N/A'}
                                        </code>
                                        <button
                                            onClick={() =>
                                                handleCopy(
                                                    credentials?.username ||
                                                    selectedStudent.username ||
                                                    '',
                                                    'username'
                                                )
                                            }
                                            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
                                            title="Copy Username"
                                        >
                                            {copiedUsername ? (
                                                <Check className="size-3.5 text-green-500" />
                                            ) : (
                                                <Copy className="size-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-neutral-500">
                                        Password
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <code className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                                            {credentials?.password || '••••••••'}
                                        </code>
                                        <button
                                            onClick={() =>
                                                handleCopy(
                                                    credentials?.password || '',
                                                    'password'
                                                )
                                            }
                                            disabled={!credentials?.password}
                                            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50"
                                            title="Copy Password"
                                        >
                                            {copiedPassword ? (
                                                <Check className="size-3.5 text-green-500" />
                                            ) : (
                                                <Copy className="size-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <a
                                href={BASE_URL_LEARNER_DASHBOARD}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
                            >
                                Open Management Portal
                                <ArrowSquareOut className="size-4" />
                            </a>
                        </div>
                    </div>

                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        <Users className="size-4" />
                        Managed Members ({members?.length || 0})
                    </h4>

                    <div className="space-y-2">
                        {members && members.length > 0 ? (
                            members.map((member) => (
                                <div
                                    key={member.id}
                                    className="group flex items-center justify-between rounded-lg border border-neutral-100 bg-white p-3 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex size-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 group-hover:bg-blue-50 group-hover:text-blue-500">
                                            <User className="size-4" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-neutral-700">
                                                {member.user.full_name}
                                            </span>
                                            <span className="text-xs text-neutral-400">
                                                {member.user.username}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                        {member.status}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-4 text-center text-xs text-neutral-400">
                                No members found
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        <ShieldCheck className="size-4" />
                        Sub-Org Admins
                    </h4>

                    <div className="space-y-2">
                        {admins && admins.length > 0 ? (
                            admins.map((admin, idx) => (
                                <div
                                    key={idx}
                                    className="group flex items-center gap-3 rounded-lg border border-neutral-100 bg-white p-3 shadow-sm transition-all hover:border-purple-200 hover:shadow-md"
                                >
                                    <div className="flex size-8 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                                        <User className="size-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-neutral-700">
                                            {admin.name}
                                        </span>
                                        <span className="text-xs text-neutral-400">
                                            {admin.role}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-4 text-center text-xs text-neutral-400">
                                No admins found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
