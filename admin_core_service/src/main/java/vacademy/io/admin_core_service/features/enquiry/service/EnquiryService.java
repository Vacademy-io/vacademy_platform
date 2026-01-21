package vacademy.io.admin_core_service.features.enquiry.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enquiry.dto.LinkCounselorDTO;
import vacademy.io.admin_core_service.features.enquiry.entity.LinkedUsers;
import vacademy.io.admin_core_service.features.enquiry.repository.EnquiryRepository;
import vacademy.io.admin_core_service.features.enquiry.repository.LinkedUsersRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;

@Service
public class EnquiryService {

    @Autowired
    private LinkedUsersRepository linkedUsersRepository;

    @Autowired
    private EnquiryRepository enquiryRepository;

    @Autowired
    private AuthService authService;

    @Transactional
    public String linkCounselorToSource(LinkCounselorDTO request) {
        // 1. Validate Input
        if (!StringUtils.hasText(request.getCounselorId()) ||
                !StringUtils.hasText(request.getSourceId()) ||
                !StringUtils.hasText(request.getSourceType())) {
            throw new VacademyException("Counselor ID, Source ID and Source Type are required");
        }

        // 2. Validate Source Existence (Enquiry)
        if ("ENQUIRY".equalsIgnoreCase(request.getSourceType())) {
            enquiryRepository.findById(java.util.UUID.fromString(request.getSourceId()))
                    .orElseThrow(() -> new VacademyException("Enquiry not found with ID: " + request.getSourceId()));
        } else {
            // For now, we strictly support ENQUIRY as per discussion
            throw new VacademyException("Only ENQUIRY source type is currently supported");
        }

        // 3. Validate User Existence (not role)
        // Design Decision: We only verify that the user exists in the system.
        // This allows flexibility to assign any registered user (counselors, admins,
        // managers, etc.)
        // The calling service is responsible for ensuring the appropriate user is
        // assigned.
        UserDTO assignedUser = null;
        try {
            List<UserDTO> users = authService.getUsersFromAuthServiceByUserIds(List.of(request.getCounselorId()));
            if (users != null && !users.isEmpty()) {
                assignedUser = users.get(0);
            }
        } catch (Exception e) {
            throw new VacademyException("Failed to fetch user details: " + e.getMessage());
        }

        if (assignedUser == null) {
            throw new VacademyException("User not found with ID: " + request.getCounselorId());
        }

        // 4. Check for existing link to avoid duplicates
        if (linkedUsersRepository.existsBySourceAndSourceIdAndUserId(
                request.getSourceType(), request.getSourceId(), request.getCounselorId())) {
            return "Counselor is already linked to this enquiry";
        }

        // 5. Create and Save Link
        LinkedUsers link = LinkedUsers.builder()
                .source(request.getSourceType())
                .sourceId(request.getSourceId())
                .userId(request.getCounselorId())
                .build();

        linkedUsersRepository.save(link);

        // 6. Update Enquiry assigned_user_id to true
        if ("ENQUIRY".equalsIgnoreCase(request.getSourceType())) {
            vacademy.io.admin_core_service.features.enquiry.entity.Enquiry enquiry = enquiryRepository
                    .findById(java.util.UUID.fromString(request.getSourceId()))
                    .orElseThrow(() -> new VacademyException("Enquiry not found during update"));

            enquiry.setAssignedUserId(true);
            enquiryRepository.save(enquiry);
        }

        return "Counselor linked successfully";
    }
}
