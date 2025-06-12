package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.AttendanceReportDTO;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionParticipantRepository;

import java.util.List;

@Service
public class AttendanceReportService {
    @Autowired
    private LiveSessionParticipantRepository liveSessionParticipantRepository;

    public List<AttendanceReportDTO> generateReport(List<String> sessionIds) {
        return liveSessionParticipantRepository.getAttendanceReportBySessionIds(sessionIds);
    }
}
