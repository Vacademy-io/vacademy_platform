package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;

import java.util.List;
import java.util.Optional;

/**
 * Reverse {@code phone -> lead} lookup for telephony attribution. Given an
 * institute and the last-10 digits of a counterparty number, finds the matching
 * CRM lead so an imported call — inbound, or a softphone-originated outbound with
 * no CRM click2dial row — can be logged against the right person instead of the
 * {@code "UNKNOWN"} sentinel.
 *
 * Conservative by design: institute-scoped (never cross-institute), exact last-10
 * match, most-recent lead on ties, and empty when nothing matches (the caller then
 * keeps UNKNOWN rather than guessing).
 */
@Component
public class LeadDirectoryResolver {

    @Autowired private AudienceResponseRepository audienceResponseRepository;

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
