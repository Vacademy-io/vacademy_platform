package vacademy.io.admin_core_service.features.doubts.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.doubts.dtos.AllDoubtsResponse;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsRequestFilter;
import vacademy.io.admin_core_service.features.doubts.manager.DoubtsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_SIZE;

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
    private ResponseEntity<AllDoubtsResponse> addDoubts(@RequestAttribute("user") CustomUserDetails userDetails,
                                                        @RequestBody DoubtsRequestFilter filter,
                                                        @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                        @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize){
        return doubtsManager.getAllDoubts(userDetails,filter,pageNo,pageSize);
    }
}
