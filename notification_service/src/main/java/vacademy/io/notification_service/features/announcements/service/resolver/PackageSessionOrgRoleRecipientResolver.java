package vacademy.io.notification_service.features.announcements.service.resolver;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.notification_service.features.announcements.client.AdminCoreServiceClient;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Resolves PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES type recipients
 * Handles large datasets by fetching users in batches
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PackageSessionOrgRoleRecipientResolver implements RecipientResolver {

    private final AdminCoreServiceClient adminCoreServiceClient;

    @Override
    public Set<String> resolve(String recipientId, String instituteId) {
        log.debug("Resolving package session org roles: {} for institute: {}", recipientId, instituteId);

        try {
            // Parse recipientId format: "packageSessionId:comma_separated_org_roles"
            String[] parts = recipientId.split(":");
            if (parts.length != 2) {
                log.warn("Invalid recipientId format for PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES: {}", recipientId);
                return new HashSet<>();
            }

            String packageSessionId = parts[0];
            String commaSeparatedOrgRoles = parts[1];

            if (packageSessionId == null || packageSessionId.isBlank() ||
                commaSeparatedOrgRoles == null || commaSeparatedOrgRoles.isBlank()) {
                log.warn("Missing packageSessionId or orgRoles in recipientId: {}", recipientId);
                return new HashSet<>();
            }

            log.debug("Extracted packageSessionId: {}, orgRoles: {}", packageSessionId, commaSeparatedOrgRoles);

            // Call admin-core-service to get users by package session and org roles (with pagination)
            List<String> userIds = adminCoreServiceClient.getUsersByPackageSessionAndOrgRoles(
                    packageSessionId,
                    commaSeparatedOrgRoles
            );

            Set<String> userIdSet = new HashSet<>(userIds);
            log.info("Resolved PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES to {} users for packageSession: {} with roles: {}",
                    userIdSet.size(), packageSessionId, commaSeparatedOrgRoles);
            return userIdSet;

        } catch (Exception e) {
            log.error("Error resolving PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES recipient: {}", recipientId, e);
            return new HashSet<>();
        }
    }

    @Override
    public boolean canResolve(String recipientType) {
        return "PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES".equals(recipientType);
    }
}
