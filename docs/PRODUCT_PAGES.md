# Product Pages

---

## 1. What it is (in one paragraph)

Product Pages is a **no-code, public-facing course-sales & enrollment funnel**. An admin builds a branded landing + checkout page in the admin dashboard (drag-and-drop designer, course selection, pricing, coupons, custom fields). A learner opens that page anonymously via a short code/URL and goes through **CATALOG → CART → FORM → PAYMENT → SUCCESS**, ending up enrolled and paid. It is the "buy this course" storefront that ties together the existing invites, payments, coupons, and custom-fields subsystems.

- **Admin builds** — authenticated, `frontend-admin-dashboard`.
- **Learner buys** — anonymous, `frontend-learner-dashboard-app`, calls only `open/` endpoints.
- **Backend** — `admin_core_service`, feature package `product_page`.

---

## 2. Architecture at a glance

```
 ┌─────────────────────────┐         ┌──────────────────────────────┐
 │ frontend-admin-dashboard │  v1/*  │       admin_core_service       │
 │  (authenticated builder) ├────────►  features/product_page          │
 └─────────────────────────┘         │   ├─ ProductPageController      │  (authed)
                                      │   ├─ OpenProductPageController  │  (public)
 ┌─────────────────────────┐ open/v1 │   ├─ ProductPageService         │
 │ frontend-learner-app     ├────────►  └─ ProductPageEnrollmentService │
 │  (anonymous storefront)  │         └───────────┬──────────────────┘
 └─────────────────────────┘                     │ integrates with
                                                  ▼
             invites (EnrollInvite + bridge) · payments (PaymentLog/PaymentPlan/gateways)
             · coupons (CouponCode/AppliedCouponDiscount) · custom fields · package sessions
```

**Key idea:** A product page does not own courses or prices. It _points at_ pre-existing enroll-invites via a bridge row, and locks a specific payment plan per course. Everything about pricing, gateways, and fulfillment is delegated to the existing invite/payment machinery.

---

## 3. Data model

Migration: `admin_core_service/src/main/resources/db/migration/V257__Create_product_page.sql`
Related: `V311__Coupon_code_per_institute_unique.sql` (coupon uniqueness, see §7).

### `product_page` — the page itself

| Column                    | Type                         | Notes                                                                                  |
| ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `id`                      | VARCHAR(255) PK              | UUID (`@UuidGenerator`)                                                                |
| `name`                    | VARCHAR(255)                 |                                                                                        |
| `code`                    | VARCHAR(50) UNIQUE           | 6-char random alphanumeric, generated server-side. This is the public URL key.         |
| `institute_id`            | VARCHAR(255) FK→`institutes` |                                                                                        |
| `status`                  | VARCHAR(50)                  | `DRAFT` / `ACTIVE` / `DELETED` (plain strings, not an enum)                            |
| `page_json`               | TEXT                         | Visual layout JSON (designer output). Stored as a **stringified JSON**.                |
| `settings_json`           | TEXT                         | Behavioural settings (default step, deselection, GTM, T&C, invoice). Stringified JSON. |
| `short_url`               | VARCHAR(500)                 | Generated via `ShortUrlManagementService` (source type `PRODUCT_PAGE`)                 |
| `created_at`/`updated_at` | TIMESTAMPTZ                  | DB-managed; entity marks them `insertable=false, updatable=false`                      |

Entity: `entity/ProductPage.java`. Indexes on `institute_id`, `status`.

### `product_page_invite_mapping` — one row per sellable course on the page

