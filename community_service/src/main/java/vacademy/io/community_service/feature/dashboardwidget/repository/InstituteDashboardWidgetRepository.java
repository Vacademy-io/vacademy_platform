package vacademy.io.community_service.feature.dashboardwidget.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.dashboardwidget.entity.InstituteDashboardWidget;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetStatus;
import vacademy.io.community_service.feature.dashboardwidget.enums.WidgetTargetType;

import java.util.List;

@Repository
public interface InstituteDashboardWidgetRepository extends JpaRepository<InstituteDashboardWidget, String> {

    /** Super-admin authoring view: every widget for a target, any status. */
    List<InstituteDashboardWidget> findByTargetTypeAndTargetValueOrderByPositionAscCreatedAtAsc(
            WidgetTargetType targetType, String targetValue);

    /** Institute read path: published widgets for one target. */
    List<InstituteDashboardWidget> findByTargetTypeAndTargetValueAndStatusOrderByPositionAscCreatedAtAsc(
            WidgetTargetType targetType, String targetValue, WidgetStatus status);
}
