# School fee receipt HTML template (`SCHOOL_FEE_RECEIPT`)

Institute-specific templates are stored via **TemplateService** with type **`SCHOOL_FEE_RECEIPT`**. If none exists, the service falls back to its built-in default. The HTML below is the **styled variant** you can paste into the template record.

PDF rendering uses **OpenHTMLToPDF**; keep markup XML-friendly (self-closing tags where needed, avoid invalid nesting).

---

## Placeholders (filled by `SchoolFeeReceiptService`)

| Placeholder | Description | Typical source |
|-------------|-------------|----------------|
| `{{institute_name}}` | Institute display name | `Institute` |
| `{{institute_address}}` | Address line | `Institute` |
| `{{institute_logo}}` | Logo `<img>` HTML (or empty) | Institute logo file URL |
| `{{receipt_number}}` | Generated receipt id | e.g. `RCT-YYYYMMDD-####` |
| `{{receipt_date}}` | Receipt date | Current date (`dd MMM yyyy`) |
| `{{student_name}}` | Learner name | Auth `UserDTO` |
| `{{student_email}}` | Learner email | Auth `UserDTO` |
| `{{package_name}}` | Class | `package.package_name` via active `student_session_institute_group_mapping` → `package_session` |
| `{{session_name}}` | Section / batch | `package_session.name` |
| `{{session}}` | Academic year label | `session.session_name` linked to `package_session` |
| `{{parent_name}}` | Parent / guardian | `audience_response.parent_name` (latest match for user) |
| `{{fee_table}}` | Installment rows | Built by service (full `<table>`) |
| `{{total_expected}}` | Sum expected | Numeric string |
| `{{total_discount}}` | Sum discounts | Numeric string |
| `{{total_paid}}` | Sum paid (all time on shown rows) | Numeric string |
| `{{balance_due}}` | Balance | Numeric string |
| `{{amount_paid_now}}` | Amount for this transaction | Numeric string |
| `{{transaction_id}}` | Reference | Payment / log id or `N/A` |
| `{{payment_mode}}` | Mode label | Caller (e.g. `Cash`, `OFFLINE`, `ONLINE`); default in code if null |
| `{{currency}}` | Currency code | Institute invoice settings |
| `{{currency_symbol}}` | Symbol | Derived from currency code |

### Hardcoded “Cash” in this template

This document’s HTML uses literal **Cash** in the meta box and payment banner. That **does not** use `{{payment_mode}}`. To show whatever the backend passes (online enrollment, Razorpay, etc.), replace those literals with `{{payment_mode}}`.

---

## Full template HTML

Copy everything inside the fence into your `SCHOOL_FEE_RECEIPT` template `content` field.

