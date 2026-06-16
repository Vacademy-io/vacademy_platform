package vacademy.io.notification_service.features.chat.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.notification_service.features.chat.dto.ChatPeopleSearchResponse;
import vacademy.io.notification_service.features.chat.dto.PeopleSearchRequest;
import vacademy.io.notification_service.features.chat.security.ChatIdentity;
import vacademy.io.notification_service.features.chat.service.ChatPeopleService;

@RestController
@RequestMapping("/notification-service/v1/chat/people")
@RequiredArgsConstructor
@Slf4j
@Validated
@CrossOrigin(origins = "*")
public class ChatPeopleController {

    private final ChatPeopleService peopleService;

    @PostMapping("/search")
    public ResponseEntity<ChatPeopleSearchResponse> searchPeople(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestHeader(value = "clientId", required = false) String clientId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody PeopleSearchRequest request) {
        ChatIdentity id = ChatIdentity.from(user, clientId);
        // Forward the caller's auth headers so auth-service can authenticate the server-side search.
        return ResponseEntity.ok(peopleService.search(id.instituteId(), id.userId(), id.role(), request, authHeader, clientId));
    }
}
