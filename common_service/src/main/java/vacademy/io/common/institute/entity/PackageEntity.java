package vacademy.io.common.institute.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Lob;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;
import lombok.Getter;
import lombok.Setter;

import java.util.Date;

@Getter
@Setter
@Entity
@Table(name = "package")
@NoArgsConstructor
@AllArgsConstructor
public class PackageEntity {

    @Id
    @Column(name = "id", length = 255)
    @UuidGenerator
    private String id;

    @Column(name = "package_name", length = 255)
    private String packageName;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "thumbnail_file_id", length = 255)
    private String thumbnailFileId;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "is_course_published_to_catalaouge")
    private Boolean isCoursePublishedToCatalaouge;

    @Column(name = "course_preview_image_media_id")
    private String coursePreviewImageMediaId;

    @Column(name = "course_banner_media_id")
    private String courseBannerMediaId;

    @Column(name = "course_media_id")
    private String courseMediaId;

    @Column(name = "why_learn", columnDefinition = "TEXT")
    private String whyLearn;

    @Column(name = "who_should_learn", columnDefinition = "TEXT")
    private String whoShouldLearn;

    @Column(name = "about_the_course", columnDefinition = "TEXT")
    private String aboutTheCourse;

    @Column(name = "comma_separated_tags")
    private String tags;

    @Column(name = "course_depth")
    private Integer courseDepth;

    @Column(name = "course_html_description", columnDefinition = "TEXT")
    private String courseHtmlDescription;

    @Column(name = "original_course_id")
    private String originalCourseId;

    @Column(name = "created_by_user_id")
    private String createdByUserId;

    @Column(name = "version_number")
    private Integer versionNumber;
}