package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner.constants.AssessmentServerRouteConstants;
import vacademy.io.admin_core_service.features.learner.dto.LeanerDashBoardDetailDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.admin_core_service.features.notification.dto.NotificationToUserDTO;
import vacademy.io.admin_core_service.features.notification.service.NotificationService;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashMap;
import java.util.List;

@Service
public class LearnerDashBoardService {

    @Autowired
    private SlideRepository slideRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Autowired
    private NotificationService notificationService;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${assessment.server.baseurl}")
    private String assessmentServerBaseUrl;

    public LeanerDashBoardDetailDTO getLearnerDashBoardDetail(String instituteId, CustomUserDetails user) {

        return new LeanerDashBoardDetailDTO(
                packageRepository.countDistinctPackagesByUserIdAndInstituteId(user.getUserId(), instituteId),
                0,
                slideRepository.findRecentIncompleteSlidesByUserId(user.getUserId(), List.of(SlideStatus.PUBLISHED.name()))
        );
    }

    private int getAssessmentCountForUser(CustomUserDetails user,String userId, String instituteId) {
        // Validate inputs
        if (userId == null || userId.isEmpty() || instituteId == null || instituteId.isEmpty()) {
            throw new IllegalArgumentException("userId and instituteId must not be null or empty");
        }

        // Construct the URL with query parameters
        String urlWithParams = AssessmentServerRouteConstants.GET_COUNT_OF_ASSESSMENTS_FOR_USER
                + "?userId=" + userId + "&instituteId=" + instituteId;

        // Make the HMAC-signed request
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                assessmentServerBaseUrl,
                urlWithParams,
                null
        );


        // Parse the response
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(response.getBody(), new TypeReference<Integer>() {});
        } catch (JsonProcessingException e) {
            throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to retrieve assessment count: " + e.getMessage());
        }
    }
}
