package vacademy.io.admin_core_service.features.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;


@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "staff")
public class Staff {


    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;


    @Column(name = "user_id")
    private String userId;

    @Column(name = "institute_id")
    private String instituteId;
}
