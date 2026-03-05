import { getInstituteId } from '@/constants/helper';
import { toast } from 'sonner';
import {
    setAuthorizationCookie,
    getUserRoles,
    removeCookiesAndLogout,
} from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import {
    shouldBlockStudentLogin,
    getInstituteSelectionResult,
    setSelectedInstitute,
    getPrimaryRole,
    getInstitutesFromToken,
} from '@/lib/auth/instituteUtils';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { trackEvent, identifyUser } from '@/lib/amplitude';
import { getDisplaySettingsFromCache, getDisplaySettings } from '@/services/display-settings';
import {
    ADMIN_DISPLAY_SETTINGS_KEY,
    TEACHER_DISPLAY_SETTINGS_KEY, CUSTOM_ROLE_DISPLAY_SETTINGS_KEY,
    type DisplaySettingsData,
} from '@/types/display-settings';
import type { QueryClient } from '@tanstack/react-query';
import { getCachedInstituteBranding } from '@/services/domain-routing';
import { getCourseSettings } from '@/services/course-settings';
import {
    hasFacultyAssignedPermission,
    fetchUserAccessDetails,
    processAccessMappings,
    saveFacultyAccessData,
} from '@/lib/auth/facultyAccessUtils';
import type { SubOrgAccess } from '@/types/faculty-access';

export interface LoginFlowResult {
    success: boolean;
    shouldShowInstituteSelection?: boolean;
    shouldShowSubOrgSelection?: boolean;
    subOrgs?: SubOrgAccess[];
    redirectUrl?: string;
    error?: string;
    userRoles?: string[];
    primaryRole?: string;
    hasStudentRole?: boolean;
    hasAdminRole?: boolean;
}

export interface LoginFlowOptions {
    loginMethod:
    | 'username_password'
    | 'oauth'
    | 'email_otp'
    | 'sso'
    | 'demo_account'
    | 'signup'
    | 'cookie_token';
    accessToken: string;
    refreshToken: string;
    queryClient?: Pick<QueryClient, 'clear'>;
}

/**
 * Centralized login flow handler for all authentication methods
 * Handles role checking, institute selection, and redirection logic
 */
