package vacademy.io.admin_core_service.features.suborg.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamAddRequestDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamListRequestDTO;
import vacademy.io.admin_core_service.features.suborg.dto.SubOrgTeamRemoveRequestDTO;
import vacademy.io.common.auth.dto.PagedUserWithRolesResponse;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Service-level operations for managing sub-org team members.
 *
 * Scope rules:
 *  - Caller is "ADMIN" / "TEACHER" → unrestricted (can target any sub-org).
 *  - Caller is a sub-org admin (only FSPSSM SUB_ORG access) → can ONLY target sub-orgs they
 *    have an active SUB_ORG-linked FSPSSM entry for.
 *  - Anyone else → 403.
 *
 * The team list is sourced from FSPSSM (linkage_type=SUB_ORG, suborg_id=...) and joined with
 * auth-service for user details. Custom roles are filtered client-side via the role list.
 */
@Service
@Slf4j
public class SubOrgTeamService {

    private static final Set<String> SYSTEM_ROLES = new HashSet<>(Arrays.asList("ADMIN", "TEACHER", "STUDENT"));

    @Autowired
    private FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Autowired
    private JwtService jwtService;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;

    @Value("${spring.application.name}")
    private String applicationName;

    /** List team members under a sub-org. */
    public PagedUserWithRolesResponse listTeamMembers(SubOrgTeamListRequestDTO request, CustomUserDetails caller) {
        String subOrgId = request.getSubOrgId();
        String instituteId = request.getInstituteId();
        if (!StringUtils.hasText(subOrgId)) {
            throw new VacademyException("sub_org_id is required");
        }
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException("institute_id is required");
        }

        ensureCallerCanAccessSubOrg(caller, instituteId, subOrgId);

        // 1. Resolve user IDs in scope from FSPSSM
        List<String> userIds = facultyMappingRepository
                .findDistinctUserIdsBySubOrgIdAndLinkage(subOrgId, List.of("ACTIVE"));
        if (userIds.isEmpty()) {
            return PagedUserWithRolesResponse.builder()
                    .content(java.util.Collections.emptyList())
                    .pageNumber(request.getPageNumber() != null ? request.getPageNumber() : 0)
                    .pageSize(request.getPageSize() != null ? request.getPageSize() : 10)
                    .totalElements(0L)
                    .totalPages(0)
                    .first(true)
                    .last(true)
                    .build();
        }

        // 2. Hand off to auth-service with the user-id filter
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("roles", request.getRoles());
        body.put("status", request.getStatus());
        body.put("name", request.getName());
        body.put("page_number", request.getPageNumber() != null ? request.getPageNumber() : 0);
        body.put("page_size", request.getPageSize() != null ? request.getPageSize() : 10);
        body.put("user_ids", userIds);

