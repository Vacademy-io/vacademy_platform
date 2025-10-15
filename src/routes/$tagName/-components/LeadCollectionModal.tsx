import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { ChevronLeftIcon, ChevronRightIcon, X } from 'lucide-react';
import axios from "axios";
import { LIVE_SESSION_REQUEST_OTP, LIVE_SESSION_VERIFY_OTP, LEAD_COLLECTION_ENROLL_URL } from "@/constants/urls";
import { useDomainRouting } from "@/hooks/use-domain-routing";

interface FieldOption {
  label: string;
  value: string;
  levelId?: string;
  packageSessionId?: string;
}

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'chips' | 'dropdown';
  required: boolean;
  step: number;
  options?: FieldOption[];
  style?: {
    variant?: 'filled' | 'outlined';
    chipColor?: string;
    allowMultiple?: boolean;
  };
}

interface FormStyle {
  type: 'single' | 'multiStep';
  showProgress: boolean;
  progressType: 'bar' | 'dots' | 'steps';
  transition: 'slide' | 'fade';
}

interface LeadCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  settings: {
    enabled: boolean;
    mandatory: boolean;
    inviteLink: string | null;
    formStyle?: FormStyle;
    fields: FormField[];
  };
  instituteId: string;
  mandatory: boolean;
}

interface FormData {
  [key: string]: string;
}

