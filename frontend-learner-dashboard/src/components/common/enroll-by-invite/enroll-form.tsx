"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { ENROLL_DETAILS_RESPONSE, GET_ENROLL_DETAILS } from "@/constants/urls";
import { toast } from "sonner";
import { DashboardLoader } from "@/components/core/dashboard-loader";
import { MyButton } from "@/components/design-system/button";
import { getPublicUrl } from "@/services/upload_file";
import axios from "axios";
import { Route } from "@/routes/learner-invitation-response";

interface CustomField {
  id: string;
  field_name: string;
  field_type: "TEXT" | "DROPDOWN";
  default_value: string;
  description: string;
  is_mandatory: boolean;
  comma_separated_options: string;
}

interface Level {
  id: string;
  name: string;
  package_session_id: string;
}

interface Session {
  id: string;
  name: string;
  institute_assigned?: boolean;
  max_selectable_packages: number;
  pre_selected_levels?: Level[];
  learner_choice_levels?: Level[];
}

interface Package {
  id: string;

  name: string;
  institute_assigned?: boolean;
  max_selectable_sessions: number;
  pre_selected_session_dtos?: Session[];
  learner_choice_sessions?: Session[];
}

interface BatchOptions {
  institute_assigned: boolean;
  max_selectable_packages: number;
  pre_selected_packages: Package[];
  learner_choice_packages: Package[];
}

interface LearnerInvitation {
  id: string;
  name: string;
  status: string;
  date_generated: string;
  expiry_date: string;
  institute_id: string;
  invite_code: string;
  batch_options_json: string;
  custom_fields: CustomField[];
}

interface ApiResponse {
  learner_invitation: LearnerInvitation;
  institute_name: string;
  institute_logo_file_id: string | null;
}

// Extended level interface with additional context information
interface LevelWithContext {
  id: string;
  name: string;
  sessionId: string;
  sessionName: string;
  packageId: string;
  packageName: string;
  isPreSelected: boolean;
}

// Validation schemas
const emailSchema = z.string().email("Please enter a valid email address");
const phoneSchema = z
  .string()
  .regex(/^\d{10}$/, "Phone number must be exactly 10 digits")
  .transform((val) => val.trim());

