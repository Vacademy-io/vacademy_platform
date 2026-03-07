package vacademy.io.admin_core_service.features.admission.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListRequestDTO;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;

public interface AdmissionResponsesRepositoryCustom {
    Page<AudienceResponse> findAdmissionResponses(AdmissionResponsesListRequestDTO filter, Pageable pageable);
}

