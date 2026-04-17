# Remote Session Management (v3.8.4)

The service is designed to be fully manageable from the **Integrated Admin Dashboard** or via external API integrations.

---

## 📲 Linking a Device

To link your WhatsApp account, use the **Dashboard Pairing View** (recommended) or the direct API flow:

### 1. Check Status
`GET /session/status`
- Confirm if the bridge is already online.

### 2. Pairing via QR Code
`GET /session/qr`
- Returns the latest QR string for rendering.
- **Dashboard**: Visit `/dashboard/` to scan the live QR code directly in your browser.

### 3. Pairing via 8-Digit Code (Remote)
`POST /session/pairing-code`
- **Body**: `{"number": "910000000000"}`
- Enter the returned 8-digit code on your phone in **Linked Devices > Link with Phone Number**.

---

## 🔒 Security & Persistence

### The `auth/` Directory
All session credentials are encrypted and stored in the root `auth/` directory. 
- **Persistence**: Once linked, the bridge will auto-reconnect on restart.
- **MFA Protection**: In v3.8.4, all session management functions via the dashboard are protected by **WhatsApp-Native MFA**. Attempts to logout or fetch QR strings require a valid OTP.

---

## 🛠️ Technical Endpoint Reference

All endpoints below reside under the `/session` prefix and require the `x-admin-token` header (except `/status`).

### 1. `GET /session/status`
Check if the WhatsApp socket is currently active.
**Response**: `{"connected": true}`

### 2. `GET /session/qr`
Retrieve the latest base64 QR string for pairing.
**Response**: `{"qr": "2@..."}`

### 3. `POST /session/pairing-code`
Request an 8-digit pairing code for phone-number-based linking.
**Payload**: `{"number": "910000000000"}`
**Response**: `{"code": "ABC123XY"}`

### 4. `GET /session/groups`
Retrieve a list of all participating groups for the current session.
**Response**: `[{ "id": "120363...@g.us", "subject": "Home", "participants": 5 }]`

### 5. `POST /session/logout`
Terminate the current session and **wipe the local auth directory**.
**Response**: `{"status": "success", "message": "Session cleared."}`

---

## 🛡️ Persistence Engine
Starting with **v3.2.0**, your session state and authentication metadata are further protected by the **Invincible Sessions** layer. This uses the `system.db` SQLite database to track session heartbeat and prevents "Ghost Connections" after a server reboot.

---

> [!CAUTION]
> If you manually delete files within the `auth/` directory without using the `/logout` endpoint, the bridge may hang or show "Conflict" errors. Always use the API or the PM2 restart command.
