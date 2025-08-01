import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { 
  searchInstitute, 
  getInstituteDetails, 
  registerUser, 
  parseInstituteSettings,
  type InstituteSearchResult,
  type InstituteDetails,
  type InstituteSettings,
  type RegisterUserRequest
} from "@/services/signup-api";

interface SignupState {
  // Institute search and selection
  searchQuery: string;
  searchResults: InstituteSearchResult[];
  isSearching: boolean;
  selectedInstitute: InstituteDetails | null;
  instituteSettings: InstituteSettings | null;
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
  isFetchingInstituteDetails: false,
  userData: {
    email: "",
    fullName: "",
    username: "",
  },
  selectedRole: null,
  isRegistering: false,
};

export const useSignupFlow = () => {
  const navigate = useNavigate();
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
      console.error("Error searching institutes:", error);
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
        selectedRole: availableRole,
        isFetchingInstituteDetails: false,
      }));
      toast.success(`Selected: ${instituteDetails.institute_name}`);
    } catch (error) {
      console.error("Error fetching institute details:", error);
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
      toast.error("Please select an institute and role first");
      return;
    }

    if (!state.userData.email || !state.userData.fullName || !state.userData.username) {
      toast.error("Please fill in all required fields");
      return;
    }

    setState(prev => ({ ...prev, isRegistering: true }));

    try {
      // Prepare user roles based on institute settings and course creation permissions
      const userRoles: string[] = [];
      
      // Always add STUDENT role for learners
      userRoles.push("STUDENT");
      
      // If learners can create courses, also add TEACHER role
      if (state.instituteSettings?.learnersCanCreateCourses) {
        userRoles.push("TEACHER");
      }
      
      console.log("User registration - Roles assigned:", {
        learnersCanCreateCourses: state.instituteSettings?.learnersCanCreateCourses,
        assignedRoles: userRoles,
        instituteSettings: state.instituteSettings
      });

      // Prepare registration payload
      const registrationData: RegisterUserRequest = {
        user: {
          username: state.userData.username,
          email: state.userData.email,
          full_name: state.userData.fullName,
          roles: userRoles,
          root_user: false,
        },
        institute_id: state.selectedInstitute.id,
        learner_package_session_enroll: null,
      };

      // Call the registration API
      const response = await registerUser(registrationData);

      // If we get here, registration was successful
      toast.success("Successfully signed up for this institute! Your credentials have been sent to your email.");
      console.log("Registration successful");
      
      // Don't store tokens - user should login separately
      // Navigate to login page
      navigate({ to: "/login" });
    } catch (error) {
      console.error("Registration failed:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setState(prev => ({ ...prev, isRegistering: false }));
    }
  }, [state.selectedInstitute, state.selectedRole, state.userData, navigate]);

  // Reset state
  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    handleInstituteSearch,
    handleInstituteSelect,
    updateUserData,
    updateSelectedRole,
    handleUserRegistration,
    resetState,
  };
}; 