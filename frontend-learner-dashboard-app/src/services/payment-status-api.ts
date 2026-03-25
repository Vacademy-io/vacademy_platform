import axios from 'axios';
import { BASE_URL } from '@/constants/urls';

// Types for the payment status API response
export interface UserPlanStatusResponse {
  user_plan_status: string;
  learner_status: string;
}

// API configuration
const API_BASE_URL = `${BASE_URL}/admin-core-service/learner/info/v1`;

/**
 * Fetches user plan status for a specific package session
 * @param packageSessionId - The package session ID
 * @param accessToken - The user's access token
 * @returns Promise<UserPlanStatusResponse>
 */
export const fetchUserPlanStatus = async (
  packageSessionId: string,
  accessToken: string
): Promise<UserPlanStatusResponse> => {
  console.log('fetchUserPlanStatus - API call started', {
    packageSessionId,
    accessToken: !!accessToken,
    url: `${API_BASE_URL}/user-plan-status`,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await axios.get<UserPlanStatusResponse>(
      `${API_BASE_URL}/user-plan-status`,
      {
        params: {
          packageSessionId: packageSessionId,
        },
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'authorization': `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      }
    );

    console.log('fetchUserPlanStatus - API call successful', {
      packageSessionId,
      response: response.data,
      status: response.status,
      timestamp: new Date().toISOString()
    });

    return response.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const is510Error = errorMessage.includes('510') || errorMessage.includes('Student has not submitted the request to enroll');
    
    console.error('fetchUserPlanStatus - API call failed', {
      packageSessionId,
      error: errorMessage,
      is510Error,
      timestamp: new Date().toISOString()
    });
    
    // For 510 errors, throw a specific error that can be handled as "no enrollment request"
    if (is510Error) {
      throw new Error('510 - Student has not submitted the request to enroll');
    }
    
    throw new Error('Failed to fetch user plan status');
  }
};

/**
 * React Query handler for user plan status
 * @param packageSessionId - The package session ID
 * @param accessToken - The user's access token
 * @returns Query configuration object
 */
export const handleGetUserPlanStatus = ({
  packageSessionId,
  accessToken,
}: {
  packageSessionId: string;
  accessToken: string;
}) => {
  return {
    queryKey: ['user-plan-status', packageSessionId, accessToken],
    queryFn: () => fetchUserPlanStatus(packageSessionId, accessToken),
    enabled: !!packageSessionId && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: 1000,
  };
};
