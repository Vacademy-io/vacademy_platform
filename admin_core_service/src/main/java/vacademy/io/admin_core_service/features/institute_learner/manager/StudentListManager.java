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
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
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
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

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

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    public ResponseEntity<AllStudentResponse> getLinkedStudents(CustomUserDetails user,
            StudentListFilter studentListFilter, int pageNo, int pageSize) {
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

        Pageable pageable = createPageable(studentListFilter, pageNo, pageSize);
        Page<StudentListV2Projection> page = fetchStudentPage(studentListFilter, pageable);
        List<StudentV2DTO> content = page != null ? mapProjectionsToDTOs(page.getContent()) : new ArrayList<>();

        if (!content.isEmpty()) {
            enrichWithUserCredentials(content);
        }

        return ResponseEntity.ok(buildResponse(content, page, pageSize, false));
    }

    private Pageable createPageable(StudentListFilter filter, int pageNo, int pageSize) {
        Sort sort = ListService.createSortObject(filter.getSortColumns());
        return PageRequest.of(pageNo, pageSize, sort);
    }

    private Page<StudentListV2Projection> fetchStudentPage(StudentListFilter filter, Pageable pageable) {
        boolean hasCustomFieldFilters = filter.getCustomFieldFilters() != null && !filter.getCustomFieldFilters().isEmpty();
        
        if (StringUtils.hasText(filter.getName())) {
            if (hasCustomFieldFilters) {
                // Use custom repository method with custom field filters
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
                        pageable);
            } else {
                // Use existing @Query method
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
                        pageable);
            }
        }

        if (!filter.getInstituteIds().isEmpty()) {
            if (hasCustomFieldFilters) {
                // Use custom repository method with custom field filters
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
            dto.setDesiredLevelId(p.getDesiredLevelId());

            dto.setSubOrgId(p.getSubOrgId());
            dto.setSubOrgName(p.getSubOrgName());
            dto.setCommaSeparatedOrgRoles(p.getCommaSeparatedOrgRoles());
            
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
