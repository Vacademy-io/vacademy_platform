package vacademy.io.media_service.course.service.content_generation;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.course.dto.YoutubeResponse;

@Service
public class YoutubeApiClient {

    @Value("${youtube.api.key}")
    private String API_KEY;

    private String BASE_URL = "https://www.googleapis.com/youtube/v3/search";


    public Mono<String> getYoutubeContentLink(String query){

        RestTemplate restTemplate = new RestTemplate();

        String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                .queryParam("part", "snippet")
                .queryParam("q", query)
                .queryParam("type", "video")
                .queryParam("key", API_KEY)
                .toUriString();

        YoutubeResponse response = restTemplate.getForObject(url, YoutubeResponse.class);
        if(response==null || response.getItems()==null) throw new VacademyException("Failed To Search Video");
        if(response.getItems().isEmpty()) throw new VacademyException("No Video Found");

        return Mono.just(response.getItems().get(0).getId().getVideoId());
    }
}
