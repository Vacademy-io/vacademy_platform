-- Payment-confirmation email becomes template-driven.
--
-- Until now the body was a hardcoded Java string (StripeInvoiceEmailBody), so an institute could
-- not change its payment confirmation without a code change. This seeds that exact body as the
-- platform-wide DEFAULT template plus its PAYMENT_CONFIRMATION event config, so:
--   * every institute keeps rendering the same mail it renders today, and
--   * any institute can override it by creating its own template + config row, with no code change.
--
-- Placeholders are the {{snake_case}} keys SendUniqueLinkService derives from
-- NotificationTemplateVariables. {{receipt_button}} carries a whole HTML block (empty when the
-- gateway returned no receipt URL) because a template cannot express a conditional row.
--
-- Idempotent: re-running is a no-op, so a partially-applied deploy can be repeated safely.

-- INSERT ... WHERE NOT EXISTS rather than ON CONFLICT (id): templates also carries a unique
-- index on (institute_id, name), so an environment that already has a DEFAULT template under
-- this name (with a different id) would fail an id-only conflict clause.
INSERT INTO templates (
    id, type, vendor_id, institute_id, name, subject, content, content_type,
    setting_json, dynamic_parameters, can_delete, status, template_category, created_at, updated_at
)
SELECT
    'default-payment-confirmation-email',
    'EMAIL',
    'default',
    'DEFAULT',
    'Payment Confirmation Email',
    'Payment Confirmation from {{institute_name}}',
    $tpl$<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation from {{institute_name}}</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f6f8fc; font-family: 'Poppins', Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
        .header { background: {{theme_color}}; color: #ffffff; padding: 20px; text-align: center; }
        .header img.success-icon { width: 64px; height: 64px; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
        .logo-container { padding: 30px 0; text-align: center; border-bottom: 1px solid #dee2e6; }
        .logo-container img { max-width: 140px; }
        .content { padding: 40px 30px; font-size: 16px; line-height: 1.75; color: #555555; }
        .content p { margin: 0 0 25px 0; }
        .content p.greeting { font-size: 18px; font-weight: 600; color: #333; }
        .receipt-card { border: 1px solid #dee2e6; border-radius: 10px; padding: 25px; margin: 20px 0; }
        .receipt-card .amount-row td { padding-bottom: 20px; }
        .receipt-card .total-label { font-size: 18px; font-weight: 600; color: #333; }
        .receipt-card .total-amount { font-size: 28px; font-weight: 700; color: {{theme_color}}; text-align: right; }
        .receipt-card .divider { border-bottom: 1px solid #dee2e6; }
        .receipt-card .details-row td { padding-top: 20px; font-size: 14px; }
        .receipt-card .label { color: #888; text-align: left; }
        .receipt-card .value { color: #333; font-weight: 600; text-align: right; }
        .cta-button { background-color: {{theme_color}}; color: #ffffff !important; padding: 16px 32px; text-align: center; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block; }
        .footer { background-color: #f9fafb; padding: 40px; text-align: center; font-size: 12px; color: #999999; }
        .social-icons img { width: 24px; margin: 0 10px; }
    </style>
</head>
<body>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="background-color: #f6f8fc;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                    <tr><td class="header">
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbi1i-616xg-52ZV-8D5_B5pSg2IYd_Y1K-g&s" alt="Success" class="success-icon">
                        <h1>Payment Successful!</h1>
                    </td></tr>
                    <tr><td class="logo-container"><img src="{{institute_logo_url}}" alt="{{institute_name}} Logo"></td></tr>
                    <tr><td class="content">
                        <p class="greeting">Hi {{learner_name}},</p>
                        <p>Thank you for your payment to <strong>{{institute_name}}</strong>. We've received it successfully, and your receipt summary is below.</p>
                        <div class="receipt-card">
                            <table width="100%">
                                <tr class="amount-row"><td class="total-label">Amount Paid</td><td class="total-amount">{{currency_symbol}}{{amount}}</td></tr>
                                <tr class="divider"><td colspan="2"></td></tr>
                                <tr class="details-row"><td class="label">Transaction ID</td><td class="value">{{transaction_id}}</td></tr>
                                <tr class="details-row"><td class="label">Payment Date</td><td class="value">{{payment_date}}</td></tr>
                            </table>
                        </div>
                        {{receipt_button}}
                        <p>If you have any questions, please feel free to contact our support team. We're always happy to help!</p>
                        <p>Thanks,<br>The {{institute_name}} Team</p>
                    </td></tr>
                    <tr><td class="footer">
                        <p style="margin-top: 20px;">&copy; {{year}} {{institute_name}}. All rights reserved.<br>{{institute_address}}</p>
                    </td></tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>$tpl$,
    'text/html',
    '{"variables":[],"isDefault":true,"templateType":"transactional"}',
    '{}',
    false,
    'ACTIVE',
    'NOTIFICATION',
    now(), now()
WHERE NOT EXISTS (
    SELECT 1 FROM templates
    WHERE id = 'default-payment-confirmation-email'
       OR (institute_id = 'DEFAULT' AND name = 'Payment Confirmation Email')
);

INSERT INTO notification_event_config (
    id, event_name, source_type, source_id, template_type, template_id, template_name,
    is_active, created_at, updated_at
)
SELECT
    'default-payment-confirmation-email-config',
    'PAYMENT_CONFIRMATION',
    'INSTITUTE',
    'DEFAULT',
    'EMAIL',
    t.id,
    t.name,
    true,
    now(), now()
FROM templates t
WHERE t.institute_id = 'DEFAULT'
  AND t.name = 'Payment Confirmation Email'
  AND NOT EXISTS (
      SELECT 1 FROM notification_event_config
      WHERE event_name = 'PAYMENT_CONFIRMATION'
        AND source_type = 'INSTITUTE'
        AND source_id = 'DEFAULT'
        AND template_type = 'EMAIL'
  );
