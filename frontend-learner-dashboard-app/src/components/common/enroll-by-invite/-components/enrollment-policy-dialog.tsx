import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MyButton } from "@/components/design-system/button";
import {
    MessageCircle,
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Sparkles,
    X
} from "lucide-react";
import { useState } from "react";

// Types for the enrollment policy response
export interface EnrollmentPolicyFrontendAction {
    type: string;
    description: string;
    buttonText: string;
    actionUrl: string;
}

export interface EnrollmentPolicyUpgradeOption {
    type: string;
    text: string;
    url: string;
}

export interface EnrollmentPolicyReenrollment {
    activeRepurchaseBehavior: string;
    allowReenrollmentAfterExpiry: boolean;
    reenrollmentGapInDays: number;
    alreadyEnrolledMessage: string;
    reenrollmentBlockedMessage: string;
    upgradeOptions?: {
        paid_upgrade?: EnrollmentPolicyUpgradeOption;
    };
}

export interface EnrollmentPolicyResponse {
    onExpiry?: {
        waitingPeriodInDays: number;
        enableAutoRenewal: boolean | null;
    };
    notifications?: Array<{
        trigger: string;
        notificationConfig?: {
            type: string;
            content?: {
                subject: string;
                body: string;
            };
        };
    }>;
    reenrollmentPolicy?: EnrollmentPolicyReenrollment;
    onEnrollment?: {
        terminateActiveSessions: string[];
        blockIfActiveIn: string[];
        blockMessage: string;
    };
    workflow?: {
        enabled: boolean;
        workflows?: Array<{
            workflowId: string;
            triggerOn: string;
        }>;
        frontendActions?: Record<string, EnrollmentPolicyFrontendAction>;
    };
}

export type EnrollmentPolicyDialogType =
    | "success_with_actions"
    | "already_enrolled"
    | "reenrollment_blocked"
    | "paid_member_blocked";

interface EnrollmentPolicyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dialogType: EnrollmentPolicyDialogType;
    policyResponse: EnrollmentPolicyResponse | null;
    courseName?: string;
    onContinue?: () => void;
    onUpgrade?: (url: string) => void;
}

