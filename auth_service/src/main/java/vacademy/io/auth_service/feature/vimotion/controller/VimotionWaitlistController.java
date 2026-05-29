package vacademy.io.auth_service.feature.vimotion.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.auth_service.feature.vimotion.dto.JoinWaitlistRequest;
import vacademy.io.auth_service.feature.vimotion.dto.WaitlistCountResponse;
import vacademy.io.auth_service.feature.vimotion.dto.WaitlistStatusResponse;
import vacademy.io.auth_service.feature.vimotion.service.WaitlistService;

@RestController
@RequestMapping("/auth-service/v1/vimotion/waitlist")
public class VimotionWaitlistController {

    @Autowired
    private WaitlistService waitlistService;

    @PostMapping("/join")
    public WaitlistStatusResponse join(@RequestBody JoinWaitlistRequest request) {
        return waitlistService.join(
                request == null ? null : request.getFullName(),
                request == null ? null : request.getEmail(),
                request == null ? null : request.getPhoneNumber(),
                request == null ? null : request.getReferralCode(),
                request == null ? null : request.getSource());
    }

    @GetMapping("/status")
    public WaitlistStatusResponse status(@RequestParam("email") String email) {
        return waitlistService.status(email);
    }

    @GetMapping("/count")
    public WaitlistCountResponse count() {
        return WaitlistCountResponse.builder().total(waitlistService.totalCount()).build();
    }
}
