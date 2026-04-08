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

/**
 * Pushes an enrollment_success event to the GTM dataLayer.
 */
export function pushEnrollmentSuccess(data: {
    courseName: string;
    paymentType: string;
    currency?: string;
    amount?: number;
}): void {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        event: 'enrollment_success',
        enrollment_course_name: data.courseName,
        enrollment_payment_type: data.paymentType,
        enrollment_currency: data.currency || '',
        enrollment_amount: data.amount || 0,
    });
}
