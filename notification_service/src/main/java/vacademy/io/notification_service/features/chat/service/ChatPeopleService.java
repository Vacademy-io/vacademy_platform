package vacademy.io.notification_service.features.chat.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.dto.PagedUserWithRolesResponse;
import vacademy.io.common.auth.dto.UserRoleDTO;
import vacademy.io.common.auth.dto.UserWithRolesDTO;
import vacademy.io.notification_service.features.announcements.client.AuthServiceClient;
import vacademy.io.notification_service.features.chat.dto.ChatPeopleSearchResponse;
import vacademy.io.notification_service.features.chat.dto.ChatPersonResponse;
import vacademy.io.notification_service.features.chat.dto.PeopleSearchRequest;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * "Find people to message", gated by the institute DM role-to-role matrix. The caller only ever sees
 * roles they are permitted to DM. The actual search + pagination is pushed to auth-service
 * (server-side LIKE on name/email/mobile, role-filtered) so we never pull the whole institute.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatPeopleService {

    private final AuthServiceClient authServiceClient;
    private final ChatPermissionService permissionService;

    private static final List<String> CANONICAL_ROLES = List.of("student", "teacher", "admin");

    public ChatPeopleSearchResponse search(String instituteId, String callerId, String callerRole,
                                           PeopleSearchRequest req, String authHeader, String clientId) {
        if (!permissionService.isChatEnabled(instituteId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "CHAT_DISABLED");
        }

        List<String> requested = req.getRoles() == null ? List.of()
                : req.getRoles().stream().map(ChatPermissionService::normalizeRole).toList();

        // Allowed target roles = matrix-permitted ∩ (requested, if any).
        List<String> targetRoles = new ArrayList<>();
        for (String role : CANONICAL_ROLES) {
            if (!requested.isEmpty() && !requested.contains(role)) continue;
            if (permissionService.canDirectMessage(instituteId, callerRole, role)) {
                targetRoles.add(role);
            }
        }

        int pageNumber = Math.max(0, req.getPageNumber());
        int pageSize = req.getPageSize() <= 0 ? 20 : req.getPageSize();
        if (targetRoles.isEmpty()) {
            return emptyResponse(pageNumber, pageSize);
        }

        List<String> roleNames = targetRoles.stream().map(String::toUpperCase).toList();
        PagedUserWithRolesResponse page = authServiceClient.searchUsersByRoles(
                instituteId, roleNames, req.getNameQuery(), pageNumber, pageSize, authHeader, clientId);

        if (page == null || page.getContent() == null) {
            return emptyResponse(pageNumber, pageSize);
        }

        Set<String> allowed = new HashSet<>(targetRoles); // normalized
        List<ChatPersonResponse> people = new ArrayList<>();
        for (UserWithRolesDTO u : page.getContent()) {
            if (u.getId() == null || u.getId().equals(callerId)) continue;
            String role = resolvePersonRole(u, allowed, instituteId);
            if (role == null) continue;
            people.add(ChatPersonResponse.builder()
                    .userId(u.getId())
                    .fullName(u.getFullName())
                    .email(u.getEmail())
                    .mobileNumber(u.getMobileNumber())
                    .role(role)
                    .build());
        }

        ChatPeopleSearchResponse resp = new ChatPeopleSearchResponse();
        resp.setPeople(people);
        resp.setPageNumber(page.getPageNumber());
        resp.setPageSize(page.getPageSize());
        resp.setTotalElements(page.getTotalElements());
        resp.setHasNext(!page.isLast());
        return resp;
    }

    /**
     * Pick the highest-privilege role the user holds among the allowed (matrix-permitted) set —
     * considering ONLY their ACTIVE roles WITHIN the searched institute. The auth DTO carries every
     * ACTIVE/INVITED role across all tenants, so without this scoping a user who is a student here but
     * an admin elsewhere would be mislabeled "ADMIN" (privilege inflation + cross-tenant leak).
     */
    private String resolvePersonRole(UserWithRolesDTO user, Set<String> allowedNormalized, String instituteId) {
        if (user.getRoles() == null) return null;
        String best = null;
        for (UserRoleDTO r : user.getRoles()) {
            if (r.getInstituteId() == null || !r.getInstituteId().equals(instituteId)) continue;
            if (!"ACTIVE".equalsIgnoreCase(r.getStatus())) continue;
            String norm = ChatPermissionService.normalizeRole(r.getRoleName());
            if (!allowedNormalized.contains(norm)) continue;
            if ("admin".equals(norm)) return "ADMIN";
            if ("teacher".equals(norm)) best = "TEACHER";
            else if ("student".equals(norm) && best == null) best = "STUDENT";
        }
        return best;
    }

    private ChatPeopleSearchResponse emptyResponse(int pageNumber, int pageSize) {
        ChatPeopleSearchResponse resp = new ChatPeopleSearchResponse();
        resp.setPeople(List.of());
        resp.setPageNumber(pageNumber);
        resp.setPageSize(pageSize);
        resp.setTotalElements(0);
        resp.setHasNext(false);
        return resp;
    }
}
