# Packing camera setup

## Connect the camera

1. Connect a USB webcam to the packing computer.
2. Place it above or beside the packing table.
3. Keep products, labels, and the box visible.
4. Open **Dashboard → Orders → Confirm Orders**.
5. Select **Start session**.
6. Select **Connect camera**.
7. Allow camera access in the browser.
8. Check the live preview before choosing an order.

The page requires HTTPS, except on `localhost`.

## Pack an order

1. Choose the required order from the queue.
2. Confirm the red **Recording** status appears.
3. Show every packed product to the camera.
4. Scan every required item.
5. Seal the box while it remains visible.
6. Select **Save Video & Complete**.
7. Wait for upload and verification.
8. Print the order documents.

The next order is never selected automatically.

## Finish work

Complete or release any open order first.

Then select **Close session**.

This stops the camera and marks the operator inactive.

## Video storage

- Videos are stored in a private Supabase bucket.
- Each filename uses its order number.
- Supported formats are WebM, MP4, and QuickTime.
- The maximum video size is 500 MB.
- Only dashboard users with order access can download videos.
- Order completion fails without a verified video.

## Recommended camera settings

- Use 1080p when the camera supports it.
- Keep the packing table brightly lit.
- Mount the camera securely.
- Avoid showing unrelated customer information.
- Use Chrome or Edge for reliable WebM recording.

If the camera disconnects, release the order and restart it.
