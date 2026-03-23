# School Fee Receipt Template (Black, Printable, XHTML-safe)

This template is intended for the `SCHOOL_FEE_RECEIPT` PDF flow in `SchoolFeeReceiptService`.

It avoids `<img ... />` tags (XHTML/XML strict renderer) and relies on `{{fee_table}}` being injected as a full `<table>...</table>` block.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fee Receipt - {{SCHOOL_NAME}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Times New Roman', Times, serif;
      background: #fff;
      color: #000;
      font-size: 12px;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 14mm 10mm;
      background: #fff;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding-bottom: 10px;
      border-bottom: 2.5px solid #000;
    }

    .logo-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid #000;
      display: inline-block;
      flex-shrink: 0;
      background-size: cover;
      background-position: center;
    }

    .school-info {
      flex: 1;
      text-align: center;
    }

    .school-name {
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }

    .school-address {
      font-size: 11px;
      margin-top: 3px;
      line-height: 1.5;
    }

    .receipt-title-box {
      text-align: center;
      border: 1.5px solid #000;
      padding: 6px 14px;
      min-width: 110px;
    }

    .receipt-title {
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .receipt-no-label { font-size: 9.5px; margin-top: 4px; }
    .receipt-no-value { font-size: 11px; font-weight: bold; }

    /* ── META INFO ── */
    .meta-section {
      margin-top: 10px;
      border: 1px solid #000;
    }

    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; }

    .meta-row {
      display: flex;
      align-items: baseline;
      padding: 4px 8px;
      border-bottom: 1px solid #bbb;
      gap: 4px;
    }

    .meta-row:nth-child(odd) { border-right: 1px solid #000; }

    .meta-label {
      font-size: 10.5px;
      font-weight: bold;
      min-width: 130px;
      flex-shrink: 0;
    }

    .meta-sep { font-size: 11px; margin-right: 2px; }
    .meta-value { font-size: 11.5px; }

    /* ── TABLE ── */
    .table-section { margin-top: 12px; }

    .table-heading {
      font-size: 12px;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: 1px solid #000;
      border-bottom: none;
      padding: 4px;
      background: #000;
      color: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .table-wrapper {
      width: 100%;
      border: 1px solid #000;
      border-top: none;
      overflow: hidden;
    }

    /* IMPORTANT:
       backend injects a full <table>...</table> into {{fee_table}}.
       So we style any table inside this wrapper.
    */
    .table-wrapper table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      table-layout: fixed;
    }

    .table-wrapper th {
      background: #000;
      color: #fff;
      padding: 6px 7px;
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #000;
      overflow: hidden;
      white-space: nowrap;
    }

    .table-wrapper td {
      padding: 6px 7px;
      border-bottom: 1px solid #aaa;
      vertical-align: middle;
      overflow: hidden;
      word-break: break-word;
    }

    /* status cells from backend:
       backend sets class like status-PAID / status-PARTIAL_PAID / status-PENDING
    */
    td.status-PAID { color: #059669; font-weight: bold; background-color: #d1fae5; }
    td.status-PARTIAL_PAID { color: #d97706; font-weight: bold; background-color: #fef3c7; }
    td.status-PENDING { color: #dc2626; font-weight: bold; background-color: #fee2e2; }

    /* ── TOTALS ── */
    .totals-section {
      display: flex;
      justify-content: flex-end;
      border: 1px solid #000;
      border-top: none;
    }

    .totals-table {
      width: 300px;
      font-size: 11.5px;
      border-left: 1px solid #000;
    }

    .totals-table tr td { padding: 4px 8px; border-bottom: 1px solid #bbb; }
    .totals-table tr td:last-child { text-align: right; font-weight: bold; }

    .balance-row td {
      background: #000 !important;
      color: #fff !important;
      font-weight: bold !important;
      font-size: 12px !important;
      border-bottom: none !important;
      padding: 6px 8px !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── PAYMENT INFO ── */
    .payment-section {
      margin-top: 10px;
      border: 1px solid #000;
      display: flex;
    }

    .pay-block {
      flex: 1;
      padding: 7px 10px;
      border-right: 1px solid #000;
    }

    .pay-block:last-child { border-right: none; }

    .pay-label {
      font-size: 9.5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }

    .pay-value    { font-size: 13px; font-weight: bold; }
    .pay-value-sm { font-size: 11px; font-weight: bold; word-break: break-all; }

    /* ── FOOTER ── */
    .footer-section {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 4px;
    }

    .remarks-block .lbl {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .remarks-block .val { font-size: 12px; margin-top: 2px; }

    .sig-block { text-align: center; }

    .sig-line {
      width: 130px;
      border-top: 1.5px solid #000;
      margin: 0 auto 4px;
    }

    .sig-label { font-size: 10px; }

    /* ── NOTE ── */
    .note-section {
      margin-top: 10px;
      border-top: 1px dashed #555;
      padding-top: 7px;
    }

    .note-text { font-size: 9.5px; color: #333; line-height: 1.6; }

    .footer-brand {
      text-align: center;
      font-size: 9px;
      color: #555;
      margin-top: 8px;
      border-top: 1px solid #000;
      padding-top: 5px;
      letter-spacing: 0.3px;
    }

    @media print {
      body { background: #fff; }
      .page { margin: 0; padding: 10mm 12mm; width: 100%; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- ══════════════════════════════
         HEADER (NO <img> tag: XHTML-safe)
    ══════════════════════════════ -->
    <div class="header">
      <div
        class="logo-circle"
        style="background-image:url('{{SCHOOL_LOGO_URL}}');">
      </div>

      <div class="school-info">
        <div class="school-name">{{SCHOOL_NAME}}</div>
        <div class="school-address">{{SCHOOL_ADDRESS}}</div>
      </div>

      <div class="receipt-title-box">
        <div class="receipt-title">Fee Receipt</div>
        <div class="receipt-no-label">Receipt No.</div>
        <div class="receipt-no-value">{{RECEIPT_NO}}</div>
      </div>
    </div>

    <!-- ══════════════════════════════
         META INFO
    ══════════════════════════════ -->
    <div class="meta-section">
      <div class="meta-grid">
        <div class="meta-row">
          <span class="meta-label">Transaction ID</span>
          <span class="meta-sep">:</span>
          <span class="meta-value" style="font-size:10px;">{{TRANSACTION_ID}}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Transaction Date</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{TRANSACTION_DATE}}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Name of Student</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{STUDENT_NAME}}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Admission No</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{ADMISSION_NO}}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Parent Name</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{PARENT_NAME}}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Class</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{CLASS}}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Unique ID / Enrollment</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{ENROLLMENT_CODE}}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Section</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{SECTION}}</span>
        </div>

        <div class="meta-row">
          <span class="meta-label">Academic Year</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{ACADEMIC_YEAR}}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Payment Mode</span>
          <span class="meta-sep">:</span>
          <span class="meta-value">{{PAYMENT_MODE}}</span>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════
         FEE TABLE
         backend injects a full <table>...</table> into {{fee_table}}
    ══════════════════════════════ -->
    <div class="table-section">
      <div class="table-heading">Fee Details</div>
      <div class="table-wrapper">
        {{fee_table}}
      </div>

      <!-- TOTALS -->
      <div class="totals-section">
        <table class="totals-table">
          <tr>
            <td>Total Expected Fee:</td>
            <td>{{TOTAL_EXPECTED_FEE}}</td>
          </tr>
          <tr>
            <td>Total Discount:</td>
            <td>- {{TOTAL_DISCOUNT}}</td>
          </tr>
          <tr>
            <td>Total Paid (All Time):</td>
            <td>{{TOTAL_PAID_ALL_TIME}}</td>
          </tr>
          <tr class="balance-row">
            <td>Current Balance Due:</td>
            <td>{{CURRENT_BALANCE_DUE}}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- ══════════════════════════════
         PAYMENT INFO
    ══════════════════════════════ -->
    <div class="payment-section">
      <div class="pay-block">
        <div class="pay-label">Amount Paid Now</div>
        <div class="pay-value">{{AMOUNT_PAID_NOW}}</div>
      </div>
      <div class="pay-block">
        <div class="pay-label">Payment Method</div>
        <div class="pay-value">{{PAYMENT_METHOD}}</div>
      </div>
      <div class="pay-block">
        <div class="pay-label">Transaction Reference</div>
        <div class="pay-value-sm">{{TRANSACTION_REFERENCE}}</div>
      </div>
    </div>

    <!-- ══════════════════════════════
         FOOTER
    ══════════════════════════════ -->
    <div class="footer-section">
      <div class="remarks-block">
        <div class="lbl">Received by</div>
        <div class="val">{{RECEIVED_BY}}</div>

        <div class="lbl" style="margin-top:6px;">Remarks</div>
        <div class="val">{{REMARKS}}</div>
      </div>

      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-label">Cashier / Manager</div>
      </div>
    </div>

    <!-- ══════════════════════════════
         NOTE + BRAND
    ══════════════════════════════ -->
    <div class="note-section">
      <p class="note-text">
        <strong>Note:</strong> Parents are requested to preserve this receipt for future clarifications
        in respect of fee paid by you. Fee once paid will not be refunded or transferred.
      </p>
    </div>

    <div class="footer-brand">
      © {{SCHOOL_NAME}} &nbsp;|&nbsp; All rights reserved &nbsp;|&nbsp;
      This is a computer-generated document. No signature is required.
    </div>

  </div>
</body>
</html>
```

