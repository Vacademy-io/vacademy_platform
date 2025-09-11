import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import { CheckCircle, Clock } from "lucide-react";
import { MyButton } from "@/components/design-system/button";

interface PaymentSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  approvalRequired: boolean;
  onExploreCourse?: () => void;
  onClose?: () => void;
}

export const PaymentSuccessDialog: React.FC<PaymentSuccessDialogProps> = ({
  open,
  onOpenChange,
  courseTitle,
  approvalRequired,
  onExploreCourse,
  onClose,
}) => {
  // Log when dialog opens
  React.useEffect(() => {
    if (open) {
      console.log('PaymentSuccessDialog - Dialog opened', {
        courseTitle,
        approvalRequired
      });
    }
  }, [open, courseTitle, approvalRequired]);

  const handleClose = () => {
    console.log('PaymentSuccessDialog - Dialog closing', {
      courseTitle,
      approvalRequired
    });
    onOpenChange(false);
    onClose?.();
  };

  const handleExploreCourse = () => {
    console.log('PaymentSuccessDialog - Explore course clicked', {
      courseTitle,
      approvalRequired
    });
    onExploreCourse?.();
    handleClose();
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[9999] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Payment Successful</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Your payment has been processed successfully
          </DialogPrimitive.Description>
          
          <button
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-700 focus:outline-none"
            onClick={handleClose}
            aria-label="Close"
          >
            <Cross2Icon className="h-4 w-4" />
          </button>
          
          <div className="text-center py-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Payment Successful!
            </h3>
            
            <p className="text-gray-600 mb-6">
              Your payment for <strong>{courseTitle}</strong> has been processed successfully.
            </p>
            
            {approvalRequired ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-yellow-800 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Admin Approval Required</span>
                </div>
                <p className="text-sm text-yellow-700 mb-3">
                  Your payment was successful and the course requires admin approval.
                </p>
                <ul className="text-sm text-yellow-700 space-y-1 text-left">
                  <li>1. Administrator will review your enrollment request</li>
                  <li>2. You will receive an email notification once approved</li>
                  <li>3. Course access will be granted automatically</li>
                </ul>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-2 text-green-800">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Ready to Explore!</span>
                </div>
                <p className="text-sm text-green-700 mt-2">
                  You can now access the course content and start learning.
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <MyButton
                buttonType="secondary"
                scale="medium"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </MyButton>
              {!approvalRequired && (
                <MyButton
                  buttonType="primary"
                  scale="medium"
                  onClick={handleExploreCourse}
                  className="flex-1"
                >
                  Explore Course
                </MyButton>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
