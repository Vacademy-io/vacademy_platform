import { Checkbox } from "@/components/ui/checkbox";
import { MyButton } from "@/components/design-system/button";
import { MyDialog } from "@/components/design-system/dialog";
import { useState, useEffect } from "react";
import { fetchLearnerSetting, updateLearnersReportSetting } from "../../-services/utils";
import { convertCommaSeparatedToArray } from "../../-services/helper";
import {
    InstituteSettingResponse,
    RoleSetting,
    RoleSettingEnum,
    CommunicationTypeEnum,
    ReportDurationEnum,
    ReportTypeEnum,
    commaSeperatedType,
} from "../../-types/types";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { useMutation } from "@tanstack/react-query";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { toast } from "sonner";
import { MultipleInput } from "./SettingReportHelperComponent";

const reportTypes = [
    ReportDurationEnum.DAILY,
    ReportDurationEnum.WEEKLY,
    ReportDurationEnum.MONTHLY,
] as const;

export default function ReportRecipientsDialogBox({ userId }: { userId: string }) {
    const [reportRecipientsState, setReportRecipientsState] = useState(false);
    const [settingDetails, setSettingDetails] = useState<InstituteSettingResponse>();
    const settingsMutation = useMutation({ mutationFn: fetchLearnerSetting });
    const { isPending } = settingsMutation;
    const updateSettingsMutation = useMutation({ mutationFn: updateLearnersReportSetting });

    const isCommTypeEnabled = (
        setting: RoleSetting | undefined,
        type: CommunicationTypeEnum.EMAIL | CommunicationTypeEnum.WHATSAPP,
    ) => {
        if (!setting) return false;
        else return setting?.comma_separated_communication_types?.split(",").includes(type);
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
    const handleListChange = (
        role: RoleSettingEnum.LEARNER | RoleSettingEnum.PARENT,
        commaSeperatedType: commaSeperatedType,
        updatedList: string[],
    ) => {
        const currentSetting = settingDetails?.[role];
        if (!currentSetting) return;
        const updatedEmails = updatedList.join(", ") || null;
        const updatedSetting = {
            ...currentSetting,
            [commaSeperatedType]: updatedEmails,
        };

        // Ensure that &apos;parent_setting&apos; is properly handled when undefined
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

        updateSettingsMutation.mutate(
            { userId, data: settingDetails },
            {
                onSuccess: () => toast.success("Settings updated!"),
                onError: () => toast.error("Failed to update"),
            },
        );
    };

    useEffect(() => {
        if (reportRecipientsState) {
            const accessToken = getTokenFromCookie(TokenKey.accessToken);
            const tokenData = getTokenDecodedData(accessToken);
            const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];

            settingsMutation.mutate(
                { userId: userId, instituteId: INSTITUTE_ID || "" },
                {
                    onSuccess: (data) => {
                        console.log(data);
                        setSettingDetails(data);
                    },
                    onError: (error) => {
                        console.error("Error:", error);
                    },
                },
            );
        }
    }, [reportRecipientsState]);
    return (
        <div>
            <MyButton
                buttonType="secondary"
                onClick={() => {
                    setReportRecipientsState(!reportRecipientsState);
                }}
            >
                Report Recipients
            </MyButton>
            <MyDialog
                heading="Report Recipients"
                open={reportRecipientsState}
                onOpenChange={setReportRecipientsState}
                dialogWidth="w-[800px]"
            >
                {isPending && <DashboardLoader />}
                {!isPending && (
                    <div className="flex flex-col gap-10">
                        <div className="flex h-[350px] flex-col gap-10 overflow-y-scroll">
                            <div className="flex flex-col gap-10">
                                <div className="flex flex-col gap-6">
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
                                    <div>
                                        <div>Student&apos;s Email</div>
                                        <MultipleInput
                                            itemsList={convertCommaSeparatedToArray(
                                                settingDetails?.learner_setting
                                                    ?.comma_separated_email_ids,
                                            )}
                                            onListChange={handleListChange}
                                            role={RoleSettingEnum.LEARNER}
                                            commaSeperatedType={commaSeperatedType.EMAIL}
                                            inputType="email"
                                        />
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
                                <div>
                                    <div>Students&apos;s Mobile Number</div>
                                    <MultipleInput
                                        itemsList={convertCommaSeparatedToArray(
                                            settingDetails?.learner_setting
                                                ?.comma_separated_mobile_number,
                                        )}
                                        onListChange={handleListChange}
                                        role={RoleSettingEnum.LEARNER}
                                        commaSeperatedType={commaSeperatedType.MOBILE}
                                        inputType="mobile"
                                    />
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
                                <div>
                                    <div>Parent/Guardian&apos;s Email</div>
                                    <MultipleInput
                                        itemsList={convertCommaSeparatedToArray(
                                            settingDetails?.parent_setting
                                                ?.comma_separated_email_ids,
                                        )}
                                        onListChange={handleListChange}
                                        role={RoleSettingEnum.PARENT}
                                        commaSeperatedType={commaSeperatedType.EMAIL}
                                        inputType="email"
                                    />
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
                                <div>
                                    <div>Parent/Guardian&apos;s Mobile Number</div>
                                    <MultipleInput
                                        itemsList={convertCommaSeparatedToArray(
                                            settingDetails?.parent_setting
                                                ?.comma_separated_mobile_number,
                                        )}
                                        onListChange={handleListChange}
                                        role={RoleSettingEnum.PARENT}
                                        commaSeperatedType={commaSeperatedType.MOBILE}
                                        inputType="mobile"
                                    />
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