const EnrollByInvite = () => {
  const { instituteId, inviteCode } = Route.useSearch();

  // Form state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [inviteData, setInviteData] = useState<LearnerInvitation | null>(null);
  const [batchOptions, setBatchOptions] = useState<BatchOptions | null>(null);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState(false);

  // All available levels with context
  const [allLevels, setAllLevels] = useState<LevelWithContext[]>([]);

  // Selection states
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<
    Record<string, string[]>
  >({});
  const [selectedLevels, setSelectedLevels] = useState<
    Record<string, string[]>
  >({});

  // Personal info state
  const [personalInfo] = useState({
    fullName: "",
    email: "",
    mobile: "",
  });

  // Custom fields state
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string>
  >({});

  // Validation errors state
  const [errors, setErrors] = useState({
    packages: "",
    sessions: {} as Record<string, string>,
    levels: {} as Record<string, string>,
    fullName: "",
    email: "",
    mobile: "",
    customFields: {} as Record<string, string>,
  });

  // Fetch invite data on component mount
  useEffect(() => {
    if (instituteId && inviteCode) {
      fetchInviteData();
    }
  }, [instituteId, inviteCode]);

  // Process batch options to create a flat list of all levels with context
  useEffect(() => {
    if (batchOptions) {
      const levels: LevelWithContext[] = [];

      // Process pre-selected packages
      batchOptions.pre_selected_packages.forEach((pkg) => {
        // Process pre-selected sessions
        if (pkg.pre_selected_session_dtos) {
          pkg.pre_selected_session_dtos.forEach((session) => {
            // Process pre-selected levels
            if (session.pre_selected_levels) {
              session.pre_selected_levels.forEach((level) => {
                levels.push({
                  id: level.id,
                  name: level.name,
                  sessionId: session.id,
                  sessionName: session.name,
                  packageId: pkg.id,
                  packageName: pkg.name,
                  isPreSelected: true,
                });
              });
            }

            // Process learner choice levels for pre-selected sessions
            if (session.learner_choice_levels) {
              session.learner_choice_levels.forEach((level) => {
                levels.push({
                  id: level.id,
                  name: level.name,
                  sessionId: session.id,
                  sessionName: session.name,
                  packageId: pkg.id,
                  packageName: pkg.name,
                  isPreSelected: false,
                });
              });
            }
          });
        }

        // Process learner choice sessions for pre-selected packages
        if (pkg.learner_choice_sessions) {
          pkg.learner_choice_sessions.forEach((session) => {
            // Process learner choice levels
            if (session.learner_choice_levels) {
              session.learner_choice_levels.forEach((level) => {
                levels.push({
                  id: level.id,
                  name: level.name,
                  sessionId: session.id,
                  sessionName: session.name,
                  packageId: pkg.id,
                  packageName: pkg.name,
                  isPreSelected: false,
                });
              });
            }
          });
        }
      });

      // Process learner choice packages
      batchOptions.learner_choice_packages.forEach((pkg) => {
        // Process learner choice sessions
        if (pkg.learner_choice_sessions) {
          pkg.learner_choice_sessions.forEach((session) => {
            // Process learner choice levels
            if (session.learner_choice_levels) {
              session.learner_choice_levels.forEach((level) => {
                levels.push({
                  id: level.id,
                  name: level.name,
                  sessionId: session.id,
                  sessionName: session.name,
                  packageId: pkg.id,
                  packageName: pkg.name,
                  isPreSelected: false,
                });
              });
            }
          });
        }
      });

      setAllLevels(levels);
    }
  }, [batchOptions]);

  // Fetch invite data from API
  const fetchInviteData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(GET_ENROLL_DETAILS, {
        params: {
          instituteId: instituteId,
          inviteCode: inviteCode,
        },
      });
      console.log("Invite data:", response.data);

      // Store the full API response
      setApiResponse(response.data);

      // Extract the learner invitation data
      const learnerInvitation = response.data.learner_invitation;
      setInviteData(learnerInvitation);
      if (response.data.institute_logo_file_id) {
        try {
          const institute_logo = await getPublicUrl(
            response.data.institute_logo_file_id
          );
          setImageUrl(institute_logo);
        } catch (error) {
          console.error("Error fetching institute logo:", error);
        }
      }

      // Parse batch options JSON
      const batchOptionsData = JSON.parse(learnerInvitation.batch_options_json);
      setBatchOptions(batchOptionsData);

      // Initialize custom fields
      const initialCustomFields: Record<string, string> = {};
      learnerInvitation.custom_fields.forEach((field: CustomField) => {
        initialCustomFields[field.id] = field.default_value || "";
      });
      setCustomFieldValues(initialCustomFields);

      // Pre-select packages, sessions, and levels
      if (batchOptionsData.pre_selected_packages) {
        const preSelectedPackages = batchOptionsData.pre_selected_packages.map(
          (pkg: Package) => pkg.id
        );
        setSelectedPackages(preSelectedPackages);

        // Pre-select sessions for each package
        const sessionsMap: Record<string, string[]> = {};
        const levelsMap: Record<string, string[]> = {};

        batchOptionsData.pre_selected_packages.forEach((pkg: Package) => {
          if (pkg.pre_selected_session_dtos) {
            const sessionIds = pkg.pre_selected_session_dtos.map(
              (session: Session) => session.id
            );
            sessionsMap[pkg.id] = sessionIds;

            // Pre-select levels for each session
            pkg.pre_selected_session_dtos.forEach((session: Session) => {
              if (session.pre_selected_levels) {
                const levelIds = session.pre_selected_levels.map(
                  (level: Level) => level.id
                );
                levelsMap[session.id] = levelIds;
              }
            });
          }
        });

        setSelectedSessions(sessionsMap);
        setSelectedLevels(levelsMap);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching invite data:", error);
      setLoading(false);
      // Handle error (show message to user)
    }
  };

  // Toggle level selection
  const toggleLevel = (level: LevelWithContext) => {
    // If pre-selected, don't allow toggling
    if (level.isPreSelected) return;

    const { sessionId, packageId } = level;
    const currentLevels = selectedLevels[sessionId] || [];
    const isSelected = currentLevels.includes(level.id);

    // Check if the package is selected
    if (!selectedPackages.includes(packageId)) {
      // Add package if not already selected
      setSelectedPackages([...selectedPackages, packageId]);
    }

    // Check if the session is selected for this package
    const packageSessions = selectedSessions[packageId] || [];
    if (!packageSessions.includes(sessionId)) {
      // Add session if not already selected
      setSelectedSessions({
        ...selectedSessions,
        [packageId]: [...packageSessions, sessionId],
      });
    }

    // Toggle level selection
    if (isSelected) {
      // Remove level
      const newLevels = { ...selectedLevels };
      newLevels[sessionId] = currentLevels.filter((id) => id !== level.id);
      setSelectedLevels(newLevels);
    } else {
      // Add level if within max limit
      const session = findSessionById(sessionId);
      if (session) {
        const maxLevels = batchOptions?.max_selectable_packages; // Changed from max_selectable_levels
        const preSelectedCount = session.pre_selected_levels?.length || 0;
        console.log("preSelectedCount", preSelectedCount);

        if (currentLevels.length < (maxLevels ?? 0)) {
          setSelectedLevels({
            ...selectedLevels,
            [sessionId]: [...currentLevels, level.id],
          });
        }
      }
    }
  };

  // Helper function to find session by ID
  const findSessionById = (sessionId: string): Session | null => {
    if (!batchOptions) return null;

    // Search in all packages
    for (const pkg of [
      ...batchOptions.pre_selected_packages,
      ...batchOptions.learner_choice_packages,
    ]) {
      // Check in pre-selected sessions
      if (pkg.pre_selected_session_dtos) {
        const session = pkg.pre_selected_session_dtos.find(
          (s) => s.id === sessionId
        );
        if (session) return session;
      }

      // Check in learner choice sessions
      if (pkg.learner_choice_sessions) {
        const session = pkg.learner_choice_sessions.find(
          (s) => s.id === sessionId
        );
        if (session) return session;
      }
    }
    return null;
  };

  // Check if a level is selected
  const isLevelSelected = (levelId: string, sessionId: string): boolean => {
    return (selectedLevels[sessionId] || []).includes(levelId);
  };

  // Check if a level can be selected (based on session's max selectable levels)
  const canSelectLevel = (level: LevelWithContext): boolean => {
    if (level.isPreSelected) return false; // Pre-selected levels can't be toggled

    const session = findSessionById(level.sessionId);
    if (!session) return false;

    const currentLevels = selectedLevels[level.sessionId] || [];
    const isSelected = currentLevels.includes(level.id);

    // If already selected, allow deselection
    if (isSelected) return true;

    // Check if we've reached the max limit
    const maxLevels = batchOptions?.max_selectable_packages; // Changed from max_selectable_levels
    const preSelectedCount = session.pre_selected_levels?.length || 0;
    console.log("preSelectedCount", preSelectedCount);

    return currentLevels.length < (maxLevels ?? 0);
  };

  // Update personal info
  // const updatePersonalInfo = (field: string, value: string) => {
  //   setPersonalInfo({ ...personalInfo, [field]: value });

  //   // Clear error when typing
  //   if (errors[field as keyof typeof errors]) {
  //     setErrors({ ...errors, [field]: "" });
  //   }
  // };

  // Update custom field value
  const updateCustomField = (fieldId: string, value: string) => {
    setCustomFieldValues({ ...customFieldValues, [fieldId]: value });

    // Clear error when typing
    const newCustomErrors = { ...errors.customFields };
    delete newCustomErrors[fieldId];
    setErrors({ ...errors, customFields: newCustomErrors });
  };

  // Handle next button click with validation
  const handleNext = () => {
    const newErrors = { ...errors };
    let hasError = false;

    // Validate packages
    if (selectedPackages.length === 0) {
      newErrors.packages = "Please select at least one package";
      hasError = true;
    }

    // Validate sessions for each selected package
    selectedPackages.forEach((packageId) => {
      const selectedSessionsForPackage = selectedSessions[packageId] || [];
      if (selectedSessionsForPackage.length === 0) {
        newErrors.sessions = {
          ...newErrors.sessions,
          [packageId]: "Please select at least one session for this package",
        };
        hasError = true;
      }
    });

    // Validate levels for each selected session
    Object.keys(selectedSessions).forEach((packageId) => {
      const sessions = selectedSessions[packageId] || [];

      sessions.forEach((sessionId) => {
        const selectedLevelsForSession = selectedLevels[sessionId] || [];
        if (selectedLevelsForSession.length === 0) {
          newErrors.levels = {
            ...newErrors.levels,
            [sessionId]: "Please select at least one level for this session",
          };
          hasError = true;
        }
      });
    });

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    setStep(2);
  };

  // Handle back button click
  const handleBack = () => {
    setStep(1);
  };

  // Handle confirm button click with validation
  const handleConfirm = async () => {
    const newErrors = { ...errors };
    let hasError = false;

    // Validate custom fields
    if (inviteData && inviteData.custom_fields) {
      inviteData.custom_fields.forEach((field) => {
        if (field.is_mandatory && !customFieldValues[field.id]) {
          newErrors.customFields = {
            ...newErrors.customFields,
            [field.id]: `${field.field_name} is required`,
          };
          hasError = true;
        }

        // Add validation for Email field
        if (field.field_name === "Email") {
          try {
            emailSchema.parse(customFieldValues[field.id]);
          } catch (error) {
            if (error instanceof z.ZodError) {
              newErrors.customFields = {
                ...newErrors.customFields,
                [field.id]: error.errors[0].message,
              };
              hasError = true;
            }
          }
        }

        // Add validation for Phone Number field
        if (field.field_name === "Phone Number") {
          try {
            phoneSchema.parse(customFieldValues[field.id]);
          } catch (error) {
            if (error instanceof z.ZodError) {
              newErrors.customFields = {
                ...newErrors.customFields,
                [field.id]: error.errors[0].message,
              };
              hasError = true;
            }
          }
        }
      });
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    // Find email and phone number from custom fields
    let emailValue = personalInfo.email;
    let phoneValue = personalInfo.mobile;

    if (inviteData && inviteData.custom_fields) {
      const emailField = inviteData.custom_fields.find(
        (field) => field.field_name === "Email"
      );
      const phoneField = inviteData.custom_fields.find(
        (field) => field.field_name === "Phone Number"
      );
      const fullNameField = inviteData.custom_fields.find(
        (field) => field.field_name === "Full Name"
      );

      if (emailField && customFieldValues[emailField.id]) {
        emailValue = customFieldValues[emailField.id];
      }

      if (phoneField && customFieldValues[phoneField.id]) {
        phoneValue = customFieldValues[phoneField.id];
      }
      if (fullNameField && customFieldValues[fullNameField.id]) {
        personalInfo.fullName = customFieldValues[fullNameField.id];
      }
    }

    // Find all package data
    const getPackageData = (packageId: string) => {
      if (!batchOptions) return { id: packageId };

      const preSelectedPackage = batchOptions.pre_selected_packages.find(
        (p) => p.id === packageId
      );
      const learnerChoicePackage = batchOptions.learner_choice_packages.find(
        (p) => p.id === packageId
      );

      return preSelectedPackage || learnerChoicePackage || { id: packageId };
    };

    // Find all session data
    const getSessionData = (packageId: string, sessionId: string) => {
      const packageData = getPackageData(packageId);

      if (!packageData) return { id: sessionId };

      let preSelectedSession = null;
      let learnerChoiceSession = null;

      if ("pre_selected_session_dtos" in packageData) {
        preSelectedSession = packageData.pre_selected_session_dtos?.find(
          (s: Session) => s.id === sessionId
        );
      }

      if ("learner_choice_sessions" in packageData) {
        learnerChoiceSession = packageData.learner_choice_sessions?.find(
          (s: Session) => s.id === sessionId
        );
      }

      return preSelectedSession || learnerChoiceSession || { id: sessionId };
    };

    // Prepare data for submission with full data for packages, sessions, and levels
    const submissionData = {
      id: null,
      institute_id: inviteData?.institute_id,
      learner_invitation_id: inviteData?.id,
      status: "ACTIVE",
      full_name: personalInfo.fullName,
      email: emailValue,
      contact_number: phoneValue,
      batch_options_json: inviteData?.batch_options_json,
      batch_selection_response_json: JSON.stringify(
        selectedPackages.map((packageId) => {
          const packageData = getPackageData(packageId);
          console.log("packageData", packageData);
          const packageSessions = selectedSessions[packageId] || [];

          return {
            package_id: packageId,
            package_name: "name" in packageData ? packageData.name : "",
            selected_sessions: packageSessions.map((sessionId) => {
              const sessionData = getSessionData(packageId, sessionId);
              const sessionLevels = selectedLevels[sessionId] || [];

              // Find the full level data for each selected level
              const selectedLevelsWithData = sessionLevels.map((levelId) => {
                const levelData = allLevels.find((l) => l.id === levelId);

                const session = findSessionById(sessionId);
                const fullLevelData = session?.learner_choice_levels?.find(
                  (l) => l.id === levelId
                );

                return {
                  id: levelId,
                  name: levelData?.name || "",
                  package_session_id: fullLevelData?.package_session_id || null,
                };
              });

              return {
                session_id: sessionId,
                session_name: "name" in sessionData ? sessionData.name : "",
                selected_levels: selectedLevelsWithData,
              };
            }),
          };
        })
      ),
      recorded_on: new Date().toISOString(),
      custom_fields_response: Object.keys(customFieldValues).map((fieldId) => {
        const field = inviteData?.custom_fields.find((f) => f.id === fieldId);
        return {
          custom_field_id: fieldId,
          id: null,
          value: customFieldValues[fieldId],
          field_name: field?.field_name || null,
        };
      }),
    };
    console.log("Submission data:", submissionData);

    // Submit data
    setSubmitLoading(true);
    try {
      const response = await axios.post(
        `${ENROLL_DETAILS_RESPONSE}`,
        submissionData
      );
      console.log("Enrollment response:", response.data);
      setSuccess(true);
      toast.success("Enrollment submitted successfully!");
    } catch (error) {
      console.error("Error submitting enrollment:", error);
      setSuccess(false);
      toast.error("Failed to submit enrollment. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Function to render custom fields based on their type
  const renderCustomField = (field: CustomField) => {
    switch (field.field_type) {
      case "TEXT":
        return (
          <Input
            id={field.id}
            placeholder={field.description || `Enter ${field.field_name}`}
            value={customFieldValues[field.id] || ""}
            onChange={(e) => updateCustomField(field.id, e.target.value)}
            className={errors.customFields[field.id] ? "border-red-500" : ""}
          />
        );
      case "DROPDOWN": {
        const options = field.comma_separated_options
          ? field.comma_separated_options.split(",")
          : [];
        return (
          <Select
            onValueChange={(value) => updateCustomField(field.id, value)}
            value={customFieldValues[field.id] || ""}
          >
            <SelectTrigger
              className={errors.customFields[field.id] ? "border-red-500" : ""}
            >
              <SelectValue placeholder={`Select ${field.field_name}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option, index) => (
                <SelectItem key={index} value={option.trim()}>
                  {option.trim()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      default:
        return (
          <Input
            id={field.id}
            placeholder={field.description || `Enter ${field.field_name}`}
            value={customFieldValues[field.id] || ""}
            onChange={(e) => updateCustomField(field.id, e.target.value)}
            className={errors.customFields[field.id] ? "border-red-500" : ""}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen">
        <DashboardLoader />
      </div>
    );
  }

  if (!inviteData || !batchOptions) {
    return (
      <div className="flex items-center w-full justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 font-medium">
            Invalid or expired invite code.
          </p>
          <p className="mt-2 text-gray-500">
            Please contact the institute for a valid invite code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full bg-gray-50 p-4">
      <Card className="w-full max-w-md md:max-w-md lg:max-w-lg">
        <CardHeader className="text-center">
          {imageUrl && (
            <img
              src={imageUrl || "/placeholder.svg"}
              alt="Institute Logo"
              className="h-12 w-12 rounded-full object-cover"
            />
          )}
          <CardTitle className="text-orange-500">
            {apiResponse?.institute_name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            You have been invited to enroll in:{" "}
            <span className="font-medium">{inviteData.name}</span>
          </p>

          {step === 1 ? (
            // Step 1: Level Selection with Package and Session context
            <div className="space-y-6">
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Select Levels</h3>
                <p className="text-xs text-gray-500 mb-2">
                  Pre-selected levels are not selectable
                </p>
                <p className="text-xs text-gray-500 mb-4">
                  Select the levels you want to enroll in
                </p>
                <p className="text-xs text-gray-500 mb-2">{}</p>
              </div>

              {/* Flat list of all levels with context */}
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Maximum selectable packages:{" "}
                  {batchOptions?.max_selectable_packages}
                </p>
                {allLevels.map((level) => (
                  <div key={level.id} className="flex items-start space-x-2">
                    {!level.isPreSelected && (
                      <Checkbox
                        id={`level-${level.id}`}
                        checked={isLevelSelected(level.id, level.sessionId)}
                        onCheckedChange={() => toggleLevel(level)}
                        disabled={!canSelectLevel(level)}
                        className={`w-6 h-6 flex items-center justify-center rounded-md shadow ${
                          isLevelSelected(level.id, level.sessionId)
                            ? "bg-primary-500"
                            : "bg-transparent border border-gray-300"
                        }`}
                      >
                        {isLevelSelected(level.id, level.sessionId) && (
                          <span className="text-white text-sm font-bold">
                            ✔
                          </span>
                        )}
                      </Checkbox>
                    )}

                    <div className="space-y-1">
                      <Label
                        htmlFor={`level-${level.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {level.name} {level.packageName} {level.sessionName}
                        {level.isPreSelected && " (Pre-selected)"}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error messages */}
              {errors.packages && (
                <p className="text-red-500 text-sm">{errors.packages}</p>
              )}
              {Object.values(errors.sessions).some((error) => error) && (
                <p className="text-red-500 text-sm">
                  Please select at least one session for each package
                </p>
              )}
              {Object.values(errors.levels).some((error) => error) && (
                <p className="text-red-500 text-sm">
                  Please select at least one level for each session
                </p>
              )}

              <div className="flex justify-center">
                <MyButton
                  type="submit"
                  scale="medium"
                  buttonType="primary"
                  layoutVariant="default"
                  onClick={handleNext}
                >
                  Next
                </MyButton>
              </div>
            </div>
          ) : (
            // Step 2: Personal Information
            <div className="space-y-6">
              <div className="border-t pt-4">
                <h3 className="font-medium mb-4">Additional Information</h3>
              </div>

              {/* Custom Fields */}
              {inviteData &&
                inviteData.custom_fields &&
                inviteData.custom_fields.length > 0 && (
                  <div className="space-y-4">
                    {inviteData.custom_fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                          {field.field_name}
                          {field.is_mandatory && (
                            <span className="text-red-500">*</span>
                          )}
                        </Label>
                        {renderCustomField(field)}
                        {errors.customFields[field.id] && (
                          <p className="text-red-500 text-sm">
                            {errors.customFields[field.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              {success ? (
                <p className="text-green-500 text-sm">
                  Your data has been sent successfully!
                </p>
              ) : null}

              <div className="pt-4 flex justify-between">
                <MyButton
                  type="submit"
                  scale="medium"
                  buttonType="secondary"
                  layoutVariant="default"
                  onClick={handleBack}
                >
                  Back
                </MyButton>
                <MyButton
                  type="submit"
                  scale="medium"
                  buttonType="primary"
                  layoutVariant="default"
                  onClick={handleConfirm}
                  className="test-sm"
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    "Confirm Enrollment"
                  )}{" "}
                </MyButton>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnrollByInvite;
