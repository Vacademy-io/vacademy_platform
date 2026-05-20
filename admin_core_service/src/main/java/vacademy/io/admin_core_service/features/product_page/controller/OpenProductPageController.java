package vacademy.io.admin_core_service.features.product_page.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.product_page.dto.*;
import vacademy.io.admin_core_service.features.product_page.service.ProductPageEnrollmentService;
import vacademy.io.admin_core_service.features.product_page.service.ProductPageService;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/open/v1/product-page")
public class OpenProductPageController {

    @Autowired
    private ProductPageService coursePageService;

    @Autowired
    private ProductPageEnrollmentService enrollmentService;

    /** Learner landing: fetch page layout + aggregated custom fields. */
    @GetMapping("/by-code")
    public ResponseEntity<ProductPageResponse> getByCode(
            @RequestParam("code") String code,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(coursePageService.getProductPageByCode(code, instituteId));
    }

    /** Cart step: validate coupon and return discount details. */
    @PostMapping("/validate-coupon")
    public ResponseEntity<ProductPageCouponValidateResponse> validateCoupon(
            @RequestParam("coursePageCode") String coursePageCode,
            @RequestParam("couponCode") String couponCode,
            @RequestParam("totalAmount") double totalAmount) {
        return ResponseEntity.ok(coursePageService.validateCoupon(coursePageCode, couponCode, totalAmount));
    }

    /** Step 1: create user + ABANDONED_CART entries per selected invite. */
    @PostMapping("/form-submit")
    public ResponseEntity<ProductPageFormSubmitResponse> formSubmit(
            @RequestBody ProductPageFormSubmitRequest request) {
        log.info("Course page form-submit received for code={}", request.getProductPageCode());
        return ResponseEntity.ok(enrollmentService.submitProductPageForm(request));
    }

    /** Step 2: combined payment + split fulfillment per invite. */
    @PostMapping("/enroll")
    public ResponseEntity<ProductPageEnrollResponse> enroll(
            @RequestBody ProductPageEnrollRequest request) {
        log.info("Course page enroll received for code={}", request.getProductPageCode());
        return ResponseEntity.ok(enrollmentService.enrollForProductPage(request));
    }
}
