"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { X } from "@phosphor-icons/react";
import { Separator } from "@/components/ui/separator";
import { Student } from "@/types/user/user-detail";
import { MyButton } from "@/components/design-system/button";
import { getPublicUrl } from "@/services/upload_file";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import SessionExpiry from "./sessionExpiery";
import { User } from "lucide-react";
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

  // Fetch student data from Preferences
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const { value } = await Preferences.get({ key: "sessionList" });

        if (!value) {
          console.log("No data found in Preferences with key 'sessionList'");
          return;
        }

        try {
          // Parse the JSON data
          const parsedData = JSON.parse(value);
          console.log("Parsed course details:", parsedData);

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
              packageName: course.package_dto?.package_name || "N/A",
              sessionName: course.session?.session_name || "N/A",
              levelName: course.level?.level_name || "N/A",
              startDate: course.session?.start_date || "N/A",
              status: course.status || "N/A",
            };
          } else if (typeof parsedData === "object" && parsedData !== null) {
            // Handle if parsedData is a single course object
            const course = parsedData;

            courseDetails = {
              packageName: course.package_dto?.package_name || "N/A",
              sessionName: course.session?.session_name || "N/A",
              levelName: course.level?.level_name || "N/A",
              startDate: course.session?.start_date || "N/A",
              status: course.status || "N/A",
            };
          }

          // Set the course details to state
          setCourseDetails(courseDetails);
        } catch (parseError) {
          console.error("Error parsing JSON from Preferences:", parseError);
        }
      } catch (error) {
        console.error("Error fetching course data from Preferences:", error);
      }

      try {
        console.log("Fetching student data from Preferences...");
        const { value } = await Preferences.get({ key: "StudentDetails" });

        if (!value) {
          console.log("No data found in Preferences with key 'StudentDetails'");
          setIsLoading(false);
          return;
        }

        try {
          // Parse the JSON data
          const parsedData = JSON.parse(value);
          console.log("Parsed student details:", parsedData);

          // Handle both array and object formats
          let studentDetails: Student;

          if (Array.isArray(parsedData)) {
            if (parsedData.length === 0) {
              console.log("Student details array is empty");
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

  if (isLoading) {
    <DashboardLoader />;
  }

  return (
    <div className="bg-white pb-12 rounded-lg w-full mx-auto shadow-lg md:max-w-lg lg:max-w-xl">
      {" "}
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b sticky top-0 bg-white z-10">
        <h1 className="text-lg font-medium text-primary-500">
          Profile Details
        </h1>
        <button onClick={handleClose} className="text-gray-500">
          <X size={20} weight="bold" />
        </button>
      </div>
      {/* Profile Info */}
      <div className="p-6 flex flex-col items-center md:flex-row md:items-start md:gap-6">
        {/* {imageUrl && (
          <img
            src={imageUrl}
            alt="Profile Photo"
            className="h-24 w-24 rounded-full object-cover"
          />
        )} */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Profile Photo"
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
            <User size={40} className="text-gray-400" />
          </div>
        )}
        <div className="text-center md:text-left">
          <h2 className="text-xl font-medium mb-2">
            {studentData?.full_name || "Student Name"}
          </h2>
          <div className="flex gap-1 ">
            <h3 className="text-sm font-medium">Username:</h3>
            <p className="text-sm text-gray-500">{studentData?.username}</p>
          </div>
        </div>
      </div>
      <Separator className="my-4" />
      {/* Badges */}
      {/* <div className="p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Badges</span>
          <span className="text-sm font-medium">2</span>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 mb-4">
          <div className="bg-orange-50 rounded-lg p-3 flex flex-col items-center">
            <Trophy className="text-orange-500 mb-1" size={24} weight="fill" />
            <span className="text-xs text-gray-600 text-center">
              Elite Scholar
            </span>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 flex flex-col items-center">
            <Trophy className="text-orange-500 mb-1" size={24} weight="fill" />
            <span className="text-xs text-gray-600 text-center">
              Curious Learner
            </span>
          </div>
        </div>
      </div>
      <Separator className="my-4" /> */}
      {/* Coins */}
      {/* <div className="p-6">
        <div className="flex items-center mb-3">
          <span className="text-sm font-medium">Coins</span>
          <div className="ml-auto flex items-center">
            <span className="text-sm font-medium mr-2">350</span>
            <div className="bg-yellow-100 p-1 rounded">
              <Coins className="text-yellow-500" size={16} weight="fill" />
            </div>
          </div>
        </div>
      </div>
      <Separator className="my-4" /> */}
      {/* Session Expiry */}
      <div className="p-6">{studentData && SessionExpiry({ studentData })}</div>
      <Separator className="my-4" />
      {/* General Details */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium">General Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Course:</span>
            <span className="text-xs">
              {courseDetails?.packageName || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Session:</span>
            <span className="text-xs">
              {courseDetails?.sessionName || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Level:</span>
            <span className="text-xs">{courseDetails?.levelName || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Enrollment No.:</span>
            <span className="text-xs">
              {studentData?.institute_enrollment_id || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Gender:</span>
            <span className="text-xs">{studentData?.gender || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">College/School Name:</span>
            <span className="text-xs">
              {studentData?.linked_institute_name || "N/A"}
            </span>
          </div>
        </div>
      </div>
      <Separator className="my-4" />
      {/* Contact Information */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium">Contact Information</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Mobile No.:</span>
            <span className="text-xs">
              {studentData?.mobile_number || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Email ID:</span>
            <span className="text-xs">{studentData?.email || "N/A"}</span>
          </div>
        </div>
        <Separator className="my-4" />

        {/* Location Details */}
        <div className="p-6"></div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium">Location Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Address Line 1:</span>
            <span className="text-xs">
              {studentData?.address_line || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">City/Village:</span>
            <span className="text-xs">{studentData?.city || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">State:</span>
            <span className="text-xs">{studentData?.region || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">Pincode:</span>
            <span className="text-xs">{studentData?.pin_code || "N/A"}</span>
          </div>
        </div>
      </div>
      <Separator className="my-4" />
      {/* Parent/Guardian's Details */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-medium">Parent/Guardian's Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">
              Father/Male Guardian's Name:
            </span>
            <span className="text-xs">{studentData?.father_name || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">
              Mother/Female Guardian's Name:
            </span>
            <span className="text-xs">{studentData?.mother_name || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">
              Parent/Guardian's Email:
            </span>
            <span className="text-xs">
              {studentData?.parents_email || "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500">
              Parent/Guardian's Mobile Number:
            </span>
            <span className="text-xs">
              {studentData?.parents_mobile_number || "N/A"}
            </span>
          </div>
        </div>
      </div>
      {/* Edit Profile Button */}
      <div className="p-2  flex justify-center fixed bottom-0 left-0 w-full bg-white ">
        <MyButton
          type="submit"
          scale="large"
          buttonType="secondary"
          layoutVariant="default"
          onClick={handleEditProfile}
        >
          Edit Profile
        </MyButton>
      </div>
    </div>
  );
}