export const handleLoginFlow = async (options: LoginFlowOptions): Promise<LoginFlowResult> => {
    const { loginMethod, accessToken, refreshToken, queryClient } = options;

    try {
        // Set tokens in cookies
        setAuthorizationCookie(TokenKey.accessToken, accessToken);
        setAuthorizationCookie(TokenKey.refreshToken, refreshToken);

        // Small delay to allow token propagation to backend
        // This helps avoid 403 errors on the first authenticated API call
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Clear queries if queryClient is provided
        if (queryClient) {
            queryClient.clear();
        }

        // Identify user to Amplitude
        const { getTokenDecodedData } = await import('@/lib/auth/sessionUtility');
        const tokenData = getTokenDecodedData(accessToken);

        try {
            const userId = tokenData?.user as string | undefined;
            if (userId) {
                identifyUser(userId, {
                    login_method: loginMethod,
                    email: tokenData?.email ?? null,
                    username: tokenData?.username ?? null,
                });
            }
        } catch {
            // noop: analytics should not block login flow
        }

        // Get user roles from token
        const userRoles = getUserRoles(accessToken);

        // Check domain-specific role restrictions
        const cachedBranding = getCachedInstituteBranding();
        if (cachedBranding?.role === 'ADMIN') {
            // Domain requires ADMIN role - check if user has ADMIN role
            const hasAdminRole = userRoles.includes('ADMIN');

            if (!hasAdminRole) {
                // Track blocked login attempt
                trackEvent('Login Blocked', {
                    login_method: loginMethod,
                    reason: 'admin_role_required',
                    user_roles: userRoles,
                    required_role: 'ADMIN',
                    timestamp: new Date().toISOString(),
                });

                // Clear tokens and show error
                removeCookiesAndLogout();

                toast.error('Access Denied', {
                    description:
                        'This portal requires ADMIN privileges. Please contact your administrator.',
                    className: 'error-toast',
                    duration: 5000,
                });

                return {
                    success: false,
                    error: 'admin_role_required',
                    userRoles,
                };
            }
        }

        // Check if user should be blocked (only has STUDENT role)
        if (shouldBlockStudentLogin()) {
            // Track blocked login attempt
            trackEvent('Login Blocked', {
                login_method: loginMethod,
                reason: 'student_only_role',
                user_roles: userRoles,
                timestamp: new Date().toISOString(),
            });

            // Clear tokens and show error
            removeCookiesAndLogout();

            toast.error('Access Denied', {
                description:
                    'Students are not allowed to access the admin portal. Please contact your administrator.',
                className: 'error-toast',
                duration: 5000,
            });

            return {
                success: false,
                error: 'student_access_denied',
                userRoles,
            };
        }

        // Check institute selection requirements
        const instituteResult = getInstituteSelectionResult();

        if (instituteResult.shouldShowSelection) {
            // User needs to select an institute
            return {
                success: true,
                shouldShowInstituteSelection: true,
                userRoles,
            };
        }

        // User has only one institute or no valid institutes
        if (instituteResult.selectedInstitute) {
            const primaryRole = getPrimaryRole(instituteResult.selectedInstitute.roles);
            const hasStudentRole = instituteResult.selectedInstitute.roles.includes('STUDENT');
            const hasAdminRole = instituteResult.selectedInstitute.roles.includes('ADMIN');

            // Set the selected institute
            const instituteId = instituteResult.selectedInstitute.id;
            setSelectedInstitute(instituteId);

            // Faculty Access Check
            if (hasFacultyAssignedPermission(instituteId)) {
                try {
                    const userId = tokenData?.user as string;
                    if (userId) {
                        const accessDetails = await fetchUserAccessDetails(userId, instituteId);
                        const processed = processAccessMappings(accessDetails.accessMappings);

                        if (processed.subOrgs.length > 1) {
                            saveFacultyAccessData({
                                subOrgs: processed.subOrgs,
                                selectedSubOrgId: null,
                                globalPackageIds: processed.globalPackageIds,
                                globalPackageSessionIds: processed.globalPackageSessionIds,
                                permissions: processed.permissions,
                            });
                            return {
                                success: true,
                                shouldShowSubOrgSelection: true,
                                subOrgs: processed.subOrgs,
                                userRoles,
                            };
                        } else if (processed.subOrgs.length === 1 && processed.subOrgs[0]) {
                            saveFacultyAccessData({
                                subOrgs: processed.subOrgs,
                                selectedSubOrgId: processed.subOrgs[0].subOrgId,
                                globalPackageIds: processed.globalPackageIds,
                                globalPackageSessionIds: processed.globalPackageSessionIds,
                                permissions: processed.permissions,
                            });
                        } else {
                            // No sub-orgs found, but might have global filters
                            saveFacultyAccessData({
                                subOrgs: processed.subOrgs,
                                selectedSubOrgId: null,
                                globalPackageIds: processed.globalPackageIds,
                                globalPackageSessionIds: processed.globalPackageSessionIds,
                                permissions: processed.permissions,
                            });
                        }
                    }
                } catch (error) {
                    console.error('Faculty access initialization failed:', error);
                    // Continue with normal flow if faculty access check fails
                }
            }

            // Refresh settings caches for this institute (non-blocking for course settings)
            void getCourseSettings(true).catch(() => { });

            // Determine redirect URL from Display Settings - fetch the correct role settings first
            const hasFaculty = hasFacultyAssignedPermission(instituteId);
            let roleKey: string = hasAdminRole ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;

            if (!hasAdminRole && hasFaculty) {
                roleKey = CUSTOM_ROLE_DISPLAY_SETTINGS_KEY;
                try {
                    const { getAllRoles } = await import('@/routes/manage-custom-teams/-services/custom-team-services');
                    const customRoles = await getAllRoles();
                    const matchedRole = customRoles?.find((cr: any) =>
                        instituteResult.selectedInstitute?.roles.some(role => role.toUpperCase() === cr.name.toUpperCase())
                    );
                    if (matchedRole) {
                        roleKey = `${CUSTOM_ROLE_DISPLAY_SETTINGS_KEY}_${matchedRole.id}`;
                    }
                } catch (err) {
                    console.error('Failed to map custom role for display settings', err);
                }
            }

            // Save the determined role key so other components can access it synchronously
            localStorage.setItem('ACTIVE_ROLE_DISPLAY_SETTINGS_KEY', roleKey);

            // Use cache-first approach for display settings to avoid blocking login
            // First try to use cached settings for immediate redirect
            let ds: DisplaySettingsData | null = getDisplaySettingsFromCache(roleKey);

            if (ds) {
                console.log(
                    '🔍 LOGIN DEBUG: Using cached display settings for immediate redirect:',
                    {
                        roleKey,
                        postLoginRedirectRoute: ds?.postLoginRedirectRoute,
                    }
                );
                // Trigger background refresh (non-blocking)
                void getDisplaySettings(roleKey, true).catch(() => { });
            } else {
                // No cache available, need to fetch with reduced retry delay
                const maxRetries = 3;
                let retryCount = 0;

                while (retryCount < maxRetries && !ds) {
                    try {
                        console.log(
                            `🔍 LOGIN DEBUG: Fetching display settings for role: ${roleKey} (attempt ${retryCount + 1}/${maxRetries})`
                        );
                        ds = await getDisplaySettings(roleKey, true);
                        console.log('🔍 LOGIN DEBUG: Display settings fetched successfully:', {
                            roleKey,
                            postLoginRedirectRoute: ds?.postLoginRedirectRoute,
                            attempt: retryCount + 1,
                        });
                        break; // Success, exit retry loop
                    } catch (error) {
                        retryCount++;
                        const errorStatus = (error as { response?: { status?: number } })?.response
                            ?.status;
                        console.warn(
                            `🔍 LOGIN DEBUG: Failed to fetch display settings (attempt ${retryCount}/${maxRetries}) [Status: ${errorStatus}]:`,
                            error
                        );

                        if (retryCount >= maxRetries) {
                            // Final attempt failed, use defaults
                            console.log(
                                '🔍 LOGIN DEBUG: All retries failed, using default redirect'
                            );
                            break;
                        } else {
                            // Wait before retry (reduced exponential backoff: 200ms, 400ms, 800ms)
                            const delay = Math.pow(2, retryCount - 1) * 200;
                            console.log(`🔍 LOGIN DEBUG: Retrying in ${delay}ms...`);
                            await new Promise((resolve) => setTimeout(resolve, delay));
                        }
                    }
                }
            }

            let redirectUrl = ds?.postLoginRedirectRoute || '/dashboard';
            console.log('🔍 LOGIN DEBUG: Determined redirect URL:', {
                postLoginRedirectRoute: ds?.postLoginRedirectRoute,
                finalRedirectUrl: redirectUrl,
                roleKey,
                hasAdminRole,
            });

            // Prefer afterLoginRoute from domain resolve if available
            const cachedBrandingOverride = getCachedInstituteBranding(instituteResult.selectedInstitute.id);
            console.log('🔍 LOGIN DEBUG: Checking domain branding override:', {
                domainBranding: cachedBrandingOverride,
                afterLoginRoute: cachedBrandingOverride?.afterLoginRoute,
                willOverride: !!cachedBrandingOverride?.afterLoginRoute,
            });
            if (cachedBrandingOverride?.afterLoginRoute) {
                console.log('🔍 LOGIN DEBUG: OVERRIDING redirect URL with domain branding:', {
                    originalUrl: redirectUrl,
                    newUrl: cachedBrandingOverride.afterLoginRoute,
                });
                redirectUrl = cachedBrandingOverride.afterLoginRoute;
            }

            if (hasFacultyAssignedPermission(instituteId)) {
                redirectUrl = '/study-library/courses';
            }

            return {
                success: true,
                redirectUrl,
                userRoles,
                primaryRole,
                hasStudentRole,
                hasAdminRole,
            };
        }

        // Fallback - navigate to dashboard or afterLoginRoute
        console.log('🔍 LOGIN DEBUG: Using fallback redirect logic (no selected institute)');
        const fallbackCachedResult = getCachedInstituteBranding(); // Fallback might not have an ID context readily available unless we guess
        const fallbackUrl = fallbackCachedResult?.afterLoginRoute || '/dashboard';
        console.log('🔍 LOGIN DEBUG: Fallback redirect URL:', {
            domainAfterLoginRoute: fallbackCachedResult?.afterLoginRoute,
            finalFallbackUrl: fallbackUrl,
        });
        return {
            success: true,
            redirectUrl: fallbackUrl,
            userRoles,
        };
    } catch (error) {
        trackEvent('Login Failed', {
            login_method: loginMethod,
            error_reason: 'login_flow_error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        });

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Login flow failed',
        };
    }
};

/**
 * Handle institute selection and redirect accordingly
 */
export const handleInstituteSelection = async (instituteId: string): Promise<LoginFlowResult> => {
    try {
        const institutes = getInstitutesFromToken();
        const selectedInstitute = institutes.find((inst) => inst.id === instituteId);

        if (!selectedInstitute) {
            return {
                success: false,
                error: 'Institute not found',
            };
        }

        const primaryRole = getPrimaryRole(selectedInstitute.roles);
        const hasStudentRole = selectedInstitute.roles.includes('STUDENT');
        const hasAdminRole = selectedInstitute.roles.includes('ADMIN');
        const userRoles = getUserRoles(getTokenFromCookie(TokenKey.accessToken));

        // Check domain-specific role restrictions
        const cachedBranding = getCachedInstituteBranding(instituteId);
        if (cachedBranding?.role === 'ADMIN') {
            // Domain requires ADMIN role - check if user has ADMIN role
            if (!hasAdminRole) {
                // Track blocked login attempt
                trackEvent('Login Blocked', {
                    login_method: 'institute_selection',
                    reason: 'admin_role_required',
                    user_roles: userRoles,
                    required_role: 'ADMIN',
                    institute_id: instituteId,
                    timestamp: new Date().toISOString(),
                });

                return {
                    success: false,
                    error: 'admin_role_required',
                    userRoles,
                };
            }
        }

        // Set the selected institute
        setSelectedInstitute(instituteId);

        // Faculty Access Check
        try {
            if (hasFacultyAssignedPermission(instituteId)) {
                const accessToken = getTokenFromCookie(TokenKey.accessToken);
                const { getTokenDecodedData } = await import('@/lib/auth/sessionUtility');
                const tData = getTokenDecodedData(accessToken);

                if (tData?.user) {
                    const accessDetails = await fetchUserAccessDetails(tData.user as string, instituteId);
                    const processed = processAccessMappings(accessDetails.accessMappings);

                    if (processed.subOrgs.length > 1) {
                        saveFacultyAccessData({
                            subOrgs: processed.subOrgs,
                            selectedSubOrgId: null,
                            globalPackageIds: processed.globalPackageIds,
                            globalPackageSessionIds: processed.globalPackageSessionIds,
                            permissions: processed.permissions,
                        });
                        return {
                            success: true,
                            shouldShowSubOrgSelection: true,
                            subOrgs: processed.subOrgs,
                            userRoles,
                        };
                    } else if (processed.subOrgs.length === 1 && processed.subOrgs[0]) {
                        saveFacultyAccessData({
                            subOrgs: processed.subOrgs,
                            selectedSubOrgId: processed.subOrgs[0].subOrgId,
                            globalPackageIds: processed.globalPackageIds,
                            globalPackageSessionIds: processed.globalPackageSessionIds,
                            permissions: processed.permissions,
                        });
                    } else {
                        // No sub-orgs found, but might have global filters
                        saveFacultyAccessData({
                            subOrgs: processed.subOrgs,
                            selectedSubOrgId: null,
                            globalPackageIds: processed.globalPackageIds,
                            globalPackageSessionIds: processed.globalPackageSessionIds,
                            permissions: processed.permissions,
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Faculty access initialization failed in institute selection:', error);
        }

        // Refresh settings caches for this institute (non-blocking for course settings)
        void getCourseSettings(true).catch(() => { });

        // Determine redirect URL from Display Settings - fetch the correct role settings first
        let roleKey: string = hasAdminRole ? ADMIN_DISPLAY_SETTINGS_KEY : TEACHER_DISPLAY_SETTINGS_KEY;
        const hasFaculty = hasFacultyAssignedPermission(instituteId);

        if (!hasAdminRole && hasFaculty) {
            roleKey = CUSTOM_ROLE_DISPLAY_SETTINGS_KEY;
            try {
                const { getAllRoles } = await import('@/routes/manage-custom-teams/-services/custom-team-services');
                const customRoles = await getAllRoles();
                const matchedRole = customRoles?.find((cr: any) => selectedInstitute?.roles.includes(cr.name));
                if (matchedRole) {
                    roleKey = `${CUSTOM_ROLE_DISPLAY_SETTINGS_KEY}_${matchedRole.id}`;
                }
            } catch (err) {
                console.error('Failed to map custom role for display settings', err);
            }
        }

        // Save the determined role key so other components can access it synchronously
        localStorage.setItem('ACTIVE_ROLE_DISPLAY_SETTINGS_KEY', roleKey);

        // Use cache-first approach for display settings to avoid blocking
        let ds: DisplaySettingsData | null = getDisplaySettingsFromCache(roleKey);

        if (ds) {
            console.log(
                '🔍 INSTITUTE DEBUG: Using cached display settings for immediate redirect:',
                {
                    roleKey,
                    postLoginRedirectRoute: ds?.postLoginRedirectRoute,
                }
            );
            // Trigger background refresh (non-blocking)
            void getDisplaySettings(roleKey, true).catch(() => { });
        } else {
            // No cache available, need to fetch with reduced retry delay
            const maxRetries = 3;
            let retryCount = 0;

            while (retryCount < maxRetries && !ds) {
                try {
                    console.log(
                        `🔍 INSTITUTE DEBUG: Fetching display settings for role: ${roleKey} (attempt ${retryCount + 1}/${maxRetries})`
                    );
                    ds = await getDisplaySettings(roleKey, true);
                    console.log('🔍 INSTITUTE DEBUG: Display settings fetched successfully:', {
                        roleKey,
                        postLoginRedirectRoute: ds?.postLoginRedirectRoute,
                        attempt: retryCount + 1,
                    });
                    break; // Success, exit retry loop
                } catch (error) {
                    retryCount++;
                    console.warn(
                        `🔍 INSTITUTE DEBUG: Failed to fetch display settings (attempt ${retryCount}/${maxRetries}):`,
                        error
                    );

                    if (retryCount >= maxRetries) {
                        // Final attempt failed, use defaults
                        console.log(
                            '🔍 INSTITUTE DEBUG: All retries failed, using default redirect'
                        );
                        break;
                    } else {
                        // Wait before retry (reduced exponential backoff: 200ms, 400ms, 800ms)
                        const delay = Math.pow(2, retryCount - 1) * 200;
                        console.log(`🔍 INSTITUTE DEBUG: Retrying in ${delay}ms...`);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                    }
                }
            }
        }

        let redirectUrl = ds?.postLoginRedirectRoute || '/dashboard';

        // Prefer afterLoginRoute from domain resolve if available
        const cached = getCachedInstituteBranding(instituteId);
        if (cached?.afterLoginRoute) {
            redirectUrl = cached.afterLoginRoute;
        }

        if (hasFacultyAssignedPermission(instituteId)) {
            redirectUrl = '/study-library/courses';
        }

        // Preserve learner tab hint if user also has STUDENT role and route points to dashboard
        if (
            hasStudentRole &&
            selectedInstitute.roles.length > 1 &&
            (redirectUrl === '/dashboard' || redirectUrl.startsWith('/dashboard?'))
        ) {
            redirectUrl = '/dashboard?showLearnerTab=true';
        }

        return {
            success: true,
            redirectUrl,
            userRoles,
            primaryRole,
            hasStudentRole,
            hasAdminRole,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Institute selection failed',
        };
    }
};

/**
 * Navigate to the appropriate URL based on login flow result
 */
export const navigateFromLoginFlow = (result: LoginFlowResult): void => {
    if (!result.success) {
        return;
    }

    if (result.shouldShowInstituteSelection) {
        // Redirect to institute selection page
        window.location.href = '/login?showInstituteSelection=true';
        return;
    }

    if (result.shouldShowSubOrgSelection) {
        // Redirect to sub-org selection page
        window.location.href = '/login?showSubOrgSelection=true';
        return;
    }

    if (result.redirectUrl) {
        // Navigate to the determined URL
        window.location.href = result.redirectUrl;
        return;
    }

    // Fallback to dashboard
    window.location.href = '/dashboard';
};
