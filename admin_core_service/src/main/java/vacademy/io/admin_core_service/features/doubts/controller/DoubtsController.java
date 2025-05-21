package vacademy.io.admin_core_service.features.doubts.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsRequestFilter;
import vacademy.io.admin_core_service.features.doubts.manager.DoubtsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/v1/doubts")
public class DoubtsController {

    @Autowired
    DoubtsManager doubtsManager;

    @PostMapping("/create")
    private ResponseEntity<String> addDoubts(@RequestAttribute("user") CustomUserDetails userDetails,
                                             @RequestParam(name = "doubtId", required = false) String doubtId,
                                             @RequestBody DoubtsDto request){
        return doubtsManager.updateOrCreateDoubt(userDetails,doubtId,request);
    }

    @PostMapping("/get-all")
    private ResponseEntity<String> addDoubts(@RequestAttribute("user") CustomUserDetails userDetails,
                                             @RequestBody DoubtsRequestFilter filter){
//        return doubtsManager.updateOrCreateDoubt(userDetails,doubtId,request);
    }
}
