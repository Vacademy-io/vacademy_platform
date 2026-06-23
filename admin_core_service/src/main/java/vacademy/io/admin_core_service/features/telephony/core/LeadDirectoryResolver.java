package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Optional;

/**
 * Reverse {@code phone -> lead} lookup for telephony attribution. Given an
 * institute and a counterparty number, finds the matching CRM lead so an imported
 * call — inbound, or a softphone-originated outbound with no CRM click2dial row —
 * can be logged against the right person instead of the {@code "UNKNOWN"} sentinel.
 *
 * Resolution order:
 *   1. PRIMARY — the USER who owns that mobile (auth_service, last-10 match), then
 *      confirm they're a lead in THIS institute. The dialed number usually lives on
 *      the user record ({@code users.mobile_number}), not the CRM lead's
 *      {@code parent_mobile} (which is often null), so this is the reliable path.
 *   2. FALLBACK — {@code audience_response.parent_mobile} (for the rarer lead whose
 *      phone is on the campaign record but whose user has no/blank mobile).
 *
 * Conservative: institute-scoped (never cross-tenant), and empty when nothing
 * matches (the caller keeps UNKNOWN rather than guessing).
 */
@Component
public class LeadDirectoryResolver {

    @Autowired private AudienceResponseRepository audienceResponseRepository;
    @Autowired private AuthService authService;

    /** A matched lead: the audience_response id + the lead's user id (either may be null). */
    public record LeadRef(String responseId, String userId) {}

    /**
     * @param instituteId the institute the call belongs to (scoping — never cross-institute)
     * @param last10      the counterparty's last-10 digits (already normalised by the importer)
     * @return the most recent matching lead, or empty if none match / inputs are invalid
     */
    public Optional<LeadRef> findByPhoneLast10(String instituteId, String last10) {
        if (instituteId == null || instituteId.isBlank() || last10 == null || last10.length() != 10) {
            return Optional.empty();
        }

        // 1) PRIMARY — resolve the USER who owns this number (auth_service matches on
        //    last-10), then confirm they are a lead in THIS institute and grab the
        //    lead's response id. This catches leads whose phone is only on the user
        //    record, not audience_response.parent_mobile.
        Optional<UserDTO> user = authService.getUserByMobile(last10);
        if (user.isPresent() && user.get().getId() != null && !user.get().getId().isBlank()) {
            String userId = user.get().getId();
            List<String> responseIds =
                    audienceResponseRepository.findResponseIdByInstituteAndUser(instituteId, userId);
            if (responseIds != null && !responseIds.isEmpty()) {
                return Optional.of(new LeadRef(responseIds.get(0), userId));
            }
        }

        // 2) FALLBACK — match the campaign's parent_mobile (covers leads whose user
        //    has no usable mobile but whose parent_mobile was captured).
        List<Object[]> rows =
                audienceResponseRepository.findLeadIdAndUserByInstituteAndPhoneLast10(instituteId, last10);
        if (rows == null || rows.isEmpty()) return Optional.empty();
        Object[] r = rows.get(0);
        String responseId = r[0] == null ? null : r[0].toString();
        String userId = r[1] == null ? null : r[1].toString();
        if (responseId == null && userId == null) return Optional.empty();
        return Optional.of(new LeadRef(responseId, userId));
    }
}
