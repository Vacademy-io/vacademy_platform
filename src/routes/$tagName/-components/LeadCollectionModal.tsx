import React, { useState } from "react";
import { useCollectPublicUserData } from "@/routes/register/live-class/-hooks/useLiveSessionGuestRegistration";
import { CollectPublicUserDataDTO } from "@/routes/register/live-class/-utils/helper";
import { toast } from "sonner";

interface LeadCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  settings: {
    enabled: boolean;
    mandatory: boolean;
    inviteLink: string;
    fields: string[];
  };
  instituteId: string;
  mandatory: boolean;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
}

export const LeadCollectionModal: React.FC<LeadCollectionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  settings,
  instituteId,
  mandatory,
}) => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateAsync: collectPublicUserData } = useCollectPublicUserData();

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create the payload for COLLECT_PUBLIC_USER_DATA
      const payload: CollectPublicUserDataDTO = {
        user_dto: {
          full_name: formData.name,
          email: formData.email,
          mobile_number: formData.phone || undefined,
        },
        package_session_id: null,
        type: "COURSE_CATALOGUE_LEAD",
        type_id: "catalogue-lead",
        source: "course-catalogue",
        custom_field_values: [],
      };

      await collectPublicUserData({
        payload,
        instituteId,
      });

      toast.success("Thank you for your interest! We'll be in touch soon.");
      onSubmit();
    } catch (error) {
      console.error("Error collecting lead data:", error);
      toast.error("Failed to submit your information. Please try again.");
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
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Get Started Today!
            </h3>
            {!mandatory && (
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="mb-4">
              <p className="text-gray-600 text-sm">
                {mandatory 
                  ? "Please provide your details to continue exploring our courses."
                  : "Get personalized course recommendations and updates by sharing your details."
                }
              </p>
            </div>

            <div className="space-y-4">
              {settings.fields.includes("name") && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              )}

              {settings.fields.includes("email") && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
              )}

              {settings.fields.includes("phone") && (
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your phone number"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
              {!mandatory && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors order-2 sm:order-1"
                >
                  Maybe Later
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg order-1 sm:order-2"
                style={{
                  backgroundColor: 'hsl(var(--primary))'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--primary))';
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'hsl(var(--primary))';
                  e.currentTarget.style.opacity = '1';
                }}
              >
                {isSubmitting ? "Submitting..." : "Get Started"}
              </button>
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
    </div>
  );
};
