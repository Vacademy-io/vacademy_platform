package vacademy.io.admin_core_service.features.vimotion.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "brand_kit")
public class BrandKit {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault;

    // Storage stays 'white' | 'black' so the existing video pipeline keeps working.
    // The Vimotion UI labels these "Light" / "Dark".
    @Column(name = "background_type", nullable = false)
    private String backgroundType;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "palette_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> palette;

    @Column(name = "heading_font")
    private String headingFont;

    @Column(name = "body_font")
    private String bodyFont;

    @Column(name = "layout_theme")
    private String layoutTheme;

    @Column(name = "logo_file_id")
    private String logoFileId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "intro_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> intro;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "outro_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> outro;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "watermark_json", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> watermark;

    // Free-text director instructions appended to the AI video generation prompts
    // (ShotPlanner / Director / NarrationWriter / per-shot HTML) for every video
    // made with this kit. Nullable — kits without it behave exactly as before.
    @Column(name = "system_prompt", columnDefinition = "text")
    private String systemPrompt;

    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @PrePersist
    @PreUpdate
    private void normalizeDefaults() {
        if (palette == null) palette = new HashMap<>();
        if (intro == null) intro = new HashMap<>();
        if (outro == null) outro = new HashMap<>();
        if (watermark == null) watermark = new HashMap<>();
        if (backgroundType == null || backgroundType.isBlank()) backgroundType = "white";
    }
}
