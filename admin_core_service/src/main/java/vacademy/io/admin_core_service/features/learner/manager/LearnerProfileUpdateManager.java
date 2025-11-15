package vacademy.io.admin_core_service.features.learner.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.dto.request.CustomFieldValueDto;
import vacademy.io.admin_core_service.features.common.service.CustomFieldValueService;
import vacademy.io.admin_core_service.features.learner.dto.LearnerProfileUpdateRequestDTO;
import vacademy.io.admin_core_service.features.learner.service.LearnerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

@Component
public class LearnerProfileUpdateManager {

    @Autowired
    private LearnerService learnerService;

    @Autowired
    private AuthService authService;

    @Autowired
    private CustomFieldValueService customFieldValueService;

    @Transactional
    public void updateLearnerProfile(LearnerProfileUpdateRequestDTO request, CustomUserDetails actor) {
        if (request == null) {
            throw new VacademyException("Request body is required");
        }

        String userId = resolveUserId(request, actor);
        if (!StringUtils.hasText(userId)) {
            throw new VacademyException("User id is required");
        }

        if (request.getUserDetails() != null && !StringUtils.hasText(request.getUserDetails().getId())) {
            request.getUserDetails().setId(userId);
        }

        if (request.getLearnerExtraDetails() != null) {
            learnerService.updateLearnerExtraDetails(request.getLearnerExtraDetails(), userId);
        }

        UserDTO userDTO = request.getUserDetails();
        if (userDTO != null) {
            authService.updateUser(userDTO, userId);
            learnerService.updateLearnerDetail(userDTO,request.getLearnerExtraDetails());
        }

        if (!CollectionUtils.isEmpty(request.getCustomFieldValues())) {
            customFieldValueService.upsertCustomFieldValues(request.getCustomFieldValues());
        }
    }

    private String resolveUserId(LearnerProfileUpdateRequestDTO request, CustomUserDetails actor) {
        if (request.getUserDetails() != null && StringUtils.hasText(request.getUserDetails().getId())) {
            return request.getUserDetails().getId();
        }
        if (!CollectionUtils.isEmpty(request.getCustomFieldValues())) {
            for (CustomFieldValueDto customFieldValue : request.getCustomFieldValues()) {
                if (customFieldValue != null && StringUtils.hasText(customFieldValue.getSourceId())) {
                    return customFieldValue.getSourceId();
                }
            }
        }
        if (actor != null && StringUtils.hasText(actor.getUserId())) {
            return actor.getUserId();
        }
        return null;
    }
}

