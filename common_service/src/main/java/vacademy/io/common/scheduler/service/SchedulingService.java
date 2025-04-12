package vacademy.io.common.scheduler.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.scheduler.entity.SchedulerActivityLog;
import vacademy.io.common.scheduler.enums.CronProfileTypeEnum;
import vacademy.io.common.scheduler.repository.SchedulerActivityRepository;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoField;
import java.util.Optional;

@Service
public class SchedulingService {

    @Autowired
    SchedulerActivityRepository schedulerActivityRepository;


    public String generateCronProfileId(CronProfileTypeEnum frequency) {
        ZonedDateTime time = ZonedDateTime.now(ZoneOffset.UTC);

        ZonedDateTime normalizedTime = switch (frequency) {
            case HOURLY -> time.withMinute(0).withSecond(0).withNano(0);
            case DAILY -> time.withHour(0).withMinute(0).withSecond(0).withNano(0);
            case WEEKLY -> time.with(ChronoField.DAY_OF_WEEK, 1) // Start of week (Monday)
                    .withHour(0).withMinute(0).withSecond(0).withNano(0);
            case MONTHLY -> time.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            default -> throw new IllegalArgumentException("Unsupported frequency: " + frequency);
        };

        return Long.toString(normalizedTime.toEpochSecond());
    }

    public SchedulerActivityLog createOrUpdateSchedulerActivityLog(SchedulerActivityLog activityLog){
        return schedulerActivityRepository.save(activityLog);
    }

    public Optional<SchedulerActivityLog> getSchedulerActivityFromCronIdAndTaskNameAndCronType(String taskName, String cronId, String cronType){
        return schedulerActivityRepository.findByTaskNameAndCronProfileIdAndCronProfileType(taskName, cronId, cronType);
    }


}
