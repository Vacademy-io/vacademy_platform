package vacademy.io.admin_core_service.features.institute.entity;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Entity
@Data
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "sub_modules")
public class Submodule {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id")
    private String id;

    @Column(name = "submodule_name")
    private String submoduleName;

    @JoinColumn(name = "module_id", referencedColumnName = "id")
    @ManyToOne
    private Module module;


}
