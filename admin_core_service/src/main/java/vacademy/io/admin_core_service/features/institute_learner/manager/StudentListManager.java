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
import vacademy.io.admin_core_service.features.institute_learner.constants.StudentConstants;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentBasicDetailsDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.service.StudentFilterService;
import vacademy.io.common.auth.dto.UserCredentials;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.core.utils.DataToCsvConverter;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;

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

    public ResponseEntity<AllStudentResponse> getLinkedStudents(CustomUserDetails user, StudentListFilter studentListFilter, int pageNo, int pageSize) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = ListService.createSortObject(studentListFilter.getSortColumns());

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        // Retrieve employees based on the filter criteria
        Page<StudentDTO> studentPage = null;

        // Check if the filter contains a numeric name
        if (StringUtils.hasText(studentListFilter.getName())) {
            studentPage = studentFilterService.getAllStudentWithSearch(studentListFilter.getName(), studentListFilter.getInstituteIds(), pageable);
        }

        if (Objects.isNull(studentPage) && !studentListFilter.getInstituteIds().isEmpty()) {
            studentPage = studentFilterService.getAllStudentWithFilter(studentListFilter.getStatuses(), studentListFilter.getGender(), studentListFilter.getInstituteIds(), studentListFilter.getGroupIds(), studentListFilter.getPackageSessionIds(), pageable);
        }

        return ResponseEntity.ok(createAllStudentResponseFromPaginatedData(studentPage));

    }

    private AllStudentResponse createAllStudentResponseFromPaginatedData(Page<StudentDTO> studentPage) {
        List<StudentDTO> content = new ArrayList<>();
        if (!Objects.isNull(studentPage)) {
            content = studentPage.getContent();
            return AllStudentResponse.builder().content(content).pageNo(studentPage.getNumber()).last(studentPage.isLast()).pageSize(studentPage.getSize()).totalPages(studentPage.getTotalPages()).totalElements(studentPage.getTotalElements()).build();
        }
        return AllStudentResponse.builder().totalPages(0).content(content).pageNo(0).totalPages(0).build();
    }

    public ResponseEntity<byte[]> getStudentsCsvExport(CustomUserDetails user, StudentListFilter studentListFilter, int pageNo, int pageSize) {

        // Get the total number of pages for the given filter
        int totalPages = getLinkedStudents(user, studentListFilter, 0, 100).getBody().getTotalPages();

        // List to store all employees
        List<StudentDTO> allStudents = new ArrayList<>();

        // Loop through all pages and append data
        for (int page = 0; page < totalPages; page++) {
            // Retrieve employees for the current page and add them to the list
            List<StudentDTO> employees = getLinkedStudents(user, studentListFilter, page, 100).getBody().getContent();
            allStudents.addAll(employees);
        }

        return DataToCsvConverter.convertListToCsv(allStudents);
    }

    public ResponseEntity<byte[]> getStudentsBasicDetailsCsv(CustomUserDetails user, StudentListFilter studentListFilter, int pageNo, int pageSize) {
        // Get the total number of pages
        int totalPages = getLinkedStudents(user, studentListFilter, 0, 100).getBody().getTotalPages();

        // Map to store students and List to collect user IDs
        Map<String, StudentDTO> studentMap = new HashMap<>();
        List<String> userIds = new ArrayList<>();

        // Fetch students across all pages
        for (int page = 0; page < totalPages; page++) {
            for (StudentDTO student : getLinkedStudents(user, studentListFilter, page, 100).getBody().getContent()) {
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
                    userCredential.getPassword(),
                    userCredential.getUsername(),
                    studentDTO.getInstituteEnrollmentId()
            ));
        }

        return DataToCsvConverter.convertListToCsv(studentBasicDetailsDTOS);
    }

    public List<UserCredentials> getUsersCredentialFromAuthService(List<String> userIds) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                    applicationName, HttpMethod.POST.name(), authServerBaseUrl,
                    StudentConstants.USERS_CREDENTIALS_ROUTE, userIds
            );

            return objectMapper.readValue(response.getBody(),
                    new TypeReference<List<UserCredentials>>() {});

        } catch (Exception e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
