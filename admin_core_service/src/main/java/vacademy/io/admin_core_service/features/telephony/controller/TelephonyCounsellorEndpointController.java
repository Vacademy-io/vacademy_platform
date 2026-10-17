package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyCounsellorEndpointDTO;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyEndpointUserDTO;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCounsellorEndpoint;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCounsellorEndpointRepository;
import vacademy.io.common.exceptions.VacademyException;

import vacademy.io.common.auth.dto.UserRoleDTO;
import vacademy.io.common.auth.dto.UserWithRolesDTO;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Admin API to map a platform user to their per-provider endpoint (extension +
 * DID) for no-pool providers (Airtel). JWT-gated (not in the public allowlist).
 *
 * <p>The table column is still {@code counsellor_user_id} — it predates admins
 * having extensions — but the row is just "the person who dials from this
 * extension". Counsellors calling leads and admins calling learners from the LMS
 * side-view both resolve through the same map, so no schema change was needed.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/counsellor-endpoints")
public class TelephonyCounsellorEndpointController {

    /** Both spellings, both casings: the seed data and the frontend gates disagree
     *  on COUNSELLOR/COUNSELOR and on ADMIN vs "Admin" (role_id 1 is stored as
     *  "Admin" on several institutes), and users-of-status matches role name
     *  exactly. Querying the union is cheaper than being wrong on one institute. */
    private static final List<String> ENDPOINT_ELIGIBLE_ROLES =
            List.of("COUNSELLOR", "COUNSELOR", "ADMIN", "Admin");

    @Autowired private TelephonyCounsellorEndpointRepository repo;
    @Autowired private AuthService authService;

    @GetMapping("/{instituteId}")
    public List<TelephonyCounsellorEndpointDTO> list(
            @PathVariable String instituteId,
            @RequestParam(value = "providerType", required = false, defaultValue = "AIRTEL") String providerType) {
        return repo.findByInstituteIdAndProviderType(instituteId, providerType.trim().toUpperCase())
                .stream().map(TelephonyCounsellorEndpointDTO::from).toList();
    }

    @PutMapping("/{instituteId}")
    @Transactional
    public TelephonyCounsellorEndpointDTO upsert(
            @PathVariable String instituteId,
            @RequestBody TelephonyCounsellorEndpointDTO body) {
        requireNonBlank(body.getCounsellorUserId(), "counsellorUserId is required");
        requireNonBlank(body.getProviderType(), "providerType is required");
        String providerType = body.getProviderType().trim().toUpperCase();

        TelephonyCounsellorEndpoint e = repo
                .findByCounsellorUserIdAndProviderType(body.getCounsellorUserId(), providerType)
                .orElseGet(TelephonyCounsellorEndpoint::new);
        e.setInstituteId(instituteId);
        e.setCounsellorUserId(body.getCounsellorUserId());
        e.setProviderType(providerType);
        if (body.getExtension() != null) e.setExtension(blankToNull(body.getExtension()));
        if (body.getProviderUserId() != null) e.setProviderUserId(blankToNull(body.getProviderUserId()));
        if (body.getDid() != null) e.setDid(blankToNull(body.getDid()));
        if (body.getEnabled() != null) e.setEnabled(body.getEnabled());

        return TelephonyCounsellorEndpointDTO.from(repo.save(e));
    }

    /**
     * The people an admin may hand an extension to: this institute's ACTIVE
     * counsellors AND admins.
     *
     * <p>Not {@code /lead-counsellor-options}: that endpoint answers "who can a
     * lead be assigned to", so it is COUNSELLOR-role only and hierarchy-scoped.
     * An extension is a phone-system fact, not a lead-routing one — an admin who
     * never touches the CRM still needs one to call a learner from the LMS
     * side-view, and the counsellor picker could never offer them.
     */
    @GetMapping("/{instituteId}/eligible-users")
    public List<TelephonyEndpointUserDTO> eligibleUsers(@PathVariable String instituteId) {
        List<UserWithRolesDTO> users =
                authService.getActiveUsersByRoles(instituteId, ENDPOINT_ELIGIBLE_ROLES);
        return users.stream()
                .filter(u -> u.getId() != null && !u.getId().isBlank())
                .map(u -> TelephonyEndpointUserDTO.builder()
                        .id(u.getId())
                        .fullName(displayName(u))
                        .email(u.getEmail())
                        .roles(instituteRoles(u, instituteId))
                        .build())
                // Stable, human order — the picker is a flat list an admin scans by name.
                .sorted(Comparator.comparing(TelephonyEndpointUserDTO::getFullName,
                        String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /** Role names this user holds IN THIS institute, uppercased and deduped. A
     *  user's role set spans every institute they belong to, so filtering by
     *  institute keeps the badge honest for multi-institute staff. */
    private static List<String> instituteRoles(UserWithRolesDTO u, String instituteId) {
        Set<UserRoleDTO> roles = u.getRoles();
        if (roles == null) return List.of();
        return roles.stream()
                .filter(r -> r.getRoleName() != null)
                .filter(r -> r.getInstituteId() == null || instituteId.equals(r.getInstituteId()))
                .map(r -> r.getRoleName().toUpperCase())
                .distinct()
                .sorted()
                .toList();
    }

    private static String displayName(UserWithRolesDTO u) {
        if (u.getFullName() != null && !u.getFullName().isBlank()) return u.getFullName();
        if (u.getEmail() != null && !u.getEmail().isBlank()) return u.getEmail();
        if (u.getUsername() != null && !u.getUsername().isBlank()) return u.getUsername();
        return u.getId();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private static void requireNonBlank(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
