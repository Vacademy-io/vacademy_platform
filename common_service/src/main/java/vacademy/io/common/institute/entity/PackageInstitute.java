package vacademy.io.common.institute.entity;

import jakarta.persistence.*;

import java.util.Date;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "package_institute")
@Data
@NoArgsConstructor
public class PackageInstitute {

    @Id
    @UuidGenerator
    @Column(name = "id") // You may need to add an ID field if it's a requirement
    private String id; // Change this type if your ID is of a different type

    @ManyToOne
    @JoinColumn(name = "package_id", referencedColumnName = "id")
    private PackageEntity packageEntity; // Assuming Package is another entity representing the "package" table

    @ManyToOne
    @JoinColumn(name = "group_id", referencedColumnName = "id")
    private Group groupEntity; // Assuming Group is another entity representing the "groups" table

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;


    @ManyToOne
    @JoinColumn(name = "institute_id", referencedColumnName = "id", nullable = false)
    private Institute instituteEntity; // Assuming Institute is another entity representing the "institutes" table

    // Additional constructors, if needed
    public PackageInstitute(PackageEntity packageEntity, Group groupEntity, Institute instituteEntity, Date createdAt, Date updatedAt) {
        this.packageEntity = packageEntity;
        this.groupEntity = groupEntity;
        this.instituteEntity = instituteEntity;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }
}