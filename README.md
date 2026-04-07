# 🌉 WhatsApp Bridge Service

A generic, headless, and modular WhatsApp-to-HTTP bridge service. Securely dispatch messages, images, and documents via a high-level multipart API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/Docs-GitHub%20Pages-blue)](https://ahtesham-clcbws.github.io/whatsapp-bridge-service/)

---

## 🚀 Overview

The **WhatsApp Bridge Service** is a lightweight Node.js application that provides a secure HTTP interface to a linked WhatsApp account. It is designed to be platform-agnostic, allowing any backend (Laravel, Django, Node, Go) to send rich WhatsApp notifications without dealing with raw WebSocket protocols or browser automation.

### ✨ Key Features
- **Headless Linking**: Link your device remotely via **QR Code** or **8-digit Pairing Code** via API.
- **Unified Batch Dispatcher**: Single endpoint to send sequences of text, images, and documents.
- **Multipart API**: Directly upload files (up to 50MB+) from your production server to the bridge.
- **Zero-Disk Footprint**: In-memory file processing for maximum privacy and performance.
- **Rich Text Support**: Full support for WhatsApp Markdown (`*bold*`, `_italic_`, etc.) and multi-line breaks (`\n`).

---

## 📦 Quick Start

### 1. Installation
```bash
git clone https://github.com/ahtesham-clcbws/whatsapp-bridge-service.git
cd whatsapp-bridge-service
npm install
```

### 2. Configuration
Create a `.env` file in the root directory:
```env
PORT=3001
API_KEY=your_secret_api_key
MAX_FILE_SIZE=52428800
WHATSAPP_AUTH_DIR=./auth
```

### 3. Run the Service
```bash
npm start
```

---

## 🔐 Authentication
All API requests require a valid `apiKey` to be passed in the multipart form or headers.

---

## 📨 Message Dispatch (Unified Array Schema)

The `/send` endpoint is highly flexible. For maximum consistency, use the **Array Schema** for both single and batch requests.

### **Laravel (PHP) Example**
```php
Http::asMultipart()->post('http://localhost:3001/send', [
    'number'  => '923123456789',
    'apiKey'  => 'your_secret_api_key',
    'type[]'  => 'image',
    'text[]'  => "Hello! Here is your *Special Report*.\n- Row 1\n- Row 2",
    'file[0]' => $fileData,
]);
```

---

## 📲 Remote Session Management

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/session/status` | GET | Returns simple `{connected: true/false}` |
| `/session/qr` | GET | Returns the latest QR string for remote display. |
| `/session/pairing-code` | POST | Takes a `number` and returns an 8-digit code for linking. |
| `/session/logout` | POST | Permanently disconnects and clears local session data. |

---

## 📖 Detailed Documentation
For full API references and advanced setup (GitHub Pages automation), please visit the **[Live Documentation Site](https://ahtesham-clcbws.github.io/whatsapp-bridge-service/)**.

---

## 🛡️ Privacy & Security
- **No Third-Party Cloud**: All data flows directly between your server and the bridge.
- **End-to-End Encryption**: Utilizes the official WhatsApp Web protocol for secure transmission.

---

## ⚖️ License
This project is licensed under the **MIT License**. Check the `LICENSE` file for details.
