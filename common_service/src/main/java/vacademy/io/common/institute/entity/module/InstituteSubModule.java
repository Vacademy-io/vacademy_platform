package vacademy.io.common.institute.entity.module;


import jakarta.persistence.*;
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

    @JoinColumn(name = "submodule_id", referencedColumnName = "id")
    @ManyToOne
    private Submodule submodule;
}
