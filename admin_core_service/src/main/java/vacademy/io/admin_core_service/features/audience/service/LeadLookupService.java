package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.dto.LeadLookupResultDto;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

/**
 * "Is this phone / email already ours?" — the one thing a counsellor may learn
 * about a lead that belongs to someone else.
 *
 * A counsellor only sees the leads assigned to them, so searching a number that
 * a colleague already owns returns nothing, and they call it as a fresh lead.
 * This closes that gap without widening the lead list: it answers for one exact
 * phone or email, with the handful of fields the institute chose to share, and
 * returns no identifier that would let the caller reach anything else.
 *
 * <p><b>Name search is off unless the institute turns it on.</b> Phone and email
 * are things the caller already has in front of them; a name is something they
 * can guess, so searching by name is the one mode that could be used to page
 * through other counsellors' leads. Where an institute does enable it the match
 * is <b>exact</b> - the whole name, not a prefix or a substring - so it answers
 * "is this person already ours" without being walkable one letter at a time.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadLookupService {

    private final AudienceResponseRepository audienceResponseRepository;
    private final LeadLookupSettingService settingService;
    private final CounsellorScopeService counsellorScopeService;

    public LeadLookupResultDto lookup(String instituteId, String phone, String email, String name,
                                      CustomUserDetails caller) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        LeadLookupSettingService.LookupSettings settings = settingService.get(instituteId);
        if (!settings.enabled()) {
            throw new VacademyException("Lead lookup is not enabled for this institute");
        }

        // Admins are not scoped out of lead data anywhere else, so masking here
        // would only make the same records harder to reach. They get everything.
        boolean isAdmin = counsellorScopeService.hasAdminRole(caller, instituteId);
        LeadLookupSettingService.Fields fields = isAdmin
                ? LeadLookupSettingService.Fields.ALL
                : settings.fields();
        if (fields.isEmpty()) {
            throw new VacademyException("Lead lookup has no fields configured for this institute");
        }

        String last10 = lastTenDigits(phone);
        String normalisedEmail = (email == null || email.isBlank()) ? null : email.trim();
        String normalisedName = (name == null || name.isBlank()) ? null : name.trim();
        // Name search is for counsellors only. An admin already has a real name
        // search over every lead in the leads list, so routing them through a
        // one-answer-at-a-time probe adds nothing. Field masking is separate -
        // admins still see every field on whatever they do look up.
        if (normalisedName != null && (!settings.searchByName() || isAdmin)) {
            throw new VacademyException(
                    "Search by name is not available here - use the leads list");
        }
        if (last10 == null && normalisedEmail == null && normalisedName == null) {
            throw new VacademyException("Search by a full phone number, an email address or a full name");
        }

        Optional<AudienceResponseRepository.LeadLookupRow> match = audienceResponseRepository
                .lookupByPhoneOrEmail(instituteId, last10, normalisedEmail, normalisedName,
                        fields.course() ? settings.courseFieldId() : null);

        if (match.isEmpty()) {
            return LeadLookupResultDto.builder().found(false).build();
        }

        AudienceResponseRepository.LeadLookupRow row = match.get();
        return LeadLookupResultDto.builder()
                .found(true)
                .leadName(fields.name() ? blankToNull(row.getLeadName()) : null)
                .leadEmail(fields.email() ? blankToNull(row.getLeadEmail()) : null)
                .leadMobile(fields.phone() ? blankToNull(row.getLeadMobile()) : null)
                .counsellorName(fields.counsellor() ? blankToNull(row.getCounsellorName()) : null)
                .campaignType(fields.source() ? blankToNull(row.getCampaignType()) : null)
                .campaignName(fields.campaign() ? blankToNull(row.getCampaignName()) : null)
                .status(fields.status() ? blankToNull(row.getStatusLabel()) : null)
                .course(fields.course() ? blankToNull(row.getCourseValue()) : null)
                .optedOut("OPTED_OUT".equalsIgnoreCase(row.getOverallStatus()))
                .build();
    }

    /**
     * Last 10 digits, matching the dedup check — most stored numbers have no
     * country code, so comparing the tail is what makes "+91 98…" and "98…" the
     * same person. Fewer than 10 digits is a partial number, not a lookup: it
     * would match whoever happens to share the suffix.
     */
    private String lastTenDigits(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("[^0-9]", "");
        return digits.length() < 10 ? null : digits.substring(digits.length() - 10);
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
