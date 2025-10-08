import React, { useState, useEffect, useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  fetchEnrollmentDetails,
  type EnrollmentResponse,
} from "../../-services/enrollment-api";
import { DonationDialog } from "@/components/common/donation/DonationDialog";
import { SubscriptionPaymentDialog } from "./SubscriptionPaymentDialog";
import { FreeEnrollmentConfirmationDialog } from "./FreeEnrollmentConfirmationDialog";
import { EnhancedEnrollmentDialog } from "./EnhancedEnrollmentDialog";

interface EnrollmentPaymentRouterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
  onEnrollmentSuccess?: () => void;
  onNavigateToSlides?: () => void;
}

export const EnrollmentPaymentDialog: React.FC<EnrollmentPaymentRouterProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
  onEnrollmentSuccess,
  onNavigateToSlides,
}) => {
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentType, setPaymentType] = useState<string | null>(null);

  const fetchEnrollmentData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('EnrollmentPaymentDialog: Fetching enrollment details', {
        inviteCode,
        instituteId,
        packageSessionId
      });
      
      const data = await fetchEnrollmentDetails(inviteCode, instituteId, packageSessionId, token);
      setEnrollmentData(data);
      
      console.log('EnrollmentPaymentDialog: Enrollment data received', {
        hasPaymentOptions: data.package_session_to_payment_options?.length > 0,
        paymentOptionsCount: data.package_session_to_payment_options?.length || 0,
        paymentOptions: data.package_session_to_payment_options?.map(opt => ({
          id: opt.payment_option.id,
          name: opt.payment_option.name,
          type: opt.payment_option.type,
          require_approval: opt.payment_option.require_approval,
          hasPaymentPlans: opt.payment_option.payment_plans?.length > 0
        }))
      });
      
      // Determine payment type from the first payment option
      if (data.package_session_to_payment_options && data.package_session_to_payment_options.length > 0) {
        const firstPaymentOption = data.package_session_to_payment_options[0].payment_option;
        setPaymentType(firstPaymentOption.type);
        
        console.log('EnrollmentPaymentDialog: Payment type determined', {
          paymentType: firstPaymentOption.type,
          requireApproval: firstPaymentOption.require_approval,
          hasPaymentPlans: firstPaymentOption.payment_plans?.length > 0
        });
      } else {
        console.warn('EnrollmentPaymentDialog: No payment options found in enrollment data');
        setError("No payment options available for this course.");
      }
    } catch (err) {
      console.error('EnrollmentPaymentDialog: Error fetching enrollment data', err);
      setError("Failed to load enrollment options. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [inviteCode, instituteId, packageSessionId, token]);

  // Fetch enrollment data when dialog opens
  useEffect(() => {
    if (open && packageSessionId) {
      fetchEnrollmentData();
    }
  }, [open, packageSessionId, fetchEnrollmentData]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
            <p className="text-gray-600">Loading enrollment options...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !enrollmentData) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Enrollment Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchEnrollmentData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }



  // Function to render the appropriate dialog based on payment type
  const renderPaymentDialog = () => {
    if (!paymentType) return null;

    console.log('EnrollmentPaymentDialog: Rendering payment dialog', {
      paymentType,
      enrollmentDataExists: !!enrollmentData,
      packageSessionId,
      instituteId
    });

    const commonProps = {
      packageSessionId,
      instituteId,
      token,
      courseTitle,
      inviteCode,
      onEnrollmentSuccess,
      onNavigateToSlides,
    };

    switch (paymentType.toLowerCase()) {
      case 'donation':
        console.log('EnrollmentPaymentDialog: Rendering DonationDialog');
        return (
          <DonationDialog
            open={open}
            onOpenChange={onOpenChange}
            courseTitle={courseTitle}
            packageSessionId={packageSessionId}
            instituteId={instituteId}
            token={token}
            inviteCode={inviteCode}
            mode="enrollment"
            isUserEnrolled={false}
            onEnrollmentSuccess={onEnrollmentSuccess}
            onSlideAccessSuccess={onNavigateToSlides ? () => {
              // Convert slide access success to navigation
              onNavigateToSlides();
            } : undefined}
          />
        );
      
      case 'subscription':
        console.log('EnrollmentPaymentDialog: Rendering EnhancedEnrollmentDialog for subscription');
        return (
          <EnhancedEnrollmentDialog
            open={open}
            onOpenChange={onOpenChange}
            packageSessionId={packageSessionId}
            instituteId={instituteId}
            token={token}
            courseTitle={courseTitle}
            inviteCode={inviteCode}
            paymentType="subscription"
            onEnrollmentSuccess={onEnrollmentSuccess}
            onNavigateToSlides={onNavigateToSlides}
          />
        );
      
      case 'one-time':
      case 'one_time':
      case 'onetime':
      case 'one_time_payment':
        console.log('EnrollmentPaymentDialog: Rendering EnhancedEnrollmentDialog for one-time payment');
        return (
          <EnhancedEnrollmentDialog
            open={open}
            onOpenChange={onOpenChange}
            packageSessionId={packageSessionId}
            instituteId={instituteId}
            token={token}
            courseTitle={courseTitle}
            inviteCode={inviteCode}
            paymentType="one_time"
            onEnrollmentSuccess={onEnrollmentSuccess}
            onNavigateToSlides={onNavigateToSlides}
          />
        );
      
      case 'free':
      case 'free_plan':
        console.log('EnrollmentPaymentDialog: Rendering FreeEnrollmentConfirmationDialog for FREE payment');
        return (
          <FreeEnrollmentConfirmationDialog
            open={open}
            onOpenChange={onOpenChange}
            {...commonProps}
            onNavigateToSlides={onNavigateToSlides}
          />
        );
      
      default:
        console.log('EnrollmentPaymentDialog: Unknown payment type, falling back to SubscriptionPaymentDialog', {
          paymentType
        });
        // Fallback to subscription dialog for unknown types
        return (
          <SubscriptionPaymentDialog
            open={open}
            onOpenChange={onOpenChange}
            {...commonProps}
          />
        );
    }
  };



  // Show error state
  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 animate-fade-in flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 max-w-sm">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-4">Enrollment Error</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchEnrollmentData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render the appropriate payment dialog based on type
  return renderPaymentDialog();
}; 