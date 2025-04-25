package vacademy.io.media_service.evaluation_ai.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserResponse;
import vacademy.io.media_service.evaluation_ai.entity.EvaluationUser;
import vacademy.io.media_service.evaluation_ai.enums.EvaluationUserSourceEnum;
import vacademy.io.media_service.evaluation_ai.repository.UserEvaluationRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AiEvaluationService {

    @Autowired
    private UserEvaluationRepository userEvaluationRepository;

    @Autowired
    private AuthService authService;

    public List<EvaluationUserResponse> getEvaluationUsersByAssessmentId(String assessmentId) {
        // Step 1: Fetch EvaluationUser records
        List<EvaluationUser> users = userEvaluationRepository.findBySourceTypeAndSourceId(
                EvaluationUserSourceEnum.ASSESSMENT_EVALUATION.name(), assessmentId
        );

        // Step 2: Extract user IDs
        List<String> userIds = users.stream()
                .map(EvaluationUser::getUserId)
                .distinct()
                .toList();

        // Step 3: Get user details from Auth Service
        List<UserDTO> userDetails = authService.getUsersFromAuthServiceByUserIds(userIds);

        // Step 4: Map userId to UserDTO for quick lookup
        Map<String, UserDTO> userDetailMap = userDetails.stream()
                .collect(Collectors.toMap(UserDTO::getId, u -> u));

        // Step 5: Build and return response
        return users.stream().map(user -> {
            EvaluationUserResponse response = new EvaluationUserResponse();
            response.setId(user.getId());
            response.setResponseJson(user.getResponseJson());
            response.setUserId(user.getUserId());

            UserDTO dto = userDetailMap.get(user.getUserId());
            if (dto != null) {
                response.setFullName(dto.getFullName());
                response.setEmail(dto.getEmail());
                response.setContactNumber(dto.getMobileNumber());
            }

            return response;
        }).toList();
    }

}
