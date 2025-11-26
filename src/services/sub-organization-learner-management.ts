import axios from 'axios';
import {
  SUB_ORG_MEMBER_ADMIN_DETAILS,
  SUB_ORG_MEMBERS,
  SUB_ORG_ADD_MEMBER,
  SUB_ORG_TERMINATE_MEMBER
} from '@/constants/urls';
import { toast } from 'sonner';

// Types
export interface AdminMappings {
  package_session_id: string;
  institute_id: string;
  sub_org_id: string;
  [key: string]: any;
}

export interface AdminDetailsResponse {
  admin_mappings: AdminMappings[];
}

export interface StudentMapping {
  id: string;
  user_id: string;
  institute_enrollment_number: string;
  enrolled_date: string;
  expiry_date: string;
  status: 'ACTIVE' | 'TERMINATED' | 'INVITED' | 'PENDING_FOR_APPROVAL' | 'INACTIVE';
  package_session_id: string;
  institute_id: string;
  group_id: string;
  sub_org_id: string;
  user_plan_id: string | null;
  destination_package_session_id: string | null;
  user: {
    user_id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    username: string;
  };
}

export interface MembersResponse {
  student_mappings: StudentMapping[];
}

export interface UserData {
  email: string;
  mobile_number?: string;
  full_name: string;
  username?: string;
}

export interface AddMemberRequest {
  user: UserData;
  package_session_id: string;
  sub_org_id: string;
  institute_id: string;
  group_id?: string;
  enrolled_date?: string;
  expiry_date?: string;
  institute_enrollment_number?: string;
  status?: 'ACTIVE' | 'TERMINATED' | 'INVITED' | 'PENDING_FOR_APPROVAL' | 'INACTIVE';
  comma_separated_org_roles?: string;
  custom_field_values?: Array<{
    custom_field_id: string;
    value: string;
  }>;
}

export interface AddMemberResponse {
  user: {
    user_id: string;
    full_name: string;
    email: string;
    mobile_number: string;
    username: string;
  };
  mapping_id: string;
  message: string;
}

export interface TerminateMemberRequest {
  sub_org_id: string;
  institute_id: string;
  package_session_id: string;
  user_ids: string[];
}

export interface TerminateMemberResponse {
  terminated_count: number;
  message: string;
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const { Preferences } = await import('@capacitor/preferences');

  const { value: accessToken } = await Preferences.get({ key: 'accessToken' });
  if (!accessToken) {
    throw new Error('No access token available');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
};

// API Functions

// Check admin access permissions
export const checkAdminAccess = async (userId: string): Promise<AdminDetailsResponse> => {
  try {
    const url = `${SUB_ORG_MEMBER_ADMIN_DETAILS}?userId=${userId}`;

    // This endpoint requires authentication headers
    const headers = await getAuthHeaders();

    const response = await axios.get<AdminDetailsResponse>(url, { headers });

    return response.data;
  } catch (error) {
    console.error('Error checking admin access:', error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
    }
    throw error;
  }
};

// Get members by package session and sub-organization
export const getMembers = async (
  packageSessionId: string,
  subOrgId: string
): Promise<MembersResponse> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.get<MembersResponse>(SUB_ORG_MEMBERS, {
      headers,
      params: {
        package_session_id: packageSessionId,
        sub_org_id: subOrgId,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching members:', error);
    toast.error('Failed to fetch members');
    throw error;
  }
};

// Add a new member
export const addMember = async (memberData: AddMemberRequest): Promise<AddMemberResponse> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.post<AddMemberResponse>(SUB_ORG_ADD_MEMBER, memberData, {
      headers,
    });
    toast.success('Learner enrolled successfully');
    return response.data;
  } catch (error) {
    console.error('Error adding member:', error);
    toast.error('Failed to add learner');
    throw error;
  }
};

// Terminate members (bulk operation)
export const terminateMembers = async (
  terminateData: TerminateMemberRequest
): Promise<TerminateMemberResponse> => {
  try {
    const headers = await getAuthHeaders();
    const response = await axios.post<TerminateMemberResponse>(
      SUB_ORG_TERMINATE_MEMBER,
      terminateData,
      { headers }
    );
    toast.success(`Successfully terminated ${terminateData.user_ids.length} learner(s)`);
    return response.data;
  } catch (error) {
    console.error('Error terminating members:', error);
    toast.error('Failed to terminate learners');
    throw error;
  }
};

// Export all functions
export const subOrganizationLearnerManagementApi = {
  checkAdminAccess,
  getMembers,
  addMember,
  terminateMembers,
};
