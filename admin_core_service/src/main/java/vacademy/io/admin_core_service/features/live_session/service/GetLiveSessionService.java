package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionListDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
public class GetLiveSessionService {
    @Autowired
    private LiveSessionRepository sessionRepository;

    public List<LiveSessionListDTO> getLiveSession(String instituteId , CustomUserDetails user) {

        List<LiveSessionRepository.LiveSessionListProjection> projections =
                sessionRepository.findCurrentlyLiveSessions(instituteId);

        return projections.stream().map(p -> new LiveSessionListDTO(
                p.getSessionId(),
                p.getMeetingDate(),
                p.getStartTime(),
                p.getLastEntryTime(),
                p.getRecurrenceType(),
                p.getAccessLevel(),
                p.getTitle(),
                p.getSubject(),
                p.getMeetingLink()
        )).toList();
    }

}
