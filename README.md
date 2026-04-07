# 🚀 WhatsApp Bridge Service

A generic, headless, and modular **WhatsApp-to-HTTP Bridge** designed for reliable automated messaging. Built with Node.js and the Baileys library, this service provides a high-level API to dispatch text and media messages with enterprise-grade stability.

---

## ✨ Key Features

- **Multi-Tech Support**: Ready-to-use examples for PHP, Laravel, React, Next.js, Python, Go, Java, and more.
- **Multipart Media API**: Single endpoint for sending text, images, and documents.
- **SQLite Audit Logs**: Weekly-rotated database archives for long-term audit trails without performance hits.
- **Session Management**: Supports both QR Code and 8-digit Pairing Code for remote linking.
- **Anti-Ban Protection**: Built-in randomized delays and human-like dispatch sequencing.
- **Zero Disk Latency**: In-memory media processing for high-speed delivery.

---

## 🛠️ Performance & Stability

This service implements a **Weekly SQLite Rotation** strategy. 
- **Main Audit Log**: All dispatches are recorded in `logs/audit_YYYY-WXX.db`.
- **Automatic Archive**: At the start of each week, a new database file is created, keeping your active logs lightweight and your queries lightning fast.

---

## ☁️ Deployment Guide

Looking to host your bridge 24/7? Check out our supported platforms:

| Platform | Type | Recommended For |
| :--- | :--- | :--- |
| **Oracle Cloud** | Always Free | Professional 24/7 Hosting ($0/mo) |
| **Hostinger VPS** | Low Cost | KVM VPS with unmatched Node.js stability |
| **Railway.app** | Managed | Easiest setup with one-click GitHub deployment |
| **Render.com** | Managed | Great for rapid prototyping |

> [!TIP]
> Check our detailed [Deployment Guide](./docs/deployment.md) for step-by-step setup and affiliate sign-up links.

---

## 🗺️ Roadmap (Future Features)

- [ ] **Webhook Callbacks**: Forward incoming messages and delivery receipts to your backend.
- [ ] **Group Messaging**: High-level support for WhatsApp Group JIDs.
- [ ] **Message Retry Queue**: Automatic retries for failed dispatches during socket drops.
- [ ] **Multi-Account Instances**: Run multiple WhatsApp sessions from a single bridge.
- [ ] **Template Engine**: Native variable replacement for personalized bulk messaging.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

### 👨‍💻 Developed by [Ahtesham](https://github.com/ahtesham-clcbws)
*Building modular tools for the modern developer.*
