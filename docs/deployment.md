# Deployment & 24/7 Operation

To make the **WhatsApp Bridge Service** truly useful, it needs to run 24/7. This guide covers how to achieve this on local hardware, VPS, and cloud platforms.

---

## 🏠 Local Hardware (Home Server / PC)

If you are running the service on a local machine but want it accessible from your production server (e.g., Laravel on AWS), follow these steps.

### 1. Persistent Process (PM2)
Use **PM2** to ensuring the Node.js process auto-restarts on crashes or system reboots.

```bash
# Install PM2 globally
npm install -g pm2

# Start the service
pm2 start src/index.js --name "whatsapp-bridge"

# Save the process list for auto-boot
pm2 save
pm2 startup
```

### 2. Exposing to Internet (Cloudflare Tunnel)
Instead of risky port-forwarding, use a **Cloudflare Tunnel**. This creates a secure, encrypted bridge between your local machine and a public domain.

1.  **Install `cloudflared`** on your machine.
2.  **Create a Tunnel**:
    ```bash
    cloudflared tunnel create wa-bridge
    ```
3.  **Route Traffic**:
    ```bash
    cloudflared tunnel route dns wa-bridge bridge.yourdomain.com
    ```
4.  **Run the Tunnel**:
    ```bash
    cloudflared tunnel run --url http://localhost:3001 wa-bridge
    ```
*Your service is now securely accessible at `https://bridge.yourdomain.com`!*

---

## ☁️ Low-Cost Cloud Hosting

### 1. Railway.app (Recommended)
- **Cost**: Free tier available / Pay-as-you-go.
- **Setup**: Connect your GitHub repo. Railway will auto-detect the `package.json` and start the service.
- **Persistence**: Add a "Volume" for the `/auth` folder to ensure your WhatsApp session isn't lost during deployments.

### 2. Render.com
- **Type**: Web Service.
- **Setup**: Link repository. Render provides a public HTTPS URL automatically.
- **Caveat**: The free tier "sleeps" after inactivity. Upgrade to the $7/mo plan for 24/7 operation.

### 3. Linux VPS (DigitalOcean / Hetzner / Linode)
- **Cost**: ~$4-5/mo.
- **Setup**:
    1.  Install Node.js & Git.
    2.  Clone repo and `npm install`.
    3.  Use **PM2** (as shown above) to keep it running.
    4.  (Optional) Install **Nginx** as a reverse proxy for SSL.

---

## 🛡️ Security Best Practices
- **Firewall**: If using a VPS, only allow traffic on port `3001` from your production server's IP.
- **Environment Variables**: Never commit your `.env` file to GitHub. Use the platform's "Environment Variables" settings instead.
- **Session Backups**: Periodically back up the `auth/` directory if you are not using persistent volumes on cloud platforms.

---

> [!TIP]
> **Scaling?** For high-volume environments, consider using a **Redis-based** session adapter (custom implementation) to share the WhatsApp state across multiple bridge instances.
