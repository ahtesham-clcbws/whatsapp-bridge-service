# 🚀 WhatsApp Bridge Service (v2.0.0)

A generic, headless, and modular **WhatsApp-to-HTTP Bridge** designed for reliable automated messaging. Built with Node.js and the Baileys library, this service provides a high-level API to dispatch text and media messages to individuals and groups with enterprise-grade stability.

---

## ✨ Key Features

- `[x]` **Group & Individual Support**: Seamlessly message phone numbers or Group JIDs.
- `[x]` **Multipart Media API**: High-performance endpoint for text, images, and documents.
- `[x]` **Weekly SQLite Audit Logs**: High-efficiency database archiving.
- `[x]` **API-based Log Access**: Secured `GET /logs` endpoint for history.
- `[x]` **Universal SDK Support**: 11+ language examples (PHP, Laravel, React, etc.).
- `[x]` **Resilient Body Parsing**: Supports JSON dispatches even without strict headers.

---

## 🛠️ API & Testing

The service is designed to be tested with any REST client (Insomnia, Postman, cURL).

### Sending a Group Message (JSON)
```json
POST /send
Headers: { "x-api-key": "your_api_key" }
Body:
{
  "number": "120363000000000000@g.us",
  "type": "text",
  "text": "Hello from the API!"
}
```

### Fetching Group IDs
```http
GET /session/groups
Headers: { "x-api-key": "your_api_key" }
```

---

## 🗺️ Future Roadmap

- `[ ]` **Webhook Callbacks**: Forward delivery receipts and incoming messages to your backend.
- `[ ]` **Message Retry Queue**: Automatic retries for failed dispatches during socket drops.
- `[ ]` **Advanced Dashboard**: Admin UI for viewing logs and managing sessions.

---

## ☁️ Deployment Guide

Check our detailed [Deployment Guide](./docs/deployment.md) for step-by-step setup on Oracle Cloud, Hostinger, and more.

---

## 📜 License

Distributed under the **MIT License**.

---

### 👨‍💻 Developed by [Ahtesham](https://github.com/ahtesham-clcbws)
*Building modular tools for the modern developer.*
