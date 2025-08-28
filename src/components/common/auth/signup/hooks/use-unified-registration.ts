import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Preferences } from '@capacitor/preferences';
import { registerUser, checkUserEnrollment, loginEnrolledUser, type RegisterUserRequest, type RegisterUserResponse } from '@/services/signup-api';
import { TokenKey } from '@/constants/auth/tokens';
import { useNavigate } from '@tanstack/react-router';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { fetchUserRolesDetails } from '@/routes/study-library/courses/-services/institute-details';
import { fetchAndStoreInstituteDetails } from '@/services/fetchAndStoreInstituteDetails';
import { fetchAndStoreStudentDetails } from '@/services/studentDetails';
import { getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { generateCredentials, areCredentialsRequired } from '../utils/credential-generator';
import { SignupSettings } from '@/config/signup/defaultSignupSettings';

export interface RegistrationData {
  username?: string;
  email: string;
  full_name: string;
  password?: string;
  instituteId: string;
  settings?: SignupSettings; // Add settings for credential generation
  subject_id?: string; // OAuth subject ID (e.g., Google sub)
  vendor_id?: string;  // OAuth provider (e.g., "google", "github")
}

export interface PostRegistrationOptions {
  shouldAutoLogin?: boolean;
  redirectAfterLogin?: boolean;
  showSuccessMessage?: boolean;
  customRedirectRoute?: string;
}

export interface UseUnifiedRegistrationReturn {
  isRegistering: boolean;
  registerUser: (data: RegistrationData, options?: PostRegistrationOptions) => Promise<RegisterUserResponse>;
  resetRegistration: () => void;
}

export function useUnifiedRegistration(): UseUnifiedRegistrationReturn {
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);

  const registerUserUnified = useCallback(async (
    data: RegistrationData,
    options: PostRegistrationOptions = {}
  ) => {

    const {
      shouldAutoLogin = true,
      redirectAfterLogin = true,
      showSuccessMessage = true,
      customRedirectRoute
    } = options;

    if (!data.email || !data.full_name || !data.instituteId) {
      throw new Error('Missing required registration data');
    }

    setIsRegistering(true);

    try {
      // First, check if user is already enrolled
      const enrollmentCheck = await checkUserEnrollment(data.email, data.instituteId);
      
      // If user exists in system, we'll try registration first, and if it fails due to existing enrollment,
      // we'll attempt to login with the password from the API response
      
      // Get institute settings to determine roles
      let allowLearnersToCreateCourses = false;
      let rawSettings = null;
      let parsedSettings = null;
      
      try {
        const stored = await Preferences.get({ key: "InstituteDetails" });
        
        if (stored?.value) {
          rawSettings = JSON.parse(stored.value);
          const settingsString = rawSettings?.institute_settings_json;
          
          if (typeof settingsString === "string") {
            try {
              parsedSettings = JSON.parse(settingsString);
              
              // Check for the correct permission setting
              const courseSetting = parsedSettings?.setting?.COURSE_SETTING;
              
              if (courseSetting?.data?.permissions?.allowLearnersToCreateCourses) {
                allowLearnersToCreateCourses = true;
              } else if (parsedSettings?.learnersCanCreateCourses) {
                // Fallback to legacy setting
                allowLearnersToCreateCourses = true;
              }
            } catch (parseError) {
              // Silently handle parsing errors
            }
          }
        }
      } catch (error) {
        // Silently handle parsing errors
      }

      // If settings are missing, try to fetch them from the full institute details API
      if (!allowLearnersToCreateCourses) {
        try {
          const { getInstituteDetails } = await import('@/services/signup-api');
          const fullInstituteDetails = await getInstituteDetails(data.instituteId);
          
          if (fullInstituteDetails?.setting) {
            // Store the full institute details for future use
            try {
              await Preferences.set({
                key: "InstituteDetails",
                value: JSON.stringify({
                  ...rawSettings, // Keep existing basic info
                  institute_settings_json: fullInstituteDetails.setting // Add the full settings
                })
              });
            } catch (storeError) {
              // Silently handle storage errors
            }
            
            // Parse the setting field to check for course permissions
            try {
              const settingData = JSON.parse(fullInstituteDetails.setting);
              
              // Check for the correct permission setting in the setting field
              // The structure is: settingData.setting.COURSE_SETTING.data.permissions.allowLearnersToCreateCourses
              const settingCourseSetting = settingData?.setting?.COURSE_SETTING;
              
              if (settingCourseSetting?.data?.permissions?.allowLearnersToCreateCourses) {
                allowLearnersToCreateCourses = true;
              } else if (settingData?.learnersCanCreateCourses) {
                // Fallback to legacy setting
                allowLearnersToCreateCourses = true;
              }
            } catch (settingParseError) {
              // Silently handle parsing errors
            }
          }
        } catch (fetchError) {
          // Continue with default behavior (STUDENT role only)
        }
      }

      // Determine roles based on institute settings
      const roles: string[] = ["STUDENT"];
      if (allowLearnersToCreateCourses) {
        roles.push("TEACHER");
      }

      // Generate credentials based on strategies if settings are provided
      let finalUsername = data.username;
      let finalPassword = data.password;

      if (data.settings) {
        const { username, password } = generateCredentials(
          data.settings.usernameStrategy,
          data.settings.passwordStrategy,
          data.email,
          data.username,
          data.password
        );

        finalUsername = username;
        finalPassword = password;
      }

      // Validate that we have required credentials
      if (data.settings) {
        const { needsUsername, needsPassword } = areCredentialsRequired(
          data.settings.usernameStrategy,
          data.settings.passwordStrategy
        );

        if (needsUsername && !finalUsername) {
          throw new Error('Username is required but not provided or generated');
        }

        if (needsPassword && !finalPassword) {
          throw new Error('Password is required but not provided or generated');
        }
      }

      // Prepare registration payload
      const payload: RegisterUserRequest = {
        user: {
          username: finalUsername || data.email.split("@")[0],
          email: data.email,
          full_name: data.full_name,
          password: finalPassword || "",
          roles,
          root_user: true,
        },
        institute_id: data.instituteId,
        ...(data.subject_id && { subject_id: data.subject_id }), // Include subject_id if provided
        ...(data.vendor_id && { vendor_id: data.vendor_id }),   // Include vendor_id if provided
      };

      // Call registration API
      let response: RegisterUserResponse;
      
      try {
        response = await registerUser(payload);
      } catch (registrationError: any) {
        // Check if registration failed due to user already being enrolled in this institute
        if (enrollmentCheck.userDetails && enrollmentCheck.password && 
            (registrationError.message?.includes('already exists') || 
             registrationError.message?.includes('already enrolled') ||
             registrationError.response?.status === 409)) {
          
          try {
            // Attempt automatic login with password from API response
            const existingUsername = enrollmentCheck.userDetails.username;
            const loginUsername = existingUsername || data.username || data.email.split("@")[0];
            
            const loginResponse = await loginEnrolledUser(
              loginUsername,
              enrollmentCheck.password,
              data.instituteId
            );
            
            // Show success message
            if (showSuccessMessage) {
              toast.success("Welcome back! You are already enrolled in this institute.");
            }
            
            // Handle post-login flow
            if (shouldAutoLogin && loginResponse.accessToken && loginResponse.refreshToken) {
              // Store tokens using Storage (compatible with existing auth system)
              await Preferences.set({ key: TokenKey.accessToken, value: loginResponse.accessToken });
              await Preferences.set({ key: TokenKey.refreshToken, value: loginResponse.refreshToken });
              await Preferences.set({ key: "instituteId", value: data.instituteId });
              await Preferences.set({ key: "InstituteId", value: data.instituteId });

              // Handle post-login flow
              if (redirectAfterLogin) {
                try {
                  // Get userId from token
                  const decodedData = getTokenDecodedData(loginResponse.accessToken);
                  const userId = decodedData?.user;
                  
                  if (!userId) {
                    throw new Error('Failed to decode user ID from token');
                  }
                  

                  
            // Extended delay to ensure tokens are properly stored and accessible
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify tokens are accessible
            const storedToken = await Preferences.get({ key: TokenKey.accessToken });
            
            if (!storedToken.value) {
              throw new Error('Access token not found in storage after storing');
            }
            
            // Additional verification: check if token is accessible via getTokenFromStorage
            try {
              const { getTokenFromStorage } = await import('@/lib/auth/axiosInstance');
              const verifiedToken = await getTokenFromStorage(TokenKey.accessToken);
              
              if (!verifiedToken) {
                throw new Error('Token not accessible via getTokenFromStorage');
              }
              
            } catch (error) {
              throw error;
            }
                  
            // 1. Fetch student display settings (same as login flow)
            try {
              await getStudentDisplaySettings(true);
            } catch (error) {
              throw error;
            }
            
            // 2. Fetch and store institute details (same as login flow)
            try {
              await fetchAndStoreInstituteDetails(data.instituteId, userId);
            } catch (error) {
              throw error;
            }
            
            // 3. Fetch and store student details (same as login flow)
            try {
              await fetchAndStoreStudentDetails(data.instituteId, userId);
            } catch (error) {
              throw error;
            }
            
            // 4. Fetch user role details (same as login flow)
            try {
              await fetchUserRolesDetails();
            } catch (error) {
              throw error;
            }

                } catch (error) {
                  // Don't fail the login, just log the error
                }

                // Handle redirection
                const backendRedirectRoute = "/study-library/courses";
                const finalRedirectRoute = customRedirectRoute || backendRedirectRoute;

                // Navigate to the determined route
                if (/^https?:\/\//.test(finalRedirectRoute)) {
                  window.location.assign(finalRedirectRoute);
                } else {
                  navigate({ to: finalRedirectRoute as never });
                }
              }
            }
            
            return loginResponse;
            
          } catch (loginError: any) {
            // Show error message
            if (showSuccessMessage) {
              toast.error('You are already enrolled in this institute. Please use the login page with your correct credentials.');
            }
            
            // Re-throw the original registration error
            throw registrationError;
          }
        } else {
          // Registration failed for other reasons, re-throw the error
          throw registrationError;
        }
      }

      // Show success message
      if (showSuccessMessage) {
        toast.success("Account created successfully!");
      }

      // Handle post-registration
      if (shouldAutoLogin && response.accessToken && response.refreshToken) {
        // Store tokens using Storage (compatible with existing auth system)
        await Preferences.set({ key: TokenKey.accessToken, value: response.accessToken });
        await Preferences.set({ key: TokenKey.refreshToken, value: response.refreshToken });
        await Preferences.set({ key: "instituteId", value: data.instituteId });
        await Preferences.set({ key: "InstituteId", value: data.instituteId });

        // ✅ IMPLEMENT PROPER LOGIN FLOW AFTER SIGNUP USING EXISTING FUNCTIONS
        if (redirectAfterLogin) {
          try {
            // Get userId from token
            const decodedData = getTokenDecodedData(response.accessToken);
            const userId = decodedData?.user;
            
            if (!userId) {
              throw new Error('Failed to decode user ID from token');
            }
            
            // Extended delay to ensure tokens are properly stored and accessible
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify tokens are accessible
            const storedToken = await Preferences.get({ key: TokenKey.accessToken });
            const storedInstituteId = await Preferences.get({ key: "InstituteId" });
            
            if (!storedToken.value) {
              throw new Error('Access token not found in storage after storing');
            }
            
            // Additional verification: check if token is accessible via getTokenFromStorage
            try {
              const { getTokenFromStorage } = await import('@/lib/auth/axiosInstance');
              const verifiedToken = await getTokenFromStorage(TokenKey.accessToken);
              
              if (!verifiedToken) {
                throw new Error('Token not accessible via getTokenFromStorage');
              }
              
            } catch (error) {
              throw error;
            }
            
            // 1. Fetch student display settings (same as login flow)
            try {
              const studentSettings = await getStudentDisplaySettings(true);
            } catch (error) {
              throw error;
            }
            
            // 2. Fetch and store institute details (same as login flow)
            try {
              const instituteDetails = await fetchAndStoreInstituteDetails(data.instituteId, userId);
            } catch (error) {
              throw error;
            }
            
            // 3. Fetch and store student details (same as login flow)
            try {
              await fetchAndStoreStudentDetails(data.instituteId, userId);
            } catch (error) {
              throw error;
            }
            
            // 4. Fetch user role details (same as login flow)
            try {
              const userRoleDetails = await fetchUserRolesDetails();
            } catch (error) {
              throw error;
            }

          } catch (error) {
            // Don't fail the signup, just log the error
          }

          // Handle redirection
          const backendRedirectRoute = "/study-library/courses";
          const finalRedirectRoute = customRedirectRoute || backendRedirectRoute;

          // Navigate to the determined route
          if (/^https?:\/\//.test(finalRedirectRoute)) {
            window.location.assign(finalRedirectRoute);
          } else {
            navigate({ to: finalRedirectRoute as never });
          }
        }
      }

      return response;

    } catch (error) {
      toast.error('Registration failed. Please try again.');
      throw error;
    } finally {
      setIsRegistering(false);
    }
  }, [navigate]);

  const resetRegistration = useCallback(() => {
    setIsRegistering(false);
  }, []);

  return {
    isRegistering,
    registerUser: registerUserUnified,
    resetRegistration
  };
}

