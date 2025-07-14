package vacademy.io.media_service.course.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.course.entity.Embedding;
import vacademy.io.media_service.course.enums.EmbeddingSourceEnums;
import vacademy.io.media_service.course.repository.EmbeddingRepository;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class EmbeddingService {

    @Autowired
    private GeminiApiClient geminiClient; // Your client for the Gemini API

    @Autowired
    private EmbeddingRepository embeddingRepository; // Your repository for the pgvector table

//    /**
//     * Creates or updates the embedding for a given slide.
//     * This method is designed to be idempotent and resilient.
//     *
//     * @param slide The slide entity containing its source type and ID.
//     * @param content The actual content object (e.g., DocumentSlide).
//     */
//    @Retryable(value = { VacademyException.class }, backoff = @Backoff(delay = 2000, multiplier = 2))
//    public void generateAndStoreEmbedding(Slide slide, Object content) {
//        try {
//
//            // 1. Serialize the content into a clean string
//            String serializedContent = serializeSlideContent(slide.getTitle(), content);
//
//            // 2. Specify the task type for optimal retrieval embeddings
//            String taskType = "RETRIEVAL_DOCUMENT";
//
//            // 3. Call the Gemini API to get the embedding vector
//            List<Float> embeddingVector = geminiClient.getEmbedding(serializedContent,  taskType,10);
//
//            // 4. Store the embedding in the database
//            embeddingRepository.save(createEmbeddingObject(slide.getId(), embeddingVector));
//
//            log.info("Successfully generated and stored embedding for slide ID: {}", slide.getId());
//
//        } catch (Exception e) {
//            log.error("An unexpected error occurred for slide ID {}: {}", slide.getId(), e.getMessage());
//        }
//    }

    @Retryable(value = { VacademyException.class }, backoff = @Backoff(delay = 2000, multiplier = 2))
    public List<Float> generateVectorEmbedding(Object content, String title) {
        try {

            // 1. Serialize the content into a clean string
            String serializedContent = serializeSlideContent(title, content);

            // 2. Specify the task type for optimal retrieval embeddings
            String taskType = "RETRIEVAL_DOCUMENT";

            // 3. Call the Gemini API to get the embedding vector
            return geminiClient.getEmbedding(serializedContent, taskType,10);
        } catch (Exception e) {
            log.error("An unexpected error occurred: {}",e.getMessage());
            return new ArrayList<>();
        }
    }
//
//    private Embedding createEmbeddingObject(String sourceId, List<Float> embeddingVector) {
//        return Embedding.builder()
//                .embedding(embeddingVector)
//                .source(EmbeddingSourceEnums.SLIDE.name())
//                .sourceId(sourceId)
//                .build();
//    }

    /**
     * Converts a content object into a single string for the embedding model.
     */
    private String serializeSlideContent(String title, Object content) {
        StringBuilder sb = new StringBuilder();
        sb.append(title).append("\n\n"); // Start with the title
        sb.append((String) content);
        // Add other 'instanceof' checks for different slide types (CodeSlide, VideoSlide, etc.)
        // Clean up the string (e.g., remove excessive whitespace)
        return sb.toString().trim();
    }
}
