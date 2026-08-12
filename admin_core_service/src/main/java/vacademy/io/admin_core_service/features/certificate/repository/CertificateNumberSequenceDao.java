package vacademy.io.admin_core_service.features.certificate.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/**
 * Allocates certificate sequence numbers.
 *
 * <p><b>Why this is not a Spring Data {@code @Modifying} query.</b> The obvious
 * spelling — {@code @Modifying @Query("INSERT ... RETURNING next_seq") Long
 * allocateNext(...)} — cannot work. Spring Data JPA's {@code ModifyingExecution}
 * asserts the method returns {@code void}, {@code int} or {@code Integer}, so a
 * {@code Long} return throws {@code InvalidDataAccessApiUsageException} before
 * the statement ever reaches the database. And even past that assertion,
 * {@code ModifyingExecution} calls {@code executeUpdate()}, which discards the
 * {@code RETURNING} row and errors in PgJDBC on a statement producing a
 * ResultSet.
 *
 * <p>So the allocation runs through {@link EntityManager#createNativeQuery} with
 * {@code getSingleResult()}, matching {@code PlatformInvoiceService}'s invoice
 * number allocator.
 */
@Repository
public class CertificateNumberSequenceDao {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Atomically reserve the next sequence number for one (institute, year).
     *
     * <p>The whole allocation is a single statement, so two concurrent issuances
     * can never receive the same number: the second blocks on the row lock taken
     * by {@code DO UPDATE} and then reads the incremented value. This replaces a
     * check-then-insert race that produced duplicate ids whose losing INSERT was
     * swallowed — the learner got a PDF but no audit row.
     *
     * <p>First call for a year inserts {@code next_seq = 1}; every later call
     * increments. The returned value is the number to use.
     */
    @Transactional
    public long allocateNext(String instituteId, int year) {
        Object result = entityManager.createNativeQuery("""
                        INSERT INTO certificate_number_sequence (institute_id, year, next_seq)
                        VALUES (:instituteId, :year, 1)
                        ON CONFLICT (institute_id, year)
                        DO UPDATE SET next_seq   = certificate_number_sequence.next_seq + 1,
                                      updated_at = CURRENT_TIMESTAMP
                        RETURNING next_seq
                        """)
                .setParameter("instituteId", instituteId)
                .setParameter("year", year)
                .getSingleResult();

        if (result instanceof Number number) {
            return number.longValue();
        }
        throw new IllegalStateException(
                "Certificate sequence allocation returned an unexpected type: "
                        + (result == null ? "null" : result.getClass().getName()));
    }
}
