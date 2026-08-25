package vacademy.io.admin_core_service.features.institute_learner.manager;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.service.AdminDirectEnrollService;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.common.auth.dto.learner.LearnerPackageSessionsEnrollDTO;

import java.lang.reflect.Method;
import java.util.Calendar;
import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * The access-days precedence a manual enrollment resolves: <b>explicit &gt; plan &gt;
 * invite</b>.
 *
 * <p>This is the rule behind "type 2 on the enrollment form and the learner gets 2 days".
 * Before it existed, only the invite was read, so the number an admin typed was silently
 * discarded — and since invites almost never carried access days, the learner ended up
 * with unlimited access.
 */
@ExtendWith(MockitoExtension.class)
class ManualEnrollAccessDaysTest {

    private final AdminDirectEnrollService service = new AdminDirectEnrollService();

    /** resolveAccessDays is private; the precedence it encodes is what matters here. */
    private String resolve(Integer explicit, Integer planDays, Integer inviteDays) throws Exception {
        LearnerPackageSessionsEnrollDTO dto = new LearnerPackageSessionsEnrollDTO();
        dto.setAccessDays(explicit);

        PaymentPlan plan = null;
        if (planDays != null) {
            plan = new PaymentPlan();
            plan.setValidityInDays(planDays);
        }

        EnrollInvite invite = new EnrollInvite();
        invite.setLearnerAccessDays(inviteDays);

        Method m = AdminDirectEnrollService.class.getDeclaredMethod(
                "resolveAccessDays", LearnerPackageSessionsEnrollDTO.class,
                PaymentPlan.class, EnrollInvite.class);
        m.setAccessible(true);
        return (String) m.invoke(service, dto, plan, invite);
    }

    @Test
    @DisplayName("typing 2 on the form wins over a 365-day plan and a 90-day invite")
    void explicitWinsOverEverything() throws Exception {
        assertEquals("2", resolve(2, 365, 90));
    }

    @Test
    @DisplayName("blank field falls back to the plan's validity")
    void fallsBackToPlan() throws Exception {
        assertEquals("365", resolve(null, 365, 90));
    }

    @Test
    @DisplayName("blank field and a plan with no validity falls back to the invite")
    void fallsBackToInvite() throws Exception {
        assertEquals("90", resolve(null, null, 90));
    }

    @Test
    @DisplayName("nothing anywhere means unlimited, not zero days")
    void unlimitedWhenNothingSet() throws Exception {
        assertNull(resolve(null, null, null),
                "null keeps expiry_date unset; \"0\" would expire the learner immediately");
    }

    @Test
    @DisplayName("an explicit 1 is honoured and never mistaken for 'unset'")
    void explicitOneIsHonoured() throws Exception {
        assertEquals("1", resolve(1, 365, null));
    }

    /**
     * The round trip that makes the feature visibly correct: the learner list derives a
     * learner's access days as {@code expiry_date - enrolled_date}, so the window has to
     * be measured from the enrollment date. Basing it on "now" would make a backdated
     * enrollment report a different number than the admin typed.
     */
    @Test
    @DisplayName("2 access days from a backdated enrollment still reads back as 2, not as days-from-today")
    void windowIsMeasuredFromEnrollmentDate() {
        StudentRegistrationManager manager = new StudentRegistrationManager(null);

        Calendar enrolled = Calendar.getInstance();
        enrolled.add(Calendar.DAY_OF_YEAR, -10); // admin backdated the enrollment
        Date enrolledDate = enrolled.getTime();

        Date expiry = manager.makeExpiryDate(enrolledDate, "2");

        long derivedAccessDays = Math.round(
                (double) (expiry.getTime() - enrolledDate.getTime()) / (24L * 60 * 60 * 1000));
        assertEquals(2, derivedAccessDays);
    }

    @Test
    @DisplayName("no access days means no expiry at all — unlimited, not an instant expiry")
    void noAccessDaysLeavesExpiryUnset() {
        StudentRegistrationManager manager = new StudentRegistrationManager(null);
        assertNull(manager.makeExpiryDate(new Date(), null));
    }
}
