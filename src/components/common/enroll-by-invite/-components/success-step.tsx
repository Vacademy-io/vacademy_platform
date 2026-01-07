import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { MyButton } from "@/components/design-system/button";
import { useNavigate } from "@tanstack/react-router";

interface SuccessStepProps {
    courseName: string;
    approvalRequired: boolean;
    email: string;
    isAutoLoggingIn?: boolean;
}

const SuccessStep = ({
    courseName,
    approvalRequired,
    email,
    isAutoLoggingIn,
}: SuccessStepProps) => {
    const navigate = useNavigate();
    return (
        <div className="space-y-6">
            {/* Success Card */}
            <Card className="shadow-lg border bg-white">
                <CardContent className="p-5 sm:p-6 text-center">
                    <div className="flex items-center justify-center mb-6">
                        <div className="p-3 bg-green-100 rounded-full">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                        Enrollment Request Submitted!
                    </h2>
                    <p className="text-gray-600 text-lg mb-6">
                        Thank you for your interest in {courseName}. Your
                        enrollment request has been submitted successfully. Your
                        login credentials has been sent to your registered email
                        address <span className="text-blue-500">{email}</span>.
                        Please log in using the provided email and password
                    </p>
                    {/* Approval Required Sub-card */}
                    {approvalRequired && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                            <div className="flex items-start gap-3">
                                <div className="p-1.5 bg-amber-100 rounded-lg flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="text-left">
                                    <h3 className="text-base font-semibold text-gray-900 mb-1">
                                        Approval Required
                                    </h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">
                                        Your enrollment request is being
                                        reviewed by our team. You will receive
                                        an email notification once approved.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Check Email Status Button */}
                    <div className="mt-6">
                        {isAutoLoggingIn ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-primary-600 font-medium italic">Redirecting to Dashboard...</p>
                            </div>
                        ) : (
                            <MyButton
                                type="button"
                                buttonType="primary"
                                scale="large"
                                layoutVariant="default"
                                className="w-full sm:w-auto text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                                onClick={() => {
                                    navigate({ to: "/login" });
                                }}
                            >
                                Login Now
                            </MyButton>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SuccessStep;
