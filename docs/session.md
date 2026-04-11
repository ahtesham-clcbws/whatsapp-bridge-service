# Remote Session Management (v3.7.0)

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
- **MFA Protection**: In v3.7.0, all session management functions via the dashboard are protected by **WhatsApp-Native MFA**. Attempts to logout or fetch QR strings require a valid OTP.

### Remote Logout
`POST /session/logout`
- Triggers a clean social logout.
- **Wipes the local `auth/` directory** for your protection.
- Accessible via the **"Security"** tab in the Admin Panel.

---

## 🛡️ Persistence Engine
Starting with **v3.2.0**, your session state and authentication metadata are further protected by the **Invincible Sessions** layer. This uses the `system.db` SQLite database to track session heartbeat and prevents "Ghost Connections" after a server reboot.

---

> [!CAUTION]
> If you manually delete files within the `auth/` directory without using the `/logout` endpoint, the bridge may hang or show "Conflict" errors. Always use the API or the PM2 restart command.
