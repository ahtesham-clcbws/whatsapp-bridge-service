# Remote Session Management

The service is designed to be fully manageable from your external dashboard or admin panel.

---

## 📲 Linking a Device

To link your WhatsApp account without terminal access, use the following flow:

### 1. Check Status
`GET /session/status`
- Confirm if the bridge is already online.

### 2. Pairing via QR Code
`GET /session/qr`
- Returns the latest QR string. Use a JavaScript library in your dashboard to render this as an image.

### 3. Pairing via 8-Digit Code
`POST /session/pairing-code`
- **Body**: `{"number": "910000000000"}`
- Enter the returned 8-digit code on your phone in **Linked Devices > Link with Phone Number**.

---

## 🔒 Security & Persistence

### The `auth/` Directory
All session credentials are stored in the root `auth/` directory. 
- **Persistence**: Once linked, the bridge will auto-reconnect on restart using these files.
- **Safety**: **NEVER** share or commit this folder to Git. It contains the raw session keys used to control your WhatsApp account.
- **Backups**: We recommend backing up this folder periodically if you are on unstable hardware.

### Remote Logout
`POST /session/logout`
- Triggers a clean social logout.
- **Wipes the local `auth/` directory** for your protection.

---

## 🖼️ v3.0 Preview: DashLink
In the upcoming **v3.0.0 Admin Dashboard**, these manual steps (copying QR strings, etc.) will be replaced by an interactive "Pairing View." You will be able to see the QR code live in your browser and manage your session with a single click.

---

> [!CAUTION]
> If you manually delete files within the `auth/` directory without using the `/logout` endpoint, the bridge may hang or show "Conflict" errors. Always use the API or the PM2 restart command.
