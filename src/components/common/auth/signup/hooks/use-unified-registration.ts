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
      try {
        const stored = await Preferences.get({ key: "InstituteDetails" });
        if (stored?.value) {
          const parsed = JSON.parse(stored.value);
          const settingsString = parsed?.institute_settings_json;
          if (typeof settingsString === "string") {
            const instSettings = JSON.parse(settingsString);
            
            // Check for the correct permission setting
            if (instSettings?.setting?.COURSE_SETTING?.data?.permissions?.allowLearnersToCreateCourses) {
              allowLearnersToCreateCourses = true;
            } else if (instSettings?.learnersCanCreateCourses) {
              // Fallback to legacy setting
              allowLearnersToCreateCourses = true;
            }
            

          }
        }
      } catch (error) {
        // Silently handle parsing errors
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
                  console.log('[UnifiedRegistration] Starting post-login flow for enrolled user...');
                  
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
              console.error('[UnifiedRegistration] Failed to fetch user role details:', error);
              throw error;
            }

                } catch (error) {
                  console.error('[UnifiedRegistration] Post-login flow failed:', error);
                  // Don't fail the login, just log the error
                }

                // Handle redirection
                const backendRedirectRoute = "/study-library/courses";
                const finalRedirectRoute = customRedirectRoute || backendRedirectRoute;

                console.log('[UnifiedRegistration] Redirecting enrolled user to:', finalRedirectRoute);

                // Navigate to the determined route
                if (/^https?:\/\//.test(finalRedirectRoute)) {
                  window.location.assign(finalRedirectRoute);
                } else {
                  navigate({ to: finalRedirectRoute as never });
                }
              }
            }
            
            console.log('[UnifiedRegistration] Automatic login process completed successfully');
            console.groupEnd();
            return loginResponse;
            
          } catch (loginError: any) {
            console.error('[UnifiedRegistration] Automatic login failed:', loginError);
            
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
        console.log('[UnifiedRegistration] Auto-login enabled, storing tokens...');
        
        // Store tokens using Storage (compatible with existing auth system)
        await Preferences.set({ key: TokenKey.accessToken, value: response.accessToken });
        await Preferences.set({ key: TokenKey.refreshToken, value: response.refreshToken });
        await Preferences.set({ key: "instituteId", value: data.instituteId });
        await Preferences.set({ key: "InstituteId", value: data.instituteId });

        console.log('[UnifiedRegistration] Tokens stored successfully');

        // ✅ IMPLEMENT PROPER LOGIN FLOW AFTER SIGNUP USING EXISTING FUNCTIONS
        if (redirectAfterLogin) {
          try {
            console.log('[UnifiedRegistration] Starting post-signup login flow...');
            
            // Get userId from token
            const decodedData = getTokenDecodedData(response.accessToken);
            const userId = decodedData?.user;
            
            if (!userId) {
              throw new Error('Failed to decode user ID from token');
            }
            
            console.log('[UnifiedRegistration] User ID extracted from token:', userId);
            
            // Extended delay to ensure tokens are properly stored and accessible
            console.log('[UnifiedRegistration] Waiting for tokens to be properly stored...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify tokens are accessible
            const storedToken = await Preferences.get({ key: TokenKey.accessToken });
            const storedInstituteId = await Preferences.get({ key: "InstituteId" });
            
            console.log('[UnifiedRegistration] Token verification:', {
              hasStoredToken: !!storedToken.value,
              tokenLength: storedToken.value?.length || 0,
              hasStoredInstituteId: !!storedInstituteId.value,
              instituteId: storedInstituteId.value
            });
            
            if (!storedToken.value) {
              throw new Error('Access token not found in storage after storing');
            }
            
            // Additional verification: check if token is accessible via getTokenFromStorage
            try {
              const { getTokenFromStorage } = await import('@/lib/auth/axiosInstance');
              const verifiedToken = await getTokenFromStorage(TokenKey.accessToken);
              console.log('[UnifiedRegistration] Token verification via getTokenFromStorage:', {
                hasVerifiedToken: !!verifiedToken,
                tokenLength: verifiedToken?.length || 0,
                tokenMatch: verifiedToken === storedToken.value
              });
              
              if (!verifiedToken) {
                throw new Error('Token not accessible via getTokenFromStorage');
              }
              
              // Additional verification: check if token is accessible via direct Preferences.get
              const directToken = await Preferences.get({ key: TokenKey.accessToken });
              console.log('[UnifiedRegistration] Direct token verification:', {
                hasDirectToken: !!directToken.value,
                tokenLength: directToken.value?.length || 0,
                directTokenMatch: directToken.value === storedToken.value
              });
              
            } catch (error) {
              console.error('[UnifiedRegistration] Token verification failed:', error);
              throw error;
            }
            
            // 1. Fetch student display settings (same as login flow)
            console.log('[UnifiedRegistration] Fetching student display settings...');
            try {
              const studentSettings = await getStudentDisplaySettings(true);
              console.log('[UnifiedRegistration] Student display settings fetched successfully:', {
                hasSettings: !!studentSettings,
                settingsKeys: studentSettings ? Object.keys(studentSettings) : []
              });
            } catch (error) {
              console.error('[UnifiedRegistration] Failed to fetch student display settings:', error);
              throw error;
            }
            
            // 2. Fetch and store institute details (same as login flow)
            console.log('[UnifiedRegistration] Fetching institute details...');
            try {
              const instituteDetails = await fetchAndStoreInstituteDetails(data.instituteId, userId);
              console.log('[UnifiedRegistration] Institute details fetched and stored successfully:', {
                hasDetails: !!instituteDetails,
                instituteName: instituteDetails?.institute_name,
                instituteId: instituteDetails?.id
              });
            } catch (error) {
              console.error('[UnifiedRegistration] Failed to fetch institute details:', error);
              throw error;
            }
            
            // 3. Fetch and store student details (same as login flow)
            console.log('[UnifiedRegistration] Fetching student details...');
            try {
              await fetchAndStoreStudentDetails(data.instituteId, userId);
              console.log('[UnifiedRegistration] Student details fetched and stored successfully');
            } catch (error) {
              console.error('[UnifiedRegistration] Failed to fetch student details:', error);
              throw error;
            }
            
            // 4. Fetch user role details (same as login flow)
            console.log('[UnifiedRegistration] Fetching user role details...');
            try {
              const userRoleDetails = await fetchUserRolesDetails();
              console.log('[UnifiedRegistration] User role details fetched successfully:', {
                hasRoleDetails: !!userRoleDetails,
                roles: userRoleDetails?.roles?.map(r => r.role_name) || []
              });
            } catch (error) {
              console.error('[UnifiedRegistration] Failed to fetch user role details:', error);
              throw error;
            }

          } catch (error) {
            console.error('[UnifiedRegistration] Post-signup login flow failed:', error);
            // Don't fail the signup, just log the error
          }

          // Handle redirection
          const backendRedirectRoute = "/study-library/courses";
          const finalRedirectRoute = customRedirectRoute || backendRedirectRoute;

          console.log('[UnifiedRegistration] Redirecting to:', finalRedirectRoute);

          // Navigate to the determined route
          if (/^https?:\/\//.test(finalRedirectRoute)) {
            window.location.assign(finalRedirectRoute);
          } else {
            navigate({ to: finalRedirectRoute as never });
          }
        }
      }

      console.log('[UnifiedRegistration] Registration process completed successfully');
      console.groupEnd();
      return response;

    } catch (error) {
      console.error('[UnifiedRegistration] Registration failed:', error);
      toast.error('Registration failed. Please try again.');
      console.groupEnd();
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

