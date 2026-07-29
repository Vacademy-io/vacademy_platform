# Runbook: Transactional email (OTP/verification) silently not delivered

**Applies to:** any app sending mail via **AWS SES** where some recipients don't receive it — most commonly a mailbox hosted on **the same domain the app sends from**, on a mail host that runs its own spam filtering (cPanel/Exim, Plesk, Zimbra, mail-in-a-box, most shared hosting, etc.).

**Provider-agnostic:** the examples below happen to use AWS SES + a cPanel host + a registrar's DNS panel, but the *pattern, diagnosis, and fixes are the same* for any DNS provider (GoDaddy, Cloudflare, Route 53, Namecheap, Tasjeel, …) and any receiving mail server that scores mail with SpamAssassin/rspamd or similar.

---

## 1. Problem

Transactional emails (OTP, email verification, password reset) sent by the app via SES **do not arrive** at certain recipients, while **other recipients receive them fine**. Typically:

- The failing recipient is a mailbox **on the same domain the app sends from** (e.g. app sends from `learn@example.com`, fails to `info@example.com`).
- **Silent failure:** no bounce, no error in the app, and nothing in the recipient's Spam/Junk folder. The app logs "sent," SES reports success.
- External recipients (Gmail, Outlook, corporate domains) get the mail normally.

This is a **deliverability** problem, not an application bug. The app is sending correctly; the mail is being dropped downstream.

---

## 2. Diagnosis

This class of failure is usually a **stack** of independent issues. Work through them in order.

### Step 0 — Rule out the trivial causes
- **SES suppression list:** a prior bounce/complaint can put a recipient on SES's account-level suppression list, after which SES silently drops mail to it.
  ```bash
  aws sesv2 get-suppressed-destination --email-address <recipient> --region <region>
  ```
  "does not exist on your suppression list" = clean.
- **Recipient mailbox exists and isn't over quota.**
- **SES account healthy / out of sandbox:** `aws sesv2 get-account --region <region>` → `ProductionAccessEnabled: true`, `SendingEnabled: true`.

### Step 1 — Find out what the receiving server actually did
Get the receiving mail server's delivery log for the message. On cPanel that's **Email → Track Delivery**; on other hosts it's the MTA log (`/var/log/exim_mainlog`, `/var/log/maillog`, Postfix logs, etc.).

Look for one of these outcomes:
- **Discarded to `/dev/null` / "Filtered" / marked spam and deleted** → a **spam-score-based discard**. This is the usual culprit for silent loss: the server *accepted* the mail at SMTP (so SES sees "success" and no bounce), then dropped it internally based on spam score. **Note the spam score.**
- **Rejected with a reason** (e.g. RBL listing, "no such user") → address that specific reason.
- **Delivered to a Junk/Spam folder** → the recipient just needs to check spam, or lower filtering.

If it was **discarded for spam score**, continue below to find *why the score is high*.

### Step 2 — Check whether the mail is authenticated (Root cause #1, most common)
Unauthenticated mail scores high everywhere and gets dropped by strict servers. Check all three:

- **SPF:** does the domain's SPF record authorize SES? Note: SPF is checked against the **envelope/Return-Path** domain. By default SES uses `<region>.amazonses.com` as the envelope, which passes its *own* SPF but is **not aligned** with your From domain unless you configure a custom MAIL FROM.
- **DKIM:** is SES actually **signing** for your domain? Verify the **domain** is a verified SES identity **with DKIM enabled** — not just the email address.
  ```bash
  aws sesv2 get-email-identity --email-identity <domain-or-address> --region <region>
  # look for DkimAttributes.SigningEnabled=true, Status=SUCCESS
  ```
- **DMARC:** is there a `_dmarc` TXT record? (Not required for delivery, but its absence + failing SPF/DKIM = higher score and no visibility.)

```bash
dig +short TXT <domain>            # SPF, DKIM domain keys, DMARC
dig +short MX <domain>             # where does mail for this domain actually go?
```

> ⚠️ **SES identity precedence:** DKIM is applied **per identity**. If you verified only the *email address* (`learn@example.com`) and not the *domain*, DKIM may be off. Verifying the **domain** with Easy DKIM makes every address on it inherit signing. If both a domain identity and an email-address identity exist, the **email-address identity's settings win** — so DKIM disabled on the address overrides DKIM enabled on the domain.

