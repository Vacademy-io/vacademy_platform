package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * One row per call attempt. {@code id} is our correlation UUID, generated
 * before we hit the provider so the webhook can find the row by PK even if
 * the provider's CallSid hasn't been recorded yet.
 *
 * Implements {@link Persistable} because the orchestrator assigns its own
 * UUID id. Without this hint, Spring Data JPA's {@code save()} treats every
 * call (including the first INSERT) as a merge — Hibernate then runs a
 * pre-INSERT SELECT to see if the row already exists. Across the webhook
 * hot path (3-5 callbacks per call) that adds up. {@link #markNew()} is
 * called explicitly when constructing a brand-new row, and the @PostLoad
 * hook flips it off so subsequent UPDATEs go through merge as usual.
 */
@Entity
@Table(name = "telephony_call_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelephonyCallLog implements Persistable<String> {

    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "provider_type", nullable = false, length = 32)
    private String providerType;

    @Column(name = "provider_call_id", length = 64)
    private String providerCallId;

    @Column(name = "provider_number_id")
    private String providerNumberId;

    @Column(name = "response_id")
    private String responseId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "counsellor_user_id", nullable = false)
    private String counsellorUserId;

    @Column(name = "direction", nullable = false, length = 16)
    private String direction;

    @Column(name = "from_number", length = 20)
    private String fromNumber;

    @Column(name = "to_number", length = 20)
    private String toNumber;

    @Column(name = "caller_id", length = 20)
    private String callerId;

    @Column(name = "status", nullable = false, length = 24)
    private String status;

    @Column(name = "termination_reason", length = 48)
    private String terminationReason;

    @Column(name = "start_time")
    private Timestamp startTime;

    @Column(name = "answer_time")
    private Timestamp answerTime;

    @Column(name = "end_time")
    private Timestamp endTime;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "price", precision = 8, scale = 4)
    private BigDecimal price;

    @Column(name = "recording_url", columnDefinition = "TEXT")
    private String recordingUrl;

    @Column(name = "recording_storage_key", length = 255)
    private String recordingStorageKey;

    @Column(name = "recording_fetch_attempts", nullable = false)
    @Builder.Default
    private Integer recordingFetchAttempts = 0;

    @Column(name = "recording_logged", nullable = false)
    @Builder.Default
    private Boolean recordingLogged = false;

    @Column(name = "raw_payload_json", columnDefinition = "TEXT")
    private String rawPayloadJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    /**
     * Persistable hint. Flipped to false after first load/persist so
     * subsequent saves go through merge() as expected.
     *
     * Lombok @Builder ignores @Transient fields by default, but we still
     * want isNew() to return true for builder-constructed rows. The
     * orchestrator calls {@link #markNew()} immediately after build().
     */
    @Transient
    @Builder.Default
    private boolean isNewEntity = false;

    @Override
    public String getId() {
        return id;
    }

    @Override
    public boolean isNew() {
        return isNewEntity;
    }

    /** Mark this freshly-built row as a brand-new INSERT candidate. */
    public TelephonyCallLog markNew() {
        this.isNewEntity = true;
        return this;
    }

    /** After Hibernate loads or persists, the row is no longer "new". */
    @PostLoad
    @PostPersist
    void markNotNew() {
        this.isNewEntity = false;
    }
}
