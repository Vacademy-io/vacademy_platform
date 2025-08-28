import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { 
  searchInstitute, 
  getInstituteDetails, 
  parseInstituteSettings,
  parseSignupSettings,
  type InstituteSearchResult,
  type InstituteDetails,
  type InstituteSettings,
  type RegisterUserRequest
} from "@/services/signup-api";
import { useUnifiedRegistration } from "./use-unified-registration";
import { mapSignupSettings, type SignupSettings } from "@/config/signup/mapSignupSettings";

interface SignupState {
  // Institute search and selection
  searchQuery: string;
  searchResults: InstituteSearchResult[];
  isSearching: boolean;
  selectedInstitute: InstituteDetails | null;
  instituteSettings: InstituteSettings | null;
  signupSettings: SignupSettings | null;
  isFetchingInstituteDetails: boolean;
  
  // User data
  userData: {
    email: string;
    fullName: string;
    username: string;
  };
  
  // Role selection
  selectedRole: "learner" | "teacher" | null;
  
  // Registration
  isRegistering: boolean;
}

const initialState: SignupState = {
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  selectedInstitute: null,
  instituteSettings: null,
  signupSettings: null,
  isFetchingInstituteDetails: false,
  userData: {
    email: "",
    fullName: "",
    username: "",
  },
  selectedRole: null,
  isRegistering: false,
};

export const useSignupFlow = (isModalSignup?: boolean, type?: string, courseId?: string) => {
  const navigate = useNavigate();
  const { isRegistering, registerUser: registerUserUnified } = useUnifiedRegistration();
  const [state, setState] = useState<SignupState>(initialState);

  // Institute search functionality
  const handleInstituteSearch = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, isSearching: true }));

    if (!query.trim()) {
      setState(prev => ({ 
        ...prev, 
        searchResults: [], 
        isSearching: false 
      }));
      return;
    }

    try {
      const results = await searchInstitute(query);
      setState(prev => ({ 
        ...prev, 
        searchResults: results, 
        isSearching: false 
      }));
    } catch (error) {
      toast.error("Failed to search institutes. Please try again.");
      setState(prev => ({ 
        ...prev, 
        searchResults: [], 
        isSearching: false 
      }));
    }
  }, []);

  // Institute selection and details fetching
  const handleInstituteSelect = useCallback(async (instituteId: string) => {
    setState(prev => ({ ...prev, isFetchingInstituteDetails: true }));

    try {
      // First, get the institute details
      const instituteDetails = await getInstituteDetails(instituteId);
      
      // Parse the settings to determine available roles
      const settings = parseInstituteSettings(instituteDetails.setting);
      
      // Parse signup settings from institute settings and merge with defaults
      const rawSignupSettings = settings.signup || parseSignupSettings(instituteDetails);
      const signupSettings = mapSignupSettings(rawSignupSettings);
      
      // Determine the available role based on settings
      let availableRole: "learner" | "teacher" | null = null;
      if (settings.allowLearnerSignup && settings.allowTeacherSignup) {
        availableRole = "learner"; // Default to learner when both are available
      } else if (settings.allowLearnerSignup) {
        availableRole = "learner";
      } else if (settings.allowTeacherSignup) {
        availableRole = "teacher";
      }
      setState(prev => ({
        ...prev,
        selectedInstitute: instituteDetails,
        instituteSettings: settings,
        signupSettings: signupSettings,
        selectedRole: availableRole,
        isFetchingInstituteDetails: false,
      }));
      // Removed toast for institute selection to keep UX quiet
    } catch (error) {
      toast.error("Failed to fetch institute details. Please try again.");
      setState(prev => ({ 
        ...prev, 
        isFetchingInstituteDetails: false 
      }));
    }
  }, []);

  // Update user data
  const updateUserData = useCallback((field: keyof SignupState["userData"], value: string) => {
    setState(prev => ({
      ...prev,
      userData: {
        ...prev.userData,
        [field]: value,
      },
    }));
  }, []);

  // Update selected role
  const updateSelectedRole = useCallback((role: "learner" | "teacher") => {
    setState(prev => ({ ...prev, selectedRole: role }));
  }, []);

  // Handle user registration
  const handleUserRegistration = useCallback(async () => {
    if (!state.selectedInstitute || !state.selectedRole) {
      //toast.error("Please select an institute and role first");
      return;
    }

    if (!state.userData.email || !state.userData.fullName || !state.userData.username) {
      // toast.error("Please fill in all required fields");
      return;
    }

    try {
      // Use unified registration hook
      await registerUserUnified({
        username: state.userData.username,
        email: state.userData.email,
        full_name: state.userData.fullName,
        instituteId: state.selectedInstitute.id,
      });

      // Post-registration handling is now managed by the unified hook
      // The hook will handle login and redirection automatically
    } catch (error) {
      console.error("Registration failed:", error);
      toast.error("Registration failed. Please try again.");
    }
  }, [state.selectedInstitute, state.selectedRole, state.userData, registerUserUnified]);

  // Reset state
  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state: {
      ...state,
      isRegistering, // Use unified registration loading state
    },
    handleInstituteSearch,
    handleInstituteSelect,
    updateUserData,
    updateSelectedRole,
    handleUserRegistration,
    resetState,
    // Getter for signup settings
    getSignupSettings: () => state.signupSettings,
  };
}; 