import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, Mail } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

interface SuccessStepProps {
    courseName: string;
}

const SuccessStep = ({ courseName }: SuccessStepProps) => {
    return (
        <div className="space-y-6">
            {/* Success Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8 text-center">
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
                        enrollment request has been submitted successfully.
                    </p>

                    {/* Approval Required Sub-card */}
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
                                    Your enrollment request is being reviewed by
                                    our team. You will receive an email
                                    notification once approved.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Check Email Status Button */}
                    <div className="mt-6">
                        <MyButton
                            type="button"
                            buttonType="secondary"
                            scale="large"
                            layoutVariant="default"
                            className="w-full sm:w-auto text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            <Mail className="w-5 h-5 mr-2" />
                            Check Email Status
                        </MyButton>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SuccessStep;
