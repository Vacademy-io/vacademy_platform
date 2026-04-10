declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
    }
}

/**
 * Injects GTM <script> and <noscript> tags into the document.
 * Idempotent — if already injected, does nothing.
 */
export function injectGtm(containerId: string): void {
    if (!containerId || document.getElementById('gtm-script')) return;

    // Validate format to prevent script injection via malicious container IDs
    if (!/^GTM-[A-Z0-9]+$/.test(containerId)) return;

    window.dataLayer = window.dataLayer || [];

    // GTM head snippet
    const script = document.createElement('script');
    script.id = 'gtm-script';
    script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${containerId}');`;
    document.head.appendChild(script);

    // GTM noscript fallback
    const noscript = document.createElement('noscript');
    noscript.id = 'gtm-noscript';
    noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${containerId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body.insertBefore(noscript, document.body.firstChild);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function pushEvent(event: string, data: Record<string, unknown> = {}): void {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...data });
}

// ─── Funnel Events ───────────────────────────────────────────────────────────

/** Fired once when the enrollment page loads with GTM configured. */
export function pushPageView(courseName: string, paymentType: string): void {
    pushEvent('enrollment_page_view', {
        enrollment_course_name: courseName,
        enrollment_payment_type: paymentType,
    });
}

/** Fired when the learner completes the registration form (step 0 → next). */
export function pushRegistrationCompleted(courseName: string): void {
    pushEvent('registration_completed', {
        enrollment_course_name: courseName,
    });
}

/** Fired when a payment plan is selected (step 1). */
export function pushPlanSelected(data: {
    courseName: string;
    planName: string;
    amount: number;
    currency: string;
}): void {
    pushEvent('payment_plan_selected', {
        enrollment_course_name: data.courseName,
        plan_name: data.planName,
        plan_amount: data.amount,
        plan_currency: data.currency,
    });
}

/** Fired when the review/checkout step is viewed (step 2). */
export function pushReviewStepViewed(courseName: string, paymentType: string): void {
    pushEvent('review_step_viewed', {
        enrollment_course_name: courseName,
        enrollment_payment_type: paymentType,
    });
}

/** Fired when the learner clicks "Pay Now" / submits enrollment (step 3). */
export function pushPaymentInitiated(data: {
    courseName: string;
    paymentType: string;
    vendor: string;
    currency?: string;
    amount?: number;
}): void {
    pushEvent('payment_initiated', {
        enrollment_course_name: data.courseName,
        enrollment_payment_type: data.paymentType,
        payment_vendor: data.vendor,
        enrollment_currency: data.currency || '',
        enrollment_amount: data.amount || 0,
    });
}

/** Fired when a payment attempt fails or an enrollment error occurs. */
export function pushPaymentFailed(data: {
    courseName: string;
    vendor: string;
    errorMessage: string;
}): void {
    pushEvent('payment_failed', {
        enrollment_course_name: data.courseName,
        payment_vendor: data.vendor,
        error_message: data.errorMessage,
    });
}

/** Fired when enrollment succeeds (step 5 — free or paid). */
export function pushEnrollmentSuccess(data: {
    courseName: string;
    paymentType: string;
    currency?: string;
    amount?: number;
}): void {
    pushEvent('enrollment_success', {
        enrollment_course_name: data.courseName,
        enrollment_payment_type: data.paymentType,
        enrollment_currency: data.currency || '',
        enrollment_amount: data.amount || 0,
    });
}
