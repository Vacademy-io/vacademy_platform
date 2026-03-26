package vacademy.io.admin_core_service.features.agent.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiRequest;
import vacademy.io.admin_core_service.features.agent.dto.ChatbotAiResponse;
import vacademy.io.admin_core_service.features.agent.service.ChatbotAiService;

@RestController
@RequestMapping("/admin-core-service/internal/chatbot-ai")
@RequiredArgsConstructor
@Slf4j
public class ChatbotAiInternalController {

    private final ChatbotAiService chatbotAiService;

    @PostMapping("/respond")
    public ResponseEntity<ChatbotAiResponse> respond(@RequestBody ChatbotAiRequest request) {
        log.info("Chatbot AI request received: institute={}", request.getInstituteId());
        ChatbotAiResponse response = chatbotAiService.respond(request);
        return ResponseEntity.ok(response);
    }
}
