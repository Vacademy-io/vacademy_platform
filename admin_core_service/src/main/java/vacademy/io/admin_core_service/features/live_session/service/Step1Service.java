package vacademy.io.admin_core_service.features.live_session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.WeeklyDetailsDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.enums.LiveSessionStatus;
import vacademy.io.admin_core_service.features.live_session.enums.RecurringTypeEnum;
import vacademy.io.admin_core_service.features.live_session.repository.LiveSessionRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionScheduleRepository;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.sql.Time;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class Step1Service {

    @Autowired
    private LiveSessionRepository sessionRepository;

    @Autowired
    private SessionScheduleRepository scheduleRepository;

    public LiveSession Step1AddService(LiveSessionStep1RequestDTO request, CustomUserDetails user) {
        LiveSession session = new LiveSession();

        if (request.getTitle() != null) {
            session.setTitle(request.getTitle());
        }
        if (request.getSubject() != null) {
            session.setSubject(request.getSubject());
        }
        if (request.getDescriptionHtml() != null) {
            session.setDescriptionHtml(request.getDescriptionHtml());
        }
        if (request.getDefaultMeetLink() != null) {
            session.setDefaultMeetLink(request.getDefaultMeetLink());
        }
        if (request.getStartTime() != null) {
            session.setStartTime(request.getStartTime());
        }
        if (request.getLastEntryTime() != null) {
            session.setLastEntryTime(request.getLastEntryTime());
        }
        if(request.getLinkType() != null){
            session.setLinkType(request.getLinkType());
        }

        session.setCreatedByUserId(user.getUserId());
        session.setStatus(LiveSessionStatus.DRAFT.name());

        LiveSession savedSession = sessionRepository.save(session);

        // Only create schedule if schedule-specific fields are present
        List<WeeklyDetailsDTO> weeklySchedule = request.getRecurringWeeklySchedule();
        String recurrenceType = request.getRecurrenceType();

        if ("WEEKLY".equalsIgnoreCase(recurrenceType) && weeklySchedule != null && request.getSessionEndDate() != null) {
            LocalDate endDate = LocalDate.parse(request.getSessionEndDate(), DateTimeFormatter.ISO_DATE);
            LocalDate currentDate = request.getStartTime().toLocalDateTime().toLocalDate();

            Map<String, WeeklyDetailsDTO> dayToDetails = new HashMap<>();
            for (WeeklyDetailsDTO details : weeklySchedule) {
                dayToDetails.put(details.getDay().toLowerCase(), details);
            }

            while (!currentDate.isAfter(endDate)) {
                String currentDay = currentDate.getDayOfWeek().name().toLowerCase(); // e.g. "monday"

                if (dayToDetails.containsKey(currentDay)) {
                    WeeklyDetailsDTO details = dayToDetails.get(currentDay);
                    SessionSchedule schedule = new SessionSchedule();

                    schedule.setSessionId((savedSession.getId()));
                    schedule.setRecurrenceType(RecurringTypeEnum.WEEKLY.name());
                    schedule.setRecurrenceKey(currentDay);
                    schedule.setMeetingDate(java.sql.Date.valueOf(currentDate));

                    // Use specific start time or default
                    Time startTime = details.getStartTime() != null
                            ? Time.valueOf(details.getStartTime())
                            : new Time(request.getStartTime().getTime());

                    schedule.setStartTime(startTime);

                    // Approximate last entry time using duration if available
                    Time lastEntryTime = request.getLastEntryTime() != null
                            ? new Time(request.getLastEntryTime().getTime())
                            : null;

                    schedule.setLastEntryTime(lastEntryTime);

                    // Use custom link or default
                    schedule.setCustomMeetingLink(details.getLink() != null ? details.getLink() : request.getDefaultMeetLink());
                    schedule.setLinkType(details.getLinkType() != null ? details.getLinkType() : request.getLinkType());
                    schedule.setCustomWaitingRoomMediaId(null); // set if needed

                    scheduleRepository.save(schedule);
                }

                currentDate = currentDate.plusDays(1);
            }
        }

        return savedSession;
    }
}
