package vacademy.io.assessment_service.features.assessment.dto.admin_get_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.assessment_service.features.assessment.entity.Section;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;

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
    private Double cutoffMarks;
    private Integer sectionOrder;
    private String problemRandomization;
    private String status;
    private Date createdAt;
    private Date updatedAt;

    public SectionDto(Section section) {
        this.id = section.getId();
        this.name = section.getName();
        this.description = section.getDescription() == null ? null : section.getDescription().toDTO();
        this.sectionType = section.getSectionType();
        this.duration = section.getDuration();
        this.cutoffMarks = section.getCutOffMarks();
        this.totalMarks = section.getTotalMarks();
        this.problemRandomization = section.getProblemRandomType();
        this.sectionOrder = section.getSectionOrder();
        this.status = section.getStatus();
        this.createdAt = section.getCreatedAt();
        this.updatedAt = section.getUpdatedAt();
    }
}