package vacademy.io.assessment_service.features.rich_text.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

@Entity
@Table(name = "assessment_rich_text_data")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class AssessmentRichTextData {

    @Id
    @Column(name = "id", nullable = false)
    @UuidGenerator
    private String id;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "content", nullable = false)
    private String content;


    // Conversion method to DTO
    public AssessmentRichTextDataDTO toDTO() {
        return new AssessmentRichTextDataDTO(this.id, this.type, this.content);
    }

    // Static method to create entity from DTO
    public static AssessmentRichTextData fromDTO(AssessmentRichTextDataDTO dto) {
        if(dto == null) return null;
        return new AssessmentRichTextData(dto.getId(), dto.getType(), dto.getContent());
    }
}
