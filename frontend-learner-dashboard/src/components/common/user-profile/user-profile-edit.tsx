"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  User,
  EnvelopeSimple,
  MapPin,
  Buildings,
  Users,
  GraduationCap,
} from "@phosphor-icons/react";
import { STUDENT_DETAIL_EDIT } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { useNavigate } from "@tanstack/react-router";
import { Preferences } from "@capacitor/preferences";
import { MyButton } from "@/components/design-system/button";
import { Loader2 } from "lucide-react";
import type { Student } from "@/types/user/user-detail";
// import PhoneInputField from "@/components/phone-input-field";
import { FormProvider, useForm } from "react-hook-form";
import { useFileUpload } from "@/hooks/use-file-upload";
import PhoneInputField from "@/components/design-system/phone-input-field";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { PencilSimpleLine } from "phosphor-react";

// Define the update request body interface
interface UpdateStudentRequest {
  user_id: string;
  email: string;
  full_name: string;
  contact_number: string;
  gender: string;
  address_line: string;
  city: string;
  state: string;
  pin_code: string;
  institute_name: string;
  father_name: string;
  mother_name: string;
  parents_mobile_number: string;
  parents_email: string;
  face_file_id: string;
}

export default function EditProfile() {
  const [studentData, setStudentData] = useState<Student | null>(null);
  const [formData, setFormData] = useState<UpdateStudentRequest>({
    user_id: "",
    email: "",
    full_name: "",
    contact_number: "",
    gender: "",
    address_line: "",
    city: "",
    state: "",
    pin_code: "",
    institute_name: "",
    father_name: "",
    mother_name: "",
    parents_mobile_number: "",
    parents_email: "",
    face_file_id: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { uploadFile, getPublicUrl } = useFileUpload();

  const methods = useForm();
  const navigate = useNavigate();

  // Function to get public URL for face image
  const getProfileImage = async (faceFileId: string) => {
    if (!faceFileId) return null;

    try {
      const url = await getPublicUrl(faceFileId);
      return url;
    } catch (error) {
      console.error("Error getting profile image URL:", error);
      return null;
    }
  };

  const handleProfileImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileId = await uploadFile({
        file,
        setIsUploading,
        userId: formData.user_id,
        source: "PROFILE_PHOTOS",
        sourceId: "STUDENTS",
        publicUrl: true,
      });

      if (fileId) {
        const existingDetails = await Preferences.get({
          key: "StudentDetails",
        });

        if (existingDetails.value) {
          // Parse existing details
          const detailsObj = JSON.parse(existingDetails.value);

          // Update just the face_file_id field
          detailsObj.face_file_id = fileId;

          // Save back the updated object
          await Preferences.set({
            key: "StudentDetails",
            value: JSON.stringify(detailsObj),
          });
        }
        // Update the face_file_id in the form data
        setFormData((prev) => ({
          ...prev,
          face_file_id: fileId,
        }));

        // Get and set the public URL for preview
        const url = await getPublicUrl(fileId);
        setProfileImageUrl(url);
      }
    } catch (error) {
      console.error("Error uploading profile image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch student data from Preferences
  // const handleProfileImageChange = async (
  //   e: React.ChangeEvent<HTMLInputElement>
  // ) => {
  //   const file = e.target.files?.[0];
  //   if (!file) return;

  //   try {
  //     setIsUploading(true);
  //     const fileId = await uploadFile({
  //       file,
  //       setIsUploading,
  //       userId: formData.user_id,
  //       source: "PROFILE_PHOTOS",
  //       sourceId: "STUDENTS",
  //       publicUrl: true,
  //     });

  //     if (fileId) {
  //       // Update the face_file_id in formData
  //       setFormData((prev) => ({
  //         ...prev,
  //         face_file_id: fileId,
  //       }));

  //       // Update existing face_file_id in Capacitor Preferences under 'StudentDetails'
  //       const existingDetails = await Preferences.get({ key: 'StudentDetails' });

  //       if (existingDetails.value) {
  //         const detailsObj = JSON.parse(existingDetails.value);
  //         detailsObj.face_file_id = fileId;

  //         await Preferences.set({
  //           key: 'StudentDetails',
  //           value: JSON.stringify(detailsObj),
  //         });
  //       }

  //       // Get and set the public URL for preview
  //       const url = await getPublicUrl(fileId);
  //       setProfileImageUrl(url);
  //     }
  //   } catch (error) {
  //     console.error("Error uploading profile image:", error);
  //   } finally {
  //     setIsUploading(false);
  //   }
  // };

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setIsFetching(true);
        console.log("Fetching student data from Preferences...");

        const { value } = await Preferences.get({ key: "StudentDetails" });
        console.log("Raw student details from Preferences:", value);

        if (!value) {
          console.log("No data found in Preferences with key 'StudentDetails'");
          setIsFetching(false);
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
              setIsFetching(false);
              return;
            }
            studentDetails = parsedData[0];
          } else if (typeof parsedData === "object" && parsedData !== null) {
            studentDetails = parsedData;
          } else {
            console.error("Unexpected data format:", parsedData);
            setIsFetching(false);
            return;
          }

          console.log("Student details to use:", studentDetails);
          setStudentData(studentDetails);

          // Pre-fill the form with student data
          setFormData({
            user_id: studentDetails.user_id || "",
            email: studentDetails.email || "",
            full_name: studentDetails.full_name || "",
            contact_number: studentDetails.mobile_number || "",
            gender: studentDetails.gender || "",
            address_line: studentDetails.address_line || "",
            city: studentDetails.city || "",
            state: studentDetails.region || "",
            pin_code: studentDetails.pin_code || "",
            institute_name: studentDetails.linked_institute_name || "",
            father_name: studentDetails.father_name || "",
            mother_name: studentDetails.mother_name || "",
            parents_mobile_number: studentDetails.parents_mobile_number || "",
            parents_email: studentDetails.parents_email || "",
            face_file_id: studentDetails.face_file_id || "",
          });

          // Get profile image if face_file_id exists
          if (studentDetails.face_file_id) {
            const imageUrl = await getProfileImage(studentDetails.face_file_id);
            setProfileImageUrl(imageUrl);
          }

          console.log("Form data pre-filled:", formData);
        } catch (parseError) {
          console.error("Error parsing JSON from Preferences:", parseError);
        }
      } catch (error) {
        console.error("Error fetching student data from Preferences:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchStudentData();
  }, []);

  const handleChange = (field: keyof UpdateStudentRequest, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log("Submitting form data:", formData);

      const response = await authenticatedAxiosInstance.put(
        `${STUDENT_DETAIL_EDIT}`,
        formData
      );

      console.log("API response:", response.data);

      // Update the stored data in Preferences
      if (studentData) {
        const updatedStudentData = {
          ...studentData,
          user_id: formData.user_id,
          email: formData.email,
          full_name: formData.full_name,
          mobile_number: formData.contact_number,
          gender: formData.gender,
          address_line: formData.address_line,
          city: formData.city,
          region: formData.state,
          pin_code: formData.pin_code,
          linked_institute_name: formData.institute_name,
          father_name: formData.father_name,
          mother_name: formData.mother_name,
          parents_mobile_number: formData.parents_mobile_number,
          parents_email: formData.parents_email,
          face_file_id: formData.face_file_id,
        };

        // Get the current stored data
        const { value } = await Preferences.get({ key: "StudentDetails" });

        if (value) {
          try {
            const parsedData = JSON.parse(value);

            // Update the data based on its format
            if (Array.isArray(parsedData)) {
              parsedData[0] = updatedStudentData;
              await Preferences.set({
                key: "StudentDetails",
                value: JSON.stringify(parsedData),
              });
            } else {
              await Preferences.set({
                key: "StudentDetails",
                value: JSON.stringify(updatedStudentData),
              });
            }

            console.log("Updated student data in Preferences");
          } catch (error) {
            console.error("Error updating data in Preferences:", error);
          }
        }
      }

      // Redirect back to profile page after successful update
      navigate({ to: "/user-profile", replace: true });
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate({ to: "/user-profile", replace: true });
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-screen">
        <DashboardLoader />
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <div className="bg-white rounded-lg w-full max-w-md mx-auto shadow-lg sm:max-w-md md:max-w-lg lg:max-w-xl">
        <div className="p-4 flex items-center justify-between border-b">
          <h1 className="text-lg font-medium text-orange-500">Edit Profile</h1>
          <button onClick={handleCancel} className="text-gray-500">
            <X size={20} weight="bold" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Profile Image */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              {profileImageUrl ? (
                <img
                  src={profileImageUrl || "/placeholder.svg"}
                  alt="Profile Photo"
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center">
                  <User size={40} className="text-gray-400" />
                </div>
              )}
              <label
                htmlFor="profile-upload"
                className="absolute bottom-0 right-0 p-1 rounded-md cursor-pointer bg-gray-100 border border-gray-400"
              >
                <input
                  type="file"
                  id="profile-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                />
                <PencilSimpleLine />
              </label>
              {isUploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                </div>
              )}
            </div>
          </div>

          {/* General Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <User size={18} weight="bold" />
              <h3>General Details</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-xs">
                Full Name*
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder="Enter your full name"
                required
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender" className="text-xs">
                Gender*
              </Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleChange("gender", value)}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institute_name" className="text-xs">
                College/School Name
              </Label>
              <div className="relative">
                <Input
                  id="institute_name"
                  value={formData.institute_name}
                  onChange={(e) =>
                    handleChange("institute_name", e.target.value)
                  }
                  placeholder="Enter college/school name"
                  className="h-10 text-sm pl-9"
                />
                <GraduationCap
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <h3>Contact Information</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_number" className="text-xs">
                Mobile Number*
              </Label>
              <PhoneInputField
                label=""
                name="contact_number"
                placeholder="Enter mobile number"
                control={methods.control}
                value={formData.contact_number}
                country="in"
                onChange={(value) => handleChange("contact_number", value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">
                Email*
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter email address"
                  required
                  className="h-10 text-sm pl-9"
                />
                <EnvelopeSimple
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <MapPin size={18} weight="bold" />
              <h3>Location Details</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_line" className="text-xs">
                Address Line 1
              </Label>
              <div className="relative">
                <Input
                  id="address_line"
                  value={formData.address_line}
                  onChange={(e) => handleChange("address_line", e.target.value)}
                  placeholder="Enter address"
                  className="h-10 text-sm pl-9"
                />
                <Buildings
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-xs">
                  City/Village
                </Label>
                <Input
                  id="city"
                  value={formData?.city || ""}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Enter city/village"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state" className="text-xs">
                  State
                </Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  placeholder="Enter state"
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin_code" className="text-xs">
                Pincode
              </Label>
              <Input
                id="pin_code"
                value={formData.pin_code}
                onChange={(e) => handleChange("pin_code", e.target.value)}
                placeholder="Enter pincode"
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Parent/Guardian's Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Users size={18} weight="bold" />
              <h3>Parent/Guardian's Details</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="father_name" className="text-xs">
                  Father/Male Guardian's Name
                </Label>
                <Input
                  id="father_name"
                  value={formData.father_name}
                  onChange={(e) => handleChange("father_name", e.target.value)}
                  placeholder="Enter father's name"
                  className="h-10 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mother_name" className="text-xs">
                  Mother/Female Guardian's Name
                </Label>
                <Input
                  id="mother_name"
                  value={formData.mother_name}
                  onChange={(e) => handleChange("mother_name", e.target.value)}
                  placeholder="Enter mother's name"
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parents_email" className="text-xs">
                Parent/Guardian's Email
              </Label>
              <div className="relative">
                <Input
                  id="parents_email"
                  type="email"
                  value={formData.parents_email}
                  onChange={(e) =>
                    handleChange("parents_email", e.target.value)
                  }
                  placeholder="Enter parent's email"
                  className="h-10 text-sm pl-9"
                />
                <EnvelopeSimple
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="parents_mobile_number" className="text-xs">
                Parent/Guardian's Mobile Number
              </Label>
              <PhoneInputField
                label=""
                name="parents_mobile_number"
                placeholder="Enter parent's mobile number"
                control={methods.control}
                value={formData.parents_mobile_number}
                country="in"
                onChange={(value) =>
                  handleChange("parents_mobile_number", value)
                }
              />
            </div>
          </div>

          <div className="pt-4 flex justify-between">
            <MyButton
              type="button"
              scale="medium"
              buttonType="secondary"
              layoutVariant="default"
              onClick={handleCancel}
            >
              Back
            </MyButton>
            <MyButton
              type="submit"
              scale="medium"
              buttonType="primary"
              layoutVariant="default"
              className="test-sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </MyButton>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}
