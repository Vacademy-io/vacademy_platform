"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { X } from "@phosphor-icons/react";

import { Student } from "@/types/user/user-detail";
import { MyButton } from "@/components/design-system/button";
import { getPublicUrl } from "@/services/upload_file";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import SessionExpiry from "./sessionExpiery";
import { User } from "lucide-react";
import { useInstituteFeatureStore } from "@/stores/insititute-feature-store";
import { HOLISTIC_INSTITUTE_ID } from "@/constants/urls";
import { getTerminology } from "../layout-container/sidebar/utils";
import { ContentTerms, SystemTerms } from "@/types/naming-settings";
import { toTitleCase } from "@/lib/utils";
import { useStudentPermissions } from "@/hooks/use-student-permissions";
import ProgressStats from "./progress-stats";
// import { SessionExpiry } from "./sessionExpiery";
interface CourseDetails {
  packageName: string;
  sessionName: string;
  levelName: string;
  startDate: string;
  status: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [courseDetails, setCourseDetails] = useState<CourseDetails | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const { showForInstitutes } = useInstituteFeatureStore();
  const { permissions, isLoading: permissionsLoading } =
    useStudentPermissions();

  // Redirect if user doesn't have permission to view profile
  useEffect(() => {
    if (!permissionsLoading && !permissions.canViewProfile) {
      navigate({ to: "/dashboard" });
    }
  }, [permissions.canViewProfile, permissionsLoading, navigate]);

  // Fetch student data from Preferences
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const { value } = await Preferences.get({ key: "sessionList" });

