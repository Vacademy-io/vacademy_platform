package vacademy.io.admin_core_service.features.institute_learner.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto.AllStudentStatsResponse;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto.StudentStatsDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto.StudentStatsFilter;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.Pageable;

@Service
public class StudentStatsManager {

    @Autowired
    private AuthService authService;

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    public AllStudentStatsResponse getStudentStats(
            CustomUserDetails user,
            StudentStatsFilter studentStatsFilter,
            int pageNo,
            int pageSize
    ) {

        // Null → Empty List fallback
        List<String> packageSessionIds =
                Optional.ofNullable(studentStatsFilter.getPackageSessionIds()).orElse(Collections.emptyList());

        List<String> userTypes =
                Optional.ofNullable(studentStatsFilter.getUserTypes()).orElse(Collections.emptyList());

        org.springframework.data.domain.Pageable pageable = createPageable(pageNo, pageSize, studentStatsFilter.getSortColumns());

        Page<Object[]> result = studentSessionRepository.findUserStatsWithTypePaginated(
                studentStatsFilter.getInstituteId(),
                studentStatsFilter.getStartDateInUtc(),
                studentStatsFilter.getEndDateInUtc(),
                packageSessionIds,
                packageSessionIds.size(),
                userTypes,
                userTypes.size(),
                pageable
        );

        // Extract userIds safely
        List<String> userIds = result.getContent()
                .stream()
                .map(row -> (String) safe(row, 0))
                .filter(Objects::nonNull)
                .toList();

        // Fetch users
        Map<String, UserDTO> usersMap = authService.getUsersFromAuthServiceByUserIds(userIds)
                .stream()
                .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a)); // avoid merge errors

        // Build stats list safely
        List<StudentStatsDTO> statsList = result.getContent()
                .stream()
                .map(row -> {
                    String userId = (String) safe(row, 0);

                    return StudentStatsDTO.builder()
                            .userType((String) safe(row, 1))
                            // FIX: Use convertToList helper instead of direct casting
                            .packageSessionIds(convertToList(safe(row, 2)))
                            .commaSeparatedOrgRoles((String) safe(row, 3))
                            .createdAt((Date) safe(row, 4))
                            .startDate(studentStatsFilter.getStartDateInUtc())
                            .endDate(studentStatsFilter.getEndDateInUtc())
                            .userDTO(usersMap.getOrDefault(userId, null))
                            .build();
                })
                .toList();

        return AllStudentStatsResponse.builder()
                .content(statsList)
                .pageNo(result.getNumber())
                .pageSize(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .last(result.isLast())
                .build();
    }

    // Utility: safe array access
    private Object safe(Object[] row, int index) {
        if (row == null || row.length <= index) return null;
        return row[index];
    }

    // FIX: Helper to safely convert String[] (from DB) to List<String>
    private List<String> convertToList(Object obj) {
        if (obj == null) {
            return new ArrayList<>();
        }
        if (obj instanceof String[]) {
            return Arrays.asList((String[]) obj);
        }
        if (obj instanceof List) {
            return (List<String>) obj;
        }
        return new ArrayList<>();
    }

    public Pageable createPageable(int page, int size, Map<String, String> sortCols) {
        Sort sort = ListService.createSortObject(sortCols);
        return PageRequest.of(page, size, sort);
    }
}