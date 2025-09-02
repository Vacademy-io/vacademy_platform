import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Lock } from "lucide-react";
import { SiStripe } from "react-icons/si";
import {
  fetchEnrollmentDetails,
  getPaymentOptions,
  getPaymentPlans,
  formatCurrency,
  type EnrollmentResponse,
  type PaymentOption,
  type PaymentPlan,
} from "../../-services/enrollment-api";
import { MyButton } from "@/components/design-system/button";

interface OneTimePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
}

export const OneTimePaymentDialog: React.FC<OneTimePaymentDialogProps> = ({
  open,
  onOpenChange,
  packageSessionId,
  instituteId,
  token,
  courseTitle = "Course",
  inviteCode = "default",
}) => {
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState<PaymentPlan | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [step, setStep] = useState<'select' | 'payment'>('select');

  // Fetch enrollment data when dialog opens
  useEffect(() => {
    if (open && packageSessionId) {
      fetchEnrollmentData();
    }
  }, [open, packageSessionId]);

  const fetchEnrollmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEnrollmentDetails(inviteCode, instituteId, packageSessionId, token);
      setEnrollmentData(data);
      
      // Auto-select first payment option and plan
      const paymentOptions = getPaymentOptions(data);
      if (paymentOptions.length > 0) {
        const firstOption = paymentOptions[0];
        setSelectedPaymentOption(firstOption);
        
        const plans = getPaymentPlans(firstOption);
        if (plans.length > 0) {
          setSelectedPaymentPlan(plans[0]);
        }
      }
    } catch (err) {
      setError("Failed to load payment options. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedPaymentOption || !selectedPaymentPlan) {
      setError("Please select a payment plan.");
      return;
    }

    setProcessingPayment(true);
    try {
      // TODO: Implement actual one-time payment processing


      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close dialog on success
      onOpenChange(false);
      
      // TODO: Show success message or redirect
    } catch (err) {
      setError("Payment processing failed. Please try again.");
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Payment Options</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
              <p className="text-gray-600">Loading payment options...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error && !enrollmentData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Error</DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchEnrollmentData} variant="outline">
              Try Again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const paymentOptions = enrollmentData ? getPaymentOptions(enrollmentData) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            One-Time Payment for {courseTitle}
          </DialogTitle>
          {enrollmentData && (
            <p className="text-sm text-gray-600">
              Complete your one-time payment to access the course
            </p>
          )}
        </DialogHeader>

        {enrollmentData && step === 'select' && (
          <div className="space-y-6">
            {/* Course Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Course Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Course:</span>
                  <span className="font-medium">{courseTitle}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Access Period:</span>
                  <span className="text-sm">
                    {new Date(enrollmentData.start_date).toLocaleDateString()} - {new Date(enrollmentData.end_date).toLocaleDateString()}
                  </span>
                </div>
                {enrollmentData.learner_access_days > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Access Duration:</span>
                    <span className="text-sm">{enrollmentData.learner_access_days} days</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Plans */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Available Plans</h3>
              
              {paymentOptions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-600">No payment plans available at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {paymentOptions.map((option) => (
                    <div key={option.id} className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-primary-600" />
                        <div>
                          <h4 className="font-semibold text-gray-900">{option.name}</h4>
                          <p className="text-sm text-gray-600">{option.tag}</p>
                        </div>
                      </div>
                      
                      <div className="grid gap-3">
                        {getPaymentPlans(option).map((plan) => (
                          <Card
                            key={plan.id}
                            className={`cursor-pointer transition-all duration-200 ${
                              selectedPaymentPlan?.id === plan.id
                                ? "ring-2 ring-primary-500 border-primary-500 bg-primary-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() => {
                              setSelectedPaymentOption(option);
                              setSelectedPaymentPlan(plan);
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <h5 className="font-medium">{plan.name}</h5>
                                    {plan.tag && (
                                      <Badge variant="secondary" className="text-xs">
                                        {plan.tag}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2">
                                    {plan.description}
                                  </p>
                                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                                    {plan.validity_in_days > 0 && (
                                      <span>Valid for {plan.validity_in_days} days</span>
                                    )}
                                    {plan.currency && (
                                      <span>Currency: {plan.currency}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-bold text-primary-600">
                                    {formatCurrency(plan.actual_price, plan.currency)}
                                  </div>
                                  {plan.elevated_price > plan.actual_price && (
                                    <div className="text-sm text-gray-500 line-through">
                                      {formatCurrency(plan.elevated_price, plan.currency)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={processingPayment}
              >
                Cancel
              </Button>
              <MyButton
                type="button"
                scale="large"
                buttonType="primary"
                layoutVariant="default"
                disabled={!selectedPaymentOption || !selectedPaymentPlan || processingPayment}
                onClick={() => setStep('payment')}
              >
                Continue to Payment
              </MyButton>
            </div>
          </div>
        )}

        {/* Payment Step */}
        {step === 'payment' && selectedPaymentPlan && (
          <div className="space-y-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Plan:</span>
                  <span className="font-medium">{selectedPaymentPlan.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Amount:</span>
                  <span className="font-bold text-lg text-primary-600">
                    {formatCurrency(selectedPaymentPlan.actual_price, selectedPaymentPlan.currency)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep('select')}
                  className="w-full"
                >
                  Change Plan
                </Button>
              </CardContent>
            </Card>

            {/* Payment Form */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Number
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="1234 5678 9012 3456"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="MM/YY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      CVC
                    </label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-3 pt-4">
                  <MyButton
                    type="button"
                    scale="large"
                    buttonType="primary"
                    layoutVariant="default"
                    disabled={processingPayment}
                    onClick={handleEnroll}
                    className="flex items-center space-x-2"
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Pay Now
                      </>
                    )}
                  </MyButton>
                </div>

                <div className="text-center text-xs text-gray-500 flex items-center justify-center space-x-1">
                  <Lock className="w-3 h-3" />
                  Secure payment powered by
                  <span className="font-semibold flex items-center space-x-1 ml-1">
                    <SiStripe className="w-4 h-4 text-indigo-600" />
                    Stripe
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}; 