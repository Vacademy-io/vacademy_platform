package vacademy.io.admin_core_service.features.hr_employee.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.hr_employee.dto.EmployeeProfileDTO;
import vacademy.io.admin_core_service.features.hr_employee.dto.StaffBridgeResponseDTO;
import vacademy.io.admin_core_service.features.hr_employee.dto.StaffBridgeRowDTO;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Phase F1 of staff↔HR-employee unification: bridges the canonical "people who
 * work here" source — user_role rows (ADMIN/TEACHER/EVALUATOR/COUNSELLOR,
 * institute-scoped, status ACTIVE/INVITED; the legacy `staff` table is dead) —
 * to hr_employee_profile.
 *
 * <p>Roster source is split, because the data is split. Membership — who holds
 * which staff role, and whether the grant is ACTIVE or INVITED — comes from
 * {@code user_role}/{@code roles}, which exist in this service's schema. The
 * identity columns (name, email, phone) live in {@code users}, which does NOT:
 * that table belongs to auth_service, and a native join against it fails at
 * runtime with {@code relation "users" does not exist}. Identity is therefore
 * fetched over HTTP and merged in.
 *
 * <p>Membership drives the roster and identity only decorates it, so an
 * auth_service outage degrades the rows to ids and roles rather than reporting
 * an institute with zero staff — {@link AuthService#getUsersByInstituteAndRoles}
 * returns an empty list on failure rather than throwing.
 */
@Service
public class StaffUnificationService {

    /** The staff roles that constitute the institute roster. */
    public static final List<String> STAFF_ROLES = List.of("ADMIN", "TEACHER", "EVALUATOR", "COUNSELLOR");

    private static final List<String> ROSTER_STATUSES = List.of("ACTIVE", "INVITED");

    private static final String CROSS_INSTITUTE_BLOCKED_REASON =
            "User already has an HR employee profile in another institute; hr_employee_profile.user_id "
                    + "is globally unique, so a second profile cannot be created for this user here.";

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private EmployeeService employeeService;

    // ======================== Roster (GET /staff-bridge) ========================

    @Transactional(readOnly = true)
    public StaffBridgeResponseDTO getStaffBridge(String instituteId, String role, String search, int page, int size) {
        String roleFilter = normalizeRoleFilter(role);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);

        // Full (unfiltered) staff roster — the summary counts must describe the
        // whole institute even when the page rows are role/search filtered.
        Map<String, RosterEntry> roster = fetchStaffRoster(instituteId);

        Map<String, EmployeeProfile> profileByUserId = employeeProfileRepository
                .findByFilters(instituteId, null, null, null, null, Pageable.unpaged())
                .getContent().stream()
                .collect(Collectors.toMap(EmployeeProfile::getUserId, Function.identity(), (a, b) -> a));

        Set<String> teachingUserIds = facultyMappingRepository
                .findUserIdsByFilters(instituteId, List.of(StatusEnum.ACTIVE.name()));

        long withHrProfile = roster.keySet().stream().filter(profileByUserId::containsKey).count();
        long teachingWithoutProfile = roster.keySet().stream()
                .filter(teachingUserIds::contains)
                .filter(userId -> !profileByUserId.containsKey(userId))
                .count();

        // Filter + stable sort + page slice.
        List<RosterEntry> filtered = roster.values().stream()
                .filter(e -> roleFilter == null || e.roles.contains(roleFilter))
                .filter(e -> matchesSearch(e, search))
                .sorted(Comparator
                        .comparing((RosterEntry e) -> e.fullName == null ? "" : e.fullName.toLowerCase(Locale.ROOT))
                        .thenComparing(e -> e.userId))
                .collect(Collectors.toList());

        int from = Math.min(safePage * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());

        List<StaffBridgeRowDTO> rows = new ArrayList<>();
        for (RosterEntry entry : filtered.subList(from, to)) {
            EmployeeProfile profile = profileByUserId.get(entry.userId);
            String blockedReason = null;
            if (profile == null) {
                // Local profile absent — surface the global-unique constraint
                // honestly when the user is already an employee elsewhere.
                blockedReason = employeeProfileRepository.findByUserId(entry.userId)
                        .map(other -> CROSS_INSTITUTE_BLOCKED_REASON)
                        .orElse(null);
            }
            rows.add(StaffBridgeRowDTO.builder()
                    .userId(entry.userId)
                    .fullName(entry.fullName)
                    .email(entry.email)
                    .mobileNumber(entry.mobileNumber)
                    .roles(new ArrayList<>(entry.roles))
                    .status(entry.anyActive ? "ACTIVE" : "INVITED")
                    .employeeId(profile != null ? profile.getId() : null)
                    .employeeCode(profile != null ? profile.getEmployeeCode() : null)
                    .teaches(teachingUserIds.contains(entry.userId))
                    .blockedReason(blockedReason)
                    .build());
        }

        return StaffBridgeResponseDTO.builder()
                .rows(rows)
                .page(safePage)
                .size(safeSize)
                .totalElements(filtered.size())
                .totalStaff(roster.size())
                .withHrProfile(withHrProfile)
                .teachingWithoutProfile(teachingWithoutProfile)
                .build();
    }

    // ======================== Create (POST /from-staff) ========================

    /**
     * Creates a minimal EmployeeProfile for an existing staff user via the
     * canonical {@link EmployeeService#createEmployee} path (its duplicate-code,
     * department/designation institute-match and enum validations all apply).
     * Only the bridge-relevant fields are forwarded; join_date defaults to today.
     */
    @Transactional
    public String createEmployeeFromStaff(EmployeeProfileDTO dto, String instituteId) {
        if (dto == null || !StringUtils.hasText(dto.getUserId())) {
            throw new VacademyException("user_id is required");
        }
        String userId = dto.getUserId();

        // user_id is globally unique on hr_employee_profile — one lookup
        // distinguishes "already onboarded here" from "blocked by another institute".
        Optional<EmployeeProfile> existing = employeeProfileRepository.findByUserId(userId);
        if (existing.isPresent()) {
            if (instituteId.equals(existing.get().getInstituteId())) {
                throw new VacademyException(
                        "User already has an HR employee profile in this institute (employee id "
                                + existing.get().getId() + ")");
            }
            throw new VacademyException(CROSS_INSTITUTE_BLOCKED_REASON);
        }

        boolean isStaffHere = userRoleRepository
                .findFirstByUserIdAndInstituteIdAndRoleNamesAndStatuses(
                        userId, instituteId, STAFF_ROLES, ROSTER_STATUSES)
                .isPresent();
        if (!isStaffHere) {
            throw new VacademyException(
                    "User holds no staff role (ADMIN/TEACHER/EVALUATOR/COUNSELLOR) in this institute");
        }

        EmployeeProfileDTO minimal = EmployeeProfileDTO.builder()
                .userId(userId)
                .employeeCode(StringUtils.hasText(dto.getEmployeeCode()) ? dto.getEmployeeCode() : null)
                .joinDate(dto.getJoinDate() != null ? dto.getJoinDate() : LocalDate.now())
                .departmentId(dto.getDepartmentId())
                .designationId(dto.getDesignationId())
                .build();

        return employeeService.createEmployee(minimal, instituteId);
    }

    // ======================== internals ========================

    /**
     * Distinct staff users of the institute: membership from {@code user_role}
     * (row shape [user_id, role_name, status]), identity decorated from
     * auth_service. A user with several staff roles yields several rows, merged
     * by userId; the entry is ACTIVE if any one grant is.
     */
    private Map<String, RosterEntry> fetchStaffRoster(String instituteId) {
        Map<String, RosterEntry> byUserId = new LinkedHashMap<>();
        List<Object[]> grants = userRoleRepository.findRoleGrantsByInstituteAndRoleNames(
                instituteId, STAFF_ROLES, ROSTER_STATUSES);
        for (Object[] row : grants) {
            String userId = (String) row[0];
            if (!StringUtils.hasText(userId)) {
                continue;
            }
            RosterEntry entry = byUserId.computeIfAbsent(userId, RosterEntry::new);
            entry.roles.add(((String) row[1]).trim().toUpperCase(Locale.ROOT));
            if ("ACTIVE".equalsIgnoreCase((String) row[2])) {
                entry.anyActive = true;
            }
        }
        decorateWithIdentity(instituteId, byUserId);
        return byUserId;
    }

    /**
     * Fills in names, emails and phone numbers from auth_service. Best-effort by
     * design: the roster is already complete without it, so a failed or partial
     * response leaves those cells blank instead of hiding staff.
     */
    private void decorateWithIdentity(String instituteId, Map<String, RosterEntry> byUserId) {
        if (byUserId.isEmpty()) {
            return;
        }
        for (UserDTO user : authService.getUsersByInstituteAndRoles(instituteId, STAFF_ROLES)) {
            if (user == null) {
                continue;
            }
            RosterEntry entry = byUserId.get(user.getId());
            if (entry == null) {
                continue;
            }
            entry.fullName = user.getFullName();
            entry.email = user.getEmail();
            entry.mobileNumber = user.getMobileNumber();
        }
    }

    private String normalizeRoleFilter(String role) {
        if (!StringUtils.hasText(role)) {
            return null;
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        if (!STAFF_ROLES.contains(normalized)) {
            throw new VacademyException("Invalid role filter: " + role + ". Allowed: " + STAFF_ROLES);
        }
        return normalized;
    }

    private boolean matchesSearch(RosterEntry entry, String search) {
        if (!StringUtils.hasText(search)) {
            return true;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return (entry.fullName != null && entry.fullName.toLowerCase(Locale.ROOT).contains(needle))
                || (entry.email != null && entry.email.toLowerCase(Locale.ROOT).contains(needle));
    }

    /**
     * In-memory merge of one user's staff user_role rows. Only {@code userId} and
     * the role grants come from this service's schema; the identity fields stay
     * null until {@link #decorateWithIdentity} fills them from auth_service.
     */
    private static final class RosterEntry {
        final String userId;
        final Set<String> roles = new LinkedHashSet<>();
        String fullName;
        String email;
        String mobileNumber;
        boolean anyActive;

        RosterEntry(String userId) {
            this.userId = userId;
        }
    }
}
