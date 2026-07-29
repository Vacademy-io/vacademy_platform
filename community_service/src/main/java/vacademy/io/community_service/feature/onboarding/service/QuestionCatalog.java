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
 * The catalogue covers the onboarding topics worth asking a prospect about: who they are and how to
 * reach them, what they need, institute profile, WhatsApp + AI agent, payments + invoicing, live
 * classes platform, mobile apps, certificates, and the CRM/growth stack (calling, AI sales agent,
 * ads). Deployment/branding details — logo, portal domains, brand colour, email sender — are
 * deliberately absent: those belong to the setup we run after the first payment, not to a demo
 * request. Add a question here and it is instantly available to the link builder and the public
 * form — no migration needed (answers are stored as generic JSON).
 */
@Component
public class QuestionCatalog {

    // section keys + labels
    public static final String S_ABOUT = "ABOUT_YOU";
    public static final String S_NEEDS = "REQUIREMENTS";
    public static final String S_INSTITUTE = "INSTITUTE";
    public static final String S_COMMS = "COMMUNICATIONS";
    public static final String S_MONEY = "MONETIZATION";
    public static final String S_DELIVERY = "DELIVERY";
    public static final String S_GROWTH = "GROWTH";

    /**
     * The short "demo" question set: who they are, how to reach them, and what they actually want.
     * Everything else (domains, gateways, senders, branding…) is deliberately deferred to the real
     * onboarding we run after the first payment — a demo request should take under a minute.
     */
    public static final List<String> DEMO_QUESTION_KEYS = List.of(
            "organization_name", "full_name", "work_email", "phone",
            "requirements", "learners_now", "learners_6m");

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

    /** Shared learner-count buckets — asked twice (today, and in 6 months). */
    private static List<QuestionOptionDto> learnerRanges() {
        return opts("LT_100", "Under 100", "100_500", "100–500", "500_2000", "500–2,000",
                "2000_10000", "2,000–10,000", "GT_10000", "10,000+");
    }

    /**
     * The capability groups shown on step 2 of the demo form. Every platform feature we sell lives
     * under exactly one group; the group code is recorded alongside the feature codes.
     */
    private static List<QuestionOptionDto> featureGroups() {
        List<QuestionOptionDto> groups = new ArrayList<>();

        groups.add(group("LMS", "LMS", "graduation-cap", "Teach, assess and certify",
                opts("LMS_COURSES", "Courses, batches & learners",
                        "ASSESSMENTS", "Assessments & exams",
                        "LIVE_CLASSES", "Live class integration",
                        "CERTIFICATES", "Certifications")));

        groups.add(group("REVENUE", "Sales & Revenue", "credit-card", "Sell courses and get paid",
                opts("PAYMENTS", "Payments & invoicing",
                        "COURSE_SELLING", "Course selling",
                        "ADMISSIONS", "Admissions process management")));

        groups.add(group("CRM", "CRM", "trending-up", "Capture leads and follow up",
                opts("CRM_PIPELINE", "Leads & pipeline",
                        "COMMUNICATIONS", "WhatsApp, email & push")));

        groups.add(group("AUTOMATIONS", "Automations & Workflows", "workflow", "Put the busywork on autopilot",
                opts("WORKFLOWS", "Workflow automations",
                        "AI_SUITE", "AI suite")));

        groups.add(group("LEARNER_APPS", "Learner Apps", "smartphone", "Your own iOS & Android apps",
                opts("LEARNER_ANDROID", "Android app",
                        "LEARNER_IOS", "iOS app")));

        groups.add(group("PARENT_APP", "Parent App", "users", "Keep parents in the loop",
                opts("PARENT_DASHBOARD", "Parent dashboard")));

        groups.add(group("CALLING", "Calling & AI Calling", "phone-call", "Reach leads by phone, or let AI do it",
                opts("CALLING_TEAM", "Calling for your team",
                        "AI_CALLING", "AI calling agent")));

        groups.add(group("WEBSITE_BUILDER", "Website Builder", "globe", "Your public site and course catalogue",
                opts("WEBSITE_PAGES", "Website & landing pages",
                        "COURSE_CATALOGUE", "Public course catalogue")));

        groups.add(group("SUB_ORGS", "Sub-orgs & Partners", "building-2", "Franchisees, VLEs and channel partners",
                opts("SUB_ORG_BRANCHES", "Branches / sub-organizations",
                        "CHANNEL_PARTNERS", "VLE, franchisees & channel partners")));

        return groups;
    }

