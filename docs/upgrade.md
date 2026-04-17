# 🆙 Upgrade Guide (v3.8.0)

Keeping your **WhatsApp Bridge Service** up to date ensures you have the latest security patches, performance optimizations, and features like the v3.8.0 Analytics Dashboard.

---

## 🛠️ Option 1: The Automated Script (Recommended)

Beginning with v3.8.0, we provide a hardened upgrade script that handles backups, dependency refreshes, and environment variable synchronization automatically.

### Running the Script:
1.  **Connect** to your server via SSH.
2.  **Navigate** to the bridge directory.
3.  **Execute**:
    ```bash
    chmod +x scripts/upgrade.sh
    ./scripts/upgrade.sh
    ```

### What the script does:
*   **Safety Backup**: Creates a `.tar.gz` archive of your current files (excluding `node_modules`).
*   **Git Sync**: Pulls the latest code from the `master` branch.
*   **Env Sync**: Automatically detects missing v3.8.0 keys (like `API_KEY` and `SESSION_SECRET`) and appends them to your `.env` with secure random values.
*   **Dependency Refresh**: Runs `npm install` to update core libraries.
*   **Idempotent Restart**: Restarts the service via PM2.

---

## 🔧 Option 2: The Manual Upgrade

If you prefer full control or are using a custom Git workflow, follow these 4 critical steps:

### 1. Pull Latest Code
```bash
git fetch --all
git reset --hard origin/master
```

### 2. Refresh Dependencies
New features in v3.8.0 require `pino`, `sqlite3`, and `multer`.
```bash
npm install --omit=dev
```

### 3. Update Environment Variables
Open your `.env` file and ensure the following keys are present:
*   `API_KEY`: Your static security key.
*   `SESSION_SECRET`: A random string for dashboard sessions.
*   `WHATSAPP_AUTH_DIR`: Typically set to `./auth`.
*   `MAX_RETRIES`: Reconnection limit (e.g., 3).

### 4. Cleanup Legacy Files
In v3.8.0, the monolithic `server.js` was moved to `src/server.js`. 
- **Action**: Rename or delete any `server.js` or `database.js` files remaining in your root directory to avoid naming conflicts with the new modular structure.
- **Entry Point**: Ensure your PM2 or startup script points to `src/index.js`.

---

## 🖥️ Option 3: Remote Update (Dashboard)

If you have already upgraded to **v3.1.0+**, you can synchronize your repository directly from the Admin Panel:
1.  Navigate to the **"Security"** tab in the Dashboard.
2.  Click **"Sync Repository (Git Pull)"**.
3.  Click **"Soft Reboot"** to apply changes.

---

> [!CAUTION]
> **Persistence Warning**: Always ensure your `auth/` directory is untouched during upgrades. This folder contains your active WhatsApp link. If you lose it, you will need to re-scan the QR code.
