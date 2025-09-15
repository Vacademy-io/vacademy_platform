package vacademy.io.admin_core_service.features.notification_service.utils;

public class StripeInvoiceEmailBody {

    public static String getInvoiceCreatedEmailBody(
        String instituteName,
        String instituteLogoUrl,
        String userFullName,
        String totalAmount,
        String currencySymbol,
        String invoiceId,
        String dueDate,
        String paymentUrl,
        String invoicePdfUrl,
        String instituteAddress,
        String themeCode
    ) {
        String themeColor = getThemeColorHex(themeCode);

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your Invoice from %s</title>
            <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                table { border-collapse: collapse !important; }
                body { margin: 0 !important; padding: 0 !important; width: 100%% !important; background-color: #f4f4f4; font-family: 'Lato', Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #f0f0f0; }
                .header { background-color: %s; color: #ffffff; padding: 30px; text-align: center; }
                .header img { max-width: 140px; margin-bottom: 15px; background-color: #ffffff; padding: 10px; border-radius: 8px; }
                .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
                .content { padding: 40px 30px; font-size: 16px; line-height: 1.7; color: #555555; }
                .invoice-total { margin-top: 20px; text-align: right; }
                .invoice-total .total-amount { font-size: 24px; color: %s; }
                .cta-button { display: inline-block; background-color: %s; color: #ffffff !important; padding: 15px 30px; text-align: center; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 700; }
                .secondary-button { color: %s; text-decoration: none; font-weight: 700; }
                .footer { background-color: #f9f9f9; padding: 30px; text-align: center; font-size: 12px; color: #999999; }
                .footer a { color: %s; text-decoration: none; font-weight: 700; }
            </style>
        </head>
        <body>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%%" style="padding: 20px 0; background-color: #f4f4f4;">
                <tr>
                    <td align="center">
                        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr><td class="header"><img src="%s" alt="%s Logo" width="140"><h1>Invoice Ready for Payment</h1></td></tr>
                            <tr><td class="content">
                                <p>Hello %s,</p>
                                <p>This is a reminder that a new invoice has been generated for you from <strong>%s</strong>.</p>
                                <table class="invoice-total" width="100%%"><tr><td align="right"><p>Total Due: <span class="total-amount">%s%s</span></p></td></tr></table>
                                <p><strong>Invoice ID:</strong> %s<br><strong>Due Date:</strong> %s</p>
                                <table width="100%%" cellspacing="0" cellpadding="0" border="0">
                                    <tr><td align="center" style="padding: 10px;"><a href="%s" class="cta-button" style="color: #ffffff;">Pay Invoice Securely</a></td></tr>
                                    <tr><td align="center" style="padding: 10px;"><a href="%s" class="secondary-button">Download PDF Version</a></td></tr>
                                </table>
                            </td></tr>
                        </table>
                        <table role="presentation" class="footer" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr><td style="padding: 20px;">
                                <p>&copy; 2024 %s. All rights reserved.<br>%s</p>
                                <p style="margin-top: 15px;">Having trouble? <a href="%s">Click here to pay</a></p>
                            </td></tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(
            instituteName,
            themeColor, themeColor, themeColor, themeColor, themeColor,
            instituteLogoUrl, instituteName,
            userFullName, instituteName,
            currencySymbol, totalAmount,
            invoiceId, dueDate,
            paymentUrl, invoicePdfUrl,
            instituteName, instituteAddress, paymentUrl
        );
    }

    /**
     * UPDATED: This template is now designed for Payment Intents.
     * It shows "Transaction ID" instead of "Invoice ID" and removes the receipt download button.
     */
    public static String getPaymentConfirmationEmailBody(
        String instituteName,
        String instituteLogoUrl,
        String userFullName,
        String amountPaid,
        String currencySymbol,
        String transactionId, // Renamed from invoiceId
        String paymentDate,
        String instituteAddress,
        String themeCode
    ) {
        String themeColor = getThemeColorHex(themeCode);

        // Using the more attractive, modern email template
        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Confirmation from %s</title>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                table { border-collapse: collapse !important; }
                body { height: 100%% !important; margin: 0 !important; padding: 0 !important; width: 100%% !important; background-color: #f6f8fc; font-family: 'Poppins', Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #dee2e6; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .header { background: linear-gradient(135deg, %s 0%%, hsl(from %s h s l / 80%%) 100%%); color: #ffffff; padding: 40px 20px; text-align: center; }
                .header img.logo { max-width: 120px; margin-bottom: 20px; background: rgba(255, 255, 255, 0.9); padding: 10px; border-radius: 12px; }
                .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                .content { padding: 40px 30px; font-size: 16px; line-height: 1.7; color: #555555; }
                .content p { margin: 0 0 20px 0; }
                .content p.greeting { font-size: 18px; font-weight: 600; color: #333; }
                .details-card { background-color: #f9fafb; border-radius: 10px; padding: 25px; margin: 20px 0; border: 1px solid #e9ecef; }
                .details-card .total-amount { font-size: 36px; font-weight: 700; color: %s; text-align: center; margin-bottom: 20px; }
                .details-table { width: 100%%; text-align: left; font-size: 14px; }
                .details-table td { padding: 10px 0; border-bottom: 1px solid #e9ecef; }
                .details-table tr:last-child td { border-bottom: none; }
                .details-table .label { color: #888; }
                .details-table .value { color: #333; font-weight: 600; text-align: right; }
                .footer { padding: 30px; text-align: center; font-size: 12px; color: #999999; }
                .footer-container { max-width: 600px; margin: 0 auto; }
                .footer a { color: %s; font-weight: 600; }
            </style>
        </head>
        <body>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%%" style="background-color: #f6f8fc;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr>
                                <td class="header">
                                    <img src="%s" alt="%s Logo" class="logo">
                                    <h1 style="margin-top: 10px;">Payment Successful!</h1>
                                </td>
                            </tr>
                            <tr>
                                <td class="content">
                                    <p class="greeting">Hi %s,</p>
                                    <p>This is a confirmation that your payment has been processed successfully. Thank you for your payment to <strong>%s</strong>.</p>

                                    <div class="details-card">
                                        <p class="total-amount">%s%s</p>
                                        <table class="details-table" width="100%%">
                                            <tr>
                                                <td class="label">Transaction ID</td>
                                                <td class="value">%s</td>
                                            </tr>
                                            <tr>
                                                <td class="label">Payment Date</td>
                                                <td class="value">%s</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <p style="margin-top: 40px;">If you have any questions, please don't hesitate to contact support. We're happy to help!</p>
                                    <p>Thanks,<br>The %s Team</p>
                                </td>
                            </tr>
                        </table>
                        <table role="presentation" class="footer-container" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr>
                                <td class="footer">
                                    <p>&copy; 2024 %s. All rights reserved.<br>
                                    %s</p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """.formatted(
            instituteName,
            themeColor, themeColor, // For gradient
            themeColor, // For total amount
            themeColor, // For footer links
            instituteLogoUrl, instituteName,
            userFullName, instituteName,
            currencySymbol, amountPaid,
            transactionId, paymentDate,
            instituteName,
            instituteName, instituteAddress
        );
    }

    private static String getThemeColorHex(String themeCode) {
        if (themeCode == null || themeCode.isBlank()) {
            return "#ED7424"; // default orange
        }

        return switch (themeCode.toLowerCase()) {
            case "red" -> "#e74c3c";
            case "purple" -> "#9b59b6";
            case "blue" -> "#3498db";
            case "green" -> "#27ae60";
            case "amber" -> "#f39c12";
            default -> "#ED7424"; // fallback orange
        };
    }
}
