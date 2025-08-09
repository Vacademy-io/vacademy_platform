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
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentBasicDetailsDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentV2DTO;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldValueMap;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentV2Response;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository.StudentListV2Projection;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.service.StudentFilterService;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.*;
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
            studentPage = studentFilterService.getAllStudentWithSearch(studentListFilter.getName(),
                    studentListFilter.getInstituteIds(), pageable);
        }

        if (Objects.isNull(studentPage) && !studentListFilter.getInstituteIds().isEmpty()) {
            studentPage = studentFilterService.getAllStudentWithFilter(studentListFilter.getStatuses(),
                    studentListFilter.getGender(), studentListFilter.getInstituteIds(), studentListFilter.getGroupIds(),
                    studentListFilter.getPackageSessionIds(), pageable);
        }

        return ResponseEntity.ok(createAllStudentResponseFromPaginatedData(studentPage));

    }

    private AllStudentResponse createAllStudentResponseFromPaginatedData(Page<StudentDTO> studentPage) {
        List<StudentDTO> content = new ArrayList<>();
        if (!Objects.isNull(studentPage)) {
            content = studentPage.getContent();
            return AllStudentResponse.builder().content(content).pageNo(studentPage.getNumber())
                    .last(studentPage.isLast()).pageSize(studentPage.getSize()).totalPages(studentPage.getTotalPages())
                    .totalElements(studentPage.getTotalElements()).build();
        }
        return AllStudentResponse.builder().totalPages(0).content(content).pageNo(0).totalPages(0).build();
    }

    public ResponseEntity<AllStudentV2Response> getLinkedStudentsV2(CustomUserDetails user,
            StudentListFilter studentListFilter, int pageNo, int pageSize) {

        Sort thisSort = ListService.createSortObject(studentListFilter.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        Page<StudentListV2Projection> page = null;

        if (StringUtils.hasText(studentListFilter.getName())) {
            page = instituteStudentRepository.getAllStudentV2WithSearchRaw(
                    studentListFilter.getName(),
                    studentListFilter.getInstituteIds(),
                    studentListFilter.getStatuses(),
                    studentListFilter.getPaymentStatuses(),
                    List.of(StatusEnum.ACTIVE.name()),
                    pageable);
        }

        if (Objects.isNull(page) && !studentListFilter.getInstituteIds().isEmpty()) {
            page = instituteStudentRepository.getAllStudentV2WithFilterRaw(
                    studentListFilter.getStatuses(),
                    studentListFilter.getGender(),
                    studentListFilter.getInstituteIds(),
                    studentListFilter.getGroupIds(),
                    studentListFilter.getPackageSessionIds(),
                    studentListFilter.getPaymentStatuses(),
                    List.of(StatusEnum.ACTIVE.name()),
                    pageable);
        }

        List<StudentV2DTO> content = new ArrayList<>();
        if (page != null) {
            for (StudentListV2Projection p : page.getContent()) {
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

                try {
                    if (p.getCustomFieldsJson() != null && !p.getCustomFieldsJson().equals("[]")) {
                        List<CustomFieldValueMap> customFieldsList = new ObjectMapper().readValue(
                                p.getCustomFieldsJson(),
                                new TypeReference<List<CustomFieldValueMap>>() {
                                });
                        Map<String, String> customFieldsMap = new HashMap<>();
                        for (CustomFieldValueMap cf : customFieldsList) {
                            customFieldsMap.put(cf.getCustomFieldId(), cf.getValue());
                        }
                        dto.setCustomFields(customFieldsMap);
                    } else {
                        dto.setCustomFields(new HashMap<>());
                    }
                } catch (JsonProcessingException e) {
                    dto.setCustomFields(new HashMap<>());
                }

                content.add(dto);
            }

            List<String> userIds = content.stream()
                    .map(StudentV2DTO::getUserId)
                    .filter(Objects::nonNull)
                    .toList();
            List<UserCredentials> creds = getUsersCredentialFromAuthService(userIds);
            Map<String, UserCredentials> map = new HashMap<>();
            for (UserCredentials c : creds) {
                map.put(c.getUserId(), c);
            }
            for (StudentV2DTO dto : content) {
                UserCredentials c = map.get(dto.getUserId());
                if (c != null)
                    dto.setPassword(c.getPassword());
            }

            AllStudentV2Response resp = AllStudentV2Response.builder()
                    .content(content)
                    .pageNo(page.getNumber())
                    .pageSize(page.getSize())
                    .totalElements(page.getTotalElements())
                    .totalPages(page.getTotalPages())
                    .last(page.isLast())
                    .build();
            return ResponseEntity.ok(resp);
        }

        return ResponseEntity.ok(AllStudentV2Response.builder()
                .content(content)
                .pageNo(0)
                .pageSize(pageSize)
                .totalElements(0)
                .totalPages(0)
                .last(true)
                .build());
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
