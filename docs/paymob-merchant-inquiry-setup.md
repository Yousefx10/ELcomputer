# Paymob Merchant Inquiry: secure credential preparation

Status: **NOT CONFIGURED. No production integration or provider call performed.**
Owner confirmed this on 28 October 2026. Existing LIVE Secret/Public keys work
for payment initiation and remain unchanged.

## Identify the existing credential

1. Sign in yourself to the existing Paymob Accept merchant Dashboard.
2. Check that this is the merchant account used by the store.
3. Open **Settings → Developers → API Keys**. Paymob describes this as API Keys
   under the Developers section of Settings.
4. Choose the intended Live view to avoid confusing integration context.
5. Select **View beside API Key**. This is separate from Secret Key, Public Key
   and HMAC Secret. Copy only that existing API Key to private storage.

These are Paymob's documented credential steps, checked28October2026:
[Getting Integration Credentials](https://developers.paymob.com/paymob-docs/need-help/setup-guides/getting-integration-credentials).
The guide explicitly says the **API Key is shared across Test/Live**, while
Secret/Public keys and integration IDs are mode-specific. Do not assume an
Inquiry token identifies Live records: validate each response's mode/integration.
This specific guide supersedes conflicting mode assumptions in older references.

This preparation requires viewing an existing key, not regenerating or replacing
any working credential. Leave Secret/Public/HMAC, integration callbacks, payment
methods and checkout settings unchanged. No Apply/Save operation is needed just
to view/copy the existing API Key.

If API Key/View is unavailable, check account permissions with the merchant
owner. Paymob lists Owner and Developer roles with credential access. Ask the
merchant's Paymob support/account manager about the missing API Key rather than
rotating live keys or inventing another authentication method.
[Dashboard roles and API Keys](https://developers.paymob.com/paymob-docs/getting-started/new-dashboard).

## Store the value privately

Use an existing secret manager, or a private local file outside Git, source,
build output and browser public configuration. For a local file, use a directory
accessible only to its owner (0700) and file0600. Enter it through a local editor;
keep the value out of shell arguments/history, chat, screenshots and logs.
Share **only the file path or secret-manager reference** in this conversation.
No production environment file or service needs changing at this stage.

The merchant API Key is not assumed to be an intrinsically read-only credential.
Future inquiry code must enforce a narrow outbound request allowlist even if the
credential can authorize other operations. Never put it in a Nuxt public setting,
customer response, client SDK, analytics payload or build-time environment.

## What happens after a secure reference is available

First prepare a bounded, read-only qualification for one specifically selected
existing provider order. Identify the regional endpoint and merchant context;
authenticate in memory, retrieve its complete history and return only sanitized
findings. No charge, intention creation, refund, void, capture or order update.
No such qualification has run, and no historical order is selected automatically.

Paymob documents separate API-key authentication for an ephemeral token:
[Authentication Request](https://developers.paymob.com/paymob-docs/developers/authentication-request-generate-auth-token-1).
Authenticating is not proof of a payment outcome. The initial qualification should
inspect evidence without changing local orders or settling payments.

After merchant response/terminality contracts are qualified, implement and test
durable reconciliation and recovery locally. Prepare a fresh explicit deployment
approval only for the exact completed artifact and its schema/runtime changes.
Retrieving/storing the key does not authorize a deployment, feature activation,
historical retry or provider write. No approval seal exists for that future work.
