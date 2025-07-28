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
import { Loader2, CheckCircle, Star, Check, Lock } from "lucide-react";
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

interface SubscriptionPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageSessionId: string;
  instituteId: string;
  token: string;
  courseTitle?: string;
  inviteCode?: string;
}

export const SubscriptionPaymentDialog: React.FC<SubscriptionPaymentDialogProps> = ({
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
      setError("Failed to load subscription options. Please try again.");
      console.error("Error fetching enrollment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedPaymentOption || !selectedPaymentPlan) {
      setError("Please select a subscription plan.");
      return;
    }

    setProcessingPayment(true);
    try {
      // TODO: Implement actual subscription payment processing
      console.log("Processing subscription with:", {
        paymentOption: selectedPaymentOption,
        paymentPlan: selectedPaymentPlan,
        packageSessionId,
      });

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Close dialog on success
      onOpenChange(false);
      
      // TODO: Show success message or redirect
    } catch (err) {
      setError("Payment processing failed. Please try again.");
      console.error("Payment error:", err);
    } finally {
      setProcessingPayment(false);
    }
  };

  const getPaymentOptionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "credit_card":
      case "card":
        return <CheckCircle className="w-5 h-5" />;
      case "bank_transfer":
      case "bank":
        return <CheckCircle className="w-5 h-5" />;
      case "wallet":
        return <CheckCircle className="w-5 h-5" />;
      case "gift":
      case "voucher":
        return <CheckCircle className="w-5 h-5" />;
      default:
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  const getPaymentOptionColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "credit_card":
      case "card":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "bank_transfer":
      case "bank":
        return "bg-green-50 border-green-200 text-green-700";
      case "wallet":
        return "bg-purple-50 border-purple-200 text-purple-700";
      case "gift":
      case "voucher":
        return "bg-orange-50 border-orange-200 text-orange-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Loading Subscription Plans</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-600" />
              <p className="text-gray-600">Loading subscription options...</p>
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
            <DialogTitle>Subscription Error</DialogTitle>
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Subscribe to {courseTitle}
          </DialogTitle>
          {enrollmentData && (
            <p className="text-sm text-gray-600">
              Choose your subscription plan to access all course content
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
                  <span className="text-sm text-gray-600">Subscription Period:</span>
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

            {/* Subscription Plans */}
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Subscription Plans</h3>
                <p className="text-gray-600">Choose your subscription interval with feature comparison</p>
              </div>
              
              {paymentOptions.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-gray-600">No subscription plans available at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {paymentOptions.map((option) => (
                    <div key={option.id} className="space-y-4">
                      {/* Payment Option Header */}
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-lg ${getPaymentOptionColor(option.type)}`}>
                          {getPaymentOptionIcon(option.type)}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{option.name}</h4>
                          <p className="text-sm text-gray-600">{option.tag}</p>
                        </div>
                      </div>
                      
                      {/* Subscription Plans Grid */}
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getPaymentPlans(option).map((plan) => (
                          <Card
                            key={plan.id}
                            className={`relative transition-all duration-300 hover:shadow-lg ${
                              selectedPaymentPlan?.id === plan.id
                                ? "ring-2 ring-primary-500 border-primary-500 shadow-lg"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                          >
                            {/* Popular Badge */}
                            {plan.tag?.toLowerCase().includes('popular') && (
                              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <Badge className="bg-primary-600 text-white px-3 py-1 text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  Most Popular
                                </Badge>
                              </div>
                            )}
                            
                            <CardHeader className="text-center pb-4">
                              <CardTitle className="text-lg font-bold text-gray-900">
                                {plan.name}
                              </CardTitle>
                              {plan.tag && !plan.tag.toLowerCase().includes('popular') && (
                                <Badge variant="secondary" className="text-xs">
                                  {plan.tag}
                                </Badge>
                              )}
                            </CardHeader>
                            
                            <CardContent className="space-y-4">
                              {/* Pricing */}
                              <div className="text-center">
                                <div className="text-3xl font-bold text-primary-600">
                                  {formatCurrency(plan.actual_price, plan.currency)}
                                </div>
                                <div className="text-sm text-gray-600">
                                  /{plan.validity_in_days === 30 ? '1 month' : 
                                    plan.validity_in_days === 90 ? '3 months' :
                                    plan.validity_in_days === 180 ? '6 months' :
                                    plan.validity_in_days === 365 ? '1 year' :
                                    `${plan.validity_in_days} days`}
                                </div>
                                {plan.elevated_price > plan.actual_price && (
                                  <div className="text-sm text-gray-500 line-through mt-1">
                                    {formatCurrency(plan.elevated_price, plan.currency)}
                                  </div>
                                )}
                              </div>
                              
                              {/* Features */}
                              <div className="space-y-3">
                                <h5 className="font-medium text-gray-900 text-sm">Features</h5>
                                <div className="space-y-2">
                                  {plan.feature_json ? (
                                    (() => {
                                      try {
                                        const features = JSON.parse(plan.feature_json);
                                        return Array.isArray(features) ? features.map((feature: string, index: number) => (
                                          <div key={index} className="flex items-center space-x-2">
                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">{feature}</span>
                                          </div>
                                        )) : [];
                                      } catch {
                                        return [
                                          <div key="default" className="flex items-center space-x-2">
                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                            <span className="text-sm text-gray-700">Full course access</span>
                                          </div>
                                        ];
                                      }
                                    })()
                                  ) : (
                                    <div className="flex items-center space-x-2">
                                      <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                      <span className="text-sm text-gray-700">Full course access</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Select Plan Button */}
                              <MyButton
                                type="button"
                                scale="large"
                                buttonType={selectedPaymentPlan?.id === plan.id ? "primary" : "secondary"}
                                layoutVariant="default"
                                className="w-full"
                                onClick={() => {
                                  setSelectedPaymentOption(option);
                                  setSelectedPaymentPlan(plan);
                                }}
                              >
                                {selectedPaymentPlan?.id === plan.id ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Selected
                                  </>
                                ) : (
                                  "Select Plan"
                                )}
                              </MyButton>
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
                <CardTitle>Subscription Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Plan:</span>
                  <span className="font-medium">{selectedPaymentPlan.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Price:</span>
                  <span className="font-bold text-lg text-primary-600">
                    {formatCurrency(selectedPaymentPlan.actual_price, selectedPaymentPlan.currency)}
                    <span className="text-sm text-gray-600 ml-1">
                      /{selectedPaymentPlan.validity_in_days === 30 ? '1 month' : 
                        selectedPaymentPlan.validity_in_days === 90 ? '3 months' :
                        selectedPaymentPlan.validity_in_days === 180 ? '6 months' :
                        selectedPaymentPlan.validity_in_days === 365 ? '1 year' :
                        `${selectedPaymentPlan.validity_in_days} days`}
                    </span>
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
                        Subscribe Now
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