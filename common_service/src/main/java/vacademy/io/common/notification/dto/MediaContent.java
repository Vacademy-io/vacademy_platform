package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.annotation.JsonTypeName;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonTypeName("VIEW_MEDIA_LINKS")
public class MediaContent extends AlertData {
    private List<Media> media;

    public String getHtmlText(String name, String title, String description) {
        StringBuilder htmlBuilder = new StringBuilder();
        htmlBuilder.append("<html>")
                .append("<head>")
                .append("<style>")
                .append("body { font-family: Arial, sans-serif; background-color: white; color: #333; }")
                .append(".header { background-color: #504cec; color: white; padding: 10px; text-align: center; }")
                .append(".content { padding: 20px; }")
                .append(".media-item { margin: 15px 0; }")
                .append(".footer { background-color: #f2f2f2; color: #666; padding: 10px; text-align: center; font-size: 14px; }")
                .append(".btn { background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; }")
                .append(".btn:hover { background-color: #0056b3; }") // Optional: darker shade on hover
                .append("</style>")
                .append("</head>")
                .append("<body>")
                .append("<div class='header'>")
                .append("<h1>").append(title).append("</h1>")
                .append("<p>").append(description).append("</p>")
                .append("</div>")
                .append("<div class='content'>");

        if (this.media != null && !this.media.isEmpty()) {
            for (Media mediaItem : this.media) {
                htmlBuilder.append("<div class='media-item'>")
                        .append("<h2>").append(mediaItem.getTitle()).append("</h2>")
                        .append("<p>").append(mediaItem.getDescription()).append("</p>")
                        .append("<a href='").append(mediaItem.getUrl()).append("' class='btn'>View Media</a>")
                        .append("</div>");
            }
        } else {
            htmlBuilder.append("<p>No media available.</p>");
        }

        htmlBuilder.append("</div>")
                .append("<div class='footer'>")
                .append("Labour Link - <a href='https://www.laborlink.co.za' style='color: #504cec;'>www.laborlink.co.za</a>")
                .append("</div>")
                .append("</body>")
                .append("</html>");

        return htmlBuilder.toString();
    }
}