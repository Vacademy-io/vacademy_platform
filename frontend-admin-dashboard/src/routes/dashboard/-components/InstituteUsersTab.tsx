import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import { RoleTypeEmptyScreen } from '@/svgs';
import { CheckCircle, XCircle } from '@phosphor-icons/react';
import InstituteUsersOptions from './InstituteUsersOptions';
import { RolesDummyDataType, UserRolesDataEntry } from '@/types/dashboard/user-roles';
import { useFileUpload } from '@/hooks/use-file-upload';
import { useEffect, useState } from 'react';
import EnrollFormUploadImage from '@/assets/svgs/enroll-form-upload-image.svg';
import { mapRoleToCustomName } from '@/utils/roleUtils';

interface InviteUsersTabProps {
    selectedTab: keyof RolesDummyDataType;
    selectedTabData: UserRolesDataEntry[];
    refetchData: () => void;
}

const InstituteUsersComponent: React.FC<InviteUsersTabProps> = ({
    selectedTab,
    selectedTabData,
    refetchData,
}) => {
    const { getPublicUrl } = useFileUpload();
    const [profilePics, setProfilePics] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        const fetchProfilePics = async () => {
            const pics: { [key: string]: string } = {};
            for (const user of selectedTabData) {
                if (user.profile_pic_file_id) {
                    const publicUrl = await getPublicUrl(user.profile_pic_file_id);
                    pics[user.id] = publicUrl || '';
                }
            }
            setProfilePics(pics);
        };

        fetchProfilePics();
    }, [selectedTabData]);

    return (
        <>
            {selectedTab === 'instituteUsers' && selectedTabData.length === 0 ? (
                <div className="flex h-[60vh] w-screen flex-col items-center justify-center">
                    <RoleTypeEmptyScreen />
                    <p>No institute users exists.</p>
                </div>
            ) : (
                <TabsContent
                    key="instituteUsers"
                    value="instituteUsers"
                    className="mt-6 flex flex-col gap-6"
                >
                    {selectedTabData?.map((item, idx) => {
                        return (
                            <div key={idx} className="flex justify-between">
                                <div className="flex items-center gap-4">
                                    {profilePics[item.id] ? (
                                        <img
                                            src={profilePics[item.id]}
                                            alt={item.full_name}
                                            className="size-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                                            <EnrollFormUploadImage />
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-4">
                                            <p>{item.full_name}</p>
                                            {item.roles?.map((role, index) => {
                                                const customRoleName = mapRoleToCustomName(
                                                    role.role_name
                                                );
                                                return (
                                                    <Badge
                                                        key={index}
                                                        className={`whitespace-nowrap rounded-lg border border-neutral-300 py-1.5 font-thin shadow-none ${role.role_name === 'ADMIN'
                                                                ? 'bg-[#F4F9FF]'
                                                                : role.role_name ===
                                                                    'COURSE CREATOR'
                                                                    ? 'bg-[#F4FFF9]'
                                                                    : role.role_name ===
                                                                        'ASSESSMENT CREATOR'
                                                                        ? 'bg-[#FFF4F5]'
                                                                        : 'bg-[#F5F0FF]'
                                                            }`}
                                                    >
                                                        {customRoleName}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                        <p className="text-sm">{item.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge
                                        key={idx}
                                        className={`flex items-center gap-1 whitespace-nowrap rounded-lg border border-neutral-300 py-1.5 font-thin shadow-none ${item.roles.some((role) => role.status === 'ACTIVE')
                                                ? 'bg-success-50'
                                                : 'bg-neutral-50'
                                            }`}
                                    >
                                        {item.roles.some((role) => role.status === 'ACTIVE') ? (
                                            <CheckCircle
                                                size={20}
                                                weight="fill"
                                                className="text-success-600"
                                            />
                                        ) : (
                                            <XCircle
                                                size={20}
                                                weight="fill"
                                                className="text-neutral-400"
                                            />
                                        )}
                                        {item.roles.some((role) => role.status === 'ACTIVE')
                                            ? 'ACTIVE'
                                            : 'DISABLED'}
                                    </Badge>
                                    <InstituteUsersOptions user={item} refetchData={refetchData} />
                                </div>
                            </div>
                        );
                    })}
                </TabsContent>
            )}
        </>
    );
};

export default InstituteUsersComponent;
