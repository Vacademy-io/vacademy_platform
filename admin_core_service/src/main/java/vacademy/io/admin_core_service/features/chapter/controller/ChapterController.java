package vacademy.io.admin_core_service.features.chapter.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.service.ChapterService;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/chapter/v1")
@RequiredArgsConstructor
public class ChapterController {
    private final ChapterService chapterService;

    @PostMapping("/add-chapter")
    public ResponseEntity<ChapterDTO>addChapter(@RequestBody ChapterDTO chapterDTO, @RequestAttribute("user") CustomUserDetails user, @RequestParam("moduleId") String moduleId, @RequestParam("commaSeparatedPackageSessionIds") String commaSeparatedPackageSessionIds){
        return ResponseEntity.ok(chapterService.addChapter(chapterDTO, moduleId, commaSeparatedPackageSessionIds, user));
    }
    @PutMapping("/update-chapter")
    public ResponseEntity<String>updateChapter(@RequestBody ChapterDTO chapterDTO, @RequestAttribute("user") CustomUserDetails user, @RequestParam("chapterId") String chapterId, @RequestParam("commaSeparatedPackageSessionIds") String commaSeparatedPackageSessionIds){
        return ResponseEntity.ok(chapterService.updateChapter(chapterId, chapterDTO, commaSeparatedPackageSessionIds, user));
    }
}
