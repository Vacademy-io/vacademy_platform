package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.time.OffsetDateTime;

/**
 * Landing-zone row for one Airtel CCR/CDR S3 object (see V340). Captured raw +
 * idempotently by {@code s3Key}; a later promoter resolves institute/counsellor/
 * lead and promotes/enriches a {@code telephony_call_log} row.
 */
@Entity
@Table(name = "airtel_call_import")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AirtelCallImport {

    /** kind discriminator values. */
    public static final String KIND_CDR = "CDR";
    public static final String KIND_RECORDING = "RECORDING";

    /** processing_status values. */
    public static final String STATUS_RECEIVED = "RECEIVED";
    public static final String STATUS_PROMOTED = "PROMOTED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_SKIPPED = "SKIPPED";

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "kind", nullable = false, length = 16)
    private String kind;

    @Column(name = "s3_key", nullable = false, length = 512)
    private String s3Key;

    @Column(name = "account_id", length = 32)
    private String accountId;

    @Column(name = "institute_id", length = 36)
    private String instituteId;

    @Column(name = "call_id", length = 64)
    private String callId;

    @Column(name = "cdr_id", length = 64)
    private String cdrId;

    @Column(name = "recording_object_id", length = 64)
    private String recordingObjectId;

    @Column(name = "direction", length = 16)
    private String direction;

    @Column(name = "disposition", length = 128)
    private String disposition;

    @Column(name = "source_extension", length = 32)
    private String sourceExtension;

    @Column(name = "source_user_id", length = 64)
    private String sourceUserId;

    @Column(name = "source_user_full_name", length = 255)
    private String sourceUserFullName;

    @Column(name = "caller_id_number", length = 32)
    private String callerIdNumber;

    @Column(name = "counterparty_number", length = 32)
    private String counterpartyNumber;

    @Column(name = "counterparty_msisdn10", length = 10)
    private String counterpartyMsisdn10;

    @Column(name = "date_start")
    private OffsetDateTime dateStart;

    @Column(name = "date_end")
    private OffsetDateTime dateEnd;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "is_recorded")
    private Boolean isRecorded;

    @Column(name = "recording_storage_key", length = 255)
    private String recordingStorageKey;

    @Column(name = "recording_length_seconds")
    private Integer recordingLengthSeconds;

    @Column(name = "raw_payload", nullable = false, columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "processing_status", nullable = false, length = 24)
    @Builder.Default
    private String processingStatus = STATUS_RECEIVED;

    @Column(name = "process_detail", columnDefinition = "TEXT")
    private String processDetail;

    @Column(name = "call_log_id", length = 36)
    private String callLogId;

    @Column(name = "received_at", insertable = false, updatable = false)
    private Timestamp receivedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    // DB default sets this on INSERT (insertable=false); @UpdateTimestamp keeps it
    // current when the promoter mutates the row (updatable=true).
    @UpdateTimestamp
    @Column(name = "updated_at", insertable = false)
    private Timestamp updatedAt;
}
