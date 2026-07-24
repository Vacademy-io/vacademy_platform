package vacademy.io.admin_core_service.features.live_session.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static vacademy.io.admin_core_service.features.live_session.util.GuestFormFieldResolver.Role;
import static vacademy.io.admin_core_service.features.live_session.util.GuestFormFieldResolver.classify;

class GuestFormFieldResolverTest {

    /** The institute-suffixed keys a real live session registration form submits. */
    private static final String INST = "_inst_f5989aa0-eb6a-44b7-a43e-0e1d0271d014";

    @Test
    @DisplayName("resolves the real institute-suffixed keys of a live session form")
    void resolvesInstituteSuffixedKeys() {
        assertEquals(Role.NAME, classify("full_name" + INST, "Full Name"));
        assertEquals(Role.EMAIL, classify("email" + INST, "Email"));
        assertEquals(Role.PHONE, classify("phone_number" + INST, "Phone Number"));
        assertEquals(Role.OTHER, classify("cuet_marks_out_of_1000" + INST, "CUET Marks out of 1000"));
    }

    @Test
    @DisplayName("a hex institute-id suffix never swallows a keyword")
    void suffixDoesNotCreateFalsePositives() {
        // UUID suffixes are hex + dashes, so they cannot contain name/mail/phone.
        assertEquals(Role.OTHER, classify("city" + INST, "City"));
        assertEquals(Role.OTHER, classify("grade" + INST, "Grade"));
    }

    @Test
    @DisplayName("matches the seeded institute defaults, which are not suffixed")
    void resolvesUnsuffixedSeededDefaults() {
        assertEquals(Role.NAME, classify("full_name", "Full Name"));
        assertEquals(Role.EMAIL, classify("email", "Email"));
        assertEquals(Role.PHONE, classify("phone_number", "Phone Number"));
    }

    @Test
    @DisplayName("phone is found regardless of the label an admin picks")
    void resolvesPhoneVariants() {
        assertEquals(Role.PHONE, classify("mobile_number" + INST, "Mobile Number"));
        assertEquals(Role.PHONE, classify("contact_number", "Contact Number"));
        assertEquals(Role.PHONE, classify("telephone", "Telephone"));
        assertEquals(Role.PHONE, classify("cell", "Cell"));
        assertEquals(Role.PHONE, classify("whatsapp_no", "Phone"));
    }

    @Test
    @DisplayName("email wins over name, and name wins over the 'contact' phone keyword")
    void ordersOverlappingKeywords() {
        // "contact_name" contains both a name and a phone keyword; a person's name is
        // the correct read, and claiming it as a phone would send messages nowhere.
        assertEquals(Role.NAME, classify("contact_name", "Contact Name"));
        // "email" contains "mail"; it must not be read as anything else.
        assertEquals(Role.EMAIL, classify("email_address", "Email Address"));
    }

    @Test
    @DisplayName("classification survives casing, padding and missing arguments")
    void handlesNullAndCasing() {
        assertEquals(Role.PHONE, classify(null, "  Phone Number  "));
        assertEquals(Role.NAME, classify("FULL_NAME", null));
        assertEquals(Role.OTHER, classify(null, null));
        assertEquals(Role.OTHER, classify("", ""));
    }
}
