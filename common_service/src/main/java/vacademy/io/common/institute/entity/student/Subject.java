package vacademy.io.common.institute.entity.student;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "subject")
@Data
@NoArgsConstructor
@AllArgsConstructor

public class Subject {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Column(name = "subject_name")
    private String subjectName;

    @Column(name = "subject_code")
    private String subjectCode;

    @Column(name = "credit")
    private Integer credit;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "thumbnail_id")
    private String thumbnailId;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
}