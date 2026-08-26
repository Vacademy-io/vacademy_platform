package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Where an institute's certificate counter currently stands.
 *
 * <p>The settings screen renders sample numbers as the admin types. Without this
 * it can only guess, and it used to show 1/2/3 — which reads as "your series
 * starts at 1" to an institute that is already at 1200. It is also the only way
 * to warn that a start number is below what has already been issued, where the
 * floor is deliberately ignored rather than reusing a live certificate id.
 */
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CertificateNumberingStatusDto {

    /** The position the next certificate issued would take, floor applied. */
    private long nextSequence;

    /** Highest position already handed out in this counter; 0 when none. */
    private long highestIssuedSequence;

    /** The counter this reflects: the issuance year, or 0 for a series that never resets. */
    private int bucket;

    /**
     * True when a start number was supplied but sits at or below
     * {@link #highestIssuedSequence}, so it has no effect. The screen turns this
     * into a sentence rather than letting the admin believe it applied.
     */
    private boolean startFromIgnored;
}
