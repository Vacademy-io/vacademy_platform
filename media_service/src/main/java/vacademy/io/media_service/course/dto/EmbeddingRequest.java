package vacademy.io.media_service.course.dto;

import lombok.*;

import java.util.List;


@Getter
@Setter
public class EmbeddingRequest {
    private Content content;
    private String taskType;
    private Integer outputDimensionality;

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Content {
        private List<Part> parts;

        public Content(Part part) {
            this.parts = List.of(part);
        }
    }

    @Getter
    @Setter
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Part {
        private String text;
    }
}
