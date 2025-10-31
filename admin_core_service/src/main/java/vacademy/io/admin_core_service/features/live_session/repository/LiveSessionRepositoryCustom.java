package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vacademy.io.admin_core_service.features.live_session.dto.SessionSearchRequest;

public interface LiveSessionRepositoryCustom {
    Page<LiveSessionRepository.LiveSessionListProjection> searchSessions(SessionSearchRequest request, Pageable pageable);
}

