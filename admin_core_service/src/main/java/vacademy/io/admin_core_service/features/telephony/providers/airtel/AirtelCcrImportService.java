package vacademy.io.admin_core_service.features.telephony.providers.airtel;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyMultipartBytes;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AirtelCallImport;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AirtelCallImportRepository;
import vacademy.io.admin_core_service.features.telephony.providers.airtel.dto.AirtelCdr;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Imports one Airtel CCR/CDR S3 object into the {@code airtel_call_import}
 * landing zone (idempotent by s3 key). Two object kinds:
 *   • {@code Cdr/<uuid>.json}  → parse the CDR → staging row (kind=CDR).
 *   • {@code Rec/<uuid>.mp3}   → read its {@code _metadata.csv} sidecar, copy the
 *                                mp3 into media_service, → staging row (kind=RECORDING).
 *
 * Promotion (staging → telephony_call_log, with institute/counsellor/lead
 * resolution + recording attach) is a later phase — see V340.
 */
@Service
@ConditionalOnProperty(prefix = "telephony.airtel.s3", name = "enabled", havingValue = "true")
public class AirtelCcrImportService {

    private static final Logger log = LoggerFactory.getLogger(AirtelCcrImportService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    /** CDR dateStart/dateEnd, e.g. "2026-06-22 09:56:06.000" — UTC. */
    private static final DateTimeFormatter CDR_TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
    /** Recording CSV Date (col 7) + Time (col 6), e.g. "2026/06/22" + "9:51 AM". */
    private static final DateTimeFormatter REC_DT = DateTimeFormatter.ofPattern("yyyy/MM/dd h:mm a", Locale.ENGLISH);

    @Autowired private AirtelCcrS3Reader s3;
    @Autowired private MediaService mediaService;
    @Autowired private AirtelCallImportRepository repo;

    /** Permanent (non-retryable) failure — malformed/unparseable object. */
    private static final class PermanentImportException extends RuntimeException {
        PermanentImportException(String message) { super(message); }
    }

    /** Import one object. Returns true if a new staging row was created. Idempotent. */
    public boolean importObject(String key) {
        if (key == null || repo.existsByS3Key(key)) return false;
        try {
            if (key.contains("/Cdr/") && key.endsWith(".json")) {
                return importCdr(key);
            }
            if (key.contains("/Rec/") && key.endsWith(".mp3")) {
                return importRecording(key);
            }
            // _metadata.csv (handled with its mp3) and anything else: ignore.
            return false;
        } catch (DataIntegrityViolationException dup) {
            // Another pod/poll imported this object concurrently (unique s3_key). Benign.
            return false;
        } catch (PermanentImportException pe) {
            // Malformed/unparseable — persist a FAILED marker so we don't re-poll it forever.
            log.warn("Airtel import permanently failed for {}: {}", key, pe.getMessage());
            saveFailed(key, pe.getMessage());
            return false;
        } catch (Exception transientErr) {
            // S3 read / media-upload hiccup — do NOT persist a FAILED row; leaving no
            // row means existsByS3Key stays false and the next poll retries.
            log.warn("Airtel import transient failure for {} (will retry): {}", key, transientErr.getMessage());
            return false;
        }
    }

    private boolean importCdr(String key) {
        String body = s3.getString(key);
        AirtelCdr cdr;
        try {
            cdr = MAPPER.readValue(body, AirtelCdr.class);
        } catch (Exception e) {
            throw new PermanentImportException("CDR json parse failed: " + e.getMessage());
        }
        String direction = mapDirection(cdr.getCallDirection());
        // Only derive the external party + counsellor when direction is known —
        // guessing would swap counsellor<->lead and corrupt the match key.
        //   Outbound: counsellor = source* (sourceExtensionNumber), lead = dnis.
        //   Inbound : counsellor = dest*   (destExtensionNumber),   lead = ani.
        // The counsellor-identifying fields below feed resolveCounsellor(), so they
        // must hold the COUNSELLOR's ext/user regardless of direction.
        boolean inbound = "INBOUND".equals(direction);
        String counterparty = null;
        if ("OUTBOUND".equals(direction)) {
            counterparty = firstNonBlank(cdr.getDnis(), cdr.getDialedNumber());
        } else if (inbound) {
            counterparty = firstNonBlank(cdr.getAni(), cdr.getDnis());
        }
        String counsellorExt = inbound ? cdr.getDestExtensionNumber() : cdr.getSourceExtensionNumber();
        String counsellorUserId = inbound ? cdr.getDestUserId() : cdr.getSourceUserId();
        String counsellorName = inbound ? cdr.getDestUserFullName() : cdr.getSourceUserFullName();
        OffsetDateTime start = parseUtc(cdr.getDateStart());
        OffsetDateTime end = parseUtc(cdr.getDateEnd());

        AirtelCallImport row = AirtelCallImport.builder()
                .kind(AirtelCallImport.KIND_CDR)
                .s3Key(key)
                .accountId(accountIdFromKey(key))
                .callId(cdr.getCallId())
                .cdrId(cdr.getCdrId())
                .direction(direction)
                .disposition(cdr.getDisposition())
                .sourceExtension(counsellorExt)
                .sourceUserId(counsellorUserId)
                .sourceUserFullName(counsellorName)
                .callerIdNumber(firstNonBlank(cdr.getCallerIdNumber(), cdr.getOutboundCallerId()))
                .counterpartyNumber(counterparty)
                .counterpartyMsisdn10(last10(counterparty))
                .dateStart(start)
                .dateEnd(end)
                .durationSeconds(durationSeconds(start, end))
                .isRecorded(cdr.getIsRecorded())
                .rawPayload(body)
                .processingStatus(AirtelCallImport.STATUS_RECEIVED)
                .build();
        repo.save(row);
        return true;
    }

    private boolean importRecording(String mp3Key) {
        String csvKey = mp3Key.substring(0, mp3Key.length() - 4) + "_metadata.csv";
        // The mp3 and its _metadata.csv sidecar are independent S3 PUTs with no
        // atomicity. If the metadata hasn't landed yet, DEFER (return false → the
        // next poll retries) rather than persist a permanent metadata-less row
        // that existsByS3Key would then skip forever. We also don't upload the
        // mp3 until the metadata is present, so retries stay cheap.
        if (!s3.exists(csvKey)) {
            return false;
        }
        String csvText = s3.getString(csvKey);
        String[] rec = parseRecordingCsv(csvText);
        if (rec == null || rec.length < 8) {
            throw new PermanentImportException("recording metadata csv malformed ("
                    + (rec == null ? "unparseable" : rec.length + " cols") + ")");
        }

        // CSV columns: 0 filename, 1 calling#, 2 calling name, 3 direction,
        //              4 length, 5 called#, 6 time, 7 date, 8 path
        String direction = normaliseDirection(rec[3]);
        String callingNumber = rec[1];
        String calledNumber = rec[5];
        String callingName = rec[2];
        // Only derive party fields when direction is known. Outbound: calling =
        // counsellor extension + name, called = lead. Inbound flips (and the
        // calling-party NAME is then the LEAD, not the counsellor — leave the
        // counsellor name null inbound).
        String counterparty = null, extension = null, counsellorName = null;
        if ("OUTBOUND".equals(direction)) {
            counterparty = calledNumber;
            extension = callingNumber;
            counsellorName = callingName;
        } else if ("INBOUND".equals(direction)) {
            counterparty = callingNumber;
            extension = calledNumber;
        }
        Integer length = parseHms(rec[4]);
        // CSV Date (col 7) + Time (col 6), e.g. "2026/06/22" + "9:51 AM". Stored
        // as UTC (consistent with the CDR's UTC dateStart) — TBC against a paired
        // recording+CDR; the promoter's primary match is msisdn + duration.
        OffsetDateTime start = parseCsvDateTime(rec[7], rec[6]);

        // Copy the mp3 into media_service (same store + playback path as Exotel).
        String objectId = baseName(mp3Key);
        byte[] bytes = s3.getBytes(mp3Key);
        FileDetailsDTO uploaded;
        try {
            uploaded = mediaService.uploadFileV2(
                    new TelephonyMultipartBytes("file", objectId + ".mp3", "audio/mpeg", bytes));
        } catch (Exception e) {
            throw new IllegalStateException("media_service upload failed: " + e.getMessage(), e);
        }
        if (uploaded == null || uploaded.getId() == null) {
            throw new IllegalStateException("media_service returned no file id for recording " + objectId);
        }

        AirtelCallImport row = AirtelCallImport.builder()
                .kind(AirtelCallImport.KIND_RECORDING)
                .s3Key(mp3Key)
                .accountId(accountIdFromKey(mp3Key))
                .recordingObjectId(objectId)
                .direction(direction)
                .sourceExtension(extension)
                .sourceUserFullName(counsellorName)
                .counterpartyNumber(counterparty)
                .counterpartyMsisdn10(last10(counterparty))
                .dateStart(start)
                .recordingStorageKey(uploaded.getId())
                .recordingLengthSeconds(length)
                .isRecorded(Boolean.TRUE)
                .rawPayload(csvText)
                .processingStatus(AirtelCallImport.STATUS_RECEIVED)
                .build();
        repo.save(row);
        return true;
    }

    /** Persist a FAILED marker so a poison object isn't re-polled forever. */
    private void saveFailed(String key, String detail) {
        try {
            if (repo.existsByS3Key(key)) return;
            String kind = key.contains("/Rec/") ? AirtelCallImport.KIND_RECORDING : AirtelCallImport.KIND_CDR;
            repo.save(AirtelCallImport.builder()
                    .kind(kind)
                    .s3Key(key)
                    .accountId(accountIdFromKey(key))
                    .rawPayload("(import failed)")
                    .processingStatus(AirtelCallImport.STATUS_FAILED)
                    .processDetail(detail == null ? null : detail.substring(0, Math.min(detail.length(), 800)))
                    .build());
        } catch (Exception ignored) {
            // best-effort; a concurrent insert on the unique s3_key is fine.
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String mapDirection(Integer callDirection) {
        if (callDirection == null) return null;
        return switch (callDirection) {
            case 1 -> "INBOUND";
            case 2 -> "OUTBOUND";
            default -> null;
        };
    }

    private static OffsetDateTime parseUtc(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDateTime.parse(s.trim(), CDR_TS).atOffset(ZoneOffset.UTC);
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer durationSeconds(OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null) return null;
        long secs = Duration.between(start, end).getSeconds();
        return secs >= 0 && secs < 24 * 3600 ? (int) secs : null;
    }

    /** Account id is the 2nd path segment: {@code <YYYYMMDD>/<accountId>/Cdr|Rec/<file>}. */
    private static String accountIdFromKey(String key) {
        if (key == null) return null;
        String[] parts = key.split("/");
        return parts.length >= 2 ? parts[1] : null;
    }

    private static String baseName(String key) {
        String name = key.substring(key.lastIndexOf('/') + 1);
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    /**
     * Parse the 2-line recording metadata.csv → the data row's trimmed cells.
     * Split with a 9-column limit so the trailing "Call path details" field
     * absorbs any commas it contains (e.g. forward/transfer paths) without
     * shifting the columns we rely on (0..7).
     */
    private static String[] parseRecordingCsv(String csv) {
        if (csv == null || csv.isBlank()) return null;
        String[] lines = csv.split("\\r?\\n");
        if (lines.length < 2) return null;
        String[] cells = lines[1].split(",", 9);
        for (int i = 0; i < cells.length; i++) cells[i] = cells[i].trim();
        return cells;
    }

    /** Normalise a CSV direction token (OUTBOUND/OUTGOING, INBOUND/INCOMING) or null. */
    private static String normaliseDirection(String s) {
        if (s == null) return null;
        String u = s.trim().toUpperCase();
        if (u.equals("OUTBOUND") || u.equals("OUTGOING")) return "OUTBOUND";
        if (u.equals("INBOUND") || u.equals("INCOMING")) return "INBOUND";
        return null;
    }

    /** Combine recording CSV date ("2026/06/22") + time ("9:51 AM") → UTC (TBC). */
    private static OffsetDateTime parseCsvDateTime(String date, String time) {
        if (date == null || time == null || date.isBlank() || time.isBlank()) return null;
        try {
            return LocalDateTime.parse(date.trim() + " " + time.trim(), REC_DT).atOffset(ZoneOffset.UTC);
        } catch (Exception e) {
            return null;
        }
    }

    /** "0:00:07" or "00:07" → seconds. */
    private static Integer parseHms(String s) {
        if (s == null || s.isBlank()) return null;
        String[] p = s.trim().split(":");
        try {
            int secs = 0;
            for (String part : p) secs = secs * 60 + Integer.parseInt(part.trim());
            return secs;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Last 10 digits of a phone number (India: the full mobile), for matching. */
    private static String last10(String number) {
        if (number == null) return null;
        String digits = number.replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return null;
        return digits.length() <= 10 ? digits : digits.substring(digits.length() - 10);
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        if (b != null && !b.isBlank()) return b;
        return null;
    }
}
