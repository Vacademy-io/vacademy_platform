import axios, { type AxiosResponse } from "axios";
import { Storage } from "@capacitor/storage";
import { jwtDecode } from "jwt-decode";
import { REFRESH_TOKEN_URL } from "@/constants/urls";
import { UnauthorizedResponse } from "@/constants/auth/unauthorizeresponse";
import { IAccessToken, TokenKey, Tokens } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "../utils";

// Helper function to get a token from Capacitor Storage
const getTokenFromStorage = async (
  tokenKey: string
): Promise<string | null> => {
  const { value } = await Storage.get({ key: tokenKey });
  return value; // Directly return the value without JSON parsing
};

// Helper function to set a token in Capacitor Storage
const setTokenInStorage = async (key: string, token: string): Promise<void> => {
  await Storage.set({
    key,
    value: token, // Directly store the token without stringifying
  });
};

// Helper function to remove a token from Capacitor Storage
const removeTokenFromStorage = async (key: string): Promise<void> => {
  await Storage.remove({ key });
};

// function to store institute ID in Capacitor Storage
// const setInstituteIdInStorage = async (instituteId: string): Promise<void> => {
//     await Storage.set({
//         key: 'instituteId',
//         value: instituteId,
//     });
// };

// function to get institute ID from Capacitor Storage
// const getInstituteIdFromStorage = async (tokenKey: string): Promise<string | null> => {
//     const { value } = await Storage.get({ key: 'instituteId' });
//     return value;
// };

// Helper function to get a token from Capacitor Storage
const getInstituteIdFromStorage = async (
  tokenKey: string
): Promise<string | null> => {
  const { value } = await Storage.get({ key: tokenKey });
  return value; // Directly return the value without JSON parsing
};

// Helper function to set a token in Capacitor Storage
const setInstituteIdInStorage = async (
  key: string,
  token: string
): Promise<void> => {
  await Storage.set({
    key,
    value: token, // Directly store the token without stringifying
  });
};

// function to remove institute ID from Capacitor Storage
const removeInstituteIdFromStorage = async (): Promise<void> => {
  await Storage.remove({ key: "instituteId" });
};

// Check if a token is expired
const isTokenExpired = (token: string | null): boolean => {
  if (isNullOrEmptyOrUndefined(token)) {
    return true;
  }

  const tokenData = jwtDecode(token);

  if (!isNullOrEmptyOrUndefined(tokenData.exp)) {
    const expirationTime = new Date(tokenData.exp * 1000); // Convert seconds to milliseconds
    return expirationTime <= new Date(); // Check if expiration time is less than or equal to current time
  } else {
    // Expiration time not found in token, consider it expired
    return true;
  }
};

// Decode token data
const getTokenDecodedData = (
  token: string | null
): IAccessToken | undefined => {
  if (isNullOrEmptyOrUndefined(token)) {
    return {
      user: "",
      email: "",
      is_root_user: false,
      authorities: {},
      username: "",
      sub: "",
      iat: 0,
      exp: 0,
    };
  }
  const tokenData: IAccessToken = jwtDecode(token);
  return tokenData;
};

// Refresh tokens
async function refreshTokens(
  refreshToken: string
): Promise<UnauthorizedResponse | Tokens> {
  const response: AxiosResponse<Tokens> = await axios({
    method: "GET",
    url: REFRESH_TOKEN_URL,
    params: { token: refreshToken },
  });

  // Store the new tokens in Capacitor Storage
  await setTokenInStorage(TokenKey.accessToken, response.data?.accessToken);
  await setTokenInStorage(TokenKey.refreshToken, response.data?.refreshToken);

  return response.data;
}

// Remove tokens from storage and log out
const removeTokensAndLogout = async (): Promise<void> => {
    // Remove tokens
    await removeTokenFromStorage(TokenKey.accessToken);
    await removeTokenFromStorage(TokenKey.refreshToken);
    
    // Remove institute ID
    await removeInstituteIdFromStorage();
    // remove all the items from storage
    await Storage.clear();

    // Redirect to login or handle logout logic
    console.log("User logged out.");
};

// Get access token from storage
export const getAccessToken = async () => {
  const { value } = await Storage.get({ key: "accessToken" });
  return value;
};

// Get refresh token from storage
export const getRefreshToken = async () => {
  const { value } = await Storage.get({ key: "refreshToken" });
  return value;
};

export {
  refreshTokens,
  removeTokensAndLogout,
  setTokenInStorage,
  getTokenFromStorage,
  isTokenExpired,
  getTokenDecodedData,
  // exports for institute ID management
  setInstituteIdInStorage,
  getInstituteIdFromStorage,
  removeInstituteIdFromStorage,
};
