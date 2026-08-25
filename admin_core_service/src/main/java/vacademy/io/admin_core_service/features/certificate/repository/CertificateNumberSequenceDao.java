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
     * The {@code year} value standing in for "one unbroken series, never reset".
     *
     * <p>Reusing the year column for the continuous bucket keeps the existing
     * primary key — and therefore the atomicity of {@code ON CONFLICT} — exactly
     * as it was, with no migration. Zero is safe as a sentinel because a real
     * issuance year can never be 0.
     */
    public static final int CONTINUOUS_BUCKET = 0;

    /**
     * Atomically reserve the next sequence number for one (institute, bucket),
     * never returning below {@code startFrom}.
     *
     * <p>The whole allocation is a single statement, so two concurrent issuances
     * can never receive the same number: the second blocks on the row lock taken
     * by {@code DO UPDATE} and then reads the incremented value. This replaces a
     * check-then-insert race that produced duplicate ids whose losing INSERT was
     * swallowed — the learner got a PDF but no audit row.
     *
     * <p>{@code startFrom} is applied with {@code GREATEST} on both branches, so
     * it is a floor rather than a set: raising it skips the series forward,
     * lowering it is a no-op. A hard set would hand out a number that is already
     * some learner's certificate id, and the id is the primary key of
     * {@code issued_certificate}. Pass {@code 0} for no floor.
     *
     * @param bucket the issuance year, or {@link #CONTINUOUS_BUCKET} for a
     *               series that never resets. The continuous row seeds itself
     *               past the highest number any yearly bucket has reached, so
     *               switching an institute over mid-life cannot replay numbers
     *               it has already issued.
     */
    // The BIGINT casts are load-bearing: GREATEST(:startFrom, :seed) inside
    // VALUES has two bare parameters and no column to infer from, which Postgres
    // rejects with "could not determine data type of parameter".
    @Transactional
    public long allocateNext(String instituteId, int bucket, long startFrom) {
        Object result = entityManager.createNativeQuery("""
                        INSERT INTO certificate_number_sequence (institute_id, year, next_seq)
                        VALUES (:instituteId, :bucket,
                                GREATEST(CAST(:startFrom AS BIGINT), CAST(:seed AS BIGINT)))
                        ON CONFLICT (institute_id, year)
                        DO UPDATE SET next_seq   = GREATEST(certificate_number_sequence.next_seq + 1,
                                                            CAST(:startFrom AS BIGINT)),
                                      updated_at = CURRENT_TIMESTAMP
                        RETURNING next_seq
                        """)
                .setParameter("instituteId", instituteId)
                .setParameter("bucket", bucket)
                .setParameter("startFrom", Math.max(0L, startFrom))
                .setParameter("seed", seedFor(instituteId, bucket))
                .getSingleResult();

        if (result instanceof Number number) {
            return number.longValue();
        }
        throw new IllegalStateException(
                "Certificate sequence allocation returned an unexpected type: "
                        + (result == null ? "null" : result.getClass().getName()));
    }

    /** Backwards-compatible allocation with no floor, on the given year. */
    @Transactional
    public long allocateNext(String instituteId, int year) {
        return allocateNext(instituteId, year, 0L);
    }

    /**
     * The number {@link #allocateNext} would hand out next, reserving nothing.
     *
     * <p>Used by the settings screen, which previews continuously as the admin
     * types — a preview that consumed numbers would burn a block of the series
     * on every visit.
     */
    public long peekNext(String instituteId, int bucket, long startFrom) {
        long issued = highestAllocated(instituteId, bucket);
        // Only an absent row takes the seed; once the bucket exists the counter
        // itself is the truth, and seeding past it would make the preview
        // disagree with what the next issuance actually gets.
        long base = issued > 0 ? issued + 1 : seedFor(instituteId, bucket);
        return Math.max(base, Math.max(1L, startFrom));
    }

    /**
     * Highest sequence position already handed out in this bucket, ignoring any
     * floor — {@code 0} when nothing has been issued yet.
     *
     * <p>The settings screen needs this to tell an admin that the start number
     * they typed is below what is already printed on real certificates and will
     * therefore be ignored, rather than letting them believe it took effect.
     */
    public long highestAllocated(String instituteId, int bucket) {
        Object result = entityManager.createNativeQuery("""
                        SELECT COALESCE(MAX(next_seq), 0)
                        FROM certificate_number_sequence
                        WHERE institute_id = :instituteId AND year = :bucket
                        """)
                .setParameter("instituteId", instituteId)
                .setParameter("bucket", bucket)
                .getSingleResult();
        return result instanceof Number number ? number.longValue() : 0L;
    }

    /**
     * The value a brand-new row starts at.
     *
     * <p>For a yearly bucket that is 1, as it always was. For the continuous
     * bucket it is one past the highest number this institute has reached in any
     * year, so an institute that switches off the yearly reset carries on from
     * where it was instead of restarting into numbers already issued.
     */
    private long seedFor(String instituteId, int bucket) {
        if (bucket != CONTINUOUS_BUCKET) {
            return 1L;
        }
        Object result = entityManager.createNativeQuery("""
                        SELECT COALESCE(MAX(next_seq), 0) + 1
                        FROM certificate_number_sequence
                        WHERE institute_id = :instituteId
                        """)
                .setParameter("instituteId", instituteId)
                .getSingleResult();
        return result instanceof Number number ? number.longValue() : 1L;
    }
}
