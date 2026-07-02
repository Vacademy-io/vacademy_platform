package vacademy.io.community_service.feature.onboarding.service;

import org.springframework.stereotype.Component;
import vacademy.io.community_service.feature.onboarding.dto.QuestionDto;
import vacademy.io.community_service.feature.onboarding.dto.QuestionOptionDto;
import vacademy.io.community_service.feature.onboarding.enums.InstituteType;
import vacademy.io.community_service.feature.onboarding.enums.QuestionType;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The master onboarding question catalogue. A link shows a subset of these; the prospect's answers
 * become the institute's pre-configuration. Sections map to the wizard steps in the public form.
 *
 * The catalogue intentionally covers every onboarding/setup topic the team wants to capture:
 * institute details + domains, brand colour, B2B/B2C model, email sender, WhatsApp + AI agent,
 * payments + invoicing, live classes platform, mobile apps, certificates, and the CRM/growth stack
 * (calling, AI sales agent, ads). Add a question here and it is instantly available to the link
 * builder and the public form — no migration needed (answers are stored as generic JSON).
 */
@Component
public class QuestionCatalog {

    // section keys + labels
    public static final String S_ABOUT = "ABOUT_YOU";
    public static final String S_INSTITUTE = "INSTITUTE";
    public static final String S_COMMS = "COMMUNICATIONS";
    public static final String S_MONEY = "MONETIZATION";
    public static final String S_DELIVERY = "DELIVERY";
    public static final String S_GROWTH = "GROWTH";
    public static final String S_WRAP = "WRAP_UP";

    private final List<QuestionDto> questions = build();
    private final Map<String, QuestionDto> byKey = index(questions);

    public List<QuestionDto> all() {
        return questions;
    }

    public QuestionDto get(String key) {
        return byKey.get(key);
    }

    public List<QuestionOptionDto> instituteTypeOptions() {
        List<QuestionOptionDto> opts = new ArrayList<>();
        for (InstituteType t : InstituteType.values()) {
            opts.add(new QuestionOptionDto(t.name(), t.getLabel()));
        }
        return opts;
    }

    private static Map<String, QuestionDto> index(List<QuestionDto> qs) {
        Map<String, QuestionDto> m = new LinkedHashMap<>();
        for (QuestionDto q : qs) {
            m.put(q.getKey(), q);
        }
        return m;
    }

