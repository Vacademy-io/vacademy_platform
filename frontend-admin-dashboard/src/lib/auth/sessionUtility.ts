import axios, { type AxiosResponse } from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { REFRESH_TOKEN_URL } from "@/constants/urls";
import { UnauthorizedResponse } from "@/constants/auth/unauthorizeresponse";
import { IAccessToken, TokenKey, Tokens } from "@/constants/auth/tokens";
import { isNullOrEmptyOrUndefined } from "../utils";

const getTokenFromCookie = (tokenKey: string) => {
    return Cookies.get(tokenKey) ?? null;
};

const setAuthorizationCookie = (key: string, token: string) => {
    Cookies.set(key, token);
};

const isTokenExpired = (token: string | null) => {
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

const getTokenDecodedData = (token: string | null) => {
    if (isNullOrEmptyOrUndefined(token)) {
        return;
    }
    const tokenData: IAccessToken = jwtDecode(token);
    return tokenData;
};

async function refreshTokens(refreshToken: string): Promise<UnauthorizedResponse | Tokens> {
    const response: AxiosResponse<Tokens> = await axios({
        method: "GET",
        url: REFRESH_TOKEN_URL,
        params: { token: refreshToken },
    });
    setAuthorizationCookie(TokenKey.accessToken, response.data?.accessToken);
    return response.data;
}

const removeCookiesAndLogout = () => {
    // Remove tokens
    Cookies.remove(TokenKey.accessToken);
    Cookies.remove(TokenKey.refreshToken);
};

export {
    refreshTokens,
    removeCookiesAndLogout,
    setAuthorizationCookie,
    getTokenFromCookie,
    isTokenExpired,
    getTokenDecodedData,
};
