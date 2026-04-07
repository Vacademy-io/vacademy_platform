package vacademy.io.admin_core_service.features.fee_management.repository;

import java.util.List;

public interface CollectionDashboardRepository {

    Object[] getCollectionSummary(String instituteId, String sessionId,
                                  boolean hasFeeTypes, List<String> feeTypeIds);

    List<Object[]> getClassWiseBreakdown(String instituteId, String sessionId,
                                         boolean hasFeeTypes, List<String> feeTypeIds);

    List<Object[]> getPaymentModeBreakdown(String instituteId, String sessionId,
                                            boolean hasFeeTypes, List<String> feeTypeIds);
}
