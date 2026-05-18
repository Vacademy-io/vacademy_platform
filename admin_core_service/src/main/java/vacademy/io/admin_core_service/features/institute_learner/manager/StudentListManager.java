package vacademy.io.admin_core_service.features.institute_learner.manager;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.enroll_invite.repository.PackageSessionLearnerInvitationToPaymentOptionRepository;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentBasicDetailsDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentV2DTO;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldValueMap;
import vacademy.io.admin_core_service.features.institute_learner.dto.projection.StudentListV2Projection;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentPlanDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentV2Response;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.service.StudentFilterService;
import vacademy.io.admin_core_service.features.live_session.service.AttendanceReportService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentOption;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.service.JwtService;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;

@Component
public class StudentListManager {

    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Autowired
    StudentFilterService studentFilterService;

    @Autowired
    AttendanceReportService attendanceReportService;

    @Autowired
    FacultySubjectPackageSessionMappingRepository facultyMappingRepository;

    @Autowired
    PackageSessionLearnerInvitationToPaymentOptionRepository pslipoRepository;

    @Autowired
    JwtService jwtService;


    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    /**
     * Applies faculty access filtering to the student list filter.
     * If the user has HAS_FACULTY_ASSIGNED permission:
     * - Restricts packageSessionIds to only accessible package sessions
     * - For PS with ENROLL_INVITE access: only shows learners enrolled via those invites
     * - For PS without invite access: shows all learners
     */
    private void applyFacultyAccessFilter(CustomUserDetails user, StudentListFilter filter) {
        // Handle user-selected invite filter (works for ALL users, not just faculty)
        applyUserInviteFilter(filter);

        if (user == null) return;

        String instituteId = (filter.getInstituteIds() != null && !filter.getInstituteIds().isEmpty())
                ? filter.getInstituteIds().get(0) : null;

        // Skip faculty filtering for ADMIN/TEACHER — they should see all students.
        // Sub-org admins (no ADMIN/TEACHER role, but have FSPSSM) → filtering applies.
        if (hasRole(user, instituteId, "ADMIN", "TEACHER") || !hasFacultyAssignedPermission(user)) {
            return;
        }

        if (instituteId == null) {
            return;
        }

        List<String> activeStatuses = List.of("ACTIVE");

        List<String> accessiblePsIds = facultyMappingRepository
                .findAccessIdsByUserIdAndInstituteId(user.getUserId(), instituteId, activeStatuses);

        if (accessiblePsIds.isEmpty()) {
            filter.setPackageSessionIds(List.of("__NONE__"));
            return;
        }

        // Intersect with user's requested packageSessionIds filter
        List<String> requestedPsIds = filter.getPackageSessionIds();
        List<String> effectivePsIds;
        if (requestedPsIds != null && !requestedPsIds.isEmpty()) {
            List<String> cleanRequestedPsIds = requestedPsIds.stream()
                    .filter(id -> id != null && !id.isEmpty())
                    .collect(Collectors.toList());
            if (cleanRequestedPsIds.isEmpty()) {
                effectivePsIds = new ArrayList<>(accessiblePsIds);
            } else {
                Set<String> accessibleSet = new HashSet<>(accessiblePsIds);
                effectivePsIds = cleanRequestedPsIds.stream()
                        .filter(accessibleSet::contains)
                        .collect(Collectors.toList());
                if (effectivePsIds.isEmpty()) {
                    filter.setPackageSessionIds(List.of("__NONE__"));
                    return;
                }
            }
        } else {
            effectivePsIds = new ArrayList<>(accessiblePsIds);
        }
        filter.setPackageSessionIds(effectivePsIds);

        // Get ENROLL_INVITE access_ids directly from FSPSSM
        List<String> accessibleInviteIds = facultyMappingRepository
                .findEnrollInviteAccessIdsByUserIdAndInstituteId(user.getUserId(), instituteId, activeStatuses);

        if (!accessibleInviteIds.isEmpty()) {
            // If user explicitly selected invites from the filter, intersect with accessible set
            List<String> userSelectedInvites = filter.getEnrollInviteIds();
            List<String> effectiveInviteIds;
            if (userSelectedInvites != null && !userSelectedInvites.isEmpty()) {
                Set<String> accessibleSet = new HashSet<>(accessibleInviteIds);
                effectiveInviteIds = userSelectedInvites.stream()
                        .filter(accessibleSet::contains)
                        .collect(Collectors.toList());
            } else {
                effectiveInviteIds = accessibleInviteIds;
            }

            List<String> invitePsIds = pslipoRepository.findPackageSessionIdsByEnrollInviteIds(effectiveInviteIds);
            Set<String> effectiveSet = new HashSet<>(effectivePsIds);
            List<String> enrollInvitePsIds = invitePsIds.stream()
                    .filter(effectiveSet::contains)
                    .collect(Collectors.toList());

            if (!enrollInvitePsIds.isEmpty()) {
                filter.setServerEnrollInviteIds(effectiveInviteIds);
                filter.setEnrollInvitePackageSessionIds(enrollInvitePsIds);
            }
        }
    }

