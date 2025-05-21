package vacademy.io.admin_core_service.features.doubts.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsAssigneeRepository;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsRepository;

import java.util.List;
import java.util.Optional;

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




}