```html
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8" />
<style>
@page { margin: 15mm; size: A4; }
body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333333; margin: 0; padding: 0; }
.container { max-width: 800px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 30px; border-radius: 8px; background-color: #ffffff; }
.header { text-align: center; margin-bottom: 25px; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; position: relative; }
.header .logo { margin-bottom: 10px; max-width: 150px; max-height: 80px; }
.header h1 { margin: 0; color: #1e3a8a; font-size: 26px; letter-spacing: 0.5px; text-transform: uppercase; }
.institute-info { text-align: center; font-size: 13px; color: #4b5563; margin-top: 8px; }
.receipt-title { margin: 15px 0 0 0; color: #3b82f6; font-size: 18px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }
.meta-box { background-color: #f3f4f6; border-radius: 6px; padding: 15px 20px; margin-bottom: 25px; }
.meta-table { width: 100%; border-collapse: collapse; }
.meta-table td { border: none; padding: 6px 10px; vertical-align: top; width: 50%; }
.meta-table td:first-child { border-right: 1px solid #e5e7eb; }
.meta-label { color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
.meta-value { font-weight: 600; font-size: 14px; color: #1f2937; margin-top: 2px; }
.fee-table-container { margin: 25px 0; }
.fee-table-container table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; }
.fee-table-container th { background-color: #f8fafc; color: #475569; padding: 12px 10px; text-align: left; font-size: 13px; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #cbd5e1; }
.fee-table-container td { padding: 12px 10px; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #334155; }
.fee-table-container tr:nth-child(even) { background-color: #fafafa; }
.status-PAID { color: #059669; font-weight: bold; background-color: #d1fae5; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
.status-PARTIAL_PAID { color: #d97706; font-weight: bold; background-color: #fef3c7; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
.status-PENDING { color: #dc2626; font-weight: bold; background-color: #fee2e2; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
.totals-table { width: 350px; margin-left: auto; border-collapse: collapse; }
.totals-table td { padding: 8px 12px; font-size: 14px; border: none; }
.totals-label { text-align: left; color: #4b5563; }
.totals-value { text-align: right; font-weight: 600; color: #1f2937; }
.totals-discount { color: #059669; }
.grand-total-row th { padding: 12px; font-size: 16px; font-weight: bold; color: #1e3a8a; border-top: 2px solid #3b82f6; background-color: #eff6ff; }
.grand-total-row .totals-label { text-align: left; }
.grand-total-row .totals-value { text-align: right; color: #1e3a8a; }
.payment-banner { margin-top: 35px; padding: 15px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #22c55e; border-radius: 6px; font-size: 13px; }
.footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 15px; }
.auth-signature { margin-top: 40px; text-align: right; padding-right: 20px; }
.auth-line { display: inline-block; width: 150px; border-top: 1px solid #1f2937; padding-top: 5px; font-size: 12px; text-align: center; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>{{institute_name}}</h1>
<div class="institute-info">{{institute_address}}<br/></div>
<div class="receipt-title">FEE RECEIPT</div>
</div>
<div class="meta-box">
<table class="meta-table">
<tr>
<td><div class="meta-label">Receipt No.</div><div class="meta-value">{{receipt_number}}</div></td>
<td><div class="meta-label">Date</div><div class="meta-value">{{receipt_date}}</div></td>
</tr>
<tr>
<td><div class="meta-label">Student Name</div><div class="meta-value">{{student_name}}</div></td>
<td><div class="meta-label">Class</div><div class="meta-value">{{package_name}}</div></td>
</tr>
<tr>
<td><div class="meta-label">Parent Name</div><div class="meta-value">{{parent_name}}</div></td>
<td><div class="meta-label">Section</div><div class="meta-value">{{session_name}}</div></td>
</tr>
<tr>
<td><div class="meta-label">Academic Year</div><div class="meta-value">{{session}}</div></td>
<td><div class="meta-label">Payment Mode</div><div class="meta-value">Cash</div></td>
</tr>
</table>
</div>
<div class="fee-table-container">{{fee_table}}</div>
<table class="totals-table">
<tr><td class="totals-label">Total Expected Fee:</td><td class="totals-value">{{currency_symbol}} {{total_expected}}</td></tr>
<tr><td class="totals-label">Total Discount:</td><td class="totals-value totals-discount">- {{currency_symbol}} {{total_discount}}</td></tr>
<tr><td class="totals-label">Total Paid (All Time):</td><td class="totals-value">{{currency_symbol}} {{total_paid}}</td></tr>
<tr class="grand-total-row"><th class="totals-label">Current Balance Due:</th><th class="totals-value">{{currency_symbol}} {{balance_due}}</th></tr>
</table>
<div class="payment-banner">
<table style="width: 100%; border: none;">
<tr>
<td style="border: none; width: 33%;"><div class="meta-label">Amount Paid Now</div><div class="meta-value" style="color: #15803d; font-size: 16px;">{{currency_symbol}} {{amount_paid_now}}</div></td>
<td style="border: none; width: 33%; text-align: center;"><div class="meta-label">Payment Method</div><div class="meta-value">Cash</div></td>
<td style="border: none; width: 34%; text-align: right;"><div class="meta-label">Transaction Reference</div><div class="meta-value">{{transaction_id}}</div></td>
</tr>
</table>
</div>
<div class="auth-signature"><div class="auth-line">Authorized Signatory</div></div>
<div class="footer">This is a computer-generated document. No signature is required.<br/> &#169; {{institute_name}} | All rights reserved.</div>
</div>
</body>
</html>
```

---

## Optional: show logo in header

If you use `{{institute_logo}}`, add it inside `.header` (before or above `h1`), for example:

```html
<div class="header">
{{institute_logo}}
<h1>{{institute_name}}</h1>
...
</div>
```

The service injects a complete `<img ... />` tag or an empty string.
