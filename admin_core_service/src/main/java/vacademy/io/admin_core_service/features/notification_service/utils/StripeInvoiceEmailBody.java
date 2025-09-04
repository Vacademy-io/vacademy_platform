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
        String themeColor = getThemeColorHex(themeCode); // Get the color dynamically

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

            body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100%% !important;
                background-color: #ffffff;
                font-family: 'Lato', Arial, sans-serif;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid #f0f0f0;
            }

            .header {
                background-color: %s;
                color: #ffffff;
                padding: 30px;
                text-align: center;
            }

            .header img {
                max-width: 140px;
                margin-bottom: 15px;
                background-color: #ffffff;
                padding: 10px;
                border-radius: 8px;
            }

            .header h1 {
                margin: 0;
                font-size: 26px;
                font-weight: 700;
            }

            .content {
                padding: 40px 30px;
                font-size: 16px;
                line-height: 1.7;
                color: #555555;
            }

            .content p {
                margin: 0 0 20px 0;
            }

            .invoice-total {
                margin-top: 20px;
                text-align: right;
            }

            .invoice-total p {
                margin: 5px 0;
                font-size: 18px;
                font-weight: 700;
                color: #333333;
            }

            .invoice-total .total-amount {
                font-size: 24px;
                color: %s;
            }

            .cta-button {
                display: inline-block;
                background-color: %s;
                color: #ffffff;
                padding: 15px 30px;
                text-align: center;
                text-decoration: none;
                border-radius: 8px;
                font-size: 18px;
                font-weight: 700;
                margin-top: 20px;
                transition: background-color 0.3s ease;
            }

            .cta-button:hover {
                filter: brightness(90%%);
            }

            .secondary-button {
                display: inline-block;
                color: %s;
                text-decoration: none;
                margin-top: 15px;
                font-size: 14px;
                font-weight: 700;
            }

            .footer {
                background-color: #f9f9f9;
                padding: 30px;
                text-align: center;
                font-size: 12px;
                color: #999999;
            }

            .footer a {
                color: %s;
                text-decoration: none;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%%" style="background-color: #ffffff;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                        <tr>
                            <td class="header">
                                <img src="%s" alt="%s Logo" width="140">
                                <h1>Invoice Ready for Payment</h1>
                            </td>
                        </tr>
                        <tr>
                            <td class="content">
                                <p>Hello %s,</p>
                                <p>This is a friendly reminder that a new invoice has been generated for you on behalf of <strong>%s</strong>.</p>

                                <table class="invoice-total" width="100%%">
                                    <tr>
                                        <td align="right">
                                            <p>Total Due: <span class="total-amount">%s%s</span></p>
                                        </td>
                                    </tr>
                                </table>

                                <p><strong>Invoice ID:</strong> %s<br>
                                <strong>Due Date:</strong> %s</p>

                                <table width="100%%" cellspacing="0" cellpadding="0" border="0">
                                    <tr>
                                        <td align="center">
                                            <a href="%s" class="cta-button">Pay Invoice Securely</a>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center">
                                            <a href="%s" class="secondary-button">Download PDF Version</a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin-top: 30px;">If you have any questions about this invoice, please don't hesitate to contact us.</p>
                                <p>Thank you for your prompt attention to this matter.</p>
                            </td>
                        </tr>
                    </table>

                    <table role="presentation" class="footer" cellspacing="0" cellpadding="0" border="0" width="600">
                        <tr>
                            <td style="padding: 20px;">
                                <p>&copy; 2024 %s. All rights reserved.<br>
                                %s</p>
                                <p style="margin-top: 15px;">Having trouble? <a href="%s">Click here to pay</a></p>
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
                themeColor, themeColor, themeColor, themeColor, themeColor, // theme injected multiple times
                instituteLogoUrl, instituteName,
                userFullName, instituteName,
                currencySymbol, totalAmount,
                invoiceId, dueDate,
                paymentUrl, invoicePdfUrl,
                instituteName, instituteAddress, paymentUrl
        );
    }
    public static String getPaymentConfirmationEmailBody(
            String instituteName,
            String instituteLogoUrl,
            String userFullName,
            String amountPaid,
            String currencySymbol,
            String invoiceId,
            String paymentDate,
            String receiptPdfUrl,
            String instituteAddress,
            String themeCode
    ) {
        // Get the dynamic theme color, defaulting to a success green for confirmations.
        String themeColor = getThemeColorHex(themeCode);

        return """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Confirmation from %s</title>
            <link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap" rel="stylesheet">
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%%; -ms-text-size-adjust: 100%%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%%; outline: none; text-decoration: none; }
                table { border-collapse: collapse !important; }
                body { height: 100%% !important; margin: 0 !important; padding: 0 !important; width: 100%% !important; background-color: #f4f4f4; font-family: 'Lato', Arial, sans-serif; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e0e0e0; }
                .header { background-color: %s; color: #ffffff; padding: 30px; text-align: center; }
                .header img { max-width: 140px; margin-bottom: 15px; background-color: #ffffff; padding: 10px; border-radius: 8px; }
                .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
                .content { padding: 40px 30px; font-size: 16px; line-height: 1.7; color: #555555; }
                .content p { margin: 0 0 20px 0; }
                .payment-details { margin-top: 20px; text-align: right; }
                .payment-details p { margin: 5px 0; font-size: 18px; font-weight: 700; color: #333333; }
                .payment-details .total-amount { font-size: 24px; color: %s; }
                .cta-button { display: inline-block; background-color: %s; color: #ffffff; padding: 15px 30px; text-align: center; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 700; margin-top: 20px; transition: background-color 0.3s ease; }
                .cta-button:hover { filter: brightness(90%%); }
                .footer { background-color: #f9f9f9; padding: 30px; text-align: center; font-size: 12px; color: #999999; }
                .footer a { color: %s; text-decoration: none; font-weight: 700; }
            </style>
        </head>
        <body>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%%" style="background-color: #f4f4f4;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" class="container" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr>
                                <td class="header">
                                    <img src="%s" alt="%s Logo" width="140">
                                    <h1>Payment Successful!</h1>
                                </td>
                            </tr>
                            <tr>
                                <td class="content">
                                    <p>Hi %s,</p>
                                    <p>Thank you for your payment! We've successfully received it on behalf of <strong>%s</strong>. A summary of your transaction is below.</p>
                                    <table class="payment-details" width="100%%">
                                        <tr>
                                            <td align="right">
                                                <p>Amount Paid: <span class="total-amount">%s%s</span></p>
                                            </td>
                                        </tr>
                                    </table>
                                    <p><strong>Invoice ID:</strong> %s<br>
                                    <strong>Payment Date:</strong> %s</p>
                                    <table width="100%%" cellspacing="0" cellpadding="0" border="0">
                                        <tr>
                                            <td align="center">
                                                <a href="%s" class="cta-button">Download Receipt</a>
                                            </td>
                                        </tr>
                                    </table>
                                    <p style="margin-top: 30px;">If you have any questions about this payment, please feel free to contact us.</p>
                                    <p>We appreciate your business!</p>
                                </td>
                            </tr>
                        </table>
                        <table role="presentation" class="footer" cellspacing="0" cellpadding="0" border="0" width="600">
                            <tr>
                                <td style="padding: 20px;">
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
                themeColor, themeColor, themeColor, themeColor, // theme injected multiple times
                instituteLogoUrl, instituteName,
                userFullName, instituteName,
                currencySymbol, amountPaid,
                invoiceId, paymentDate,
                receiptPdfUrl,
                instituteName, instituteAddress
        );
    }


    private static String getThemeColorHex(String themeCode) {
        if (themeCode == null) return "#ED7424"; // default orange

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
