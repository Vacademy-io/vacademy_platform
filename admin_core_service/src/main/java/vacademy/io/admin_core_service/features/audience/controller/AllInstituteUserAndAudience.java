package vacademy.io.admin_core_service.features.audience.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.audience.dto.combined.CombinedUserAudienceRequestDTO;
import vacademy.io.admin_core_service.features.audience.dto.combined.CombinedUserAudienceResponseDTO;
import vacademy.io.admin_core_service.features.audience.service.DistinctUserAudienceService;
import vacademy.io.admin_core_service.features.common.service.CustomFieldListFilterResolver;

@RestController
@RequestMapping("/admin-core-service/v1/audience")
public class AllInstituteUserAndAudience {

    @Autowired
    private DistinctUserAudienceService distinctUserAudienceService;

    @Autowired
    private CustomFieldListFilterResolver customFieldListFilterResolver;


    @PostMapping("/distinct-institute-users-and-audience")
    public ResponseEntity<CombinedUserAudienceResponseDTO> getCombinedUsersWithCustomFields(
            @Valid @RequestBody CombinedUserAudienceRequestDTO request) {
        CombinedUserAudienceResponseDTO response = distinctUserAudienceService.getCombinedUsersWithCustomFields(request);
        return ResponseEntity.ok(response);
    }

    /**
     * Distinct values a custom field holds across the institute's contacts —
     * the union of learner (USER) and lead (AUDIENCE_RESPONSE) answers.
     * Searchable and paginated; powers the multi-select custom-field dropdowns
     * on the All Contacts filter bar, mirroring the leads and students
     * distinct-value endpoints for their surfaces.
     */
    @GetMapping("/contact-custom-field-values")
    public ResponseEntity<Page<String>> getContactCustomFieldValues(
            @RequestParam("instituteId") String instituteId,
            @RequestParam("customFieldId") String customFieldId,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(name = "pageNo", defaultValue = "0") int pageNo,
            @RequestParam(name = "pageSize", defaultValue = "20") int pageSize) {
        return ResponseEntity.ok(customFieldListFilterResolver.getContactCustomFieldValues(
                instituteId, customFieldId, search, pageNo, pageSize));
    }
}
