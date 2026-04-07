# Remote Session Management

The service is designed to be fully manageable from your external dashboard or admin panel.

## 📲 Linking a Device

To link your WhatsApp account without terminal access, use the following flow:

### 1. Check Status
`GET /session/status`
- Confirm if the bot is already online.

### 2. Pairing via QR Code
`GET /session/qr`
- Returns the latest QR string. Use a JavaScript library in your dashboard to render this as an image.

### 3. Pairing via 8-Digit Code (Pairing Code)
`POST /session/pairing-code`
- **Body**: `{"number": "923123456789"}`
- Enter the returned 8-digit code on your phone in **Linked Devices > Link with Phone Number**.

---

## 🔌 Disconnecting

### Remote Logout
`POST /session/logout`
- Triggers `sock.logout()`.
- Wipes the local credentials directory (`auth/`) for safety.

---

## 🛠️ Session Persistence
The service uses **Multi-File Auth State**. Once a device is linked, it will reconnect automatically even after a server restart unless explicitly logged out via the API.
