package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.live_session.dto.CreateBookingRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.live_session.repository.BookingTypeRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LiveSessionBookingService {

    private final Step1Service step1Service;
    private final Step2Service step2Service;
    private final BookingTypeRepository bookingTypeRepository;

    @Transactional
    public LiveSession createBooking(CreateBookingRequestDTO request, CustomUserDetails user) {

        // Resolve Booking Type ID if code is provided
        if (request.getBookingTypeId() == null && request.getBookingType() != null) {
            Optional<BookingType> type = bookingTypeRepository.findByCodeAndInstituteId(request.getBookingType(),
                    request.getInstituteId());
            if (type.isEmpty()) {
                type = bookingTypeRepository.findByCode(request.getBookingType());
            }
            type.ifPresent(bookingType -> request.setBookingTypeId(bookingType.getId()));
        }

        // Step 1: Create Session and Schedule
        LiveSession createdSession = step1Service.step1AddService(request, user);

        // Step 2: Add Participants
        if (request.getParticipantUserIds() != null && !request.getParticipantUserIds().isEmpty()) {
            LiveSessionStep2RequestDTO step2Request = new LiveSessionStep2RequestDTO();
            step2Request.setSessionId(createdSession.getId());
            step2Request.setIndividualUserIds(request.getParticipantUserIds());
            // Default access type to PRIVATE for bookings typically, or map if needed
            step2Request.setAccessType(
                    createdSession.getAccessLevel() != null ? createdSession.getAccessLevel() : "PRIVATE");

            step2Service.step2AddService(step2Request, user);
        }

        return createdSession;
    }

    /**
     * Link or unlink users to/from an existing booking.
     * This allows adding participants to a booking after it was created.
     */
    @Transactional
    public String linkUsersToBooking(String sessionId, java.util.List<String> userIdsToAdd, 
                                     java.util.List<String> userIdsToRemove, CustomUserDetails user) {
        LiveSessionStep2RequestDTO step2Request = new LiveSessionStep2RequestDTO();
        step2Request.setSessionId(sessionId);
        
        if (userIdsToAdd != null && !userIdsToAdd.isEmpty()) {
            step2Request.setIndividualUserIds(userIdsToAdd);
        }
        
        if (userIdsToRemove != null && !userIdsToRemove.isEmpty()) {
            step2Request.setDeletedIndividualUserIds(userIdsToRemove);
        }
        
        // Keep existing access type
        step2Request.setAccessType("PRIVATE");
        
        step2Service.step2AddService(step2Request, user);
        
        int added = userIdsToAdd != null ? userIdsToAdd.size() : 0;
        int removed = userIdsToRemove != null ? userIdsToRemove.size() : 0;
        
        return String.format("Successfully linked %d users and unlinked %d users", added, removed);
    }
}
