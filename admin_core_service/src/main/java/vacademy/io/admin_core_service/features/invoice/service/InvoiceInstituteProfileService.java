package vacademy.io.admin_core_service.features.invoice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;

/**
 * Owns persistence of institute-level invoice defaults (the {@code Institute Name} /
 * {@code Institute Address} / {@code Institute Contact} / default {@code Notes} fields
 * shown in the admin Create-Invoice review step) into the institute's real
 * {@code INVOICE_SETTING}, under {@code instituteNameOverride} / {@code instituteAddressOverride}
 * / {@code instituteContactOverride} / {@code defaultNotes}.
 *
 * <p>Unlike the per-user {@link InvoiceBillingProfileService}, this is genuinely
 * institute-wide: every admin creating any future invoice sees the corrected details —
 * matching how these fields already work (they're the institute's invoicing identity,
 * not per-invoice data), and matching the same place Settings &gt; Invoice Settings
 * already stores tax/currency config.
 *
 * <p>{@code INVOICE_SETTING} writes are a FULL OVERWRITE of the stored JSON (see
 * {@code GenericSettingStrategy.rebuildInstituteSetting}), so {@link #upsert} always
 * starts from the caller's already-loaded settings map (which carries every existing
 * key — tax rate, currency, …) and only mutates the four keys this class owns, never a
 * fresh/partial map. Kept as a separate bean with its own {@link Propagation#REQUIRES_NEW}
 * transaction for the same reason as {@link InvoiceBillingProfileService}: a save failure
 * here must never roll back invoice creation.
 */
@Slf4j
@Service
public class InvoiceInstituteProfileService {

    @Autowired
    private InstituteSettingService instituteSettingService;

    private static final String KEY_NAME = "instituteNameOverride";
    private static final String KEY_ADDRESS = "instituteAddressOverride";
    private static final String KEY_CONTACT = "instituteContactOverride";
    private static final String KEY_NOTES = "defaultNotes";

    /**
     * Institute-level invoice defaults as a placeholder-keyed map (institute_name,
     * institute_address, institute_contact, notes), reading from the ALREADY-LOADED
     * settings map (no extra DB round-trip). Only non-blank values are included.
     */
    public Map<String, String> loadAsMap(Map<String, Object> invoiceSettings) {
        Map<String, String> map = new HashMap<>();
        if (invoiceSettings == null) return map;
        putIfText(map, "institute_name", invoiceSettings.get(KEY_NAME));
        putIfText(map, "institute_address", invoiceSettings.get(KEY_ADDRESS));
        putIfText(map, "institute_contact", invoiceSettings.get(KEY_CONTACT));
        putIfText(map, "notes", invoiceSettings.get(KEY_NOTES));
        return map;
    }

    /**
     * Upsert (last-write-wins) the institute-linked fields the admin submitted, so the
     * next invoice — created by any admin — prefills them. {@code edits} must contain
     * only placeholder keys that genuinely CHANGED (see the deviation logic in
     * {@code InvoiceService.instituteEditsFromOverrides}) — an empty string clears a
     * previously-pinned value. Runs in its own transaction (REQUIRES_NEW); the caller is
     * expected to wrap this in try/catch so a settings-save failure never breaks invoice
     * creation.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void upsert(Institute institute, Map<String, Object> currentInvoiceSettings, Map<String, String> edits) {
        if (edits == null || edits.isEmpty() || institute == null) return;
        boolean anyField = edits.containsKey("institute_name")
                || edits.containsKey("institute_address")
                || edits.containsKey("institute_contact")
                || edits.containsKey("notes");
        if (!anyField) return;

        // Start from the FULL currently-stored settings (tax rate, currency, …) — this write
        // is a total overwrite of the JSON, so anything not carried here would be lost.
        Map<String, Object> mutated = new HashMap<>(currentInvoiceSettings != null ? currentInvoiceSettings : Map.of());
        if (edits.containsKey("institute_name")) setOrRemove(mutated, KEY_NAME, edits.get("institute_name"));
        if (edits.containsKey("institute_address")) setOrRemove(mutated, KEY_ADDRESS, edits.get("institute_address"));
        if (edits.containsKey("institute_contact")) setOrRemove(mutated, KEY_CONTACT, edits.get("institute_contact"));
        if (edits.containsKey("notes")) setOrRemove(mutated, KEY_NOTES, edits.get("notes"));

        instituteSettingService.saveGenericSetting(institute, "INVOICE_SETTING", mutated);
    }

    private void putIfText(Map<String, String> map, String key, Object value) {
        if (value != null && StringUtils.hasText(value.toString())) map.put(key, value.toString());
    }

    private void setOrRemove(Map<String, Object> map, String key, String value) {
        if (StringUtils.hasText(value)) map.put(key, value);
        else map.remove(key);
    }
}
