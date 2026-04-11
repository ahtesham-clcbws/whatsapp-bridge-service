<div align="center">
  <img src="./logo.png" alt="WhatsApp Bridge Service Logo" width="200">
</div>

# 🚀 WhatsApp Bridge Service (v3.7.0)

A generic, headless, and modular **WhatsApp-to-HTTP Bridge** designed for reliable automated messaging. Built with Node.js and the Baileys library, this service provides a high-level API to dispatch text and media messages to individuals and groups with enterprise-grade stability.

---

## ✨ Current Feature Suite (v3.7.0)

- `[x]` **Interactive Admin Dashboard**: Lightweight, mobile-first UI for instance management, log browsing, and orchestrating messages securely.
- `[x]` **Hardware Telemetry Console**: Real-time monitoring of CPU Load, Memory Usage, and Server Uptime.
- `[x]` **WhatsApp Native MFA**: Password-less security using dynamic OTPs sent to your own WhatsApp account.
- `[x]` **Centralized Telemetry Engine**: Multilevel datewise logging (Info/Warn/Error/Debug) with built-in zero-noise console modes and real-time frontend viewers.
- `[x]` **Intelligent Queue Management**: Stateful database queue throttling to mimic human typing behaviors and prevent account suspensions.
- `[x]` **Group & Individual Support**: Seamlessly message phone numbers or Group JIDs.
- `[x]` **Multipart Media API**: High-performance endpoint for text, images, and documents.
- `[x]` **Webhook Engine**: Real-time delivery receipts (Sent → Delivered → Read) and incoming message callbacks.
- `[x]` **Exponential Backoff Retry**: Automated recovery for temporary socket failures (v2.3.0).
- `[x]` **Weekly SQLite Audit Logs**: High-efficiency database archiving with auto-migrations.
- `[x]` **Premium Analytics (7D/30D/90D)**: Dynamic area-chart visualization with historical range scaling (v3.7).
- `[x]` **Administrative Data Purging**: Granular deletion of file-based logs and individual audit records (v3.7).

---

## 🗺️ Future Roadmap

### Phase 4: Enterprise Safety (v4.0)
- **Intelligent Throttling 2.0**: Stateful database queue with randomized human-like typing delays to prevent account suspensions during high-volume periods.
- **Historical SQLite Explorer**: Executive search interface to search, filter, and export records across all historical weekly databases (v4.0).

### Phase 5: Governance (v5.0)
- **Granular RBAC**: Multi-role support (Admin, Viewer, Dispatcher) with permission-based auditing.
- **Dynamic Template Variables**: Integration of `{{name}}` and `{{date}}` parsing within the Vault, strictly tied to the Contact Management suite.
- **Contact Synchronization Hub**: Optional synchronization of WhatsApp contacts to the local database for safe bulk personalization (Configurable via `SYNC_CONTACTS=true` in `.env`).

### Phase 6: Scaling & Reliability (v6.0)
- **Enterprise Core (Multi-Instance)**: Management of multiple independent WhatsApp numbers from a single core service.
- **Meta Official API Channel**: Direct integration with the official Meta WhatsApp Business API as a fail-safe/official channel for high-risk operations to ensure 0% ban risk.

---

## 🛠️ Documentation & Vision

For full technical details, **[The Vision](https://ahtesham-clcbws.github.io/whatsapp-bridge-service/vision)**, authentication guides, and SDK examples, visit our documentation portal:


👉 **[Launch Documentation Portal](https://ahtesham-clcbws.github.io/whatsapp-bridge-service/)**

---

## 📜 License

Distributed under the **MIT License**.

---

### 👨‍💻 Developed by [Ahtesham](https://github.com/ahtesham-clcbws)
*(Built in collaboration with Antigravity AI)*
*Building modular tools for the modern developer.*
