package vacademy.io.admin_core_service.features.doubts.manager;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtStatusEnum;
import vacademy.io.admin_core_service.features.doubts.service.DoubtService;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Slf4j
@Component
public class DoubtsManager {

    @Autowired
    DoubtService doubtService;

    public ResponseEntity<String> updateOrCreateDoubt(CustomUserDetails userDetails, String doubtId, DoubtsDto request) {
        if(StringUtils.hasText(doubtId)){
            return ResponseEntity.ok(updateDoubt(doubtId, request));
        }

        return ResponseEntity.ok(createNewDoubt(request));
    }

    private String createNewDoubt(DoubtsDto request) {
        Doubts doubts = Doubts.builder()
                .status(DoubtStatusEnum.ACTIVE.name())
                .userId(request.getUserId())
                .source(request.getSource())
                .sourceId(request.getSourceId())
                .htmlText(request.getHtmlText())
                .parentLevel(request.getParentLevel())
                .raisedTime(new Date())
                .parentId(request.getParentId())
                .contentPosition(request.getContentPosition())
                .contentType(request.getContentType())
                .build();

        Doubts savedDoubt = doubtService.updateOrCreateDoubt(doubts);
        try{
            if(request.getDoubtAssigneeRequestUserIds()!=null){
                createDoubtsAssignee(savedDoubt, request.getDoubtAssigneeRequestUserIds());
            }
        } catch (Exception e) {
            log.error("Failed To Save Doubt Assignee: {}", e.getMessage());
        }
        return savedDoubt.getId();
    }

    private String updateDoubt(String doubtId, DoubtsDto request) {
        try{
            Optional<Doubts> doubtsOpt = doubtService.getDoubtById(doubtId);
            if(doubtsOpt.isEmpty()) throw new VacademyException("Doubt Not Found");

            updateIfNotNull(request.getHtmlText(), doubtsOpt.get()::setHtmlText);
            updateIfNotNull(request.getStatus(), doubtsOpt.get()::setStatus);

            if(request.getStatus()!=null && request.getStatus().equals("RESOLVED")){
                updateIfNotNull(new Date(), doubtsOpt.get()::setResolvedTime);
            }

            if(request.getDoubtAssigneeRequestUserIds()!=null){
                createDoubtsAssignee(doubtsOpt.get(), request.getDoubtAssigneeRequestUserIds());
            }
        } catch (Exception e) {
            throw new VacademyException("Failed To Update Doubt: " +e.getMessage());
        }

        return doubtId;
    }

    private void createDoubtsAssignee(Doubts doubts, List<String> doubtAssigneeRequestUserIds) {
        List<DoubtAssignee> allNewAssignee = new ArrayList<>();

        doubtAssigneeRequestUserIds.forEach(userId->{
            allNewAssignee.add(DoubtAssignee.builder()
                    .doubts(doubts)
                    .source("USER")
                    .sourceId(userId)
                    .status("ACTIVE").build());
        });

        doubtService.saveOrUpdateDoubtsAssignee(allNewAssignee);
    }

    private <T> void updateIfNotNull(T value, java.util.function.Consumer<T> setterMethod) {
        if (value != null) {
            setterMethod.accept(value);
        }
    }
}
