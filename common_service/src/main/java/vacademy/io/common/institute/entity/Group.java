package vacademy.io.common.institute.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.dto.GroupDTO;

import java.util.Date;

@Entity
@Table(name = "groups", schema = "public") // Use "groups" as the table name
@Data
@NoArgsConstructor
public class Group {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Column(name = "group_name", length = 255)
    private String groupName;

    @ManyToOne
    @JoinColumn(name = "parent_group_id", referencedColumnName = "id")
    private Group parentGroup; // Self-referential relationship

    @Column(name = "is_root")
    private Boolean isRoot;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "group_value")
    private String groupValue;

    // Additional constructors, if needed
    public Group(String id, String groupName, Group parentGroup, Boolean isRoot,
                 Date createdAt, Date updatedAt, String groupValue) {
        this.id = id;
        this.groupName = groupName;
        this.parentGroup = parentGroup;
        this.isRoot = isRoot;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.groupValue = groupValue;
    }

    public Group(GroupDTO groupDTO){
        this.id = groupDTO.getId();
        this.groupName = groupDTO.getGroupName();
        this.parentGroup = groupDTO.getParentGroup();
        this.isRoot = groupDTO.getIsRoot();
        this.groupValue = groupDTO.getGroupValue();
    }
}