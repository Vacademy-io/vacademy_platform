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
@Table(name = "institute_submodule_mapping")
public class InstituteSubModule {


    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;


    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "submodule_id")
    private String subModuleId;
}