### Step 3 — If it's authenticated but STILL scores high, read the rule breakdown (Root cause #2)
Once DKIM/SPF pass, confirm on a **neutral filter**: send a real message to **https://www.mail-tester.com** and read its SpamAssassin breakdown. If mail-tester scores it low (e.g. −1) but your target server still scores it high, the difference is the **receiving server's own rules** — read its `X-Spam-Report` / `X-Spam-Status` header on a delivered copy.

Common high-scoring rules and their causes:
- **`GB_AWSTRACK_REDIR`, `KAM_MARKETINGBL_*`, `KAM_INFOUSMEBIZ`, `HTML_IMAGE_ONLY_*`** → **SES open/click tracking.** When a configuration set with open/click tracking is used, SES **rewrites every link** to its tracking domain (`<region>.awstrack.me`) and injects a **1×1 tracking pixel**. Servers running the KAM ruleset flag the tracking domain and the image-heavy body. This can add ~4–5 points and is *invisible* on Gmail/mail-tester (they don't run KAM).
- **`BAYES_*`** → the server's **Bayesian learning** thinks it's spam (see Step 4).
- **`HEADER_FROM_DIFFERENT_DOMAINS`** → envelope domain (`amazonses.com`) ≠ From domain. Fixed with a custom MAIL FROM subdomain (minor points).
- **`MIME_HTML_ONLY`** → no plain-text part. Add a `text/plain` alternative (minor).

### Step 4 — Beware Bayes self-poisoning (self-inflicted)
On servers with Bayesian auto-learning, **every message that gets filtered trains the filter to treat similar messages as spam.** If you repeatedly test-send to the failing mailbox and each one is filtered, the score **climbs with each test** (e.g. 5.2 → 6.7 → 7.2 → 8.8). **Stop testing to the failing mailbox during diagnosis** — use mail-tester (which never poisons your server's Bayes) instead.

### Two infrastructure traps to watch for
- **Multiple DNS panels / only one is authoritative.** Some providers/registrars expose **two DNS interfaces** (e.g. a billing/registrar panel *and* the hosting control panel's zone editor), and only one actually feeds the live nameservers. Records added in the wrong one **never propagate**. Verify against the **authoritative nameservers**:
  ```bash
  dig +short SOA <domain> @<authoritative-ns>     # SOA serial should bump after an edit
  dig +short CNAME <record> @<authoritative-ns>   # the record should resolve here
  ```
  If the SOA serial doesn't change and the record doesn't resolve at the nameserver, you edited the wrong panel.
- **SES open/click tracking can't be disabled per-configuration-set.** Removing the OPEN/CLICK *event-destination types* does **not** stop the link rewriting/pixel (verified). SES rewrites whenever *any* configuration set is attached to the send. The only ways to remove the tracking domain: send with **no configuration set at all**, or configure a **custom tracking (redirect) domain**.

---

## 3. Solution

### A. Fix authentication (the real, universal fix — do this first)
This lowers the score for **all** recipients and is correct regardless of the receiving server.

1. **Enable Easy DKIM for the domain in SES:**
   ```bash
   aws sesv2 create-email-identity --email-identity <domain> --region <region>
   # returns DkimAttributes.Tokens = 3 tokens
   ```
   Add the **3 CNAME records** to DNS (see trap above — use the **authoritative** panel):
   ```
   <token1>._domainkey.<domain>   CNAME   <token1>.dkim.amazonses.com
   <token2>._domainkey.<domain>   CNAME   <token2>.dkim.amazonses.com
   <token3>._domainkey.<domain>   CNAME   <token3>.dkim.amazonses.com
   ```
   Wait for SES to auto-verify (`VerifiedForSendingStatus: true`). DKIM now signs all mail from the domain, aligned.

2. **SPF:** ensure the domain's SPF authorizes SES — add `include:amazonses.com` to the existing `v=spf1 …` record. (Strictly only affects the score if the envelope is aligned via a custom MAIL FROM, but it's correct hygiene.)

3. **DMARC:** add a `_dmarc` TXT record:
   ```
   _dmarc.<domain>   TXT   "v=DMARC1; p=none; rua=mailto:postmaster@<domain>; fo=1"
   ```

4. **Verify** with mail-tester.com → confirm **DKIM=pass, SPF=pass, DMARC=pass** and a low SpamAssassin score.

### B. If the failing recipient is on YOUR OWN mail server (same domain), and it still filters
When the recipient mailbox is hosted on your own strict-filtering server, authentication alone may not be enough (KAM rules on SES tracking, and/or poisoned Bayes). The **correct, permanent** fix is to tell your own server to trust your own authenticated sender:

- **Add a DKIM-gated allowlist** for your sender. On cPanel: **Email → Spam Filters → Additional Configurations → `whitelist_from_dkim`** → add `<your-sender>@<domain>`. Equivalent on other MTAs: SpamAssassin `whitelist_from_dkim`, rspamd allowlist, etc.
  - Use the **DKIM-gated** form (`whitelist_from_dkim`), **not** a plain from-allowlist — it trusts the sender **only when DKIM validates**, so it's **spoof-proof**.
  - Effect: forces the score deeply negative → delivered to inbox → and **stops the Bayes poisoning** (delivered mail is no longer learned as spam), so the filter self-heals.
- **Ask the mail host to reset the account's Bayes database** if it was poisoned by repeated failed tests — this instantly undoes the self-inflicted part (often the only piece genuinely outside your control on shared hosting).

### C. Optional hardening
- **Custom MAIL FROM domain** in SES (e.g. `mail.<domain>`) → aligns SPF with your From domain, removes `HEADER_FROM_DIFFERENT_DOMAINS`.
- **Custom open/click tracking domain** (or disable tracking for transactional mail) → removes the `awstrack.me` links/pixel that trip KAM rules. For OTP/verification mail, tracking has no value and hurts deliverability. Note: to fully remove tracking you must send **without a configuration set** (a code change), since it can't be toggled off per-config-set.
- **Add a `text/plain` alternative** part to HTML-only transactional emails (removes `MIME_HTML_ONLY`).

---

## 4. Quick playbook (hand this to an assistant/agent)

> "Emails from our app (AWS SES) aren't reaching `<mailbox>@<ourdomain>`, but other recipients work. Diagnose and fix."

1. **Receiving-server log** (cPanel Track Delivery / MTA log): is it discarded for **spam score**, rejected, or junked? Note the score.
2. **SES auth:** is the **domain** DKIM-verified? SPF include SES? DMARC present? (`aws sesv2 get-email-identity`, `dig TXT`)
3. **Fix auth:** Easy DKIM (3 CNAMEs) + SPF `include:amazonses.com` + DMARC `p=none`. ⚠️ Edit DNS in the **authoritative** panel; confirm with `dig … @<nameserver>` that the SOA bumps and records resolve.
4. **Verify** on **mail-tester.com** (real send) → read the SpamAssassin breakdown.
5. **If a mailbox on your own strict server still filters it:** read the delivered mail's **`X-Spam-Report`** header. `KAM_*`/`GB_AWSTRACK_REDIR` = SES tracking; `BAYES_*` = Bayes. Add **`whitelist_from_dkim <sender>`**; ask the host to reset Bayes if poisoned.
6. **Don't repeatedly test to the failing mailbox** — it poisons Bayes. Use mail-tester.

**Handy commands**
```bash
aws sesv2 get-account --region <region>
aws sesv2 get-email-identity --email-identity <domain-or-address> --region <region>
aws sesv2 create-email-identity --email-identity <domain> --region <region>      # Easy DKIM
aws sesv2 get-suppressed-destination --email-address <recipient> --region <region>
dig +short SOA <domain> @<authoritative-ns>
dig +short CNAME <token>._domainkey.<domain> @<authoritative-ns>
dig +short MX <domain>
```

---

## 5. Key takeaways
- **Silent loss to a same-domain mailbox = the receiving server discarded it for spam score.** It's not a bounce; the app and SES both see "success."
- **Fix authentication first** (domain DKIM + SPF + DMARC) — the real, universal fix.
- **For a mailbox on your own strict server, the correct permanent fix is a DKIM-gated allowlist for your authenticated sender** — not a hack.
- **Watch out for:** multiple DNS panels (edit the authoritative one), SES per-identity DKIM precedence, SES `awstrack.me` tracking tripping KAM rules, and **Bayes poisoning from repeated failed tests**.
