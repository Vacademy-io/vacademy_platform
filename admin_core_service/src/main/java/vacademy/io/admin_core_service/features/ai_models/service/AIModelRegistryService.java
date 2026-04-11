package vacademy.io.admin_core_service.features.ai_models.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Local model registry backed by ai_models and ai_model_defaults tables.
 */
@Slf4j
@Service
public class AIModelRegistryService {

        private static final Duration CACHE_TTL = Duration.ofMinutes(5);

        private final EntityManager entityManager;
        private final Map<String, CachedModels> useCaseCache = new ConcurrentHashMap<>();

        public AIModelRegistryService(EntityManager entityManager) {
                this.entityManager = entityManager;
        }

        public List<String> getModelPriority(String useCase) {
                if (useCase == null || useCase.isBlank()) {
                        return Collections.emptyList();
                }

                CachedModels cached = useCaseCache.get(useCase);
                if (cached != null && cached.isValid()) {
                        return cached.modelIds;
                }

                List<String> models = fetchModelPriority(useCase);
                if (!models.isEmpty()) {
                        useCaseCache.put(useCase, new CachedModels(models));
                }
                return models;
        }

        private List<String> fetchModelPriority(String useCase) {
                try {
                        LinkedHashSet<String> modelIds = new LinkedHashSet<>();

                        addDefaultModels(modelIds, useCase);
                        addRecommendedModels(modelIds, useCase);

                        if (modelIds.isEmpty()) {
                                addAllActiveModels(modelIds);
                        }

                        return new ArrayList<>(modelIds);
                } catch (Exception e) {
                        log.warn("[AIModelRegistryService] Failed to resolve models for use case {}: {}", useCase,
                                        e.getMessage());
                        return Collections.emptyList();
                }
        }

        private void addDefaultModels(LinkedHashSet<String> modelIds, String useCase) {
                Query defaultsQuery = entityManager.createNativeQuery(
                                "SELECT default_model_id, fallback_model_id, free_tier_model_id " +
                                                "FROM ai_model_defaults WHERE use_case = :use_case");
                defaultsQuery.setParameter("use_case", useCase);
                List<Object[]> rows = defaultsQuery.getResultList();

                if (rows.isEmpty()) {
                        return;
                }

                Object[] row = rows.get(0);
                addModelId(modelIds, row[0]);
                addModelId(modelIds, row[1]);
                addModelId(modelIds, row[2]);
        }

        private void addRecommendedModels(LinkedHashSet<String> modelIds, String useCase) {
                Query recommendedQuery = entityManager.createNativeQuery(
                                "SELECT model_id FROM ai_models " +
                                                "WHERE :use_case = ANY(recommended_for) AND is_active = TRUE " +
                                                "ORDER BY quality_score DESC, speed_score DESC, display_order ASC");
                recommendedQuery.setParameter("use_case", useCase);
                List<String> recommended = recommendedQuery.getResultList();

                for (String modelId : recommended) {
                        addModelId(modelIds, modelId);
                }
        }

        private void addAllActiveModels(LinkedHashSet<String> modelIds) {
                Query allQuery = entityManager.createNativeQuery(
                                "SELECT model_id FROM ai_models WHERE is_active = TRUE ORDER BY display_order, name");
                List<String> allModels = allQuery.getResultList();
                for (String modelId : allModels) {
                        addModelId(modelIds, modelId);
                }
        }

        private void addModelId(LinkedHashSet<String> modelIds, Object rawId) {
                if (rawId == null) {
                        return;
                }
                String modelId = rawId.toString();
                if (!modelId.isBlank()) {
                        modelIds.add(modelId);
                }
        }

        private static final class CachedModels {
                private final List<String> modelIds;
                private final long cachedAtMillis;

                private CachedModels(List<String> modelIds) {
                        this.modelIds = Collections.unmodifiableList(modelIds);
                        this.cachedAtMillis = System.currentTimeMillis();
                }

                private boolean isValid() {
                        return System.currentTimeMillis() - cachedAtMillis < CACHE_TTL.toMillis();
                }
        }
}
