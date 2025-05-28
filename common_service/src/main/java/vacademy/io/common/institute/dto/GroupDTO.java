package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.Data;
import vacademy.io.common.institute.entity.Group;

import java.util.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class GroupDTO {
    private String id;

    private String groupName;

    private Group parentGroup; // Self-referential relationship

    private Boolean isRoot;

    private String groupValue;

    public GroupDTO(Group group) {
        this.id = group.getId();
        this.groupName = group.getGroupName();
        this.parentGroup = group.getParentGroup();
        this.isRoot = group.getIsRoot();
        this.groupValue = group.getGroupValue();
    }

    public GroupDTO(){}
}