| Column                        | Type                                                      | Notes                                                                              |
| ----------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`                          | VARCHAR(255) PK                                           |                                                                                    |
| `product_page_id`             | FK→`product_page`                                         |                                                                                    |
| `ps_invite_payment_option_id` | FK→`package_session_learner_invitation_to_payment_option` | **The bridge**: pins one package-session + enroll-invite + payment-option together |
| `payment_plan_id`             | VARCHAR(255)                                              | Loose string ref to `PaymentPlan` (no DB FK); determines cart price                |
| `is_preselected`              | BOOLEAN                                                   | Default course selection (see gotcha in §8 — learner side ignores this)            |
| `display_order`               | INTEGER                                                   |                                                                                    |
| `status`                      | VARCHAR(50)                                               | `ACTIVE` / `DELETED`                                                               |
| `created_at`/`updated_at`     | TIMESTAMPTZ                                               |                                                                                    |

Entity: `entity/ProductPageInviteMapping.java`. Indexes on `product_page_id`, `ps_invite_payment_option_id`.

**Relationships to know:**

- The bridge (`ps_invite_payment_option_id`) links to `EnrollInvite`, `PackageSession`, and `PaymentOption`. The **EnrollInvite drives vendor, currency, invite code, and post-enroll workflows** — the product page inherits all of that.
- Coupons are **not** in a product_page-owned table. They live in the shared `coupon_code` / `applied_coupon_discount` tables with `source_type='PRODUCT_PAGE'` and `source_id=<product_page.id>`.

---

## 4. Backend API

Package: `admin_core_service/src/main/java/vacademy/io/admin_core_service/features/product_page/`

### 4.1 Admin (authenticated) — `ProductPageController`

Base: `/admin-core-service/v1/product-page`

| Method | Path                                                             | Request → Response                                            | Purpose                                                                           |
| ------ | ---------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| POST   | `/create?instituteId=`                                           | `ProductPageRequest` → `ProductPageResponse`                  | Create DRAFT page, gen unique code, save mappings, create short URL               |
| PUT    | `/update?coursePageId=`                                          | `ProductPageRequest` → `ProductPageResponse`                  | Update fields; if mappings present, **full replace** (soft-delete all, re-insert) |
| GET    | `/get-all?instituteId=`                                          | → `List<ProductPageResponse>`                                 | List `ACTIVE`+`DRAFT` pages                                                       |
| GET    | `/{coursePageId}`                                                | → `ProductPageResponse`                                       | Get one (with custom fields)                                                      |
| DELETE | `/delete?coursePageId=`                                          | → `String`                                                    | Soft-delete (status=DELETED)                                                      |
| POST   | `/coupon/create?coursePageId=`                                   | `ProductPageCouponRequest` → `String`                         | Create coupon (source PRODUCT_PAGE)                                               |
| DELETE | `/coupon/{couponCodeId}`                                         | → `String`                                                    | Soft-delete coupon                                                                |
| POST   | `/{productPageId}/custom-fields/add?customFieldId=&instituteId=` | → `ProductPageResponse`                                       | Link an existing custom field to all active invites                               |
| POST   | `/{productPageId}/custom-fields/create?instituteId=`             | `ProductPageCustomFieldCreateRequest` → `ProductPageResponse` | Create + link a new custom field                                                  |
| DELETE | `/{productPageId}/custom-fields/{customFieldId}?instituteId=`    | → `ProductPageResponse`                                       | Soft-delete field mappings                                                        |

### 4.2 Public (anonymous) — `OpenProductPageController`

Base: `/admin-core-service/open/v1/product-page`

| Method | Path                                                        | Request → Response                                               | Purpose                                                              |
| ------ | ----------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| GET    | `/by-code?code=&instituteId=`                               | → `ProductPageResponse`                                          | Learner landing: layout + aggregated custom fields                   |
| POST   | `/validate-coupon?coursePageCode=&couponCode=&totalAmount=` | → `ProductPageCouponValidateResponse`                            | Validate coupon, return discount                                     |
| POST   | `/form-submit`                                              | `ProductPageFormSubmitRequest` → `ProductPageFormSubmitResponse` | **Step 1**: create user + ABANDONED_CART entries per selected invite |
| POST   | `/enroll`                                                   | `ProductPageEnrollRequest` → `ProductPageEnrollResponse`         | **Step 2**: combined payment + per-invite fulfillment                |
| POST   | `/cpo-enroll`                                               | `ProductPageCpoEnrollRequest` → `ProductPageEnrollResponse`      | CPO (installment) enroll without upfront payment                     |

All wire JSON is **snake_case**.

---

## 5. Backend services (the important logic)

### `ProductPageService` — CRUD, coupons, custom fields, response building

- `createProductPage` / `updateProductPage` — note **update does a full mapping replace** (deletes ALL existing mappings then re-inserts; no diffing) whenever `mappings` is non-null.
- Code generation: `generateUniqueCode()` — 6-char, loops on `existsByCode`.
- Custom fields: `addCustomFieldToPage` / `createAndLinkCustomFieldToPage` / `removeCustomFieldFromPage` — apply the field to each active mapping's **EnrollInvite** (`CustomFieldTypeEnum.ENROLL_INVITE`).
- `createCoupon` — builds `CouponCode` + `AppliedCouponDiscount`, source `PRODUCT_PAGE`.
- `validateCoupon` — delegates to shared `CouponValidationService`.
- Response builders `buildAdminResponse` / `buildAdminResponseWithCustomFields` — the latter adds `aggregateCustomFields` (dedupes fields across invites, tracking owning `enrollInviteIds` so the frontend can hide fields when a course is deselected), plus vendor/currency (from first invite) and GTM container id (institute setting `GTM_SETTING`).

### `ProductPageEnrollmentService` — the enrollment engine

- **`submitProductPageForm` (Step 1)** — ensures STUDENT role, creates the user via auth service, creates one ABANDONED_CART "details-filled" entry per selected invite, saves custom-field values (source USER).
- **`enrollForProductPage` (Step 2)** — the core combined-payment flow:
  - **Server recomputes the total** from each `PaymentPlan.actualPrice` — client-supplied `amount` is advisory only.
  - **Vendor/currency overridden from the first EnrollInvite** — client-supplied gateway is ignored.
  - Applies coupon; `finalTotal = serverTotal − discount`.
  - Branches by vendor:
    - **Razorpay** — 2-phase: phase 1 returns order+key (no enrollment yet); phase 2 verifies HMAC signature then enrolls.
    - **Free** (`finalTotal <= 0`) — MANUAL PAID log, enroll immediately.
    - **MANUAL** — PENDING log, admin confirms offline.
    - **Redirect gateways** (Cashfree/PhonePe) — create UserPlan+SSIGM per mapping in INVITED status with a parent PaymentLog, collect child payment log ids, return `paymentUrl`; webhook completes it.
    - **Sync gateways** (Stripe/Eway, `PAID`) — enroll immediately with `FORCE_PAID_STATUS`.
  - Fulfillment per invite via `OneTimePaymentOptionOperation.enrollLearnerToBatch`; creates `PaymentLogLineItem` rows (type `PRODUCT_PAGE_ALLOCATION`, source `ENROLL_INVITE`; coupon as a negative line item `COUPON:<code>`).
  - `triggerPostEnrollmentActions` — credential email, learner coupon generation, per-package-session workflows — **only for sync-paid**; paid gateway flows defer these to the webhook.
- **`enrollCpoForProductPage`** — for Custom Payment Option installment plans. Creates an ACTIVE UserPlan + fee rows with no upfront payment, sends credentials, returns `userPlanId`. Learner then pays installments via the shared `/open/v1/fee/cpo-pay-installments`.

**Enroll response `status` values:** `PAYMENT_PENDING`, `PAID`, `INITIATED`, `CPO_ENROLLED`.

---

## 6. Frontend

### 6.1 Admin builder — `frontend-admin-dashboard`

- Routes: `src/routes/manage-pages/product-pages/`
  - `index.lazy.tsx` → `ProductPagesList.tsx` (list; `index.tsx` is a loading placeholder)
  - `editor/$productPageId.tsx` → `ProductPageEditor.tsx`
- Editor shell logic: `-hooks/use-product-page-editor.ts` (loads page, tracks `isDirty`, on save calls `updateProductPage` with stringified `page_json`/`settings_json` and reduced mapping rows).
- **Editor tabs** (the component actually defines **6**, often described as "5" by omitting Preview):
  1. **Page Design** (`PageDesignEditor.tsx`) — drag-and-drop builder (@dnd-kit), 15-component palette (header, hero, footer, course grid, text/image/video/html blocks, stats, testimonials, FAQ, CTA, feature grid, steps, marquee). Includes `normalizePageJson`/`migrateComponent` to upgrade legacy page_json (old PascalCase → new camelCase).
  2. **Courses** (`CourseSessionSelector.tsx`) — pick package sessions, an enroll-invite + payment plan per row, toggle preselected → produces the mapping rows. Embeds `SuggestionsPanel` (per-course upsell map in `pageJson.suggestions`).
  3. **Settings** (`ProductPageSettingsCard.tsx`) — default landing step, allowCourseDeselection, disableBackNavigation, T&C, suggested courses, coupon.enabled, invoice (+ channels), post-enroll redirect/login/success content. Writes `settings_json`.
  4. **Coupons** (`CouponManager.tsx`) — create/delete coupons.
  5. **Custom Fields** (`ProductPageCustomFieldsManager.tsx`) — add/create/remove custom fields.
  6. **Preview** (`ProductPagePreview.tsx`) — sandboxed iframe of the learner URL.
- API service: `-services/product-pages-service.ts` (authenticated axios). Base `PRODUCT_PAGE_BASE_URL` in `src/constants/urls.ts`.

### 6.2 Learner storefront — `frontend-learner-dashboard-app`

- Route: `src/routes/product-pages/$productPageCode/index.tsx`
  - Search params (zod): `instituteId`, `courseIds`, `defaultTab` (`CATALOG|CART|PAYMENT`), `utm_*`.
  - Institute resolved via **domain routing** first, then `?instituteId=` fallback.
  - Data loaded with `useSuspenseQuery(handleGetProductPage(code, instituteId))`, wrapped in `PaymentGatewayWrapper`.
- Orchestrator: `-components/ProductPageShell.tsx` — the step state machine. Parses `settings_json`, resolves initial step, seeds selection from URL, injects GTM, decides CPO branching (if _all_ selected mappings are CPO, FORM → CPO_INSTALLMENTS).
- Store: `-stores/product-page-store.ts` (zustand) — selection, coupon, registration data, UTM, CPO state; computed `totalPrice()`/`finalPrice()`.
- Steps (`ProductPageStep = CATALOG | CART | FORM | PAYMENT | CPO_INSTALLMENTS | SUCCESS`):
  1. **CATALOG** (`CatalogStep.tsx`) — renders designed page via `PageRenderer.tsx` if `page_json.components` exist, else a fallback catalog.
  2. **CART** (`CartStep.tsx`) — order summary, coupon box (double-gated: page setting AND institute-level), upsell courses. Calls `validateCoupon`.
  3. **FORM** (`MultiEnrollForm.tsx`) — custom fields (filtered to selected invites via `-utils/custom-field-aggregator.ts`), optional T&C. Calls `submitProductPageForm`.
  4. **PAYMENT** (`CombinedPaymentStep.tsx`) — calls `enrollForProductPage`. Free auto-enrolls; Razorpay via `RazorpayCheckoutForm`; redirect vendors `window.location.href`.
  5. **CPO_INSTALLMENTS** (`CpoInstallmentsCheckoutStep.tsx`) — 3-call dance: `cpo-enroll` → fetch dues (SFP ids) → pay installments.
  6. **SUCCESS** (`ProductPageSuccess.tsx`) — enrolled courses, optional custom HTML/login button, postMessage to embedder allow-list.
- API service: `-services/product-page-service.ts` (plain unauthenticated axios). Base `PRODUCT_PAGE_OPEN_URL` in `src/constants/urls.ts`.

---

## 7. Integrations

| Subsystem              | How Product Pages uses it                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Invites**            | `EnrollInvite` + `PackageSessionLearnerInvitationToPaymentOption` bridge. Invite drives vendor, currency, invite code, workflows.                                                                                                                            |
| **Payments**           | `PaymentPlan` (price), `PaymentLog`/`PaymentLogLineItem`, gateway operations. Multi-vendor: Razorpay (2-phase), Cashfree/PhonePe (redirect), Stripe/Eway (sync), MANUAL, FREE. Combined payment = one parent PaymentLog with child line items.               |
| **Coupons**            | Shared `CouponCode`/`AppliedCouponDiscount`, `source_type='PRODUCT_PAGE'`. `V311` made codes unique per-institute (`uq_coupon_code_institute_code`) instead of globally, so two institutes can share a code string. Validated via `CouponValidationService`. |
| **Custom fields**      | `InstituteCustomFiledService` — attached at `ENROLL_INVITE` scope, deduped/aggregated for the page, values saved at USER scope and filtered per invite on enroll.                                                                                            |
| **Package sessions**   | Via the bridge → `PackageSession` (package/level/session names surfaced in responses).                                                                                                                                                                       |
| **CPO / installments** | Reuses the shared enroll-by-invite CPO flow and `/open/v1/fee/cpo-pay-installments`.                                                                                                                                                                         |

---

## 8. Gotchas & things to watch (read this before you touch anything)

1. **`update` replaces all mappings** — sending `mappings` in the update request soft-deletes every existing mapping and re-inserts. There is no diffing. Don't send a partial mapping list expecting a merge.
2. **Server ignores client price and gateway.** Total is recomputed from `PaymentPlan.actualPrice`; vendor/currency come from the first EnrollInvite. Client `amount`/vendor are advisory.
3. **`preselected` is DB-side only for admin preview.** The learner side (`resolveInitialSelection`) deliberately ignores the DB flag and seeds selection from the URL `courseIds`. Admin preview builds `courseIds` from preselected rows to simulate it.
4. **`defaultTab=PAYMENT` maps to the FORM step**, not payment — the learner must fill the form before paying.
5. **Coupons are double-gated** — must be enabled on the page (`settings.coupon.enabled`) AND institute-wide (`useCouponsEnabled`). Any cart change silently clears an applied coupon.
6. **CPO branch only triggers when the _entire_ selection is CPO.** Mixed CPO+regular goes through normal PAYMENT.
7. **`page_json` / `settings_json` are stringified JSON strings**, parsed client-side with a local `parseSafeJson` + defaults. There are multiple copies of that helper and several hardcoded default colors.
8. **Legacy page_json migration** — component types exist in both old PascalCase and new camelCase; admin `normalizePageJson` migrates on load, and learner renderers branch on both casings. Keep both paths working.
9. **Type drift risk** — the two `product-page-types.ts` files (admin & learner) are hand-mirrored, not shared. They can diverge (custom-field shapes already differ). If you change the backend contract, update _both_.
10. **Statuses are plain strings**, not enums (`DRAFT`/`ACTIVE`/`DELETED`, mapping `ACTIVE`/`DELETED`). Deletes are soft.
11. **Potential wiring bug to verify:** `ProductPageService.couponValidationService` (~line 73) appears to lack `@Autowired`/constructor injection. If Spring doesn't wire it, `validateCoupon` could NPE. Confirm it's actually injected.
12. **Migration version comment mismatch** — code comments reference "V309" for the coupon per-institute change; the actual migration file is `V311`.
13. **Razorpay signature verification** falls back through gateway config keys and silently skips (logs a warning) if the secret is absent — a misconfigured gateway means no verification.

---

## 9. Local setup / testing a page end-to-end

1. **Create a page (admin):** open the admin dashboard → Manage Pages → Product Pages → create. You'll land in the editor.
2. **Add courses (Courses tab):** you need existing package sessions with **enroll-invites and payment plans** already set up — Product Pages only reference these; it can't create them.
3. **Design + Settings + (optional) Coupons/Custom Fields**, then set status to **ACTIVE** and Save.
4. **Get the link:** copy the shareable link from the editor top bar, or use the Preview tab.
5. **Run the learner flow:** open `/<learner-app>/product-pages/{code}?instituteId=<id>`. Walk CATALOG → CART → FORM → PAYMENT.
   - For a no-friction test, use a **free** plan (finalTotal ≤ 0) — it auto-enrolls without a gateway.
   - For paid, use gateway test credentials (Razorpay test mode etc.).
6. **Verify:** learner user created, `UserPlan`/enrollment present, `PaymentLog` + `PaymentLogLineItem` rows written, and (for sync-paid) credential email/workflows triggered.

---

## 10. File map (quick reference)

**Backend** — `admin_core_service/src/main/java/vacademy/io/admin_core_service/features/product_page/`

- `entity/ProductPage.java`, `entity/ProductPageInviteMapping.java`
- `controller/ProductPageController.java`, `controller/OpenProductPageController.java`
- `service/ProductPageService.java`, `service/ProductPageEnrollmentService.java`
- `dto/*` — request/response DTOs
- `repository/*`
- Migrations: `resources/db/migration/V257__Create_product_page.sql`, `V311__Coupon_code_per_institute_unique.sql`

**Admin frontend** — `frontend-admin-dashboard/src/routes/manage-pages/product-pages/`

- `-components/ProductPageEditor.tsx`, `PageDesignEditor.tsx`, `CourseSessionSelector.tsx`, `ProductPageSettingsCard.tsx`, `CouponManager.tsx`, `ProductPageCustomFieldsManager.tsx`, `ProductPagePreview.tsx`
- `-hooks/use-product-page-editor.ts`, `-services/product-pages-service.ts`, `-types/product-page-types.ts`

**Learner frontend** — `frontend-learner-dashboard-app/src/routes/product-pages/$productPageCode/`

- `index.tsx`, `-components/ProductPageShell.tsx`, `CatalogStep.tsx`, `CartStep.tsx`, `MultiEnrollForm.tsx`, `CombinedPaymentStep.tsx`, `CpoInstallmentsCheckoutStep.tsx`, `ProductPageSuccess.tsx`, `PageRenderer.tsx`
- `-stores/product-page-store.ts`, `-services/product-page-service.ts`, `-utils/custom-field-aggregator.ts`, `-types/product-page-types.ts`
