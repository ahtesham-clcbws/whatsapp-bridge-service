# 🚀 WhatsApp Bridge Service (v1.3.0)

A generic, headless, and modular **WhatsApp-to-HTTP Bridge** designed for reliable automated messaging. Built with Node.js and the Baileys library, this service provides a high-level API to dispatch text and media messages with enterprise-grade stability.

---

## ✨ Key Features & Progress

- `[x]` **Multipart Media API**: High-performance endpoint for text, images, and documents.
- `[x]` **Weekly SQLite Audit Logs**: High-efficiency database archiving.
- `[x]` **Weekly SQLite Rotation**: Automated database archiving for long-term health.
- `[x]` **API-based Log Access**: Secured `GET /logs` endpoint for history.
- `[x]` **Universal SDK Support**: 11+ language examples (PHP, Laravel, React, etc.).y media processing.

---

## 🛠️ Performance & Stability

This service implements a **Weekly SQLite Rotation** strategy to ensure long-term reliability.
- **Main Audit Log**: All dispatches are recorded in `logs/audit_YYYY-WXX.db`.
- **Automatic Archive**: Every week, a new database file is created, keeping your active logs lightweight and your queries lightning fast.

---

## 🗺️ Future Roadmap

- `[ ]` **Webhook Callbacks**: Forward incoming messages and delivery receipts to your backend.
- `[ ]` **Group Messaging Support**: Dedicated support for WhatsApp Group JIDs.
- `[ ]` **Message Retry Queue**: Automatic retries for failed dispatches during socket drops.
- `[ ]` **Multi-Account Instances**: Run multiple WhatsApp sessions from a single bridge.
- `[ ]` **Template Engine**: Native variable replacement for personalized bulk messaging.
- `[ ]` **Advanced Dashboard**: Admin UI for viewing logs and managing sessions.

---

## ☁️ Deployment Guide

Check our detailed [Deployment Guide](./docs/deployment.md) for step-by-step setup on:
- **Oracle Cloud** (Always Free ARM)
- **Hostinger VPS** (KVM Optimized)
- **Railway.app** (Managed Persistence)
- **Render.com** (Simplified PaaS)

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

### 👨‍💻 Developed by [Ahtesham](https://github.com/ahtesham-clcbws)
*Building modular tools for the modern developer.*