const EnrollmentPolicyDialog = ({
    open,
    onOpenChange,
    dialogType,
    policyResponse,
    courseName = "this course",
    onContinue,
    onUpgrade,
}: EnrollmentPolicyDialogProps) => {
    const [isRedirecting, setIsRedirecting] = useState(false);

    // Extract frontend actions from policy response
    const frontendActions = policyResponse?.workflow?.frontendActions || {};
    const reenrollmentPolicy = policyResponse?.reenrollmentPolicy;
    const onEnrollment = policyResponse?.onEnrollment;

    // Handle action button click
    const handleActionClick = (action: EnrollmentPolicyFrontendAction) => {
        if (action.actionUrl) {
            setIsRedirecting(true);
            window.open(action.actionUrl, "_blank");
            setTimeout(() => setIsRedirecting(false), 1000);
        }
    };

    // Handle upgrade button click
    const handleUpgradeClick = (url: string) => {
        if (url) {
            setIsRedirecting(true);
            if (onUpgrade) {
                onUpgrade(url);
            } else {
                window.open(url, "_blank");
            }
            setTimeout(() => setIsRedirecting(false), 1000);
        }
    };

    // Get the icon based on action type
    const getActionIcon = (type: string) => {
        switch (type) {
            case "whatsapp":
                return <MessageCircle className="w-5 h-5" />;
            default:
                return <ExternalLink className="w-5 h-5" />;
        }
    };

    // Render success with actions (WhatsApp verification, etc.)
    const renderSuccessWithActions = () => (
        <>
            <DialogHeader className="flex flex-col items-center space-y-4 pb-2 pt-4">
                <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-1000" />
                    <div className="relative mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 ring-4 ring-white">
                        <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <DialogTitle className="hidden">Enrollment Successful</DialogTitle>
                    <DialogDescription className="text-gray-600 text-base max-w-xs mx-auto">
                        Complete the following steps to activate your access to <span className="font-semibold text-gray-900">{courseName}</span>
                    </DialogDescription>
                </div>
            </DialogHeader>

            <div className="w-full space-y-3 py-6 px-1">
                {Object.entries(frontendActions).map(([key, action]) => (
                    <Card key={key} className="border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group">
                        <CardContent className="p-0">
                            <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
                                <div className={cn(
                                    "p-3 rounded-2xl flex-shrink-0 transition-colors",
                                    action.type === "whatsapp"
                                        ? "bg-[#25D366]/10 text-[#25D366] group-hover:bg-[#25D366]/20"
                                        : "bg-primary/10 text-primary group-hover:bg-primary/20"
                                )}>
                                    {getActionIcon(action.type)}
                                </div>

                                <div className="flex-1 text-center sm:text-left space-y-1">
                                    <h4 className="font-bold text-gray-900 text-base">
                                        {action.type === "whatsapp" ? "WhatsApp Verification" : key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                                    </h4>
                                    <p className="text-sm text-gray-500 leading-snug">
                                        {action.description}
                                    </p>
                                </div>

                                <button
                                    onClick={() => handleActionClick(action)}
                                    disabled={isRedirecting}
                                    className={cn(
                                        "flex-shrink-0 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 transform active:scale-[0.98]",
                                        action.type === "whatsapp"
                                            ? "bg-[#25D366] hover:bg-[#128C7E] text-white shadow-lg shadow-green-500/20"
                                            : "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                                    )}
                                >
                                    {getActionIcon(action.type)}
                                    <span>{action.buttonText}</span>
                                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>


        </>
    );

    // Render already enrolled message
    const renderAlreadyEnrolled = () => (
        <>
            <DialogHeader className="space-y-4 pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800">
                        Already Enrolled
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-sm sm:text-base leading-relaxed">
                        {reenrollmentPolicy?.alreadyEnrolledMessage ||
                            "You are already enrolled in this course. Please complete your current enrollment first."}
                    </DialogDescription>
                </div>
            </DialogHeader>

            <div className="py-4 space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-amber-800">
                            Your existing enrollment gives you full access to all course content. Continue learning from where you left off!
                        </p>
                    </div>
                </div>

                {/* Upgrade option if available */}
                {reenrollmentPolicy?.upgradeOptions?.paid_upgrade && (
                    <div className="rounded-xl bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 p-5">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <Sparkles className="w-6 h-6 text-primary-600" />
                            <h4 className="font-semibold text-gray-900">Want to Upgrade?</h4>
                            <p className="text-sm text-gray-600">
                                {reenrollmentPolicy.upgradeOptions.paid_upgrade.text || "Upgrade to get access to premium features."}
                            </p>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={() => handleUpgradeClick(reenrollmentPolicy.upgradeOptions?.paid_upgrade?.url || "")}
                                disabled={isRedirecting}
                                className="flex items-center gap-2 px-6 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40"
                            >
                                <span>Upgrade Now</span>
                                <ExternalLink className="w-4 h-4 ml-2" />
                            </MyButton>
                        </div>
                    </div>
                )}
            </div>

            <DialogFooter className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="medium"
                    layoutVariant="default"
                    onClick={() => onOpenChange(false)}
                    className="w-full sm:w-auto order-2 sm:order-1"
                >
                    <X className="w-4 h-4 mr-2" />
                    Close
                </MyButton>
                <MyButton
                    type="button"
                    buttonType="primary"
                    scale="medium"
                    layoutVariant="default"
                    onClick={() => {
                        onOpenChange(false);
                        onContinue?.();
                    }}
                    className="w-full sm:w-auto order-1 sm:order-2 bg-gradient-to-r from-primary-500 to-primary-600"
                >
                    Go to Dashboard
                </MyButton>
            </DialogFooter>
        </>
    );

    // Render reenrollment blocked message
    const renderReenrollmentBlocked = () => (
        <>
            <DialogHeader className="space-y-4 pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                    <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800">
                        Ready to continue ?
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-sm sm:text-base leading-relaxed">
                        {reenrollmentPolicy?.reenrollmentBlockedMessage}
                    </DialogDescription>
                </div>
            </DialogHeader>

            {reenrollmentPolicy?.upgradeOptions?.paid_upgrade && (
                <div className="py-4">
                    <div className="rounded-xl bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 p-5">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <Sparkles className="w-6 h-6 text-primary-600" />
                            <h4 className="font-semibold text-gray-900">Upgrade to Continue Learning</h4>
                            <p className="text-sm text-gray-600">
                                Get unlimited access to all course content with our premium plan.
                            </p>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={() => handleUpgradeClick(reenrollmentPolicy.upgradeOptions?.paid_upgrade?.url || "")}
                                disabled={isRedirecting}
                                className="flex items-center gap-2 px-6 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40"
                            >
                                <span>{reenrollmentPolicy.upgradeOptions.paid_upgrade.text}</span>
                                <ExternalLink className="w-4 h-4 ml-2" />
                            </MyButton>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // Render paid member blocked message
    const renderPaidMemberBlocked = () => (
        <>
            <DialogHeader className="space-y-4 pb-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <div className="text-center space-y-2">
                    <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-800">
                        You have an active membership
                    </DialogTitle>
                    <DialogDescription className="text-gray-600 text-sm sm:text-base leading-relaxed">
                        {onEnrollment?.blockMessage ||
                            "You already have an active membership plan. Demo access is not available for existing paid subscribers."}
                    </DialogDescription>
                </div>
            </DialogHeader>

            {reenrollmentPolicy?.upgradeOptions?.paid_upgrade && (
                <div className="py-4">
                    <div className="rounded-xl bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 p-5">
                        <div className="flex flex-col items-center text-center space-y-3">
                            <Sparkles className="w-6 h-6 text-primary-600" />
                            <h4 className="font-semibold text-gray-900">Upgrade to Continue Learning</h4>
                            <p className="text-sm text-gray-600">
                                Get unlimited access to all course content with our premium plan.
                            </p>
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="medium"
                                layoutVariant="default"
                                onClick={() => handleUpgradeClick(reenrollmentPolicy.upgradeOptions?.paid_upgrade?.url || "")}
                                disabled={isRedirecting}
                                className="flex items-center gap-2 px-6 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40"
                            >
                                <span>{reenrollmentPolicy.upgradeOptions.paid_upgrade.text}</span>
                                <ExternalLink className="w-4 h-4 ml-2" />
                            </MyButton>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // Render content based on dialog type
    const renderContent = () => {
        switch (dialogType) {
            case "success_with_actions":
                return renderSuccessWithActions();
            case "already_enrolled":
                return renderAlreadyEnrolled();
            case "reenrollment_blocked":
                return renderReenrollmentBlocked();
            case "paid_member_blocked":
                return renderPaidMemberBlocked();
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md md:max-w-lg p-6 rounded-2xl border-0 shadow-2xl bg-white">
                {renderContent()}
            </DialogContent>
        </Dialog>
    );
};

export default EnrollmentPolicyDialog;
