package vacademy.io.community_service.feature.pricing.service;

import org.springframework.stereotype.Component;
import vacademy.io.community_service.feature.pricing.dto.BracketDto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The Vacademy rate card. Every number the plan builder quotes comes from here — the FE renders
 * what this exposes and the calculator prices against it, so there is exactly one place to change
 * when pricing moves.
 *
 * Bump {@link #VERSION} on any change: saved quotes record the version they were priced against,
 * so an old quote can still be read back correctly after a repricing.
 */
@Component
public class RateCard {

    public static final String VERSION = "2026-07-v1";

    /** Flat conversion, as agreed: ₹100 = $1. */
    public static final BigDecimal USD_PER_INR = new BigDecimal("0.01");

    /** Indian GST on SaaS. Applied to INR quotes only — USD quotes are treated as exports. */
    public static final BigDecimal GST_RATE = new BigDecimal("0.18");

    // ---- billing cycles ----------------------------------------------------------
    // Multipliers apply to the recurring annual subtotal; one-time fees are never adjusted.
    public static final BigDecimal MONTHLY_UPLIFT = new BigDecimal("1.20");   // +20%
    public static final BigDecimal HALF_YEARLY = BigDecimal.ONE;              // list price
    public static final BigDecimal ANNUAL_DISCOUNT = new BigDecimal("0.85");  // -15% paid upfront

    // ---- one-off and flat add-on prices (INR, per year unless stated) -------------
    public static final BigDecimal ANDROID_ONE_TIME = new BigDecimal("8000");
    public static final BigDecimal IOS_ONE_TIME = new BigDecimal("10000");
    public static final BigDecimal WHATSAPP_AND_PAYMENTS = new BigDecimal("5000");
    /** Website + course catalogue below the Scale bracket: development and maintenance. */
    public static final BigDecimal WEBSITE_ANNUAL = new BigDecimal("5000");
    public static final BigDecimal CRM_BASE = new BigDecimal("32000");
    public static final int CRM_INCLUDED_SEATS = 10;
    public static final BigDecimal CRM_EXTRA_SEAT = new BigDecimal("2000");
    public static final BigDecimal EXTRA_SUB_ORG = new BigDecimal("1800");
    public static final BigDecimal MEET_PER_SESSION_HOUR = new BigDecimal("64");
    public static final BigDecimal PREMIUM_SUPPORT_UPGRADE = new BigDecimal("20000");
    public static final BigDecimal DEDICATED_SUPPORT_MONTHLY = new BigDecimal("15000");

    /** Parent app costs a fifth of the LMS per-student rate, charged across the same students. */
    public static final int PARENT_APP_DIVISOR = 5;

    /**
     * The seven student brackets. A prospect buys the bracket their headcount falls into —
     * 150 learners buys the 300 bracket. Everything that scales with size keys off this row.
     */
    private static final List<BracketDto> BRACKETS = List.of(
            bracket("B_100", "Starter", 100, 300, false, false, false, 0, false),
            bracket("B_300", "Growth", 300, 200, true, false, false, 0, false),
            bracket("B_500", "Scale", 500, 200, true, true, true, 0, true),
            bracket("B_1000", "Pro", 1000, 180, true, true, true, 2, true),
            bracket("B_2000", "Premier", 2000, 150, true, true, true, 3, true),
            bracket("B_5000", "Elite", 5000, 135, true, true, true, 5, true),
            bracket("B_10000", "Enterprise", 10000, 105, true, true, true, 7, true));

    private static final Map<String, BracketDto> BY_CODE = index();

    public List<BracketDto> brackets() {
        return BRACKETS;
    }

    public BracketDto bracket(String code) {
        return BY_CODE.get(code);
    }

    /** The smallest bracket that fits the headcount; the largest if they exceed every bracket. */
    public BracketDto bracketFor(int students) {
        for (BracketDto b : BRACKETS) {
            if (students <= b.getMaxStudents()) {
                return b;
            }
        }
        return BRACKETS.get(BRACKETS.size() - 1);
    }

    private static Map<String, BracketDto> index() {
        Map<String, BracketDto> m = new LinkedHashMap<>();
        for (BracketDto b : BRACKETS) {
            m.put(b.getCode(), b);
        }
        return m;
    }

    private static BracketDto bracket(String code, String name, int maxStudents, int perStudent,
                                      boolean androidFree, boolean iosFree, boolean websiteFree,
                                      int includedSubOrgs, boolean premiumSupportIncluded) {
        BigDecimal rate = BigDecimal.valueOf(perStudent);
        List<String> included = new ArrayList<>();
        if (androidFree) included.add("Android app");
        if (iosFree) included.add("iOS app");
        if (websiteFree) included.add("Website builder & course catalogue");
        if (premiumSupportIncluded) included.add("Premium support");
        if (includedSubOrgs > 0) included.add(includedSubOrgs + " sub-organizations");
        // WhatsApp + payments come free once the bracket is 1,000 or larger.
        boolean commsFree = maxStudents >= 1000;
        if (commsFree) included.add("WhatsApp & payment integration");

        return BracketDto.builder()
                .code(code)
                .name(name)
                .maxStudents(maxStudents)
                .perStudentPerYear(rate)
                .lmsAnnual(rate.multiply(BigDecimal.valueOf(maxStudents)))
                .parentAppPerStudent(rate.divide(BigDecimal.valueOf(PARENT_APP_DIVISOR)))
                .androidIncluded(androidFree)
                .iosIncluded(iosFree)
                .websiteIncluded(websiteFree)
                .commsIncluded(commsFree)
                .includedSubOrgs(includedSubOrgs)
                .premiumSupportIncluded(premiumSupportIncluded)
                .includes(included)
                .build();
    }
}