    private static QuestionOptionDto group(String value, String label, String icon, String description,
                                           List<QuestionOptionDto> children) {
        return QuestionOptionDto.builder()
                .value(value).label(label).icon(icon).description(description).children(children).build();
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
        // These four are the entire demo form — keep them together in one step.
        q.add(base("organization_name", "Institute / organization name", QuestionType.TEXT, S_ABOUT, "About you", 1)
                .required(true).placeholder("Bright Future Academy").build());
        q.add(base("full_name", "Your full name", QuestionType.TEXT, S_ABOUT, "About you", 1)
                .required(true).placeholder("Jane Doe").build());
        q.add(base("work_email", "Work email", QuestionType.EMAIL, S_ABOUT, "About you", 1)
                .required(true).placeholder("jane@yourbrand.com").build());
        q.add(base("phone", "WhatsApp number", QuestionType.PHONE, S_ABOUT, "About you", 1)
                .required(true).placeholder("+91 98765 43210")
                .helpText("We'll send your demo details and follow up here.").build());
        q.add(base("role", "Your role", QuestionType.TEXT, S_ABOUT, "About you", 1)
                .placeholder("Founder, Admin, Academic Head…").build());

        // ---- Section 2: What do you need? ----------------------------------------
        // Eight capability groups the prospect expands to tick individual features. Both the group
        // codes and the feature codes land in features_of_interest, so sales can triage on the
        // coarse interest and still see exactly what was asked for.
        q.add(base("requirements", "What are you looking for?", QuestionType.FEATURE_GROUPS, S_NEEDS, "What do you need?", 2)
                .required(true).multi(true)
                .helpText("Pick the areas you care about, then tick the specifics. This shapes the demo we set up for you.")
                .options(featureGroups())
                .build());
        q.add(base("learners_now", "How many learners do you have today?", QuestionType.SELECT, S_NEEDS, "What do you need?", 2)
                .required(true).options(learnerRanges()).build());
        q.add(base("learners_6m", "And how many in the next 6 months?", QuestionType.SELECT, S_NEEDS, "What do you need?", 2)
                .required(true).options(learnerRanges())
                .helpText("A rough estimate is fine — it helps us size the right plan.").build());

        // ---- Section 3: Your institute (items 1, 4, 6) ---------------------------
        q.add(base("institute_type", "What best describes you?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 3)
                .required(true).drivesDemo(true)
                .helpText("This tailors your demo.")
                .options(opts("SCHOOL", "School", "DISTANCE_LEARNING", "Distance Learning",
                        "CORPORATE", "Corporate", "UNIVERSITY", "University")).build());
        q.add(base("business_model", "How do you sell?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 3)
                .options(opts("B2C", "Direct to learners (B2C)", "B2B", "To organizations (B2B)", "BOTH", "Both")).build());
        // Logo, portal domains and brand colour deliberately live in the post-payment onboarding,
        // not here — a prospect asking for a demo doesn't have those decisions made yet.
        q.add(base("audience_size", "How many learners?", QuestionType.SELECT, S_INSTITUTE, "Your institute", 3)
                .options(opts("LT_100", "Under 100", "100_500", "100–500", "500_2000", "500–2,000",
                        "2000_10000", "2,000–10,000", "GT_10000", "10,000+")).build());

        // ---- Section 4: Communications (items 2, 7) ------------------------------
        // Ask about intent, not setup: the sender name/address is a post-payment detail.
        q.add(base("wants_email_campaigns", "Want to run email campaigns and notifications?", QuestionType.BOOLEAN, S_COMMS, "Communications", 4)
                .featureFlag("EMAIL_CAMPAIGNS")
                .helpText("Broadcasts to your learners, plus automated course and payment notifications.").build());
        q.add(base("wants_whatsapp", "Connect WhatsApp?", QuestionType.BOOLEAN, S_COMMS, "Communications", 4)
                .featureFlag("WHATSAPP").build());
        q.add(base("whatsapp_number", "WhatsApp business number", QuestionType.PHONE, S_COMMS, "Communications", 4)
                .dependsOnKey("wants_whatsapp").dependsOnValue("true").build());
        q.add(base("wants_whatsapp_ai_agent", "Add a WhatsApp AI agent?", QuestionType.BOOLEAN, S_COMMS, "Communications", 4)
                .dependsOnKey("wants_whatsapp").dependsOnValue("true").featureFlag("WHATSAPP_AI_AGENT").build());

        // ---- Section 5: Payments & billing (item 3) ------------------------------
        q.add(base("wants_payments", "Sell courses / collect payments?", QuestionType.BOOLEAN, S_MONEY, "Payments & billing", 5)
                .featureFlag("PAYMENTS").build());
        q.add(base("payment_gateway", "Preferred payment gateway", QuestionType.SELECT, S_MONEY, "Payments & billing", 5)
                .dependsOnKey("wants_payments").dependsOnValue("true")
                .options(opts("RAZORPAY", "Razorpay", "STRIPE", "Stripe", "PAYU", "PayU",
                        "CASHFREE", "Cashfree", "PHONEPE", "PhonePe", "OTHER", "Other / not sure")).build());
        q.add(base("wants_invoicing", "Need invoices / GST billing?", QuestionType.BOOLEAN, S_MONEY, "Payments & billing", 5)
                .dependsOnKey("wants_payments").dependsOnValue("true").featureFlag("INVOICING").build());

        // ---- Section 6: Teaching & delivery (items 5, 9, 10) ---------------------
        q.add(base("wants_live_classes", "Run live classes?", QuestionType.BOOLEAN, S_DELIVERY, "Teaching & delivery", 6)
                .featureFlag("LIVE_CLASSES").build());
        q.add(base("live_class_platform", "Live class platform", QuestionType.SELECT, S_DELIVERY, "Teaching & delivery", 6)
                .dependsOnKey("wants_live_classes").dependsOnValue("true")
                .options(opts("BBB", "Built-in (BigBlueButton)", "ZOOM", "Zoom", "GOOGLE_MEET", "Google Meet", "OTHER", "Other")).build());
        q.add(base("wants_mobile_apps", "Want branded mobile apps?", QuestionType.MULTISELECT, S_DELIVERY, "Teaching & delivery", 6)
                .multi(true).featureFlag("MOBILE_APPS")
                .options(opts("ANDROID", "Android", "IOS", "iOS")).build());
        q.add(base("wants_certificates", "Issue course certificates?", QuestionType.BOOLEAN, S_DELIVERY, "Teaching & delivery", 6)
                .featureFlag("CERTIFICATES").build());

        // ---- Section 7: Sales & growth (item 8) ----------------------------------
        q.add(base("wants_crm", "Use the built-in CRM for leads?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 7)
                .featureFlag("CRM").build());
        q.add(base("wants_calling", "Enable calling / telephony for your team?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 7)
                .dependsOnKey("wants_crm").dependsOnValue("true").featureFlag("CALLING").build());
        q.add(base("wants_ai_sales_agent", "Add an AI sales agent?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 7)
                .dependsOnKey("wants_crm").dependsOnValue("true").featureFlag("AI_SALES_AGENT").build());
        q.add(base("ads_integration", "Connect ad platforms for lead capture?", QuestionType.MULTISELECT, S_GROWTH, "Sales & growth", 7)
                .multi(true).featureFlag("ADS_INTEGRATION")
                .options(opts("META", "Meta (Facebook/Instagram) Lead Ads", "GOOGLE", "Google Ads")).build());
        q.add(base("wants_sub_orgs", "Run branches, franchisees or channel partners?", QuestionType.BOOLEAN, S_GROWTH, "Sales & growth", 7)
                .featureFlag("SUB_ORGS")
                .helpText("Sub-organizations, VLEs and partners each get their own scoped workspace.").build());
        q.add(base("sub_org_count", "How many branches / partners?", QuestionType.SELECT, S_GROWTH, "Sales & growth", 7)
                .dependsOnKey("wants_sub_orgs").dependsOnValue("true")
                .options(opts("LT_5", "Under 5", "5_20", "5–20", "20_100", "20–100", "GT_100", "100+")).build());

        // The old "Almost done" step (main goal, launch timeline, how-did-you-hear, guided-call,
        // free-text notes) is gone — those are questions for the sales conversation, not the form.

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
