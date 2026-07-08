package vacademy.io.admin_core_service.features.invoice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceBillingProfile;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceBillingProfileRepository;

import java.util.HashMap;
import java.util.Map;

/**
 * Owns persistence of the remembered per-user "Bill To" details for the admin invoice flow.
 *
 * <p>Kept as a separate bean so the {@link #upsert} runs in its OWN transaction
 * ({@link Propagation#REQUIRES_NEW}). This matters because it is called from within the
 * {@code @Transactional} {@code InvoiceService.createAdminInvoices}: a save failure here
 * (constraint race, oversized value, …) must NOT poison / roll back the invoice-creation
 * transaction. With REQUIRES_NEW the parent transaction is suspended, so an inner failure
 * rolls back only the profile write and the caller can swallow it — invoice creation still
 * commits. Billing-profile persistence is strictly best-effort.
 */
@Slf4j
@Service
public class InvoiceBillingProfileService {

    @Autowired
    private InvoiceBillingProfileRepository invoiceBillingProfileRepository;

    /**
     * Load a user's saved Bill-To details as a placeholder-keyed map (user_name, user_email,
     * user_address, user_tax_info, place_of_supply). Returns an empty map when nothing is saved
     * or on any error — reads must never break the preview.
     */
    public Map<String, String> loadAsMap(String userId, String instituteId) {
        Map<String, String> map = new HashMap<>();
        try {
            invoiceBillingProfileRepository.findByUserIdAndInstituteId(userId, instituteId)
                    .ifPresent(p -> {
                        putIfText(map, "user_name", p.getBillingName());
                        putIfText(map, "user_email", p.getBillingEmail());
                        putIfText(map, "user_address", p.getBillingAddress());
                        putIfText(map, "user_tax_info", p.getTaxInfo());
                        putIfText(map, "place_of_supply", p.getPlaceOfSupply());
                    });
        } catch (Exception e) {
            log.warn("Failed to load invoice billing profile for user {} institute {}: {}",
                    userId, instituteId, e.getMessage());
        }
        return map;
    }

    /**
     * Upsert (last-write-wins) the user-linked Bill-To fields, keyed by placeholder name, so the
     * next invoice for this user prefills them. Runs in a NEW transaction — see class doc. The
     * caller is expected to wrap this in try/catch so an inner failure never propagates.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsert(String userId, String instituteId, Map<String, String> overrides) {
        if (overrides == null) return;
        // Only fields the admin submitted (present as keys — the template surfaced them AND the
        // caller decided they deviate from the live user record) are written; fields absent from
        // this invoice are left untouched so we never wipe a value saved via a different template.
        // An empty value DOES clear the pin (falls back to the live record next time).
        boolean anyUserField = overrides.containsKey("user_name")
                || overrides.containsKey("user_email")
                || overrides.containsKey("user_address")
                || overrides.containsKey("user_tax_info")
                || overrides.containsKey("place_of_supply");
        if (!anyUserField) return;

        java.util.Optional<InvoiceBillingProfile> existing =
                invoiceBillingProfileRepository.findByUserIdAndInstituteId(userId, instituteId);
        // Don't create an all-empty profile row (the common "admin changed nothing" case): only
        // update an existing profile (to clear pins) or create one when there's a value to remember.
        boolean anyValue = StringUtils.hasText(overrides.get("user_name"))
                || StringUtils.hasText(overrides.get("user_email"))
                || StringUtils.hasText(overrides.get("user_address"))
                || StringUtils.hasText(overrides.get("user_tax_info"))
                || StringUtils.hasText(overrides.get("place_of_supply"));
        if (existing.isEmpty() && !anyValue) return;

        InvoiceBillingProfile profile = existing.orElseGet(() -> {
            InvoiceBillingProfile p = new InvoiceBillingProfile();
            p.setUserId(userId);
            p.setInstituteId(instituteId);
            return p;
        });
        // Clamp to column widths so an over-length free-text paste can never throw and discard the
        // whole save. (billing_address is TEXT, so unbounded.)
        if (overrides.containsKey("user_name")) profile.setBillingName(clamp(overrides.get("user_name"), 512));
        if (overrides.containsKey("user_email")) profile.setBillingEmail(clamp(overrides.get("user_email"), 320));
        if (overrides.containsKey("user_address")) profile.setBillingAddress(blankToNull(overrides.get("user_address")));
        if (overrides.containsKey("user_tax_info")) profile.setTaxInfo(clamp(overrides.get("user_tax_info"), 255));
        if (overrides.containsKey("place_of_supply")) profile.setPlaceOfSupply(clamp(overrides.get("place_of_supply"), 255));
        invoiceBillingProfileRepository.save(profile);
    }

    private void putIfText(Map<String, String> map, String key, String value) {
        if (StringUtils.hasText(value)) map.put(key, value);
    }

    private String blankToNull(String s) {
        return StringUtils.hasText(s) ? s : null;
    }

    /** Trim-to-null then cap at {@code max} chars so a fixed-length column can't overflow. */
    private String clamp(String s, int max) {
        String v = blankToNull(s);
        if (v == null) return null;
        return v.length() > max ? v.substring(0, max) : v;
    }
}
