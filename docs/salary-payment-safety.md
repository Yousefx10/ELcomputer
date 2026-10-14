# Salary-payment retry safety

H2 corrects Treasury **salary accounting records**. Recording a salary creates an outflow in `treasury_transactions`; it does not initiate a bank transfer, calculate payroll, enforce one payment per period, or settle an external ERP account. Existing amounts are rounded to two decimals and periods normalize to their calendar month. Supplier payments and customer receipts retain their existing behavior.

Use application code with additive migration **81**, `20261014230000_salary_payment_commands.sql`. Migrations1–80 and historical installation certificates remain unchanged. The old unkeyed salary RPC loses all browser/service caller grants; old clients fail closed and must refresh. The replacement server route is `POST /api/admin-treasury/salary-payment`.

## Command and transaction

The existing Treasury form saves one UUID and its original payment details in administrator-scoped **tab session storage before sending**. Double-clicks are blocked synchronously. Ordinary retry, page navigation and reload reuse that command. Pending details are locked. Storage failure blocks submission. A successful response displays the confirmed result and offers **Record another salary payment**; that explicit action clears the old local command, and the next submission creates a distinct UUID. Restored commands are checked again rather than trusting a browser-stored success flag.

The server validates the exact bounded payload, calendar dates and UUIDs, verifies the current native Auth token, and requires active `treasury.edit` access through the existing parent-permission rules. It supplies the verified administrator ID; request-supplied actor, receipt, audit or approval fields are rejected. Responses are private/no-store.

Only `service_role` can call the replacement security-definer RPC. The transaction rechecks and SHARE-locks the active administrator and Treasury view/edit permissions. It takes the existing shared System Reset exclusion before authority and command locks, serializes the command UUID, rechecks its receipt, and retains the built-in ERP/employee guards. No RLS policy or HR access is broadened. Browser roles cannot call either salary write RPC or read/write the receipt table.

One PostgreSQL transaction inserts the treasury entry, its `treasury.salary_payment.created` audit, and the private durable receipt. Any failure rolls all three back. The receipt primary key and command lock protect identical concurrent submissions. Replays return the original command/transaction/audit IDs without another entry or audit. Successful receipts survive application restarts. They contain only IDs, a SHA-256 payload hash, commit time and a reset-retirement flag; no salary amount, employee name, reference, notes or source token is retained there.

The fingerprint binds employee, original numeric amount, submitted period, payment date, trimmed reference and trimmed notes. Equivalent numeric notation and existing blank/trim behavior normalize consistently. Reusing the UUID with different material details is a conflict. Another administrator cannot replay its receipt, even with Treasury edit access. Separate authorized commands may legitimately record the same employee, period and amount.

A timeout, dropped response, lock timeout or database error shows **Payment result unknown. Retry the same payment.** It never creates an alternate command automatically. Auth/revocation checks also run on every retry. The browser retains unresolved commands and makes no claim that a rejected/unknown HTTP response proves no commit. Closing the tab clears its local session storage; review Treasury history before deliberately recording another payment when the original command is unavailable. Database receipts remain durable. Cross-device recovery and elapsed hosted Auth lifecycle acceptance are outside this task.

Salary audits are protected from ordinary fifty-row admin-log trimming, and the generic log API rejects that reserved action key. Full Reset still clears those audits under its existing policy.

## Reset and retention

All eight scopes explicitly recognize `private.salary_payment_commands`. Products, Orders, Documents, Media, Store Content and Analytics preserve ledger history and live receipts. Commerce and Full clear treasury transactions under the existing allowlist and retire all salary receipts atomically through the guarded pre-erasure manifest hook. Full also clears employees and salary audits. The minimal receipts survive both financial scopes permanently.

An old command returns a reset conflict and cannot resurrect a cleared entry, including after the employee UUID is recreated. A new explicit payment with a new UUID can post after reinitialization. Reset and in-flight commands share the established exclusion lock; no receipt FK blocks intended erasure. No generic table coverage is relaxed.

Protection applies to new keyed commands. A lost pre-migration unkeyed acknowledgement has no recoverable command receipt; review Treasury history before approving a new entry. No retroactive receipts are fabricated.

## Historical reconciliation

Migration81 does not delete, merge, rewrite or reverse any existing entry. Similar employee/period/amount/reference fields are **candidates for review**, not proof of duplication. A separately authorized reconciliation must preserve the original IDs, compare administrator actions with payslips and actual transfer/cash evidence, identify the intended legitimate payments, and have the merchant approve any supported accounting correction with an audit trail. This task authorizes no reconciliation writes or automatic reversals.

## Validation boundary

Automated coverage uses real disposable PostgreSQL17, Auth, Storage and PostgREST, with the Nuxt HTTP shell explicitly bundled as a fixture. Separate acceptance uses the actual production Nuxt bundle and Chrome Treasury form, native acknowledgement loss, twelve concurrent requests, rollback failures, real process restart, protected audits and Full Reset/post-reset recovery. Correctly signed expired JWTs use only the laboratory signing key and actual native Auth validation; this is not an elapsed hosted idle/refresh lifecycle certificate.

Historical release79 publisher regressions use exact approved `a811b05fe5daa0739b913f1bd4847f6adc26da21` source and a preserved compiled package supplied as `RELEASE79_REVIEW_OUTPUT`. Current application fixtures use `PUBLICATION_REVIEW_OUTPUT` and assert all matching application inputs. The installer/certificate source guards remain unchanged.

The composed native schema uses the existing certified70 baseline plus ordered application SQL through81 and a native first-owner bootstrap. It deliberately has no installer CLI migration ledger and is **not installer recertification**. The unchanged release-79-v1 remains historical; schema81 requires separately authorized recertification after the remaining Gate2 blockers. Production, providers and H3 remain untouched. Final results are recorded in the H2 evidence report.
