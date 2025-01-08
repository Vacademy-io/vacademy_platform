package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.entity.AssessmentRichTextData;

import java.util.Date;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SectionDto {
    private String id;
    private String name;
    private AssessmentRichTextDataDTO description;
    private String sectionType;
    private Integer duration;
    private Double totalMarks;
    private Integer sectionOrder;
    private Date createdAt;
    private Date updatedAt;

    public SectionDto(Section section) {
        this.id = section.getId();
        this.name = section.getName();
        this.description = section.getDescription() == null ? null : section.getDescription().toDTO();
        this.sectionType = section.getSectionType();
        this.duration = section.getDuration();
        this.totalMarks = section.getTotalMarks();
        this.sectionOrder = section.getSectionOrder();
        this.createdAt = section.getCreatedAt();
        this.updatedAt = section.getUpdatedAt();
    }
}