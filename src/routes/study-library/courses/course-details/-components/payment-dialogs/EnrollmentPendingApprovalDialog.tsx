import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Clock } from "lucide-react";

interface EnrollmentPendingApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle?: string;
}

export const EnrollmentPendingApprovalDialog: React.FC<EnrollmentPendingApprovalDialogProps> = ({
  open,
  onOpenChange,
  courseTitle = "Course",
}) => {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">

        <div className="text-center py-8">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-blue-600" />
          </div>
          
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Enrollment Pending Approval
          </h3>
          
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl p-6 max-w-md mx-auto shadow-sm">
            <div className="flex items-center justify-center space-x-3 mb-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-lg font-semibold text-slate-800">Pending Administrator Approval</span>
            </div>
            <p className="text-slate-600 text-sm">
              Your enrollment request for <strong className="text-slate-900">{courseTitle}</strong> is currently being reviewed.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


