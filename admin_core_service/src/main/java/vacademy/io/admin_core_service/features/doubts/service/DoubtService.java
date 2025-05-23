package vacademy.io.admin_core_service.features.doubts.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtStatusEnum;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsAssigneeRepository;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsRepository;

import java.util.*;

@Slf4j
@Service
public class DoubtService {

    @Autowired
    DoubtsRepository doubtsRepository;

    @Autowired
    DoubtsAssigneeRepository doubtsAssigneeRepository;

    public Optional<Doubts> getDoubtById(String id){
        return doubtsRepository.findById(id);
    }

    public Doubts updateOrCreateDoubt(Doubts doubts){
        return doubtsRepository.save(doubts);
    }

    public List<DoubtAssignee> saveOrUpdateDoubtsAssignee(List<DoubtAssignee> allAssignees){
        return doubtsAssigneeRepository.saveAll(allAssignees);
    }


    public Page<Doubts> getAllDoubtsWithFilter(List<String> contentTypes,
                                               List<String> contentPositions,
                                               List<String> sources,
                                               List<String> sourceIds,
                                               Date startDate,
                                               Date endDate,
                                               List<String> userIds,
                                               List<String> status,
                                               Pageable pageable) {
        contentTypes = Optional.ofNullable(contentTypes).orElse(Collections.emptyList());
        contentPositions = Optional.ofNullable(contentPositions).orElse(Collections.emptyList());
        sources = Optional.ofNullable(sources).orElse(Collections.emptyList());
        sourceIds = Optional.ofNullable(sourceIds).orElse(Collections.emptyList());
        userIds = Optional.ofNullable(userIds).orElse(Collections.emptyList());
        status = Optional.ofNullable(status).orElse(Collections.emptyList());

        return doubtsRepository.findDoubtsWithFilter(contentPositions,contentTypes,sources,sourceIds,userIds,status,startDate,endDate,pageable);
    }

    public List<DoubtsDto> createDtoFromDoubts(List<Doubts> allDoubts) {
        if(allDoubts == null || allDoubts.isEmpty()) return new ArrayList<>();

        List<DoubtsDto> response = new ArrayList<>();
        allDoubts.forEach(doubt -> {
            // Recursively fetch all replies
            List<Doubts> childDoubts = doubtsRepository.findByParentIdAndStatusNotIn(
                    doubt.getId(), List.of(DoubtStatusEnum.DELETED.name())
            );

            response.add(DoubtsDto.builder()
                    .id(doubt.getId())
                    .userId(doubt.getUserId())
                    .contentPosition(doubt.getContentPosition())
                    .contentType(doubt.getContentType())
                    .htmlText(doubt.getHtmlText())
                    .parentId(doubt.getParentId())
                    .parentLevel(doubt.getParentLevel()==null ? 0 : doubt.getParentLevel())
                    .source(doubt.getSource())
                    .sourceId(doubt.getSourceId())
                    .status(doubt.getStatus())
                    .resolvedTime(doubt.getResolvedTime())
                    .raisedTime(doubt.getRaisedTime())
                    .replies(createDtoFromDoubts(childDoubts)) // recursive call here
                    .build());
        });
        return response;
    }

}
