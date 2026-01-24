package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;
import vacademy.io.admin_core_service.features.live_session.repository.BookingTypeRepository;

@Service
@RequiredArgsConstructor
public class BookingTypeService {

    private final BookingTypeRepository bookingTypeRepository;

    public Page<BookingType> getBookingTypesForInstitute(String instituteId, Pageable pageable) {
        return bookingTypeRepository.findByInstituteIdOrInstituteIdIsNull(instituteId, pageable);
    }
}
