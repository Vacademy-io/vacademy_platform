package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
public class GetLiveSessionService {
    @Autowired
    private LiveSessionRepository sessionRepository;

    public List<LiveSession> GetLiveSession(CustomUserDetails user) {
        return sessionRepository.findCurrentlyLiveSessions();
    }

}
