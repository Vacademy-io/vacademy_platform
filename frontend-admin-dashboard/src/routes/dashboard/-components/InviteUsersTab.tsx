import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { RoleTypeEmptyScreen } from "@/svgs";
import InviteUsersOptions from "./InviteUsersOptions";
import { RolesDummyDataType, UserRolesDataEntry } from "@/types/dashboard/user-roles";

interface InviteUsersTabProps {
    selectedTab: keyof RolesDummyDataType;
    selectedTabData: UserRolesDataEntry[];
    refetchData: () => void;
}

const InviteUsersTab: React.FC<InviteUsersTabProps> = ({
    selectedTab,
    selectedTabData,
    refetchData,
}) => {
    return (
        <>
            {selectedTab === "invites" && selectedTabData.length === 0 ? (
                <div className="flex h-[60vh] w-screen flex-col items-center justify-center">
                    <RoleTypeEmptyScreen />
                    <p>No users have been invited yet.</p>
                </div>
            ) : (
                <TabsContent key="invites" value="invites" className="mt-6 flex flex-col gap-6">
                    {selectedTabData?.map((item, idx) => {
                        return (
                            <div key={idx} className="flex justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-4">
                                            <p>{item.full_name}</p>
                                            {item.roles?.map((role, index) => {
                                                return (
                                                    <Badge
                                                        key={index}
                                                        className={`whitespace-nowrap rounded-lg border border-neutral-300 py-1.5 font-thin shadow-none ${
                                                            role.role_name === "ADMIN"
                                                                ? "bg-[#F4F9FF]"
                                                                : role.role_name ===
                                                                    "COURSE CREATOR"
                                                                  ? "bg-[#F4FFF9]"
                                                                  : role.role_name ===
                                                                      "ASSESSMENT CREATOR"
                                                                    ? "bg-[#FFF4F5]"
                                                                    : "bg-[#F5F0FF]"
                                                        }`}
                                                    >
                                                        {role.role_name}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                        <p className="text-sm">{item.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <InviteUsersOptions user={item} refetchData={refetchData} />
                                </div>
                            </div>
                        );
                    })}
                </TabsContent>
            )}
        </>
    );
};

export default InviteUsersTab;
