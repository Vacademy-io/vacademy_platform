package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.Date;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubjectDTO {

    private String id;

    private String subjectName;

    private String subjectCode;

    private Integer credit;

    private Date createdAt;

    private Date updatedAt;

    public SubjectDTO(Subject subject) {

        this.id = subject.getId();
        this.subjectName = subject.getSubjectName();
        this.subjectCode = subject.getSubjectCode();
        this.credit = subject.getCredit();
        this.createdAt = subject.getCreatedAt();
        this.updatedAt = subject.getUpdatedAt();
    }
}