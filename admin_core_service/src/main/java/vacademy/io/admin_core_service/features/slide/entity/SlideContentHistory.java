package vacademy.io.admin_core_service.features.slide.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;

/**
 * Read-only view over the append-only audit trail written by the V363
 * before-update triggers on document_slide / video / audio_slide. Rows are
 * ONLY inserted by those DB triggers — the application never writes here, it
 * reads (history listing) and copies values back into the source rows (restore).
 */
@Entity
@Table(name = "slide_content_history")
@Getter
@Setter
public class SlideContentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "source_table")
    private String sourceTable;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "draft_value")
    private String draftValue;

    @Column(name = "published_value")
    private String publishedValue;

    @Column(name = "changed_by")
    private String changedBy;

    @Column(name = "changed_at", insertable = false, updatable = false)
    private Timestamp changedAt;
}
