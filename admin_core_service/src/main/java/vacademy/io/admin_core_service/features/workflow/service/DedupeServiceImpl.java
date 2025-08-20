package vacademy.io.admin_core_service.features.workflow.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.engine.ActionNodeHandler;
import vacademy.io.admin_core_service.features.workflow.entity.NodeDedupeRecord;
import vacademy.io.admin_core_service.features.workflow.repository.NodeDedupeRecordRepository;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DedupeServiceImpl implements ActionNodeHandler.DedupeService {

    private final NodeDedupeRecordRepository repo;

    @Override
    public boolean seen(String key) {
        if (key == null || key.isBlank())
            return false;
        return repo.findAll().stream().anyMatch(r -> key.equals(r.getOperationKey()));
    }

    @Override
    public void remember(String key) {
        if (key == null || key.isBlank())
            return;
        NodeDedupeRecord rec = NodeDedupeRecord.builder()
                .id(UUID.randomUUID().toString())
                .operationKey(key)
                .build();
        repo.save(rec);
    }
}