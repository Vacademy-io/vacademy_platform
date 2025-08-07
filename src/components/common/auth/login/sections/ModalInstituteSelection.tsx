import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Users, ArrowRight, CheckCircle2 } from "lucide-react";

import {
  getTokenDecodedData,
  setTokenInStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import { fetchAndStoreInstituteDetails } from "@/services/fetchAndStoreInstituteDetails";
import { fetchAndStoreStudentDetails } from "@/services/studentDetails";
import { useTheme } from "@/providers/theme/theme-provider";

interface Institute {
  id: string;
  name: string;
  logo?: string;
  theme_code?: string;
}

interface ModalInstituteSelectionProps {
  accessToken: string;
  refreshToken: string;
  type?: string;
  courseId?: string;
  currentUrl?: string;
  onInstituteSelected?: () => void;
}

export function ModalInstituteSelection({
  accessToken,
  refreshToken,
  type,
  courseId,
  currentUrl,
  onInstituteSelected,
}: ModalInstituteSelectionProps) {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedInstitute, setSelectedInstitute] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setPrimaryColor } = useTheme();

  useEffect(() => {
    loadInstitutes();
  }, []);

  const loadInstitutes = async () => {
    try {
      const decodedData = getTokenDecodedData(accessToken);
      const authorities = decodedData?.authorities;
      const userId = decodedData?.user;

      if (!authorities || !userId) {
        toast.error("Invalid user data");
        return;
      }

      // Convert authorities to institute list
      const instituteList: Institute[] = Object.keys(authorities).map((instituteId) => ({
        id: instituteId,
        name: `Institute ${instituteId.slice(0, 8)}`, // Placeholder name
        theme_code: "#E67E22", // Default theme
      }));

      setInstitutes(instituteList);
      
      // Auto-select first institute if only one
      if (instituteList.length === 1) {
        setSelectedInstitute(instituteList[0].id);
      }
    } catch (error) {
      console.error("Error loading institutes:", error);
      toast.error("Failed to load institutes");
    }
  };

  const handleInstituteSelection = async () => {
    if (!selectedInstitute) {
      toast.error("Please select an institute");
      return;
    }

    setIsLoading(true);

    try {
      const decodedData = getTokenDecodedData(accessToken);
      const userId = decodedData?.user;

      if (!userId) {
        toast.error("Invalid user data");
        return;
      }

      // Fetch and store institute details
      const details = await fetchAndStoreInstituteDetails(selectedInstitute, userId);
      
      // Set theme color
      if (setPrimaryColor && details?.institute_theme_code) {
        setPrimaryColor(details.institute_theme_code);
      }

      // Fetch and store student details
      await fetchAndStoreStudentDetails(selectedInstitute, userId);

      // Handle redirection based on type and courseId
      await handleModalRedirection(type, courseId, currentUrl);

      // Call success callback
      if (onInstituteSelected) {
        onInstituteSelected();
      }

    } catch (error) {
      console.error("Error selecting institute:", error);
      toast.error("Failed to select institute");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalRedirection = async (
    type?: string,
    courseId?: string,
    currentUrl?: string
  ) => {
    try {
      // For modal OAuth login, always redirect to study library based on type and courseId
      let redirectUrl = "/study-library/courses"; // Default to study library courses
      
      if (type === "courseDetailsPage" && courseId) {
        redirectUrl = `/study-library/courses/course-details?courseId=${courseId}&selectedTab=ALL`;
      } else if (type === "courseDetailsPage") {
        redirectUrl = "/study-library/courses";
      } else if (currentUrl && currentUrl.includes("/courses/course-details")) {
        // Extract courseId from current URL
        const urlParams = new URLSearchParams(currentUrl.split('?')[1] || '');
        const extractedCourseId = urlParams.get('courseId');
        if (extractedCourseId) {
          redirectUrl = `/study-library/courses/course-details?courseId=${extractedCourseId}&selectedTab=ALL`;
        } else {
          redirectUrl = "/study-library/courses";
        }
      }
      
      // Open the redirect URL in new tab for modal login
      window.open(redirectUrl, '_blank');
      
      // Call onInstituteSelected callback to close the modal
      if (onInstituteSelected) {
        onInstituteSelected();
      }
    } catch (error) {
      console.error("Error handling redirection:", error);
      // Fallback to study library courses
      window.open("/study-library/courses", '_blank');
      if (onInstituteSelected) {
        onInstituteSelected();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center space-y-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            delay: 0.2,
            type: "spring",
            stiffness: 200,
          }}
          className="w-12 h-12 bg-blue-100 rounded-xl mx-auto flex items-center justify-center"
        >
          <Building2 className="w-6 h-6 text-blue-700" />
        </motion.div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Select Your Institute
          </h3>
          <p className="text-sm text-gray-600">
            Choose the institute you want to access
          </p>
        </div>
      </motion.div>

      {/* Institute List */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        {institutes.map((institute, index) => (
          <motion.div
            key={institute.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + index * 0.1 }}
            className={`relative cursor-pointer rounded-lg border-2 transition-all duration-200 ${
              selectedInstitute === institute.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
            onClick={() => setSelectedInstitute(institute.id)}
          >
            <div className="p-4 flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {institute.name}
                </p>
                <p className="text-xs text-gray-500">
                  Institute ID: {institute.id.slice(0, 8)}...
                </p>
              </div>
              <div className="flex-shrink-0">
                {selectedInstitute === institute.id ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-500" />
                ) : (
                  <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Continue Button */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="pt-2"
      >
        <motion.button
          onClick={handleInstituteSelection}
          disabled={!selectedInstitute || isLoading}
          whileHover={{ scale: selectedInstitute && !isLoading ? 1.01 : 1 }}
          whileTap={{ scale: selectedInstitute && !isLoading ? 0.99 : 1 }}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            selectedInstitute && !isLoading
              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              </motion.div>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>Continue to Institute</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center"
      >
        <p className="text-xs text-gray-500">
          You can switch institutes later from your profile settings
        </p>
      </motion.div>
    </div>
  );
} 