package vacademy.io.admin_core_service.features.institute.service.setting;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.user_subscription.util.TrialStartResolver;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * Reads the institute's PAYMENT_SETTING JSON (saved via the generic
 * /institute/setting/v1/save-setting endpoint with settingKey=PAYMENT_SETTING).
 * <p>
 * Everything here is opt-IN: an institute with no PAYMENT_SETTING block, or one
 * without {@code packageSessionRenewalSchedulerEnabled: true}, is treated as
 * disabled — the renewal scheduler never touches its user plans.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentSettingService {

    /** Flag inside PAYMENT_SETTING.data that opts an institute into the daily scan. */
    public static final String RENEWAL_SCHEDULER_ENABLED_KEY = "packageSessionRenewalSchedulerEnabled";

    /**
     * Flag inside PAYMENT_SETTING.data that opts an institute into learner-facing plan
     * switching. Off (or absent) means learners never see a "change plan" affordance
     * anywhere, whatever the per-option and per-plan flags say — those configure WHICH
     * plans are switchable; this decides whether the feature is exposed at all.
     */
    public static final String PLAN_CHANGE_ENABLED_KEY = "planChangeEnabled";

    /**
     * Flag inside PAYMENT_SETTING.data that makes a manual renewal ("pay to continue") also
     * arm autopay, without the learner having to ask for it.
     *
     * <p>Opt-in, and deliberately so: turning it on means a member who pays one lapsed
     * invoice is enrolled into recurring billing, so it is the institute's decision to make
     * explicitly rather than a default anyone inherits. It still only applies to plans whose
     * invite offers autopay at all.
     */
    public static final String AUTOPAY_DEFAULT_ON_RENEWAL_KEY = "autopayDefaultOnManualRenewal";

    /**
     * Flag inside PAYMENT_SETTING.data that opts an institute into the daily AUTOPAY CHARGE
     * sweep -- the job that actually presents money to the gateway.
     *
     * <p>Separate from {@link #RENEWAL_SCHEDULER_ENABLED_KEY} on purpose. That one opts into
     * the enrolment-policy scan (notifications, waiting period, expiry), which moves no
     * money; this one authorises charging cards. An institute that wanted expiry handling
     * must not silently acquire auto-debit along with it, so the two are asked separately.
     */
    public static final String AUTOPAY_CHARGE_SCHEDULER_ENABLED_KEY = "autopayChargeSchedulerEnabled";

    private final InstituteRepository instituteRepository;
    private final ObjectMapper objectMapper;

    /**
     * Institutes that have explicitly enabled the package-session renewal
     * scheduler. The repository pre-filters on a LIKE over the raw setting
     * column (cheap, index-free but the institutes table is small); the JSON
     * envelope is then parsed here so formatting/spacing can't cause false
     * positives. Unparseable settings are skipped defensively — an institute
     * with corrupt JSON must never be swept into the scan by accident.
     */
    public List<String> getInstituteIdsWithRenewalSchedulerEnabled() {
        return getInstituteIdsWithFlag(RENEWAL_SCHEDULER_ENABLED_KEY);
    }

    /**
     * Institutes that have explicitly authorised the autopay charge sweep to present money
     * for them. Absent flag = not authorised, so no institute is auto-charged until someone
     * turns this on: the sweep itself is platform-wide, and this is the only thing scoping it.
     */
    public List<String> getInstituteIdsWithAutopayChargeEnabled() {
        return getInstituteIdsWithFlag(AUTOPAY_CHARGE_SCHEDULER_ENABLED_KEY);
    }

    /**
     * How many days BEFORE the period ends the autopay charge is presented
     * ({@code PAYMENT_SETTING.data.autopayChargeLeadDays}). Default 0 = charge on the end
     * date itself, which is what every institute did before this existed.
     *
     * <p>Why it is needed: a UPI AutoPay debit is not instant. Razorpay raises it as a
     * collect request the learner must approve in their UPI app, and it expires unanswered
     * — SuchBliss renewals were failing with exactly that
     * ({@code payment_collect_request_expired}), 29 FAILED against 8 PAID. Charging on the
     * end date leaves no room for that: the debit is raised at 15:00 IST on the day access
     * runs out, so a learner who approves it the next morning has already lapsed. Presenting
     * it N days early gives them a day to tap and dunning a day of runway, so access is
     * revoked only after a renewal has genuinely failed rather than while it is still
     * waiting for an approval.
     *
     * <p>It also sets the notification rhythm for free. The pre-charge reminder is the
     * {@code getUpcomingAutopayCharges} audience at {@code daysAhead=1}, i.e.
     * {@code next_charge_at - 1 day}, so a two-day lead puts "your plan ends on X" three
     * days before the period ends and the charge two.
     */
    public static final String AUTOPAY_CHARGE_LEAD_DAYS_KEY = "autopayChargeLeadDays";

    /** Hard ceiling: a lead longer than this is a misconfiguration, not an intention. */
    private static final int MAX_CHARGE_LEAD_DAYS = 10;

    /**
     * Days to present an autopay charge ahead of the period end for this institute, clamped
     * to 0..{@value #MAX_CHARGE_LEAD_DAYS}. Returns 0 when unset, unparseable or negative,
     * so an institute that has never heard of this keeps charging on the end date exactly as
     * before.
     *
     * @see #AUTOPAY_CHARGE_LEAD_DAYS_KEY
     */
    public int getAutopayChargeLeadDays(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return 0;
        }
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(Institute::getSetting)
                    .orElse(null);
            if (!StringUtils.hasText(settingJson)) {
                return 0;
            }
            int lead = objectMapper.readTree(settingJson)
                    .path("setting")
                    .path(SettingKeyEnums.PAYMENT_SETTING.name())
                    .path("data")
                    .path(AUTOPAY_CHARGE_LEAD_DAYS_KEY)
                    .asInt(0);
            return Math.max(0, Math.min(lead, MAX_CHARGE_LEAD_DAYS));
        } catch (Exception e) {
            log.warn("[PaymentSetting] Could not read {} for institute {} — treating as 0",
                    AUTOPAY_CHARGE_LEAD_DAYS_KEY, instituteId, e);
            return 0;
        }
    }

    /**
     * When the autopay charge for a period ending {@code endDate} should be presented:
     * {@code endDate} minus this institute's lead days, with the invite deciding which
     * institute and which calendar that subtraction happens in.
     *
     * <p>Null-safe in both arguments — a null end date has no charge date, and a plan with
     * no invite falls back to charging on the end date rather than guessing a lead.
     */
    public Date resolveChargeAt(Date endDate, EnrollInvite invite) {
        if (endDate == null) {
            return null;
        }
        if (invite == null) {
            return endDate;
        }
        return resolveChargeAt(endDate, invite.getInstituteId(),
                TrialStartResolver.zoneFromInvite(invite.getSettingJson()));
    }

    /**
     * {@code endDate} minus this institute's lead days, subtracted in {@code zone}.
     *
     * <p>The zone matters, and getting it wrong is the bug this signature exists to prevent.
     * {@code Calendar.add(DAY_OF_MONTH, -n)} works in the SERVER's zone, so on a UTC pod a
     * plan ending at 18:30 UTC (midnight IST) walks back to 18:30 UTC — right by luck, since
     * India has no DST. Across a DST boundary the same arithmetic shifts the wall-clock hour,
     * which moves the charge onto the wrong calendar day in the only zone anyone is reading:
     * {@code getUpcomingAutopayCharges} buckets {@code next_charge_at} by date in the
     * invite's {@code AUTOPAY_SETTING.TRIAL_TIMEZONE}, so an hour of drift silently costs or
     * gains a day of notice. Subtracting in that same zone keeps the charge on the day the
     * reminder promises.
     *
     * <p>A zero or negative lead returns {@code endDate} untouched — no conversion, no
     * rounding, nothing for an unconfigured institute to notice.
     */
    public Date resolveChargeAt(Date endDate, String instituteId, ZoneId zone) {
        if (endDate == null) {
            return null;
        }
        int lead = getAutopayChargeLeadDays(instituteId);
        if (lead <= 0) {
            return endDate;
        }
        ZoneId target = zone != null ? zone : ZoneId.systemDefault();
        ZonedDateTime chargeAt = endDate.toInstant().atZone(target).minusDays(lead);
        return Date.from(chargeAt.toInstant());
    }

    /** Institutes whose PAYMENT_SETTING.data has {@code flagKey} set to true. */
    private List<String> getInstituteIdsWithFlag(String flagKey) {
        List<String> enabled = new ArrayList<>();
        for (Object[] row : instituteRepository.findIdAndSettingWithPaymentSetting()) {
            String instituteId = (String) row[0];
            String settingJson = (String) row[1];
            if (settingJson == null || settingJson.isBlank()) continue;
            try {
                JsonNode flag = objectMapper.readTree(settingJson)
                        .path("setting")
                        .path(SettingKeyEnums.PAYMENT_SETTING.name())
                        .path("data")
                        .path(flagKey);
                if (flag.asBoolean(false)) {
                    enabled.add(instituteId);
                }
            } catch (Exception e) {
                log.warn("[PaymentSetting] Could not parse setting JSON for institute {} — treating as disabled",
                        instituteId, e);
            }
        }
        return enabled;
    }

    /**
     * Whether this institute exposes learner-facing plan switching.
     *
     * <p>Opt-in like everything else in this blob: a missing PAYMENT_SETTING, a missing
     * flag, or unparseable JSON all mean disabled. An institute must choose to show its
     * members a way to move between plans rather than find it already on.
     */
    public boolean isPlanChangeEnabled(String instituteId) {
        return readFlag(instituteId, PLAN_CHANGE_ENABLED_KEY);
    }

    /**
     * Whether a manual renewal should arm autopay by default for this institute.
     *
     * <p>Off unless explicitly enabled. Note what "default" means here: it pre-selects the
     * choice, it does not remove it -- a learner on a checkout gateway still sees the
     * checkbox and can clear it.
     */
    public boolean isAutopayDefaultOnManualRenewal(String instituteId) {
        return readFlag(instituteId, AUTOPAY_DEFAULT_ON_RENEWAL_KEY);
    }

    /** Reads one boolean out of PAYMENT_SETTING.data. False on anything unexpected. */
    private boolean readFlag(String instituteId, String flagKey) {
        if (instituteId == null || instituteId.isBlank()) {
            return false;
        }
        try {
            String settingJson = instituteRepository.findById(instituteId)
                    .map(vacademy.io.common.institute.entity.Institute::getSetting)
                    .orElse(null);
            if (settingJson == null || settingJson.isBlank()) {
                return false;
            }
            return objectMapper.readTree(settingJson)
                    .path("setting")
                    .path(SettingKeyEnums.PAYMENT_SETTING.name())
                    .path("data")
                    .path(flagKey)
                    .asBoolean(false);
        } catch (Exception e) {
            log.warn("[PaymentSetting] Could not read {} for institute {} — treating as disabled",
                    flagKey, instituteId, e);
            return false;
        }
    }
}
