package vacademy.io.assessment_service.features.scheduler.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.scheduler.service.SchedulingService;

@Service
public class AssessmentParticipantsSchedulingService {

    @Autowired
    SchedulingService schedulingService;


}