        if (value) {
          try {
            // Parse the JSON data
            const parsedData = JSON.parse(value);

            // Initialize course details with defaults
            let courseDetails = {
              packageName: "N/A",
              sessionName: "N/A",
              levelName: "N/A",
              startDate: "N/A",
              status: "N/A",
            };

            // Check if parsedData is an array or object
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              const course = parsedData[0]; // Take the first course if it's an array

              courseDetails = {
                packageName: toTitleCase(
                  course.package_dto?.package_name || "N/A"
                ),
                sessionName: toTitleCase(course.session?.session_name || "N/A"),
                levelName: toTitleCase(course.level?.level_name || "N/A"),
                startDate: course.session?.start_date || "N/A",
                status: course.status || "N/A",
              };
            } else if (typeof parsedData === "object" && parsedData !== null) {
              // Handle if parsedData is a single course object
              const course = parsedData;

              courseDetails = {
                packageName: toTitleCase(
                  course.package_dto?.package_name || "N/A"
                ),
                sessionName: toTitleCase(course.session?.session_name || "N/A"),
                levelName: toTitleCase(course.level?.level_name || "N/A"),
                startDate: course.session?.start_date || "N/A",
                status: course.status || "N/A",
              };
            }

            // Set the course details to state
            setCourseDetails(courseDetails);
          } catch (parseError) {
            console.error("Error parsing JSON from Preferences:", parseError);
            // Set default course details if parsing fails
            setCourseDetails({
              packageName: "N/A",
              sessionName: "N/A",
              levelName: "N/A",
              startDate: "N/A",
              status: "N/A",
            });
          }
        } else {
          // Try to get fallback data from institute batches
          try {
            const { value: fallbackValue } = await Preferences.get({
              key: "instituteBatchesForSessions",
            });

            if (fallbackValue) {
              const fallbackData = JSON.parse(fallbackValue);

              if (Array.isArray(fallbackData) && fallbackData.length > 0) {
                const fallbackCourse = fallbackData[0];
                const fallbackCourseDetails = {
                  packageName: toTitleCase(
                    fallbackCourse.package_dto?.package_name || "N/A"
                  ),
                  sessionName: toTitleCase(
                    fallbackCourse.session?.session_name || "N/A"
                  ),
                  levelName: toTitleCase(
                    fallbackCourse.level?.level_name || "N/A"
                  ),
                  startDate: fallbackCourse.session?.start_date || "N/A",
                  status: fallbackCourse.status || "N/A",
                };
                setCourseDetails(fallbackCourseDetails);
              } else {
                // Set default course details if no fallback data
                setCourseDetails({
                  packageName: "N/A",
                  sessionName: "N/A",
                  levelName: "N/A",
                  startDate: "N/A",
                  status: "N/A",
                });
              }
            } else {
              // Set default course details if no fallback data
              setCourseDetails({
                packageName: "N/A",
                sessionName: "N/A",
                levelName: "N/A",
                startDate: "N/A",
                status: "N/A",
              });
            }
          } catch (fallbackError) {
            console.error("Error getting fallback data:", fallbackError);
            // Set default course details if fallback fails
            setCourseDetails({
              packageName: "N/A",
              sessionName: "N/A",
              levelName: "N/A",
              startDate: "N/A",
              status: "N/A",
            });
          }
        }
      } catch (error) {
        console.error("Error fetching course data from Preferences:", error);
        // Set default course details if error occurs
        setCourseDetails({
          packageName: "N/A",
          sessionName: "N/A",
          levelName: "N/A",
          startDate: "N/A",
          status: "N/A",
        });
      }

      try {
        const { value } = await Preferences.get({ key: "StudentDetails" });

        if (!value) {
          setIsLoading(false);
          return;
        }

        try {
          // Parse the JSON data
          const parsedData = JSON.parse(value);

          // Handle both array and object formats
          let studentDetails: Student;
          if (Array.isArray(parsedData)) {
            if (parsedData.length === 0) {
              setIsLoading(false);
              return;
            }
            studentDetails = parsedData[0];
          } else if (typeof parsedData === "object" && parsedData !== null) {
            studentDetails = parsedData;
          } else {
            console.error("Unexpected data format:", parsedData);
            setIsLoading(false);
            return;
          }

          setStudentData(studentDetails);

          if (studentDetails.face_file_id) {
            try {
              const institute_logo = await getPublicUrl(
                studentDetails.face_file_id
              );
              setImageUrl(institute_logo);
            } catch (error) {
              console.error("Error fetching institute logo:", error);
            }
          }
        } catch (parseError) {
          console.error("Error parsing JSON from Preferences:", parseError);
        }
      } catch (error) {
        console.error("Error fetching student data from Preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudentData();
  }, []);

  const handleEditProfile = () => {
    navigate({ to: "/user-profile/edit" });
  };

  const handleClose = () => {
    navigate({ to: "/dashboard" });
  };

  if (isLoading || permissionsLoading) {
    return <DashboardLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-8">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="w-full py-4 px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 md:hidden"
              >
                <X size={24} />
              </button>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                My Profile
              </h1>
            </div>
            <div className="hidden md:flex gap-3">
              <MyButton
                type="button"
                scale="medium"
                buttonType="secondary"
                layoutVariant="default"
                onClick={handleClose}
              >
                Back to Dashboard
              </MyButton>
              {permissions.canEditProfile && (
                <MyButton
                  type="button"
                  scale="medium"
                  buttonType="primary"
                  layoutVariant="default"
                  onClick={handleEditProfile}
                >
                  Edit Profile
                </MyButton>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full py-6 md:py-8 px-4">
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
            {/* Left Column - Profile Summary */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-4 md:space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 flex flex-col items-center">
                  {/* Profile Image */}
                  <div className="mb-4">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Profile"
                        className="h-32 w-32 rounded-full object-cover shadow-lg border-4 border-gray-100"
                      />
                    ) : (
                      <div className="h-32 w-32 rounded-full bg-gray-100 flex items-center justify-center shadow-lg border-4 border-gray-200 text-gray-400">
                        <User size={48} />
                      </div>
                    )}
                  </div>

                  {/* User Info */}
                  <div className="text-center w-full">
                    <h2 className="text-xl font-bold text-gray-900">
                      {studentData?.full_name || "Student Name"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      @{studentData?.username || "username"}
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <div className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium border border-primary-200">
                        Student
                      </div>
                      {studentData?.gender && (
                        <div className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-xs font-medium border border-gray-200">
                          {studentData.gender}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Expiry */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Membership Status
                </h3>
                {studentData && SessionExpiry({ studentData })}
              </div>
              {studentData && <ProgressStats userId={studentData.user_id} />}
            </div>

            {/* Right Column - Details */}
            <div className="lg:col-span-8 xl:col-span-9 space-y-4 md:space-y-6">
              {/* Academic Journey Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-primary-500 rounded-full"></span>
                  Academic Journey
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {getTerminology(ContentTerms.Course, SystemTerms.Course)}
                    </p>
                    <p className="text-base font-medium text-gray-900">
                      {toTitleCase(courseDetails?.packageName || "N/A")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {getTerminology(
                        ContentTerms.Session,
                        SystemTerms.Session
                      )}
                    </p>
                    <p className="text-base font-medium text-gray-900">
                      {toTitleCase(courseDetails?.sessionName || "N/A")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      {getTerminology(ContentTerms.Level, SystemTerms.Level)}
                    </p>
                    <p className="text-base font-medium text-gray-900">
                      {toTitleCase(courseDetails?.levelName || "N/A")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Enrollment No.
                    </p>
                    <p className="text-base font-medium text-gray-900">
                      {studentData?.institute_enrollment_id || "N/A"}
                    </p>
                  </div>
                  {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        College/School Name
                      </p>
                      <p className="text-base font-medium text-gray-900">
                        {studentData?.linked_institute_name || "N/A"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact & Location Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-secondary-500 rounded-full"></span>
                  Contact & Location
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Mobile Number
                    </p>
                    <p className="text-base font-medium text-gray-900">
                      {studentData?.mobile_number || "N/A"}
                    </p>
                  </div>
                  <div className="sm:col-span-2 xl:col-span-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                      Email Address
                    </p>
                    <p className="text-base font-medium text-gray-900 break-words">
                      {studentData?.email || "N/A"}
                    </p>
                  </div>

                  {showForInstitutes([HOLISTIC_INSTITUTE_ID]) ? (
                    <div className="sm:col-span-2 pt-6 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Country
                      </p>
                      <p className="text-base font-medium text-gray-900">
                        {studentData?.country || "N/A"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="sm:col-span-2 xl:col-span-3 pt-6 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Address
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {studentData?.address_line || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          City/Village
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {studentData?.city || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          State
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {studentData?.region || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Pincode
                        </p>
                        <p className="text-base font-medium text-gray-900">
                          {studentData?.pin_code || "N/A"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Guardian Info Card */}
              {!showForInstitutes([HOLISTIC_INSTITUTE_ID]) && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <span className="w-1 h-6 bg-tertiary-500 rounded-full"></span>
                    Guardian Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Father/Male Guardian
                      </p>
                      <p className="text-base font-medium text-gray-900">
                        {studentData?.father_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Mother/Female Guardian
                      </p>
                      <p className="text-base font-medium text-gray-900">
                        {studentData?.mother_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Guardian's Email
                      </p>
                      <p className="text-base font-medium text-gray-900 break-words">
                        {studentData?.parents_email || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Guardian's Mobile
                      </p>
                      <p className="text-base font-medium text-gray-900">
                        {studentData?.parents_mobile_number || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Fixed Bottom Bar */}
      {permissions.canEditProfile && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-40">
          <MyButton
            type="button"
            scale="large"
            buttonType="primary"
            layoutVariant="default"
            className="w-full"
            onClick={handleEditProfile}
          >
            Edit Profile
          </MyButton>
        </div>
      )}
    </div>
  );
}