    /**
     * Handles user-selected enroll_invite_ids filter (works for all users).
     * If no faculty FSPSSM filtering will happen, this sets serverEnrollInviteIds directly.
     */
    private void applyUserInviteFilter(StudentListFilter filter) {
        List<String> userInviteIds = filter.getEnrollInviteIds();
        if (userInviteIds == null || userInviteIds.isEmpty()) {
            return;
        }
        // Pre-set serverEnrollInviteIds from user selection.
        // If applyFacultyAccessFilter runs later, it will intersect/override.
        List<String> invitePsIds = pslipoRepository.findPackageSessionIdsByEnrollInviteIds(userInviteIds);
        if (!invitePsIds.isEmpty()) {
            filter.setServerEnrollInviteIds(userInviteIds);
            filter.setEnrollInvitePackageSessionIds(invitePsIds);
        }
    }

    private boolean hasRole(CustomUserDetails user, String instituteId, String... roles) {
        // Fast path: check storedAuthorities from auth-service
        boolean fromAuthorities = user.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .anyMatch(authority -> {
                    for (String role : roles) {
                        if (role.equalsIgnoreCase(authority)) return true;
                    }
                    return false;
                });
        if (fromAuthorities) return true;

        // JWT fallback: read roles directly from the token (no DB call needed)
        // storedAuthorities can be empty when clientId header mismatches UserRole.instituteId in auth-service
        if (instituteId == null) return false;
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) return false;
            HttpServletRequest request = attrs.getRequest();
            String authHeader = request.getHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) return false;
            String jwt = authHeader.substring(7);

            @SuppressWarnings("unchecked")
            Map<String, Object> authorities = jwtService.extractClaim(jwt,
                    claims -> (Map<String, Object>) claims.get("authorities"));
            if (authorities == null) return false;

            @SuppressWarnings("unchecked")
            Map<String, Object> instituteAuth = (Map<String, Object>) authorities.get(instituteId);
            if (instituteAuth == null) return false;

            @SuppressWarnings("unchecked")
            List<String> jwtRoles = (List<String>) instituteAuth.get("roles");
            if (jwtRoles == null) return false;

            for (String role : roles) {
                if (jwtRoles.stream().anyMatch(r -> role.equalsIgnoreCase(r))) return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private boolean hasFacultyAssignedPermission(CustomUserDetails user) {
        // Check Spring Security authorities
        boolean fromAuthorities = user.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .anyMatch(authority -> "HAS_FACULTY_ASSIGNED".equalsIgnoreCase(authority));
        if (fromAuthorities) return true;

        // Fallback: check if user has any active FSPSSM entries (direct DB check)
        List<FacultySubjectPackageSessionMapping> mappings = facultyMappingRepository.findByUserId(user.getUserId());
        return mappings.stream().anyMatch(m -> "ACTIVE".equals(m.getStatus()));
    }

    public ResponseEntity<AllStudentResponse> getLinkedStudents(CustomUserDetails user,
            StudentListFilter studentListFilter, int pageNo, int pageSize) {
        // Apply faculty access filter (restricts PS and injects invite filter)
        applyFacultyAccessFilter(user, studentListFilter);

        // Create a sorting object based on the provided sort columns
        Sort thisSort = ListService.createSortObject(studentListFilter.getSortColumns());

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        // Retrieve employees based on the filter criteria
        Page<StudentDTO> studentPage = null;

        // Check if the filter contains a numeric name
        if (StringUtils.hasText(studentListFilter.getName())) {
            studentPage = studentFilterService.getAllStudentWithSearch(studentListFilter.getName(),studentListFilter.getStatuses(),
                    studentListFilter.getGender(), studentListFilter.getInstituteIds(), studentListFilter.getGroupIds(),
                    studentListFilter.getPackageSessionIds(),studentListFilter.getCustomFields(), pageable);
        }

        if (Objects.isNull(studentPage) && !studentListFilter.getInstituteIds().isEmpty()) {
            studentPage = studentFilterService.getAllStudentWithFilterAndCustomFields(studentListFilter.getStatuses(),
                    studentListFilter.getGender(), studentListFilter.getInstituteIds(), studentListFilter.getGroupIds(),
                    studentListFilter.getPackageSessionIds(),studentListFilter.getCustomFields(), pageable);
        }

        return ResponseEntity.ok(createAllStudentResponseFromPaginatedData(studentPage));

    }

    /**
     * Enriches students with attendance percentage data
     * @param students List of students to enrich with attendance data
     */
    private void enrichStudentsWithAttendancePercentage(List<StudentDTO> students) {
        if (students == null || students.isEmpty()) {
            return;
        }

        // Calculate attendance percentage for each student
        for (StudentDTO student : students) {
            try {
                // Get the package session ID for the student
                String packageSessionId = student.getPackageSessionId();
                String userId = student.getUserId();
                
                if (packageSessionId != null && userId != null) {
                    // Calculate attendance for the last 30 days as a reasonable default period
                    LocalDate endDate = LocalDate.now();
                    LocalDate startDate = endDate.minusDays(30);
                    
                    // Get attendance report for the student
                    var attendanceReport = attendanceReportService.getStudentReport(userId, packageSessionId, startDate, endDate);
                    student.setAttendancePercent(attendanceReport.getAttendancePercentage());
                } else {
                    // Set to 0.0 if no package session or user ID
                    student.setAttendancePercent(0.0);
                }
            } catch (Exception e) {
                // Log error and set attendance to 0.0 in case of any issues
                // You might want to add proper logging here
                student.setAttendancePercent(0.0);
            }
        }
    }

    private AllStudentResponse createAllStudentResponseFromPaginatedData(Page<StudentDTO> studentPage) {
        List<StudentDTO> content = new ArrayList<>();
        if (!Objects.isNull(studentPage)) {
            content = studentPage.getContent();
            // Calculate attendance percentage for each student
            enrichStudentsWithAttendancePercentage(content);
            return AllStudentResponse.builder().content(content).pageNo(studentPage.getNumber())
                    .last(studentPage.isLast()).pageSize(studentPage.getSize()).totalPages(studentPage.getTotalPages())
                    .totalElements(studentPage.getTotalElements()).build();
        }
        return AllStudentResponse.builder().totalPages(0).content(content).pageNo(0).totalPages(0).build();
    }

    public ResponseEntity<AllStudentV2Response> getLinkedStudentsV2(CustomUserDetails user,
                                                                    StudentListFilter studentListFilter, int pageNo, int pageSize) {
        applyFacultyAccessFilter(user, studentListFilter);

        boolean hasCustomFieldFilters = studentListFilter.getCustomFieldFilters() != null && !studentListFilter.getCustomFieldFilters().isEmpty();
        boolean hasEnrollInviteFilter = studentListFilter.getServerEnrollInviteIds() != null && !studentListFilter.getServerEnrollInviteIds().isEmpty();
        boolean hasNameSearch = StringUtils.hasText(studentListFilter.getName());
        boolean hasPaymentStatusFilter = studentListFilter.getPaymentStatuses() != null && !studentListFilter.getPaymentStatuses().isEmpty();

        // Complex filters (custom fields, payment status, invite filter) require full JOIN query
        if (hasCustomFieldFilters || hasEnrollInviteFilter || hasPaymentStatusFilter) {
            Pageable pageable = createPageable(studentListFilter, pageNo, pageSize);
            Page<StudentListV2Projection> page = fetchStudentPage(studentListFilter, pageable);
            List<StudentV2DTO> content = page != null ? mapProjectionsToDTOs(page.getContent()) : new ArrayList<>();
            if (!content.isEmpty()) enrichWithUserCredentials(content);
            return ResponseEntity.ok(buildResponse(content, page, pageSize, false));
        }

        // The learner-list is a superset: institute-enrolled users + audience-only respondents.
        // Audience-only rows are dropped the moment any enrollment-scoped filter is active
        // (status, batch, group, source/type/typeId, destPSID, levelId, subOrgUserType, date range);
        // gender / audience / name search are user-scoped and do not gate them out.
        boolean includeAudienceOnly = CollectionUtils.isEmpty(studentListFilter.getStatuses())
                && CollectionUtils.isEmpty(studentListFilter.getPackageSessionIds())
                && CollectionUtils.isEmpty(studentListFilter.getGroupIds())
                && CollectionUtils.isEmpty(studentListFilter.getSources())
                && CollectionUtils.isEmpty(studentListFilter.getTypes())
                && CollectionUtils.isEmpty(studentListFilter.getTypeIds())
                && CollectionUtils.isEmpty(studentListFilter.getDestinationPackageSessionIds())
                && CollectionUtils.isEmpty(studentListFilter.getLevelIds())
                && CollectionUtils.isEmpty(studentListFilter.getSubOrgUserTypes())
                && studentListFilter.getStartDate() == null
                && studentListFilter.getEndDate() == null;

        // Two-phase approach: 1) get IDs (combined UNION when audience-only included), 2) enrich page IDs
        Page<String> idPage = instituteStudentRepository.findPagedCombinedUserIdsForLearnerList(
                studentListFilter.getStatuses(),
                studentListFilter.getGender(),
                studentListFilter.getInstituteIds(),
                studentListFilter.getGroupIds(),
                studentListFilter.getPackageSessionIds(),
                studentListFilter.getSources(),
                studentListFilter.getTypes(),
                studentListFilter.getTypeIds(),
                studentListFilter.getDestinationPackageSessionIds(),
                studentListFilter.getLevelIds(),
                studentListFilter.getSubOrgUserTypes(),
                studentListFilter.getStartDate(),
                studentListFilter.getEndDate(),
                studentListFilter.getAudienceIds(),
                hasNameSearch ? studentListFilter.getName() : null,
                includeAudienceOnly,
                PageRequest.of(pageNo, pageSize));

        List<String> pagedUserIds = idPage.getContent();
        if (pagedUserIds.isEmpty()) {
            return ResponseEntity.ok(AllStudentV2Response.builder()
                    .content(new ArrayList<>()).pageNo(pageNo).pageSize(pageSize)
                    .totalElements(0L).totalPages(0).last(true).build());
        }

        // Slim enrichment: skip user_plan/payment_log/enroll_invite joins and the
        // auth-service credential call. Side-view tabs hydrate plan/payment/credentials
        // on demand. Heavy path above already handles paymentStatus/enrollInvite/customField filters.
        List<StudentListV2Projection> projections = instituteStudentRepository.getStudentSlimDataForUserIds(
                pagedUserIds,
                studentListFilter.getInstituteIds(),
                List.of(StatusEnum.ACTIVE.name()));

        // First-wins map collapses multi-enrollment users to one row. The slim query
        // is ORDERed by ssigm.enrolled_date DESC so the latest enrollment lands first.
        Map<String, StudentListV2Projection> projMap = projections.stream()
                .filter(p -> p.getUserId() != null)
                .collect(Collectors.toMap(StudentListV2Projection::getUserId, p -> p, (a, b) -> a));

        // Aggregate every enrollment's package_session_id per user BEFORE collapsing,
        // so side-view tabs that fetch batch-scoped data can iterate every ps_id, not
        // just the latest one. Latest-first because the slim query ORDERs by enrolled_date DESC.
        Map<String, List<String>> allPsIdsByUser = new LinkedHashMap<>();
        for (StudentListV2Projection p : projections) {
            if (p.getUserId() == null) continue;
            String psId = p.getPackageSessionId();
            if (psId != null) {
                allPsIdsByUser
                        .computeIfAbsent(p.getUserId(), k -> new ArrayList<>())
                        .add(psId);
            }
        }

        List<StudentListV2Projection> ordered = pagedUserIds.stream()
                .map(projMap::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<StudentV2DTO> content = mapProjectionsToDTOs(ordered);
        // Attach the per-user enrollment fan-out, dedup preserving order.
        for (StudentV2DTO dto : content) {
            List<String> psIds = allPsIdsByUser.getOrDefault(dto.getUserId(), new ArrayList<>());
            dto.setAllPackageSessionIds(psIds.stream().distinct().collect(Collectors.toList()));
        }
        // No enrichWithUserCredentials on the slim path — password isn't shown in the list.

        long totalElements = idPage.getTotalElements();
        int totalPages = (int) Math.ceil((double) totalElements / pageSize);
        return ResponseEntity.ok(AllStudentV2Response.builder()
                .content(content)
                .pageNo(pageNo)
                .pageSize(pageSize)
                .totalElements(totalElements)
                .totalPages(totalPages)
                .last(pageNo >= totalPages - 1)
                .build());
    }

    private Pageable createPageable(StudentListFilter filter, int pageNo, int pageSize) {
        Sort sort = ListService.createSortObject(filter.getSortColumns());
        return PageRequest.of(pageNo, pageSize, sort);
    }

    private Page<StudentListV2Projection> fetchStudentPage(StudentListFilter filter, Pageable pageable) {
        boolean hasCustomFieldFilters = filter.getCustomFieldFilters() != null && !filter.getCustomFieldFilters().isEmpty();
        boolean hasEnrollInviteFilter = filter.getServerEnrollInviteIds() != null && !filter.getServerEnrollInviteIds().isEmpty();
        // Use custom repo methods when custom field filters or enroll invite filters are present
        boolean useCustomRepo = hasCustomFieldFilters || hasEnrollInviteFilter;

        if (StringUtils.hasText(filter.getName())) {
            if (useCustomRepo) {
                return instituteStudentRepository.getAllStudentV2WithSearchAndCustomFieldFilters(
                        filter.getName(),
                        filter.getInstituteIds(),
                        filter.getStatuses(),
                        filter.getPaymentStatuses(),
                        List.of(StatusEnum.ACTIVE.name()),
                        filter.getSources(),
                        filter.getTypes(),
                        filter.getTypeIds(),
                        filter.getDestinationPackageSessionIds(),
                        filter.getLevelIds(),
                        filter.getSubOrgUserTypes(),
                        filter.getCustomFieldFilters(),
                        filter.getStartDate(),
                        filter.getEndDate(),
                        filter.getServerEnrollInviteIds(),
                        filter.getEnrollInvitePackageSessionIds(),
                        pageable);
            } else {
                return instituteStudentRepository.getAllStudentV2WithSearchRaw(
                        filter.getName(),
                        filter.getInstituteIds(),
                        filter.getStatuses(),
                        filter.getPaymentStatuses(),
                        List.of(StatusEnum.ACTIVE.name()),
                        filter.getSources(),
                        filter.getTypes(),
                        filter.getTypeIds(),
                        filter.getDestinationPackageSessionIds(),
                        filter.getLevelIds(),
                        filter.getSubOrgUserTypes(),
                        filter.getStartDate(),
                        filter.getEndDate(),
                        pageable);
            }
        }

        if (!filter.getInstituteIds().isEmpty()) {
            if (useCustomRepo) {
                return instituteStudentRepository.getAllStudentV2WithFilterAndCustomFieldFilters(
                        filter.getStatuses(),
                        filter.getGender(),
                        filter.getInstituteIds(),
                        filter.getGroupIds(),
                        filter.getPackageSessionIds(),
                        filter.getPaymentStatuses(),
                        List.of(StatusEnum.ACTIVE.name()),
                        filter.getSources(),
                        filter.getTypes(),
                        filter.getTypeIds(),
                        filter.getDestinationPackageSessionIds(),
                        filter.getLevelIds(),
                        filter.getSubOrgUserTypes(),
                        filter.getCustomFieldFilters(),
                        filter.getStartDate(),
                        filter.getEndDate(),
                        filter.getServerEnrollInviteIds(),
                        filter.getEnrollInvitePackageSessionIds(),
                        pageable);
            } else {
                // Use existing @Query method
                return instituteStudentRepository.getAllStudentV2WithFilterRaw(
                        filter.getStatuses(),
                        filter.getGender(),
                        filter.getInstituteIds(),
                        filter.getGroupIds(),
                        filter.getPackageSessionIds(),
                        filter.getPaymentStatuses(),
                        List.of(StatusEnum.ACTIVE.name()),
                        filter.getSources(),
                        filter.getTypes(),
                        filter.getTypeIds(),
                        filter.getDestinationPackageSessionIds(),
                        filter.getLevelIds(),
                        filter.getSubOrgUserTypes(),
                        filter.getStartDate(),
                        filter.getEndDate(),
                        pageable);
            }
        }

        return null;
    }

    private List<StudentV2DTO> mapProjectionsToDTOs(List<StudentListV2Projection> projections) {
        List<StudentV2DTO> dtos = new ArrayList<>();
        ObjectMapper mapper = new ObjectMapper();

        for (StudentListV2Projection p : projections) {
            StudentV2DTO dto = new StudentV2DTO();

            dto.setId(p.getId());
            dto.setUserId(p.getUserId());
            dto.setUsername(p.getUsername());
            dto.setEmail(p.getEmail());
            dto.setFullName(p.getFullName());
            dto.setAddressLine(p.getAddressLine());
            dto.setRegion(p.getRegion());
            dto.setCity(p.getCity());
            dto.setPinCode(p.getPinCode());
            dto.setMobileNumber(p.getPhone());

            dto.setDateOfBirth(parseTimestamp(p.getDateOfBirth()));
            dto.setGender(p.getGender());
            dto.setFathersName(p.getFathersName());
            dto.setMothersName(p.getMothersName());
            dto.setParentsMobileNumber(p.getParentsMobileNumber());
            dto.setParentsEmail(p.getParentsEmail());
            dto.setLinkedInstituteName(p.getLinkedInstituteName());
            dto.setCreatedAt(parseTimestamp(p.getCreatedAt()));
            dto.setUpdatedAt(parseTimestamp(p.getUpdatedAt()));
            dto.setFaceFileId(p.getFaceFileId());
            dto.setExpiryDate(parseTimestamp(p.getExpiryDate()));
            dto.setParentsToMotherMobileNumber(p.getParentsToMotherMobileNumber());
            dto.setParentsToMotherEmail(p.getParentsToMotherEmail());

            dto.setPaymentStatus(p.getPaymentStatus());
            dto.setPackageSessionId(p.getPackageSessionId());
            dto.setAccessDays(p.getAccessDays());
            dto.setInstituteEnrollmentNumber(p.getInstituteEnrollmentNumber());
            dto.setInstituteId(p.getInstituteId());
            dto.setGroupId(p.getGroupId());
            dto.setStatus(p.getStatus());

            dto.setDestinationPackageSessionId(p.getDestinationPackageSessionId());

            // ---- ADDED MAPPINGS ----
            dto.setPaymentAmount(p.getPaymentAmount());
            dto.setSource(p.getSource());
            dto.setType(p.getType());
            dto.setTypeId(p.getTypeId());

            PaymentPlan paymentPlan = JsonUtil.fromJson(p.getPaymentPlanJson(), PaymentPlan.class);
            if (paymentPlan != null) {
                dto.setPaymentPlan(paymentPlan.mapToPaymentPlanDTO());
            }
            PaymentOption paymentOption = JsonUtil.fromJson(p.getPaymentOptionJson(), PaymentOption.class);
            if (paymentOption != null) {
                dto.setPaymentOption(paymentOption.mapToPaymentOptionDTO());
            }
            dto.setCustomFields(parseCustomFields(mapper, p.getCustomFieldsJson()));
            dto.setEnrollInviteId(p.getEnrollInviteId());
            dto.setEnrollInviteName(p.getEnrollInviteName());
            dto.setDesiredLevelId(p.getDesiredLevelId());

            dto.setSubOrgId(p.getSubOrgId());
            dto.setSubOrgName(p.getSubOrgName());
            dto.setCommaSeparatedOrgRoles(p.getCommaSeparatedOrgRoles());

            dto.setTncAccepted(p.getTncAccepted());
            dto.setTncFileId(p.getTncFileId());
            dto.setTncAcceptedDate(p.getTncAcceptedDate());
            dto.setIsAudienceOnly(p.getIsAudienceOnly());

            dtos.add(dto);
        }

        return dtos;
    }

    private <T> T parseJsonSafe(ObjectMapper mapper, String json, Class<T> clazz) {
        if (json == null || json.trim().isEmpty())
            return null;
        try {
            return mapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            // Log error if needed
            return null;
        }
    }

    private Map<String, String> parseCustomFields(ObjectMapper mapper, String json) {
        if (json == null || json.equals("[]"))
            return new HashMap<>();
        try {
            List<CustomFieldValueMap> list = mapper.readValue(json, new TypeReference<List<CustomFieldValueMap>>() {
            });
            Map<String, String> map = new HashMap<>();
            for (CustomFieldValueMap cf : list) {
                map.put(cf.getCustomFieldId(), cf.getValue());
            }
            return map;
        } catch (JsonProcessingException e) {
            return new HashMap<>();
        }
    }

    private void enrichWithUserCredentials(List<StudentV2DTO> dtos) {
        List<String> userIds = dtos.stream()
                .map(StudentV2DTO::getUserId)
                .filter(Objects::nonNull)
                .toList();

        List<UserCredentials> creds = getUsersCredentialFromAuthService(userIds);
        Map<String, UserCredentials> credsMap = creds.stream()
                .collect(Collectors.toMap(UserCredentials::getUserId, c -> c));

        for (StudentV2DTO dto : dtos) {
            UserCredentials c = credsMap.get(dto.getUserId());
            if (c != null) {
                dto.setPassword(c.getPassword());
            }
        }
    }

    private AllStudentV2Response buildResponse(List<StudentV2DTO> content, Page<StudentListV2Projection> page,
            int pageSize, boolean unused) {
        if (page == null) {
            return AllStudentV2Response.builder()
                    .content(content)
                    .pageNo(0)
                    .pageSize(pageSize)
                    .totalElements(0)
                    .totalPages(0)
                    .last(true)
                    .build();
        }

        return AllStudentV2Response.builder()
                .content(content)
                .pageNo(page.getNumber())
                .pageSize(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .last(page.isLast())
                .build();
    }

    private Date parseTimestamp(String ts) {
        if (ts == null)
            return null;
        try {
            return Timestamp.valueOf(ts); // parses "yyyy-MM-dd HH:mm:ss.SSSSSS"
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public ResponseEntity<byte[]> getStudentsCsvExport(CustomUserDetails user, StudentListFilter studentListFilter,
            int pageNo, int pageSize) {

        // Get the total number of pages for the given filter
        int totalPages = getLinkedStudents(user, studentListFilter, pageNo, pageSize).getBody().getTotalPages();
        // List to store all employees
        List<StudentDTO> allStudents = new ArrayList<>();

        // Loop through all pages and append data
        for (int page = 0; page < totalPages; page++) {
            // Retrieve employees for the current page and add them to the list
            List<StudentDTO> employees = getLinkedStudents(user, studentListFilter, page, pageSize).getBody()
                    .getContent();
            allStudents.addAll(employees);
        }

        return DataToCsvConverter.convertListToCsv(allStudents);
    }

    public ResponseEntity<byte[]> getStudentsBasicDetailsCsv(CustomUserDetails user,
            StudentListFilter studentListFilter, int pageNo, int pageSize) {
        // Get the total number of pages
        int totalPages = getLinkedStudents(user, studentListFilter, pageNo, pageSize).getBody().getTotalPages();

        // Map to store students and List to collect user IDs
        Map<String, StudentDTO> studentMap = new HashMap<>();
        List<String> userIds = new ArrayList<>();

        // Fetch students across all pages
        for (int page = 0; page < totalPages; page++) {
            for (StudentDTO student : getLinkedStudents(user, studentListFilter, page, pageSize).getBody()
                    .getContent()) {
                studentMap.put(student.getUserId(), student);
                userIds.add(student.getUserId());
            }
        }

        // Fetch user credentials
        List<UserCredentials> userCredentials = getUsersCredentialFromAuthService(userIds);

        // Convert to StudentBasicDetailsDTO
        List<StudentBasicDetailsDTO> studentBasicDetailsDTOS = new ArrayList<>();
        for (UserCredentials userCredential : userCredentials) {
            StudentDTO studentDTO = studentMap.get(userCredential.getUserId());
            studentBasicDetailsDTOS.add(new StudentBasicDetailsDTO(
                    studentDTO.getFullName(),
                    studentDTO.getInstituteEnrollmentId(),
                    userCredential.getUsername(),
                    userCredential.getPassword()));
        }

        return DataToCsvConverter.convertListToCsv(studentBasicDetailsDTOS);
    }

    public List<UserCredentials> getUsersCredentialFromAuthService(List<String> userIds) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    applicationName, HttpMethod.POST.name(), authServerBaseUrl,
                    StudentConstants.USERS_CREDENTIALS_ROUTE, userIds);

            return objectMapper.readValue(response.getBody(),
                    new TypeReference<List<UserCredentials>>() {
                    });

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
