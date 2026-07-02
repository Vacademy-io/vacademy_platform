package vacademy.io.community_service.feature.dashboardwidget.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.dashboardwidget.entity.InstituteWidgetInteraction;

import java.util.List;

@Repository
public interface InstituteWidgetInteractionRepository extends JpaRepository<InstituteWidgetInteraction, String> {

    List<InstituteWidgetInteraction> findByWidgetIdOrderByCreatedAtAsc(String widgetId);
}
