package vacademy.io.admin_core_service.features.parent_portal.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentAssistantRequestDTO;
import vacademy.io.admin_core_service.features.parent_portal.dto.ParentAssistantResponseDTO;
import vacademy.io.admin_core_service.features.parent_portal.service.ParentAssistantService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Parent AI assistant — a free-form Q&A over the guarded child's data. The guard
 * runs inside {@link ParentAssistantService}; the caller is always the JWT user.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/parent-portal/v1/children/{childUserId}")
@RequiredArgsConstructor
public class ParentAssistantController {

    private final ParentAssistantService assistantService;

    @PostMapping("/assistant")
    public ResponseEntity<ParentAssistantResponseDTO> assistant(
            @PathVariable String childUserId,
            @RequestBody ParentAssistantRequestDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        if (request == null || !StringUtils.hasText(request.getQuestion())) {
            return ResponseEntity.ok(new ParentAssistantResponseDTO(null, false));
        }
        String answer = assistantService.answer(user, childUserId, request.getQuestion().trim());
        return ResponseEntity.ok(new ParentAssistantResponseDTO(answer, answer != null && !answer.isBlank()));
    }
}
