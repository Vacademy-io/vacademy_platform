package vacademy.io.media_service.course.service.content_generation;


import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.course.dto.UnsplashPhoto;
import vacademy.io.media_service.course.dto.UnsplashSearchResponse;
import vacademy.io.media_service.course.dto.YoutubeResponse;

@Service
public class UnsplashApiClient {

    @Value("${unsplash.access.key}")
    private String ACCESS_KEY;

    private String BASE_URL = "https://api.unsplash.com";
    private WebClient webClient;

    @PostConstruct
    public void init() {
        this.webClient = WebClient.builder()
                .baseUrl(BASE_URL)
                .defaultHeader("Authorization", "Client-ID " + ACCESS_KEY)
                .build();
    }

    public Mono<String> getUnsplashContent(String query) {
        return webClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search/photos")
                        .queryParam("query", query)
                        .queryParam("per_page", 1)
                        .build())
                .retrieve()
                .bodyToMono(UnsplashSearchResponse.class)
                .flatMap(response -> {
                    if (response == null || response.getResults() == null || response.getResults().isEmpty()) {
                        return Mono.error(new RuntimeException("No images found for query: " + query));
                    }

                    UnsplashPhoto photo = response.getResults().get(0);
                    if (photo.getUrls() == null || photo.getUrls().getRaw() == null) {
                        return Mono.error(new RuntimeException("Raw URL not found in first image"));
                    }

                    return Mono.just(photo.getUrls().getRaw());
                });
    }

}
