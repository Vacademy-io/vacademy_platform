package vacademy.io.admin_core_service.features.certificate.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.Date;
import java.util.Objects;

/**
 * Per-institute, per-year counter backing sequential certificate numbers.
 *
 * <p>Rows are never created or incremented through this entity — allocation goes
 * through {@code CertificateNumberSequenceRepository.allocateNext}, a single
 * atomic {@code INSERT .. ON CONFLICT DO UPDATE .. RETURNING}. The entity exists
 * so the table is visible to JPA and readable for diagnostics; writing through
 * JPA would reintroduce the read-modify-write race this table was added to fix.
 */
@Entity
@Table(name = "certificate_number_sequence")
@IdClass(CertificateNumberSequence.CertificateNumberSequenceId.class)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CertificateNumberSequence {

    @Id
    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Id
    @Column(name = "year", nullable = false)
    private Integer year;

    /** Highest sequence number handed out so far for this (institute, year). */
    @Column(name = "next_seq", nullable = false)
    private Long nextSeq;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Date updatedAt;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CertificateNumberSequenceId implements Serializable {
        private String instituteId;
        private Integer year;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            CertificateNumberSequenceId that = (CertificateNumberSequenceId) o;
            return Objects.equals(instituteId, that.instituteId) && Objects.equals(year, that.year);
        }

        @Override
        public int hashCode() {
            return Objects.hash(instituteId, year);
        }
    }
}
