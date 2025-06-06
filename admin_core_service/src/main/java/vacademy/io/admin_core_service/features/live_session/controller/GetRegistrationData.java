package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.service.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin-core-service/live-session")
@RequiredArgsConstructor
public class GetRegistrationData {

    private final GetRegistrationDataService getRegistrationFromResponseDTO;

    @Autowired
    RegistrationService registrationService;

    @GetMapping("/get-registration-data")
    ResponseEntity<RegistrationFromResponseDTO> getRegistrationData(@RequestParam("sessionId") String SessionId) {
        return ResponseEntity.ok( getRegistrationFromResponseDTO.getRegistrationData(SessionId));
    }

    @PostMapping("/register-guest-user")
    ResponseEntity<Boolean> registerGuestUser(@RequestBody GuestRegistrationRequestDTO requestDTO){
        registrationService.saveGuestUserDetails(requestDTO);
        return ResponseEntity.ok(true);
    }
}