        String route = "/auth-service/internal/v1/user-roles/users-of-status-paged?instituteId=" + instituteId;
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                applicationName, HttpMethod.POST.name(), authServerBaseUrl, route, body);

        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(response.getBody(), PagedUserWithRolesResponse.class);
        } catch (Exception e) {
            log.error("Failed to parse auth-service response for sub-org team list", e);
            throw new VacademyException("Failed to load sub-org team members");
        }
    }

    /**
     * Add a team member to a sub-org.
     * - Validates sub-org scope and the requested role.
     * - Calls auth-service to invite/create the user with the role.
     * - Creates one FSPSSM entry per package session, with linkage_type=SUB_ORG.
     */
    @Transactional
    public Map<String, Object> addTeamMember(SubOrgTeamAddRequestDTO request, CustomUserDetails caller) {
        if (request.getUser() == null || !StringUtils.hasText(request.getUser().getEmail())
                || !StringUtils.hasText(request.getUser().getFullName())) {
            throw new VacademyException("user.email and user.full_name are required");
        }
        if (!StringUtils.hasText(request.getSubOrgId())) {
            throw new VacademyException("sub_org_id is required");
        }
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("institute_id is required");
        }

        ensureCallerCanAccessSubOrg(caller, request.getInstituteId(), request.getSubOrgId());

        // For non-admin callers, reject system roles.
        boolean callerIsSystemAdmin = hasSystemRole(caller, request.getInstituteId(), "ADMIN", "TEACHER");
        String roleName = request.getRoleName();
        if (!callerIsSystemAdmin) {
            if (!StringUtils.hasText(roleName) || SYSTEM_ROLES.contains(roleName.toUpperCase())) {
                throw new VacademyException("Sub-org admins can only assign custom roles");
            }
        }

        // Validate package sessions are within caller's scope (sub-org admins only).
        List<String> requestedPsIds = request.getPackageSessionIds() != null
                ? request.getPackageSessionIds() : new ArrayList<>();
        if (!callerIsSystemAdmin && !requestedPsIds.isEmpty()) {
            List<String> accessiblePsIds = facultyMappingRepository
                    .findAccessIdsByUserIdAndInstituteId(caller.getUserId(), request.getInstituteId(),
                            List.of("ACTIVE"));
            Set<String> accessibleSet = new HashSet<>(accessiblePsIds);
            for (String psId : requestedPsIds) {
                if (!accessibleSet.contains(psId)) {
                    throw new VacademyException("Package session " + psId + " is outside your access scope");
                }
            }
        }

        // 1. Invite user via auth-service. UserDTO uses SnakeCaseStrategy so the field is is_root_user.
        Map<String, Object> invitePayload = new java.util.HashMap<>();
        invitePayload.put("email", request.getUser().getEmail());
        invitePayload.put("full_name", request.getUser().getFullName());
        invitePayload.put("mobile_number", request.getUser().getMobileNumber());
        invitePayload.put("roles", List.of(roleName));
        invitePayload.put("is_root_user", false);

        String inviteRoute = "/auth-service/internal/v1/user-invitation/invite?instituteId=" + request.getInstituteId();
        ResponseEntity<String> inviteResponse = internalClientUtils.makeHmacRequest(
                applicationName, HttpMethod.POST.name(), authServerBaseUrl, inviteRoute, invitePayload);

        String userId;
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> respMap = mapper.readValue(inviteResponse.getBody(), new TypeReference<>() {});
            userId = extractUserId(respMap);
            if (!StringUtils.hasText(userId)) {
                throw new VacademyException("Auth service did not return a user id");
            }
        } catch (Exception e) {
            log.error("Failed to invite user via auth-service", e);
            throw new VacademyException("Failed to create user");
        }

        // 2. Create FSPSSM entries for each package session with SUB_ORG linkage
        String accessPermission = StringUtils.hasText(request.getAccessPermission())
                ? request.getAccessPermission() : "FULL";
        for (String psId : requestedPsIds) {
            FacultySubjectPackageSessionMapping mapping = new FacultySubjectPackageSessionMapping();
            mapping.setUserId(userId);
            mapping.setPackageSessionId(psId);
            mapping.setName(request.getUser().getFullName());
            mapping.setStatus("ACTIVE");
            mapping.setUserType("ROLE");
            mapping.setTypeId(request.getRoleId());
            mapping.setAccessType("PACKAGE_SESSION");
            mapping.setAccessId(psId);
            mapping.setAccessPermission(accessPermission);
            mapping.setLinkageType("SUB_ORG");
            mapping.setSuborgId(request.getSubOrgId());
            facultyMappingRepository.save(mapping);
        }

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("user_id", userId);
        result.put("granted_count", requestedPsIds.size());
        return result;
    }

    /**
     * Remove a team member from a sub-org. Marks all SUB_ORG-linked FSPSSM entries for
     * (user_id, sub_org_id) as INACTIVE. Other sub-orgs the user belongs to are untouched.
     */
    @Transactional
    public Map<String, Object> removeTeamMember(SubOrgTeamRemoveRequestDTO request, CustomUserDetails caller) {
        if (!StringUtils.hasText(request.getSubOrgId()) || !StringUtils.hasText(request.getUserId())) {
            throw new VacademyException("sub_org_id and user_id are required");
        }
        if (!StringUtils.hasText(request.getInstituteId())) {
            throw new VacademyException("institute_id is required");
        }

        ensureCallerCanAccessSubOrg(caller, request.getInstituteId(), request.getSubOrgId());

        List<FacultySubjectPackageSessionMapping> mappings = facultyMappingRepository
                .findByUserIdAndSubOrgIdAndLinkage(request.getUserId(), request.getSubOrgId());
        if (mappings.isEmpty()) {
            throw new VacademyException("User has no active membership in this sub-org");
        }

        int updated = 0;
        for (FacultySubjectPackageSessionMapping m : mappings) {
            if (!"INACTIVE".equalsIgnoreCase(m.getStatus())) {
                m.setStatus("INACTIVE");
                updated++;
            }
        }
        facultyMappingRepository.saveAll(mappings);

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("user_id", request.getUserId());
        result.put("sub_org_id", request.getSubOrgId());
        result.put("deactivated_mappings", updated);
        return result;
    }

    // ─────────── helpers ───────────

    private void ensureCallerCanAccessSubOrg(CustomUserDetails caller, String instituteId, String subOrgId) {
        if (caller == null) {
            throw new VacademyException("Authentication required");
        }
        if (hasSystemRole(caller, instituteId, "ADMIN", "TEACHER")) {
            return; // unrestricted
        }
        // Sub-org admin path: must have an active SUB_ORG FSPSSM for this sub-org.
        List<String> accessibleSubOrgs = facultyMappingRepository
                .findDistinctSubOrgIdsByUserAndLinkage(caller.getUserId(), List.of("ACTIVE"));
        if (!accessibleSubOrgs.contains(subOrgId)) {
            throw new VacademyException("You do not have access to this sub-org");
        }
    }

    /**
     * Mirror of StudentListManager.hasRole — checks JWT authorities first, then JWT claim
     * fallback. We avoid a DB role check here because user_role lives in auth-service.
     */
    @SuppressWarnings("unchecked")
    private boolean hasSystemRole(CustomUserDetails user, String instituteId, String... roles) {
        if (user == null) return false;
        boolean fromAuthorities = user.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(authority -> {
                    for (String role : roles) {
                        if (role.equalsIgnoreCase(authority)) return true;
                    }
                    return false;
                });
        if (fromAuthorities) return true;

        if (instituteId == null) return false;
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return false;
            HttpServletRequest request = attrs.getRequest();
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) return false;
            String jwt = authHeader.substring(7);

            Map<String, Object> authorities = jwtService.extractClaim(jwt,
                    claims -> (Map<String, Object>) claims.get("authorities"));
            if (authorities == null) return false;

            Map<String, Object> instituteAuth = (Map<String, Object>) authorities.get(instituteId);
            if (instituteAuth == null) return false;

            List<String> jwtRoles = (List<String>) instituteAuth.get("roles");
            if (jwtRoles == null) return false;

            for (String role : roles) {
                if (jwtRoles.stream().anyMatch(r -> role.equalsIgnoreCase(r))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    @SuppressWarnings("unchecked")
    private String extractUserId(Map<String, Object> resp) {
        if (resp == null) return null;
        if (resp.get("userId") instanceof String s) return s;
        if (resp.get("id") instanceof String s) return s;
        Object userObj = resp.get("user");
        if (userObj instanceof Map) {
            Object id = ((Map<String, Object>) userObj).get("id");
            if (id instanceof String s) return s;
        }
        return null;
    }
}
