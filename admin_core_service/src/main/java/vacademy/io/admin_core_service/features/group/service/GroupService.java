package vacademy.io.admin_core_service.features.group.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.group.dto.AddGroupDTO;
import vacademy.io.admin_core_service.features.group.repository.GroupRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Group;

import java.util.Objects;

@Service
public class GroupService {

    @Autowired
    private GroupRepository groupRepository;

    public Group addGroup(AddGroupDTO addGroupDTO){
        if (Objects.isNull(addGroupDTO)){
            return null;
        }
        if (!addGroupDTO.isNewGroup()) return updateGroup(addGroupDTO);
        return addNewGroup(addGroupDTO);
    }

    private Group updateGroup(AddGroupDTO addGroupDTO){
        Group group = groupRepository.findById(addGroupDTO.getId()).orElseThrow(() -> new VacademyException("Group not found"));
        if (StringUtils.hasText(addGroupDTO.getGroupName())) group.setGroupName(addGroupDTO.getGroupName());
        if (StringUtils.hasText(addGroupDTO.getGroupValue())) group.setGroupValue(addGroupDTO.getGroupValue());
        return groupRepository.save(group);
    }

    private Group addNewGroup(AddGroupDTO addGroupDTO){
        Group group = new Group();
        group.setGroupName(addGroupDTO.getGroupName());
        group.setGroupValue(addGroupDTO.getGroupValue());
        return groupRepository.save(group);
    }
}
