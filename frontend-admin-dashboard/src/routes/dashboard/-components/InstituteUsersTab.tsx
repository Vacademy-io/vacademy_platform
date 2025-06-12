import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { RoleTypeEmptyScreen, RoleTypeUserIcon } from "@/svgs";
import { CheckCircle, XCircle } from "phosphor-react";
import InstituteUsersOptions from "./InstituteUsersOptions";
import { RolesDummyDataType, UserRolesDataEntry } from "@/types/dashboard/user-roles";

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
    return (
        <>
            {selectedTab === "instituteUsers" && selectedTabData.length === 0 ? (
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
                                    <RoleTypeUserIcon />
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
                                    <Badge
                                        key={idx}
                                        className={`flex items-center gap-1 whitespace-nowrap rounded-lg border border-neutral-300 py-1.5 font-thin shadow-none ${
                                            item.status === "ACTIVE"
                                                ? "bg-success-50"
                                                : "bg-neutral-50"
                                        }`}
                                    >
                                        {item.status === "ACTIVE" ? (
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
                                        {item.status}
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