    private static List<QuestionOptionDto> opts(String... pairs) {
        List<QuestionOptionDto> list = new ArrayList<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            list.add(new QuestionOptionDto(pairs[i], pairs[i + 1]));
        }
        return list;
    }

    private static List<QuestionDto> build() {
        List<QuestionDto> q = new ArrayList<>();

        // ---- Section 1: About you ------------------------------------------------
        q.add(base("full_name", "Your full name", QuestionType.TEXT, S_ABOUT, "About you", 1)
                .required(true).placeholder("Jane Doe").build());
        q.add(base("work_email", "Work email", QuestionType.EMAIL, S_ABOUT, "About you", 1)
                .required(true).placeholder("jane@yourbrand.com").build());
        q.add(base("phone", "Phone / WhatsApp", QuestionType.PHONE, S_ABOUT, "About you", 1).build());
        q.add(base("role", "Your role", QuestionType.TEXT, S_ABOUT, "About you", 1)
                .placeholder("Founder, Admin, Academic Head…").build());

        // ---- Section 2: Your institute (items 1, 4, 6) ---------------------------
        q.add(base("organization_name", "Institute / organization name", QuestionType.TEXT, S_INSTITUTE, "Your institute", 2)
                .required(true).build());
        q.add(base("institute_type", "What best describes you?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 2)
                .required(true).drivesDemo(true)
                .helpText("This tailors your demo.")
                .options(opts("SCHOOL", "School", "DISTANCE_LEARNING", "Distance Learning",
                        "CORPORATE", "Corporate", "UNIVERSITY", "University")).build());
        q.add(base("business_model", "How do you sell?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 2)
                .options(opts("B2C", "Direct to learners (B2C)", "B2B", "To organizations (B2B)", "BOTH", "Both")).build());
        q.add(base("logo_url", "Logo", QuestionType.URL, S_INSTITUTE, "Your institute", 2)
                .placeholder("https://…/logo.png")
                .helpText("Paste a link to your logo — or leave blank and share it later.").build());
        q.add(base("preferred_admin_domain", "Preferred admin portal domain", QuestionType.TEXT, S_INSTITUTE, "Your institute", 2)
                .placeholder("admin.yourbrand.com").build());
        q.add(base("preferred_learner_domain", "Preferred learner portal domain", QuestionType.TEXT, S_INSTITUTE, "Your institute", 2)
                .placeholder("learn.yourbrand.com").build());
        q.add(base("brand_color", "Brand color", QuestionType.COLOR, S_INSTITUTE, "Your institute", 2)
                .helpText("Used to theme your portals.").build());
        q.add(base("audience_size", "How many learners?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 2)
                .options(opts("LT_100", "Under 100", "100_500", "100–500", "500_2000", "500–2,000",
                        "2000_10000", "2,000–10,000", "GT_10000", "10,000+")).build());

        // ---- Section 3: Communications (items 2, 7) ------------------------------
        q.add(base("email_sender_pref", "Preferred email sender", QuestionType.TEXT, S_COMMS, "Communications", 3)
                .placeholder("Your Brand <noreply@yourbrand.com>")
                .helpText("The from-name/address learners see on emails.").build());
        q.add(base("wants_whatsapp", "Connect WhatsApp?", QuestionType.BOOLEAN, S_COMMS, "Communications", 3)
                .featureFlag("WHATSAPP").build());
        q.add(base("whatsapp_number", "WhatsApp business number", QuestionType.PHONE, S_COMMS, "Communications", 3)
                .dependsOnKey("wants_whatsapp").dependsOnValue("true").build());
        q.add(base("wants_whatsapp_ai_agent", "Add a WhatsApp AI agent?", QuestionType.BOOLEAN, S_COMMS, "Communications", 3)
                .dependsOnKey("wants_whatsapp").dependsOnValue("true").featureFlag("WHATSAPP_AI_AGENT").build());

        // ---- Section 4: Payments & billing (item 3) ------------------------------
        q.add(base("wants_payments", "Sell courses / collect payments?", QuestionType.BOOLEAN, S_MONEY, "Payments & billing", 4)
                .featureFlag("PAYMENTS").build());
        q.add(base("payment_gateway", "Preferred payment gateway", QuestionType.SELECT, S_MONEY, "Payments & billing", 4)
                .dependsOnKey("wants_payments").dependsOnValue("true")
                .options(opts("RAZORPAY", "Razorpay", "STRIPE", "Stripe", "PAYU", "PayU",
                        "CASHFREE", "Cashfree", "PHONEPE", "PhonePe", "OTHER", "Other / not sure")).build());
        q.add(base("wants_invoicing", "Need invoices / GST billing?", QuestionType.BOOLEAN, S_MONEY, "Payments & billing", 4)
                .dependsOnKey("wants_payments").dependsOnValue("true").featureFlag("INVOICING").build());

        // ---- Section 5: Teaching & delivery (items 5, 9, 10) ---------------------
        q.add(base("wants_live_classes", "Run live classes?", QuestionType.BOOLEAN, S_DELIVERY, "Teaching & delivery", 5)
                .featureFlag("LIVE_CLASSES").build());
        q.add(base("live_class_platform", "Live class platform", QuestionType.SELECT, S_DELIVERY, "Teaching & delivery", 5)
                .dependsOnKey("wants_live_classes").dependsOnValue("true")
                .options(opts("BBB", "Built-in (BigBlueButton)", "ZOOM", "Zoom", "GOOGLE_MEET", "Google Meet", "OTHER", "Other")).build());
        q.add(base("wants_mobile_apps", "Want branded mobile apps?", QuestionType.MULTISELECT, S_DELIVERY, "Teaching & delivery", 5)
                .multi(true).featureFlag("MOBILE_APPS")
                .options(opts("ANDROID", "Android", "IOS", "iOS")).build());
        q.add(base("wants_certificates", "Issue course certificates?", QuestionType.BOOLEAN, S_DELIVERY, "Teaching & delivery", 5)
                .featureFlag("CERTIFICATES").build());

        // ---- Section 6: Sales & growth (item 8) ----------------------------------
        q.add(base("wants_crm", "Use the built-in CRM for leads?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 6)
                .featureFlag("CRM").build());
        q.add(base("wants_calling", "Enable calling / telephony for your team?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 6)
                .dependsOnKey("wants_crm").dependsOnValue("true").featureFlag("CALLING").build());
        q.add(base("wants_ai_sales_agent", "Add an AI sales agent?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 6)
                .dependsOnKey("wants_crm").dependsOnValue("true").featureFlag("AI_SALES_AGENT").build());
        q.add(base("ads_integration", "Connect ad platforms for lead capture?", QuestionType.MULTISELECT, S_GROWTH, "Sales & growth", 6)
                .multi(true).featureFlag("ADS_INTEGRATION")
                .options(opts("META", "Meta (Facebook/Instagram) Lead Ads", "GOOGLE", "Google Ads")).build());

        // ---- Section 7: Almost done ----------------------------------------------
        q.add(base("primary_goal", "What's your main goal with Vacademy?", QuestionType.TEXTAREA, S_WRAP, "Almost done", 7).build());
        q.add(base("launch_timeline", "When do you want to launch?", QuestionType.SELECT, S_WRAP, "Almost done", 7)
                .options(opts("NOW", "Immediately", "MONTH", "Within a month", "QUARTER", "1–3 months", "EXPLORING", "Just exploring")).build());
        q.add(base("referral_source", "How did you hear about us?", QuestionType.TEXT, S_WRAP, "Almost done", 7).build());
        q.add(base("wants_demo_call", "Want a guided demo call with our team?", QuestionType.BOOLEAN, S_WRAP, "Almost done", 7).build());
        q.add(base("notes", "Anything specific you'd like to see?", QuestionType.TEXTAREA, S_WRAP, "Almost done", 7).build());

        return q;
    }

    private static QuestionDto.QuestionDtoBuilder base(String key, String label, QuestionType type,
                                                       String section, String sectionLabel, int sectionOrder) {
        return QuestionDto.builder()
                .key(key)
                .label(label)
                .type(type.name())
                .section(section)
                .sectionLabel(sectionLabel)
                .sectionOrder(sectionOrder);
    }
}
