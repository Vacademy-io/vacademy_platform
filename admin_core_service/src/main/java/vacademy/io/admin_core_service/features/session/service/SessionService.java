package vacademy.io.admin_core_service.features.session.service;

import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.entity.session.Session;

@Service
@AllArgsConstructor
public class SessionService {

    private SessionRepository sessionRepository;

    public Session createOrGetSession(SessionDTO sessionDTO) {
        Session session = null;
        if (sessionDTO.getId() != null) {
            session = sessionRepository.findById(sessionDTO.getId()).orElseThrow(() -> new RuntimeException("Session not found for id " + sessionDTO.getId()));
        }
        else{
            session = new Session(null,sessionDTO.getSessionName(),sessionDTO.getStatus());
        }
        return sessionRepository.save(session);
    }

    public Session getSessionById(String sessionId) {
        return sessionRepository.findById(sessionId).orElseThrow(() -> new VacademyException("Session not found for id " + sessionId));
    }
}
