package vacademy.io.admin_core_service.features.enrollment_policy.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.enroll_invite.enums.SubOrgRoles;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Collections;
import java.util.List;

/**
 * Service for finding admin users in sub-organizations.
 * For payment-related operations, only ROOT_ADMIN is used.
 * For general notifications, all ADMIN roles can be used.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgAdminService {

    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final AuthService authService;

    /**
     * Gets the ROOT_ADMIN user for a sub-org in a specific package session.
     * ROOT_ADMIN is the only user who handles payments and payment-related
     * notifications.
     * 
     * @param subOrgId         Sub-organization ID
     * @param packageSessionId Package session ID
     * @return ROOT_ADMIN UserDTO
     * @throws VacademyException if no ROOT_ADMIN found
     */
    public UserDTO getRootAdminForSubOrg(String subOrgId, String packageSessionId) {
        if (!StringUtils.hasText(subOrgId)) {
            log.warn("Sub-org ID is empty, cannot find ROOT_ADMIN");
            throw new VacademyException("Sub-organization ID is required");
        }

        if (!StringUtils.hasText(packageSessionId)) {
            log.warn("Package session ID is empty, cannot find ROOT_ADMIN");
            throw new VacademyException("Package session ID is required");
        }

        log.info("Finding ROOT_ADMIN user for sub-org: {} in package session: {}", subOrgId, packageSessionId);

        // Find ROOT_ADMIN user IDs (case-insensitive role matching)
        List<String> rootAdminUserIds = mappingRepository.findAdminUserIdsForSubOrg(
                subOrgId,
                packageSessionId,
                SubOrgRoles.ROOT_ADMIN.name());

        if (CollectionUtils.isEmpty(rootAdminUserIds)) {
            log.warn("No active ROOT_ADMIN found for sub-org: {} in package session: {}", subOrgId, packageSessionId);
            throw new VacademyException("No active ROOT_ADMIN found for sub-organization");
        }

        // Get the first ROOT_ADMIN (there should typically be only one)
        String rootAdminUserId = rootAdminUserIds.get(0);
        log.info("Found ROOT_ADMIN user ID: {} for sub-org: {}", rootAdminUserId, subOrgId);

        // Fetch user details from auth service
        try {
            List<UserDTO> rootAdmins = authService.getUsersFromAuthServiceByUserIds(List.of(rootAdminUserId));
            if (CollectionUtils.isEmpty(rootAdmins)) {
                throw new VacademyException("ROOT_ADMIN user details not found");
            }
            log.info("Retrieved ROOT_ADMIN user details for sub-org: {}", subOrgId);
            return rootAdmins.get(0);
        } catch (Exception e) {
            log.error("Error fetching ROOT_ADMIN user details from auth service for sub-org: {}", subOrgId, e);
            throw new VacademyException("Failed to retrieve ROOT_ADMIN user details: " + e.getMessage());
        }
    }

    /**
     * Gets all active admin users for a sub-org in a specific package session.
     * This includes both ADMIN and ROOT_ADMIN roles.
     * Used for general notifications (not payment-related).
     *
     * @param subOrgId         Sub-organization ID
     * @param packageSessionId Package session ID
     * @return List of admin UserDTOs
     * @throws VacademyException if no admins found
     */
    public List<UserDTO> getActiveAdminsForSubOrg(String subOrgId, String packageSessionId) {
        if (!StringUtils.hasText(subOrgId)) {
            log.warn("Sub-org ID is empty, cannot find admins");
            throw new VacademyException("Sub-organization ID is required");
        }

        if (!StringUtils.hasText(packageSessionId)) {
            log.warn("Package session ID is empty, cannot find admins");
            throw new VacademyException("Package session ID is required");
        }

        log.info("Finding admin users for sub-org: {} in package session: {}", subOrgId, packageSessionId);

        // Find admin user IDs (case-insensitive role matching)
        List<String> adminUserIds = mappingRepository.findAdminUserIdsForSubOrg(
                subOrgId,
                packageSessionId,
                SubOrgRoles.ADMIN.name());

        if (CollectionUtils.isEmpty(adminUserIds)) {
            log.warn("No active admins found for sub-org: {} in package session: {}", subOrgId, packageSessionId);
            throw new VacademyException("No active admins found for sub-organization");
        }

        log.info("Found {} admin user IDs for sub-org: {}", adminUserIds.size(), subOrgId);

        // Fetch user details from auth service
        try {
            List<UserDTO> admins = authService.getUsersFromAuthServiceByUserIds(adminUserIds);
            log.info("Retrieved {} admin user details for sub-org: {}", admins.size(), subOrgId);
            return admins;
        } catch (Exception e) {
            log.error("Error fetching admin user details from auth service for sub-org: {}", subOrgId, e);
            throw new VacademyException("Failed to retrieve admin user details: " + e.getMessage());
        }
    }

    /**
     * Gets all active admin user IDs for a sub-org (without fetching full user
     * details).
     * Useful when only IDs are needed.
     *
     * @param subOrgId         Sub-organization ID
     * @param packageSessionId Package session ID
     * @return List of admin user IDs
     */
    public List<String> getActiveAdminUserIdsForSubOrg(String subOrgId, String packageSessionId) {
        if (!StringUtils.hasText(subOrgId) || !StringUtils.hasText(packageSessionId)) {
            return Collections.emptyList();
        }

        return mappingRepository.findAdminUserIdsForSubOrg(subOrgId, packageSessionId, "ADMIN");
    }
}
