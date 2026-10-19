package vacademy.io.admin_core_service.features.notification_service.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PaymentConfirmationReceiptAliasesTest {

    private static Map<String, String> base() {
        Map<String, String> v = new HashMap<>();
        v.put("user_full_name", "Sam Lee");
        v.put("amount", "431.00");
        v.put("currency_symbol", "A$");
        v.put("payment_date", "19 Oct 2026");
        v.put("course_name", "Practice Membership - MYCPD");
        return v;
    }

    private static PaymentLog logWithPlan(String planName) {
        PaymentPlan plan = new PaymentPlan();
        plan.setName(planName);
        UserPlan userPlan = new UserPlan();
        userPlan.setPaymentPlan(plan);
        PaymentLog log = new PaymentLog();
        log.setUserPlan(userPlan);
        return log;
    }

    @Test
    @DisplayName("email-editor receipt names resolve from the values the confirmation already carries")
    void aliases() {
        Map<String, String> v = PaymentNotificatonService.withReceiptAliases(base(),
                logWithPlan("Annual Fee for 5 Members"));
        assertEquals("Sam Lee", v.get("customer_name"));
        assertEquals("A$431.00", v.get("amount_paid"));
        assertEquals("19 Oct 2026", v.get("payment_received_date"));
        assertEquals("Practice Membership - MYCPD", v.get("invoice_item_description"));
        assertEquals("Annual Fee for 5 Members", v.get("invoice_item_tag"));
    }

    @Test
    @DisplayName("no plan, or a plan name the course already says, leaves the tag empty")
    void tagEmpty() {
        assertEquals("", PaymentNotificatonService.withReceiptAliases(base(), null).get("invoice_item_tag"));
        assertEquals("", PaymentNotificatonService.withReceiptAliases(base(), logWithPlan("Practice Membership"))
                .get("invoice_item_tag"));
    }

    @Test
    @DisplayName("a value the template's own variables already set is not overwritten")
    void keepsExisting() {
        Map<String, String> v = base();
        v.put("customer_name", "Billing Contact");
        assertEquals("Billing Contact", PaymentNotificatonService.withReceiptAliases(v, null).get("customer_name"));
    }
}
