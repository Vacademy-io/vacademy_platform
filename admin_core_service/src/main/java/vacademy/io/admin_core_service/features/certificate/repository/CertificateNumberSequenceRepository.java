package vacademy.io.admin_core_service.features.certificate.repository;

import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.certificate.entity.CertificateNumberSequence;

@Repository
public interface CertificateNumberSequenceRepository
        extends JpaRepository<CertificateNumberSequence, CertificateNumberSequence.CertificateNumberSequenceId> {

    /**
     * Atomically reserve the next sequence number for one (institute, year).
     *
     * <p>The whole allocation is a single statement, so two concurrent issuances
     * can never receive the same number: the second one blocks on the row lock
     * taken by {@code DO UPDATE} and then reads the incremented value. This is
     * the fix for the previous random-id scheme, where a check-then-insert race
     * produced duplicate ids whose losing INSERT was swallowed — the learner got
     * a PDF but no audit row.
     *
     * <p>First call for a year inserts {@code next_seq = 1}; every later call
     * increments. The returned value is the number to use, not the next free one.
     */
    @Modifying
    @Transactional
    @Query(value = """
            INSERT INTO certificate_number_sequence (institute_id, year, next_seq)
            VALUES (:instituteId, :year, 1)
            ON CONFLICT (institute_id, year)
            DO UPDATE SET next_seq   = certificate_number_sequence.next_seq + 1,
                          updated_at = CURRENT_TIMESTAMP
            RETURNING next_seq
            """, nativeQuery = true)
    Long allocateNext(@Param("instituteId") String instituteId, @Param("year") int year);
}
