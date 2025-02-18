package vacademy.io.community_service.feature.init.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(name = "subjects")
public class Subjects {

    @Id
    @Column(name = "subject_id")
    private String subjectId;

    @Column(name = "subject_name", unique = true, nullable = false)
    private String subjectName;
}
