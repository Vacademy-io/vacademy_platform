import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";

const SuccessStep = () => {
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
                        Thank you for your enrollment request. We have received your application and will process it shortly.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-blue-800 text-sm">
                            You will receive a confirmation email with further instructions once your enrollment is processed.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Approval Required Card */}
            <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                            <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Approval Required
                            </h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                Your enrollment request is currently pending approval. This process typically takes 1-2 business days. 
                                You will be notified via email once your enrollment is approved or if any additional information is required.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SuccessStep; 