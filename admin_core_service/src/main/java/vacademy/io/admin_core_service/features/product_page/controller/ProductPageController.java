package vacademy.io.admin_core_service.features.product_page.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.product_page.dto.*;
import vacademy.io.admin_core_service.features.product_page.service.ProductPageService;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/v1/product-page")
public class ProductPageController {

    @Autowired
    private ProductPageService coursePageService;

    @PostMapping("/create")
    public ResponseEntity<ProductPageResponse> create(
            @RequestParam("instituteId") String instituteId,
            @RequestBody ProductPageRequest request) {
        return ResponseEntity.ok(coursePageService.createProductPage(instituteId, request));
    }

    @PutMapping("/update")
    public ResponseEntity<ProductPageResponse> update(
            @RequestParam("coursePageId") String coursePageId,
            @RequestBody ProductPageRequest request) {
        return ResponseEntity.ok(coursePageService.updateProductPage(coursePageId, request));
    }

    @GetMapping("/get-all")
    public ResponseEntity<List<ProductPageResponse>> getAll(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(coursePageService.getAllProductPages(instituteId));
    }

    @GetMapping("/{coursePageId}")
    public ResponseEntity<ProductPageResponse> getById(
            @PathVariable("coursePageId") String coursePageId) {
        return ResponseEntity.ok(coursePageService.getProductPageById(coursePageId));
    }

    @DeleteMapping("/delete")
    public ResponseEntity<String> delete(
            @RequestParam("coursePageId") String coursePageId) {
        return ResponseEntity.ok(coursePageService.deleteProductPage(coursePageId));
    }

    @PostMapping("/coupon/create")
    public ResponseEntity<String> createCoupon(
            @RequestParam("coursePageId") String coursePageId,
            @RequestBody ProductPageCouponRequest request) {
        return ResponseEntity.ok(coursePageService.createCoupon(coursePageId, request));
    }

    @DeleteMapping("/coupon/{couponCodeId}")
    public ResponseEntity<String> deleteCoupon(
            @PathVariable("couponCodeId") String couponCodeId) {
        return ResponseEntity.ok(coursePageService.deleteCoupon(couponCodeId));
    }
}
