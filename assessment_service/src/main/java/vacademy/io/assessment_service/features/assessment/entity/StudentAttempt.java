package vacademy.io.assessment_service.features.assessment.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.UuidGenerator;


import java.util.Date;

@Entity
@Table(name = "student_attempt")
@Data
@EqualsAndHashCode(of = "id")
public class StudentAttempt {
    
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @ManyToOne
    @JoinColumn(name = "registration_id")
    private AssessmentUserRegistration registration;
    
    @Column(name = "attempt_number", nullable = false)
    private Integer attemptNumber;
    
    @Column(name = "start_time", nullable = false)
    private Date startTime;
    
    @Column(name = "submit_time")
    private Date submitTime;
    
    @Column(name = "max_time", nullable = false)
    private Integer maxTime;
    
    @Column(name = "status", nullable = false)
    private String status;
    
    @Column(name = "responses")
    private String responses;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}