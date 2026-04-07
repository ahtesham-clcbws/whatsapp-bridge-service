# API Reference Guide

This guide explains how to interact with the **WhatsApp Bridge Service** from any programming language.

## 🔓 Authentication

All requests must include your `API_KEY` in the request body, as a query parameter (`?apiKey=...`), or in the header `x-api-key`.

---

## 📥 JSON-Ready Dispatching

The preferred method is using **Multipart/Form-Data** to handle both text and media attachments efficiently.

### `POST /send`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `number` | String | Yes | Destination with country code (e.g., `923123456789`). |
| `type[]` | Array | Yes | Message types (`text`, `image`, `document`). |
| `text[]` | Array | No | Corresponding captions or message bodies. |
| `file[]` | File | If media | Binary attachments for `image` or `document`. |

### **Example (cURL)**
```bash
curl -X POST http://localhost:3001/send \
  -F "number=923123456789" \
  -F "apiKey=your_secret_key" \
  -F "type[]=text" \
  -F "text[]=*Bridge Alert*\nSuccessfully sent via cURL."
```

---

## 🛠️ Data Objects

### Text Formatting
The service preserves **WhatsApp Markdown**:
- Use `*` for bold.
- Use `_` for italics.
- Use `\n` (literal backslash + n) for explicit newlines in your request.

---

## 📦 Large File Handling
Attachments up to **50MB** (default) are processed in-memory. You can adjust this limit in your `.env` file via `MAX_FILE_SIZE`.
