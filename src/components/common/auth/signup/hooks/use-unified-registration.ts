import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Storage } from '@capacitor/storage';
import { registerUser, type RegisterUserRequest, type RegisterUserResponse } from '@/services/signup-api';
import { TokenKey } from '@/constants/auth/tokens';
import { useNavigate } from '@tanstack/react-router';
import { getStudentDisplaySettings } from '@/services/student-display-settings';
import { fetchInstituteDetails, fetchUserRolesDetails } from '@/routes/study-library/courses/-services/institute-details';
import { generateCredentials, areCredentialsRequired } from '../utils/credential-generator';
import { SignupSettings } from '@/config/signup/defaultSignupSettings';

export interface RegistrationData {
  username?: string;
  email: string;
  full_name: string;
  password?: string;
  instituteId: string;
  settings?: SignupSettings; // Add settings for credential generation
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
    console.group('[UnifiedRegistration] Starting registration process');
    console.log('[UnifiedRegistration] Registration data:', data);
    console.log('[UnifiedRegistration] Options:', options);

    const {
      shouldAutoLogin = true,
      redirectAfterLogin = true,
      showSuccessMessage = true,
      customRedirectRoute
    } = options;

    if (!data.email || !data.full_name || !data.instituteId) {
      console.error('[UnifiedRegistration] Missing required registration data');
      throw new Error('Missing required registration data');
    }

    setIsRegistering(true);

    try {
      // Get institute settings to determine roles
      let learnersCanCreateCourses = false;
      try {
        const stored = await Storage.get({ key: "InstituteDetails" });
        if (stored?.value) {
          const parsed = JSON.parse(stored.value);
          const settingsString = parsed?.institute_settings_json;
          if (typeof settingsString === "string") {
            const instSettings = JSON.parse(settingsString);
            learnersCanCreateCourses = !!instSettings?.learnersCanCreateCourses;
            console.log('[UnifiedRegistration] Institute settings parsed:', { learnersCanCreateCourses });
          }
        }
      } catch (error) {
        console.warn('[UnifiedRegistration] Failed to parse institute settings:', error);
      }

      // Determine roles based on institute settings
      const roles: string[] = ["LEARNER"];
      if (learnersCanCreateCourses) {
        roles.push("TEACHER");
        console.log('[UnifiedRegistration] Adding TEACHER role - learners can create courses');
      }
      console.log('[UnifiedRegistration] Final roles:', roles);

      // Generate credentials based on strategies if settings are provided
      let finalUsername = data.username;
      let finalPassword = data.password;

      if (data.settings) {
        console.log('[UnifiedRegistration] Using settings for credential generation:', {
          usernameStrategy: data.settings.usernameStrategy,
          passwordStrategy: data.settings.passwordStrategy
        });

        const { username, password } = generateCredentials(
          data.settings.usernameStrategy,
          data.settings.passwordStrategy,
          data.email,
          data.username,
          data.password
        );

        finalUsername = username;
        finalPassword = password;

        console.log('[UnifiedRegistration] Generated credentials:', {
          username: finalUsername || '(not generated)',
          password: finalPassword ? '(generated)' : '(not generated)'
        });
      } else {
        console.log('[UnifiedRegistration] No settings provided, using provided credentials');
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
      };

      console.log('[UnifiedRegistration] Registration payload prepared:', {
        username: payload.user.username,
        email: payload.user.email,
        full_name: payload.user.full_name,
        password: payload.user.password ? '(provided)' : '(not provided)',
        roles: payload.user.roles,
        institute_id: payload.institute_id
      });

      // Call registration API
      console.log('[UnifiedRegistration] Calling registration API...');
      const response = await registerUser(payload);
      console.log('[UnifiedRegistration] Registration API response received');

      // Show success message
      if (showSuccessMessage) {
        toast.success("Account created successfully!");
      }

      // Handle post-registration
      if (shouldAutoLogin && response.accessToken && response.refreshToken) {
        console.log('[UnifiedRegistration] Auto-login enabled, storing tokens...');
        
        // Store tokens using Storage (compatible with existing auth system)
        await Storage.set({ key: TokenKey.accessToken, value: response.accessToken });
        await Storage.set({ key: TokenKey.refreshToken, value: response.refreshToken });
        await Storage.set({ key: "instituteId", value: data.instituteId });
        await Storage.set({ key: "InstituteId", value: data.instituteId });

        console.log('[UnifiedRegistration] Tokens stored successfully');

        // ✅ IMPLEMENT PROPER LOGIN FLOW AFTER SIGNUP USING EXISTING FUNCTIONS
        if (redirectAfterLogin) {
          try {
            console.log('[UnifiedRegistration] Starting post-signup login flow...');
            
            // 1. Fetch student display settings (same as login flow)
            const studentSettings = await getStudentDisplaySettings(true);
            console.log('[UnifiedRegistration] Student display settings fetched');
            
            // 2. Fetch institute details (same as login flow)
            const instituteDetails = await fetchInstituteDetails();
            console.log('[UnifiedRegistration] Institute details fetched');
            
            // 3. Fetch user role details (same as login flow)
            const userRoleDetails = await fetchUserRolesDetails();
            console.log('[UnifiedRegistration] User role details fetched');

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

