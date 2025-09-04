import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";

interface EnrollmentPendingApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle?: string;
  onClose?: () => void;
}

export const EnrollmentPendingApprovalDialog: React.FC<EnrollmentPendingApprovalDialogProps> = ({
  open,
  onOpenChange,
  courseTitle = "Course",
  onClose,
}) => {
  const handleClose = () => {
    onOpenChange(false);
    if (onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center space-x-2">
            <Clock className="w-6 h-6 text-orange-600" />
            <span>Enrollment Already Requested</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Card */}
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-800 mb-2">
                    Your enrollment request is pending approval
                  </h3>
                  <p className="text-orange-700 text-sm mb-4">
                    You have already requested enrollment for <strong>{courseTitle}</strong>. 
                    Your request is currently being reviewed by the administrator.
                  </p>
                  
                  <div className="bg-white rounded-lg p-4 border border-orange-200">
                    <div className="flex items-center space-x-2 mb-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800">Current Status</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span className="text-sm text-orange-700">Pending Administrator Approval</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Information */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">What happens next?</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Administrator will review your enrollment request</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>You will receive an email notification once approved</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span>Course access will be granted automatically</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Close
            </Button>
            <Button
              onClick={handleClose}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


