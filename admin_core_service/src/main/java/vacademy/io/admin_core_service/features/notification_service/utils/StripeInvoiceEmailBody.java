package vacademy.io.admin_core_service.features.notification_service.utils;

public class StripeInvoiceEmailBody {

    // Your existing getInvoiceCreatedEmailBody method can remain here...

    /**
     * UPDATED: This template is now more visually appealing and fixes the formatting exception.
     * It correctly escapes '%' characters in CSS and includes a conditional receipt button.
     */
    public static String getPaymentConfirmationEmailBody(
        String instituteName,
        String instituteLogoUrl,
        String userFullName,
        String amountPaid,
        String currencySymbol,
        String transactionId,
        String paymentDate,
        String receiptUrl,
        String instituteAddress,
        String themeCode
    ) {
        String themeColor = getThemeColorHex(themeCode);

        // Conditionally create the button HTML only if a receipt URL is available
        String buttonHtml = "";
        if (receiptUrl != null && !receiptUrl.isBlank()) {
            buttonHtml = """
            <table width="100%%" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                <tr>
                    <td align="center">
                        <a href="%s" class="cta-button">View Full Receipt</a>
                    </td>
                </tr>
            </table>
            """.formatted(receiptUrl);
        }

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Confirmation from %s</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                /* --- FIX: Escaped all '%%' symbols --- */
                body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                table { border-collapse: collapse !important; }
                body { height: 100%% !important; margin: 0 !important; padding: 0 !important; width: 100%% !important; background-color: #f6f8fc; font-family: 'Poppins', Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.07); }
                .header { background: %s; color: #ffffff; padding: 20px; text-align: center; }
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
                .receipt-card .total-amount { font-size: 28px; font-weight: 700; color: %s; text-align: right; }
                .receipt-card .divider { border-bottom: 1px solid #dee2e6; }
                .receipt-card .details-row td { padding-top: 20px; font-size: 14px; }
                .receipt-card .label { color: #888; text-align: left; }
                .receipt-card .value { color: #333; font-weight: 600; text-align: right; }
                .cta-button { background-color: %s; color: #ffffff !important; padding: 16px 32px; text-align: center; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block; }
                .footer { background-color: #f9fafb; padding: 40px; text-align: center; font-size: 12px; color: #999999; }
                .social-icons img { width: 24px; margin: 0 10px; }
            </style>
        </head>
        <body>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%%" style="background-color: #f6f8fc;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr><td class="header">
                                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRbi1i-616xg-52ZV-8D5_B5pSg2IYd_Y1K-g&s" alt="Success" class="success-icon">
                                <h1>Payment Successful!</h1>
                            </td></tr>
                            <tr><td class="logo-container"><img src="%s" alt="%s Logo"></td></tr>
                            <tr><td class="content">
                                <p class="greeting">Hi %s,</p>
                                <p>Thank you for your payment to <strong>%s</strong>. We've received it successfully, and your receipt summary is below.</p>
                                <div class="receipt-card">
                                    <table width="100%%">
                                        <tr class="amount-row"><td class="total-label">Amount Paid</td><td class="total-amount">%s%s</td></tr>
                                        <tr class="divider"><td colspan="2"></td></tr>
                                        <tr class="details-row"><td class="label">Transaction ID</td><td class="value">%s</td></tr>
                                        <tr class="details-row"><td class="label">Payment Date</td><td class="value">%s</td></tr>
                                    </table>
                                </div>
                                %s
                                <p>If you have any questions, please feel free to contact our support team. We're always happy to help!</p>
                                <p>Thanks,<br>The %s Team</p>
                            </td></tr>
                            <tr><td class="footer">
                                <p style="margin-top: 20px;">© 2025 %s. All rights reserved.<br>%s</p>
                            </td></tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(
            instituteName,
            themeColor, // Header background
            themeColor, // Total amount color
            themeColor, // CTA button background
            instituteLogoUrl, instituteName,
            userFullName, instituteName,
            currencySymbol, amountPaid,
            transactionId, paymentDate,
            buttonHtml, // Inject the button HTML here
            instituteName,
            instituteName, instituteAddress
        );
    }

    private static String getThemeColorHex(String themeCode) {
        if (themeCode == null || themeCode.isBlank()) return "#007bff"; // A nice default blue
        return switch (themeCode.toLowerCase()) {
            case "red" -> "#e74c3c";
            case "purple" -> "#9b59b6";
            case "blue" -> "#3498db";
            case "green" -> "#27ae60";
            case "amber" -> "#f39c12";
            default -> "#007bff";
        };
    }
}
