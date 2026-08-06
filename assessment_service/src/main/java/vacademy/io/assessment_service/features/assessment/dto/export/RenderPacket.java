package vacademy.io.assessment_service.features.assessment.dto.export;

import lombok.Builder;
import lombok.Getter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentComparisonDto;

import java.util.Date;

/**
 * The transaction-boundary contract for the bulk export worker. Everything in
 * here is a DTO, a primitive, or a String — no entity, no projection proxy,
 * no lazy anything. Built inside {@code ReportBatchProcessor.loadRenderPacket}
 * (a short read-only transaction) and consumed entirely outside any
 * transaction, on the same thread, a few lines later. See
 * ARCHITECTURE.md §5.3 / §8.3.
 */
@Getter
@Builder
public class RenderPacket {
    private final String attemptId;
    private final String userId;
    private final String studentName;      // zip entry name + index.csv
    private final String studentEmail;     // index.csv only
    private final Date attemptUpdatedAt;   // stale detection (§8.4)
    private final String existingReportPdfFileId; // attempt.report_pdf_file_id, for REUSED
    private final StudentReportOverallDetailDto detail;
    private final StudentComparisonDto comparison;
    /** null when the attempt is not in a submitted state (LIVE/ENDED) — caller marks the item SKIPPED. */
    private final String skipReason;
}
