package vacademy.io.admin_core_service.features.workflow.actions;

public interface DbClient {
    boolean updateRemainingDaysForMapping(String mappingId, int newRemainingDays);
}