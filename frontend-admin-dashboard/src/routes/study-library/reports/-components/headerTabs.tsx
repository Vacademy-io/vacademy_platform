import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import BatchReports from "./batch/batchReports";
import StudentReports from "./student/studentReports";
import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearch } from "@tanstack/react-router";
import { Route } from "@/routes/study-library/reports";
import { fetchInstituteSetting, updateInstituteReportSetting } from "../../reports/-services/utils";
import {
    InstituteSettingResponse,
    RoleSetting,
    RoleSettingEnum,
    CommunicationTypeEnum,
    ReportDurationEnum,
    ReportTypeEnum,
} from "../../reports/-types/types";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { useMutation } from "@tanstack/react-query";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { toast } from "sonner";

const reportTypes = [
    ReportDurationEnum.DAILY,
    ReportDurationEnum.WEEKLY,
    ReportDurationEnum.MONTHLY,
] as const;

export default function HeaderTabs() {
    const search = useSearch({ from: Route.id });

    const [selectedTab, setSelectedTab] = useState(
        search.studentReport ? search.studentReport.tab : "BATCH",
    );
    const [settingDialogState, setSettingDialogState] = useState(false);
    const [settingDetails, setSettingDetails] = useState<InstituteSettingResponse>();

    const settingsMutation = useMutation({ mutationFn: fetchInstituteSetting });
    const { isPending } = settingsMutation;
    const updateSettingsMutation = useMutation({ mutationFn: updateInstituteReportSetting });

    const handleTabChange = (value: string) => {
        setSelectedTab(value);
    };

    const isCommTypeEnabled = (
        setting: RoleSetting | undefined,
        type: CommunicationTypeEnum.EMAIL | CommunicationTypeEnum.WHATSAPP,
    ) => {
        if (!setting) return false;
        else return setting.comma_separated_communication_types?.split(",").includes(type);
    };

    const toggleCommType = (
        role: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT,
        type: CommunicationTypeEnum.EMAIL | CommunicationTypeEnum.WHATSAPP,
        checked: boolean,
    ) => {
        setSettingDetails((prev) => {
            if (!prev) return prev;
            const updated = { ...prev };
            const setting = updated[role];

            let commTypes = setting.comma_separated_communication_types?.split(",") || [];

            if (checked) {
                if (!commTypes.includes(type)) commTypes.push(type);
            } else {
                commTypes = commTypes.filter((t) => t !== type);
            }

            setting.comma_separated_communication_types = commTypes.join(",");
            return updated;
        });
    };

    const toggleReportSetting = (
        role: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT,
        reportType: ReportTypeEnum.LEARNER_PROGRESS | ReportTypeEnum.BATCH_PROGRESS,
        duration: ReportDurationEnum,
        value: boolean,
    ) => {
        const currentSetting = settingDetails?.[role];
        if (!currentSetting) return;

        const updatedSetting = {
            ...currentSetting,
            [reportType]: {
                ...currentSetting[reportType],
                [duration]: value,
            },
        };

        setSettingDetails({
            ...settingDetails,
            [role]: updatedSetting,
        });
    };

    const renderProgressReportSection = (
        roleKey: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT,
        settingKey: ReportTypeEnum.LEARNER_PROGRESS | ReportTypeEnum.BATCH_PROGRESS,
        title: string,
    ) => (
        <div className="flex flex-col items-start gap-4">
            <div className="text-subtitle font-[600]">{title}</div>
            <div className="flex flex-row gap-6">
                {reportTypes.map((type) => (
                    <div key={type} className="flex flex-row items-center gap-2">
                        <Checkbox
                            checked={!!settingDetails?.[roleKey]?.[settingKey]?.[type]}
                            onCheckedChange={(checked) =>
                                toggleReportSetting(roleKey, settingKey, type, !!checked)
                            }
                        />
                        <div className="text-body">Generate {type} reports</div>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleSave = () => {
        if (!settingDetails) return;

        console.log("Saving updated settings:", settingDetails);

        updateSettingsMutation.mutate(settingDetails, {
            onSuccess: () => toast.success("Settings updated!"),
            onError: () => toast.error("Failed to update"),
        });
    };

    useEffect(() => {
        if (settingDialogState) {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const tokenData = getTokenDecodedData(accessToken);
            const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

            settingsMutation.mutate(INSTITUTE_ID || "", {
                onSuccess: (data) => {
                    console.log(data);
                    setSettingDetails(data);
                },
                onError: (error) => {
                    console.error("Error:", error);
                },
            });
        }
    }, [settingDialogState]);

    return (
        <div>
            <Tabs value={selectedTab} onValueChange={handleTabChange}>
                <div className="flex flex-row justify-between">
                    <TabsList className="inline-flex h-auto justify-start gap-4 rounded-none border-b-[1px] !bg-transparent p-0">
                        <TabsTrigger
                            value="BATCH"
                            className={`flex gap-1.5 rounded-none pb-2 pl-12 pr-12 pt-2 !shadow-none ${
                                selectedTab === "BATCH"
                                    ? "border-4px rounded-tl-sm rounded-tr-sm border !border-b-0 border-primary-200 !bg-primary-50"
                                    : "border-none bg-transparent"
                            }`}
                        >
                            Batch
                        </TabsTrigger>
                        <TabsTrigger
                            value="STUDENT"
                            className={`flex gap-1.5 rounded-none pb-2 pl-12 pr-12 pt-2 !shadow-none ${
                                selectedTab === "STUDENT"
                                    ? "border-4px rounded-tl-sm rounded-tr-sm border !border-b-0 border-primary-200 !bg-primary-50"
                                    : "border-none bg-transparent"
                            }`}
                        >
                            Student
                        </TabsTrigger>
                    </TabsList>
                    <MyButton
                        onClick={() => {
                            setSettingDialogState(!settingDialogState);
                        }}
                        buttonType="secondary"
                    >
                        Report Settings
                    </MyButton>
                </div>
                <TabsContent value="BATCH">
                    <BatchReports></BatchReports>
                </TabsContent>
                <TabsContent value="STUDENT">
                    <StudentReports></StudentReports>
                </TabsContent>
            </Tabs>
            <MyDialog
                heading="Reports Settings"
                open={settingDialogState}
                onOpenChange={setSettingDialogState}
                dialogWidth="w-[800px]"
            >
                {isPending && <DashboardLoader />}
                {!isPending && (
                    <div className="flex flex-col gap-10">
                        <div className="flex h-[350px] flex-col gap-10 overflow-y-scroll">
                            <div className="flex flex-col gap-10">
                                <div className="flex flex-row items-center gap-4">
                                    <Checkbox
                                        checked={isCommTypeEnabled(
                                            settingDetails?.learner_setting,
                                            CommunicationTypeEnum.EMAIL,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleCommType(
                                                RoleSettingEnum.LEARNER,
                                                CommunicationTypeEnum.EMAIL,
                                                !!checked,
                                            )
                                        }
                                    />
                                    <div className="text-subtitle font-[600]">
                                        Send Reports to Student via mail
                                    </div>
                                </div>
                                <div className="flex flex-row items-center gap-4">
                                    <Checkbox
                                        checked={isCommTypeEnabled(
                                            settingDetails?.learner_setting,
                                            CommunicationTypeEnum.WHATSAPP,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleCommType(
                                                RoleSettingEnum.LEARNER,
                                                CommunicationTypeEnum.WHATSAPP,
                                                !!checked,
                                            )
                                        }
                                    />
                                    <div className="text-subtitle font-[600]">
                                        Send Reports to Student via whatsapp
                                    </div>
                                </div>
                                {renderProgressReportSection(
                                    RoleSettingEnum.LEARNER,
                                    ReportTypeEnum.LEARNER_PROGRESS,
                                    "Student Learning Progress Report",
                                )}
                                {renderProgressReportSection(
                                    RoleSettingEnum.LEARNER,
                                    ReportTypeEnum.BATCH_PROGRESS,
                                    "Batch Learning Progress Report",
                                )}
                            </div>
                            <div className="border"></div>
                            <div className="flex flex-col gap-10">
                                <div className="flex flex-row items-center gap-4">
                                    <Checkbox
                                        checked={isCommTypeEnabled(
                                            settingDetails?.parent_setting,
                                            CommunicationTypeEnum.EMAIL,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleCommType(
                                                RoleSettingEnum.PARENT,
                                                CommunicationTypeEnum.EMAIL,
                                                !!checked,
                                            )
                                        }
                                    />
                                    <div className="text-subtitle font-[600]">
                                        Send Reports to Parent/Guardian via mail
                                    </div>
                                </div>
                                <div className="flex flex-row items-center gap-4">
                                    <Checkbox
                                        checked={isCommTypeEnabled(
                                            settingDetails?.parent_setting,
                                            CommunicationTypeEnum.WHATSAPP,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleCommType(
                                                RoleSettingEnum.PARENT,
                                                CommunicationTypeEnum.WHATSAPP,
                                                !!checked,
                                            )
                                        }
                                    />
                                    <div className="text-subtitle font-[600]">
                                        Send Reports to Parent/Guardian via whatsapp
                                    </div>
                                </div>
                                {renderProgressReportSection(
                                    RoleSettingEnum.PARENT,
                                    ReportTypeEnum.LEARNER_PROGRESS,
                                    "Student Learning Progress Report",
                                )}
                                {renderProgressReportSection(
                                    RoleSettingEnum.PARENT,
                                    ReportTypeEnum.BATCH_PROGRESS,
                                    "Batch Learning Progress Report",
                                )}
                            </div>
                        </div>
                        <div className="flex w-full items-center justify-center">
                            <MyButton onClick={handleSave}>Save Changes</MyButton>
                        </div>
                    </div>
                )}
            </MyDialog>
        </div>
    );
}
