package vacademy.io.assessment_service.features.assessment.entity;


import jakarta.persistence.*;
import lombok.Builder;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.*;

@Entity
@Table(name = "assessment_user_access")
@Data
@Builder
public class AssessmentUserAccess {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "user_id")
    private String userId;

    @Column(name = "name")
    private String name;

    @Column(name = "username")
    private String username;

    @Column(name = "email")
    private String email;

    @Column(name = "phone")
    private String phoneNumber;

    @Column(name = "permission", columnDefinition = "TEXT[]")
    private String[] permissions;

    @ManyToOne
    @JoinColumn(name = "assessment_id")
    private Assessment assessment;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;


    public List<String> getAllPermissions(){
        if(Objects.isNull(this.permissions)) return new ArrayList<>();
        return Arrays.asList(permissions);
    }

    public void setAllPermissions(List<String> permissionsList){
        this.permissions = permissionsList.toArray(new String[0]);
    }
}
