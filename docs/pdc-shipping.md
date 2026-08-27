# PDC shipping

The integration is inactive by default. No PDC request runs unless every activation gate is enabled.

## Launch checklist

1. Apply the two `2026082813*` migrations.
2. Set `SHIPPING_CREDENTIALS_ENCRYPTION_KEY` and `SHIPPING_WORKER_SECRET`.
3. Save the token, pickup address, and webhook secret in the dashboard.
4. Register `https://<store-domain>/api/webhooks/pdc` with PDC.
5. Set `PDC_LIVE_REQUESTS_ENABLED=true`.
6. Enable live requests in the PDC dashboard settings.
7. Schedule `POST /api/internal/shipping/process` with `X-Shipping-Worker-Secret`.

Eligible orders must be paid, review-free or approved, and fully addressed. Missing data blocks the job without contacting PDC.