export const LeadCollectionModal: React.FC<LeadCollectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  settings,
  instituteId,
  mandatory,
}) => {
  const domainRouting = useDomainRouting();
  const [formData, setFormData] = useState<FormData>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPackageSessionId, setSelectedPackageSessionId] = useState<string | null>(null);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Helper functions to extract level and package IDs from form data
  const getLevelIdFromFormData = (levelValue: string): string => {
    const levelField = settings.fields.find(field => field.name === 'Level');
    if (levelField && levelField.options) {
      const selectedOption = levelField.options.find(option => option.value === levelValue);
      return selectedOption?.levelId || "";
    }
    return "";
  };

  const getPackageIdFromFormData = (levelValue: string): string => {
    const levelField = settings.fields.find(field => field.name === 'Level');
    if (levelField && levelField.options) {
      const selectedOption = levelField.options.find(option => option.value === levelValue);
      return selectedOption?.packageSessionId || "";
    }
    return "";
  };

  // Debug logging
  console.log("[LeadCollectionModal] Props received:", {
    isOpen,
    mandatory,
    settings,
    instituteId
  });

  // Get form style configuration
  const formStyle = settings.formStyle || {
    type: 'single',
    showProgress: false,
    progressType: 'bar',
    transition: 'slide'
  };

  // Get total steps
  const totalSteps = Math.max(...settings.fields.map(field => field.step), 1);

  // Get fields for current step
  const currentStepFields = settings.fields.filter(field => field.step === currentStep);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({});
      setCurrentStep(1);
      setSelectedPackageSessionId(null);
      setEmailOtpSent(false);
      setEmailOtp('');
      setIsVerifyingOtp(false);
      setEmailVerified(false);
    }
  }, [isOpen]);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Remove all non-digit characters and check for exactly 10 digits
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length === 10 && /^[1-9]\d{9}$/.test(cleanPhone);
  };

  // OTP verification functions
  const handleSendOtp = async () => {
    const email = formData.email;
    console.log("[LeadCollectionModal] Sending OTP for email:", email);
    console.log("[LeadCollectionModal] Institute ID:", instituteId);
    console.log("[LeadCollectionModal] API URL:", LIVE_SESSION_REQUEST_OTP);
    
    if (!email || !validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      const response = await axios.post(
        LIVE_SESSION_REQUEST_OTP,
        {
          to: email.trim(),
        },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
          params: {
            instituteId,
          },
        }
      );

      console.log("[LeadCollectionModal] OTP API response:", response);
      setEmailOtpSent(true);
      toast.success("OTP sent to your email");
    } catch (error) {
      console.error("[LeadCollectionModal] Error sending OTP:", error);
      console.error("[LeadCollectionModal] Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        response: error instanceof Error && 'response' in error ? (error as any).response : null
      });
      toast.error("Failed to send OTP. Please try again");
    }
  };

  const handleVerifyOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await axios.post(
        LIVE_SESSION_VERIFY_OTP,
        {
          to: formData.email,
          otp: emailOtp,
          client_name: "LEARNER",
          institute_id: instituteId,
        },
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
          },
        }
      );

      setEmailVerified(true);
      setEmailOtpSent(false);
      setEmailOtp("");
      toast.success("Email verified successfully");
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to verify OTP. Please try again");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // Reset email verification if email changes
    if (field === 'email') {
      setEmailVerified(false);
      setEmailOtpSent(false);
      setEmailOtp('');
    }
  };

  const handleChipSelection = (field: FormField, option: FieldOption) => {
    setFormData((prev) => ({
      ...prev,
      [field.name]: option.value,
    }));
    
    // Store package session ID for this level
    if (option.packageSessionId) {
      setSelectedPackageSessionId(option.packageSessionId);
    }
  };

  const canProceedToNextStep = () => {
    const requiredFields = currentStepFields.filter(field => field.required);
    return requiredFields.every(field => {
      const value = formData[field.name];
      if (!value || value.toString().trim() === '') {
        return false;
      }
      
      // Additional validation for specific field types
      if (field.type === 'email' && !validateEmail(value)) {
        return false;
      }
      if (field.type === 'tel' && !validatePhone(value)) {
        return false;
      }
      
      // For email field, also check if OTP is verified
      if (field.type === 'email' && !emailVerified) {
        return false;
      }
      
      return true;
    });
  };

  const handleNextStep = () => {
    if (canProceedToNextStep() && currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check all required fields across all steps
    const allRequiredFields = settings.fields.filter(field => field.required);
    const missingRequiredFields = allRequiredFields.filter(field => 
      !formData[field.name]?.trim()
    );
    
    if (missingRequiredFields.length > 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create the payload for the new lead collection endpoint
      const payload = {
        user_dto: {
          id: "",
          username: formData.email || "",
          email: formData.email || "",
          full_name: formData.name || "",
          address_line: "",
          city: "",
          region: "",
          pin_code: "",
          mobile_number: formData.phone || "",
          date_of_birth: null,
          gender: "",
          password: "",
          profile_pic_file_id: "",
          roles: [],
          root_user: false
        },
        package_session_id: selectedPackageSessionId || "",
        type: "COURSE_CATALOGUE_LEAD",
        type_id: null,
        source: "LEAD",
        custom_field_values: [],
        desired_level_id: formData.Level ? getLevelIdFromFormData(formData.Level) : "",
        desired_package_id: formData.Level ? getPackageIdFromFormData(formData.Level) : ""
      };

      // Call the new API endpoint
      const response = await axios.post(
        `${LEAD_COLLECTION_ENROLL_URL}?instituteId=${instituteId}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log("Lead collection response:", response.data);

      // Show success popup instead of toast
      setSuccessMessage("Thank you for your interest! We'll be in touch soon.");
      setShowSuccessPopup(true);
    } catch (error: any) {
      console.error("Error collecting lead data:", error);
      
      // Check if it's a duplicate entry error
      if (error.response?.data?.ex === "User entry already exists" || 
          error.response?.data?.responseCode === "510 NOT_EXTENDED") {
        setSuccessMessage("We already have your information. Thank you for your interest! We'll get back to you soon.");
        setShowSuccessPopup(true);
      } else {
        toast.error("Failed to submit your information. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (mandatory) {
      // If mandatory, don't allow closing
      return;
    }
    onClose();
  };

  // Progress bar component
  const renderProgressBar = () => {
    if (!formStyle.showProgress || formStyle.type === 'single') return null;

    const progress = (currentStep / totalSteps) * 100;

    if (formStyle.progressType === 'bar') {
      return (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-primary-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      );
    }

    if (formStyle.progressType === 'dots') {
      return (
        <div className="flex justify-center space-x-2 mb-6">
          {Array.from({ length: totalSteps }, (_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index + 1 <= currentStep ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      );
    }

    if (formStyle.progressType === 'steps') {
      return (
        <div className="flex justify-between items-center mb-6">
          {Array.from({ length: totalSteps }, (_, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  index + 1 <= currentStep
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              {index < totalSteps - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 transition-all duration-300 ${
                    index + 1 < currentStep ? 'bg-primary-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  // Render field based on type
  const renderField = (field: FormField) => {
    const fieldValue = formData[field.name] || "";

    if (field.type === 'chips' && field.options) {
      return (
        <div key={field.name} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            {field.label} {field.required && "*"}
          </label>
          <div className="flex flex-wrap gap-2">
            {field.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleChipSelection(field, option)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  fieldValue === option.value
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                }`}
                style={{
                  backgroundColor: fieldValue === option.value ? field.style?.chipColor : undefined,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div key={field.name} className="space-y-3">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
          {field.label} {field.required && "*"}
        </label>
        <div className="flex gap-2">
          <input
            type={field.type}
            id={field.name}
            value={fieldValue}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            className={`flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              (field.type === 'email' && fieldValue && !validateEmail(fieldValue)) ||
              (field.type === 'tel' && fieldValue && !validatePhone(fieldValue))
                ? 'border-red-300' 
                : 'border-gray-300'
            }`}
            placeholder={field.type === 'tel' ? 'Enter your 10-digit phone number' : `Enter your ${field.label.toLowerCase()}`}
            required={field.required}
            maxLength={field.type === 'tel' ? 10 : undefined}
            pattern={field.type === 'tel' ? '[0-9]{10}' : undefined}
          />
          {field.type === 'email' && fieldValue && validateEmail(fieldValue) && !emailVerified && (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={emailOtpSent}
              className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              style={{
                backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
              }}
            >
              {emailOtpSent ? 'Sent' : 'Send OTP'}
            </button>
          )}
          {field.type === 'email' && emailVerified && (
            <div className="flex items-center px-3 py-2 bg-green-100 text-green-800 rounded-md text-sm">
              ✓ Verified
            </div>
          )}
        </div>
        
        {/* OTP Verification Section */}
        {field.type === 'email' && emailOtpSent && !emailVerified && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Enter OTP sent to your email
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={isVerifyingOtp || emailOtp.length !== 6}
                className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                style={{
                  backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                }}
              >
                {isVerifyingOtp ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        )}
        
        {/* Helper Text for Phone Numbers */}
        {field.type === 'tel' && (
          <p className="text-gray-500 text-xs">Enter exactly 10 digits (e.g., 9876543210)</p>
        )}
        
        {/* Validation Messages */}
        {field.type === 'email' && fieldValue && !validateEmail(fieldValue) && (
          <p className="text-red-500 text-sm">Please enter a valid email address</p>
        )}
        {field.type === 'tel' && fieldValue && !validatePhone(fieldValue) && (
          <p className="text-red-500 text-sm">Please enter a valid 10-digit phone number</p>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              {mandatory ? "Complete Your Registration" : "Get Course Details"}
            </h2>
            <div className="flex items-center gap-2">
            {!mandatory && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                title="Close"
              >
                  <X className="w-6 h-6" />
              </button>
            )}
            </div>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6">
            <div className="mb-4">
              <p className="text-gray-600 text-sm">
                {mandatory 
                  ? "Please provide your details to continue exploring our courses."
                  : "Get personalized course recommendations and updates by sharing your details."
                }
              </p>
              
            </div>

            {/* Progress Bar */}
            {renderProgressBar()}

            {/* Form Fields */}
            <div className="space-y-4 min-h-[200px]">
              {formStyle.type === 'multiStep' ? (
                <div className={`transition-all duration-300 ${
                  formStyle.transition === 'slide' ? 'transform' : ''
                }`}>
                  {currentStepFields.map(renderField)}
                </div>
              ) : (
                settings.fields.map(renderField)
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex justify-between items-center gap-3 mt-6">
              {/* Left side - Previous and Cancel buttons */}
              <div className="flex gap-3">
                {formStyle.type === 'multiStep' && currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePreviousStep}
                    className="flex items-center px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 mr-1" />
                    Previous
                  </button>
                )}
                {!mandatory && formStyle.type === 'single' && (
                <button
                  type="button"
                  onClick={handleClose}
                    className="px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors"
                    style={{
                      backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                    }}
                >
                    Cancel
                </button>
              )}
              </div>
              
              {/* Right side - Next and Submit buttons */}
              <div className="flex gap-3">
                {formStyle.type === 'multiStep' && currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={!canProceedToNextStep()}
                    className="flex items-center px-6 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{
                      backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                    }}
                  >
                    Next
                    <ChevronRightIcon className="w-4 h-4 ml-1" />
                  </button>
                ) : (
              <button
                type="submit"
                    disabled={isSubmitting || (formStyle.type === 'multiStep' && !canProceedToNextStep())}
                    className="px-6 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                      backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                    }}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
              </button>
                )}
              </div>
            </div>
          </form>

          {/* Invite Link */}
          {settings.inviteLink && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                Have an invite code?{" "}
                <a
                  href={settings.inviteLink}
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  Click here
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Request Sent</h3>
              <p className="text-sm text-gray-600 mb-6">{successMessage}</p>
              <button
                onClick={() => {
                  setShowSuccessPopup(false);
                  onSubmit();
                }}
                className="w-full px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors"
                style={{
                  backgroundColor: domainRouting.instituteThemeCode ? `hsl(var(--primary))` : '#3b82f6'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
