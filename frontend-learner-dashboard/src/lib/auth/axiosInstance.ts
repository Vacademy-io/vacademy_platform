import { Storage } from "@capacitor/storage";
import { TokenKey } from "@/constants/auth/tokens";
import axios from "axios";
import { isTokenExpired } from "./sessionUtility"; // Utility for JWT expiration checks
import { REFRESH_TOKEN_URL } from "@/constants/urls";

// Helper functions to interact with Capacitor Storage
const getTokenFromStorage = async (key: string): Promise<string | null> => {
  const { value } = await Storage.get({ key });
  return value;
};

const removeTokensAndInstituteId = async () => {
  await Storage.remove({ key: TokenKey.accessToken });
  await Storage.remove({ key: TokenKey.refreshToken });
  await Storage.remove({ key: "instituteId" });
};

const refreshTokens = async (refreshToken: string): Promise<void> => {
  try {
    const response = await axios.post(REFRESH_TOKEN_URL, { refreshToken });
    const {
      accessToken,
      refreshToken: newRefreshToken,
      instituteId,
    } = response.data;

    // Store the new tokens and institute ID
    await Storage.set({ key: TokenKey.accessToken, value: accessToken });
    await Storage.set({ key: TokenKey.refreshToken, value: newRefreshToken });
    await Storage.set({ key: "instituteId", value: instituteId });
  } catch (error) {
    console.error("Error refreshing token", error);
    throw error;
  }
};

// Create an instance of Axios
const authenticatedAxiosInstance = axios.create({
  // Optional base configuration can be added here
  // For example: baseURL, timeout, etc.
  headers: {
    clientId: "",
  },
});

// Request interceptor: gets called before every request
authenticatedAxiosInstance.interceptors.request.use(
  async (request) => {
    const accessToken = await getTokenFromStorage(TokenKey.accessToken);
    const instituteId = await getTokenFromStorage("InstituteId");
    console.log("Request interceptor called", instituteId);

    // Add instituteId to headers if available
    if (instituteId) {
      console.log("Institute ID:", instituteId);
      request.headers["clientId"] = instituteId;
      request.headers["X-Institute-Id"] = instituteId;
    }

    // Check if the access token is expired
    if (!isTokenExpired(accessToken)) {
      // request.headers["Authorization"] = `Bearer ${accessToken}`;
      request.headers.Authorization = `Bearer ${accessToken}`;

      return request;
    } else {
      // If the access token is expired, refresh it
      const refreshToken = await getTokenFromStorage(TokenKey.refreshToken);
      try {
        if (!refreshToken) throw new Error("No refresh token found");

        // Refresh tokens
        await refreshTokens(refreshToken);

        // Get the new access token after refresh
        const newAccessToken = await getTokenFromStorage(TokenKey.accessToken);
        request.headers["Authorization"] = `Bearer ${newAccessToken}`;

        return request;
      } catch (error) {
        console.error("Error refreshing token: Logging out ...", error);

        // If token refresh fails, remove tokens and institute ID
        await removeTokensAndInstituteId();

        // Reject the request with an error indicating that the user is not authenticated
        return Promise.reject(new Error("Unauthorized"));
      }
    }
  },
  async (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle global error responses
authenticatedAxiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      console.error("Unauthorized access. Logging out...");

      // Remove tokens and institute ID
      await removeTokensAndInstituteId();

      // Optionally, you can add logic to redirect to login page
      // This might involve using a navigation library or window.location
    }
    return Promise.reject(error);
  }
);

export default authenticatedAxiosInstance;
