package vacademy.io.admin_core_service.features.app_status.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.app_status.client.CommunityAppRegistryClient;
import vacademy.io.admin_core_service.features.app_status.dto.AppStatusResponse;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AppStatusService {

    private static final String ROLE_NAME_ADMIN = "ADMIN";

    private final CommunityAppRegistryClient communityAppRegistryClient;
    private final InstituteRepository instituteRepository;
    private final UserRoleRepository userRoleRepository;

    public AppStatusResponse getStatus(CustomUserDetails user, String instituteId) {
        assertInstituteAccess(user, instituteId);

        List<AppStatusResponse.RegisteredApp> apps = new ArrayList<>();
        for (JsonNode record : communityAppRegistryClient.fetchByInstitute(instituteId)) {
            apps.add(toRegisteredApp(record));
        }

        return AppStatusResponse.builder()
                .instituteId(instituteId)
                .apps(apps)
                .build();
    }

    private AppStatusResponse.RegisteredApp toRegisteredApp(JsonNode record) {
        JsonNode basics = record.path("basics");

        List<AppStatusResponse.PlatformStatus> platforms = new ArrayList<>();
        JsonNode platformsNode = record.path("platforms");
        platformsNode.fieldNames().forEachRemaining(platformKey -> {
            JsonNode p = platformsNode.path(platformKey);
            // An institute admin only cares about platforms actually turned on for this app —
            // a disabled platform is registry bookkeeping, not something to show as "status".
            if (!p.path("enabled").asBoolean(false)) {
                return;
            }
            platforms.add(AppStatusResponse.PlatformStatus.builder()
                    .platform(platformKey)
                    .enabled(true)
                    .status(textOrDefault(p, "status", "NOT_REGISTERED"))
                    .storeUrl(textOrDefault(p, "storeUrl", ""))
                    .currentVersion(textOrDefault(p, "currentVersion", ""))
                    .currentBuild(textOrDefault(p, "currentBuild", ""))
                    .releasedAt(textOrDefault(p, "releasedAt", ""))
                    .lastSyncedAt(textOrDefault(p, "lastSyncedAt", ""))
                    .build());
        });

        return AppStatusResponse.RegisteredApp.builder()
                .id(textOrDefault(record, "id", ""))
                .name(textOrDefault(basics, "name", ""))
                .displayName(textOrDefault(basics, "displayName", ""))
                .packageName(textOrDefault(basics, "packageName", ""))
                .platforms(platforms)
                .build();
    }

    private static String textOrDefault(JsonNode node, String field, String fallback) {
        if (node == null) return fallback;
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? fallback : value.asText(fallback);
    }

    /**
     * Same three-tier check as WhiteLabelService#assertInstituteAccess (root bypass → user_role
     * ADMIN row → legacy staff-table fallback) — duplicated rather than shared because
     * WhiteLabelService keeps it private, and this endpoint has the identical authorization
     * requirement: only that institute's admins (or a root user) may read its data.
     */
    private void assertInstituteAccess(CustomUserDetails user, String instituteId) {
        if (user == null) {
            throw new VacademyException("Access denied: no authenticated user");
        }

        if (user.isRootUser()) {
            return;
        }

        if (userRoleRepository.existsByUserIdAndInstituteIdAndRoleName(
                user.getUserId(), instituteId, ROLE_NAME_ADMIN)) {
            return;
        }

        boolean isStaff = instituteRepository.findInstitutesByUserId(user.getUserId())
                .stream()
                .anyMatch(i -> i.getId().equals(instituteId));
        if (!isStaff) {
            log.warn("[AppStatus] Unauthorized attempt by userId={} on instituteId={}",
                    user.getUserId(), instituteId);
            throw new VacademyException("Access denied: you are not a member of institute " + instituteId);
        }
    }
}
