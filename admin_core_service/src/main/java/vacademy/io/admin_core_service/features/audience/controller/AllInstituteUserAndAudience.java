package vacademy.io.admin_core_service.features.audience.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.combined.CombinedUserAudienceRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.combined.CombinedUserAudienceResponseDTO;
import vacademy.io.admin_core_service.features.audience.service.DistinctUserAudienceService;

@RestController
@RequestMapping("/admin-core-service/v1/audience")
public class AllInstituteUserAndAudience {

    @Autowired
    private DistinctUserAudienceService distinctUserAudienceService;


    @PostMapping("/distinct-institute-users-and-audience")
    public ResponseEntity<CombinedUserAudienceResponseDTO> getCombinedUsersWithCustomFields(
            @Valid @RequestBody CombinedUserAudienceRequestDTO request) {
        CombinedUserAudienceResponseDTO response = distinctUserAudienceService.getCombinedUsersWithCustomFields(request);
        return ResponseEntity.ok(response);
    }
}
