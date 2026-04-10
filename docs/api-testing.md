# API Client Testing Guide

This guide provides a **Full Postman Collection JSON** that you can copy, save, and import into your favorite API client (Postman, Insomnia, etc.) to test all bridge features in seconds.

---

## 📥 Direct Import Collection
Copy the JSON block below, save it as `whatsapp-bridge.json` on your computer, and import it into Postman.

```json
{
	"info": {
		"_postman_id": "wa-bridge-v2-4",
		"name": "WhatsApp Bridge Service (v2.4.x)",
		"description": "Comprehensive collection for testing text, media, group dispatches, and system vitals.",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "System Health",
			"request": {
				"method": "GET",
				"header": [],
				"url": {
					"raw": "{{baseUrl}}/health",
					"host": ["{{baseUrl}}"],
					"path": ["health"]
				}
			}
		},
		{
			"name": "Send Text",
			"request": {
				"method": "POST",
				"header": [
					{ "key": "x-api-key", "value": "{{apiKey}}", "type": "text" }
				],
				"body": {
					"mode": "raw",
					"raw": "{\n  \"number\": \"910000000000\",\n  \"type\": \"text\",\n  \"text\": \"Hello from imported collection! 🚀\"\n}",
					"options": { "raw": { "language": "json" } }
				},
				"url": {
					"raw": "{{baseUrl}}/send",
					"host": ["{{baseUrl}}"],
					"path": ["send"]
				}
			}
		},
		{
			"name": "Send Image (URL)",
			"request": {
				"method": "POST",
				"header": [
					{ "key": "x-api-key", "value": "{{apiKey}}", "type": "text" }
				],
				"body": {
					"mode": "raw",
					"raw": "{\n  \"number\": \"910000000000\",\n  \"type\": \"image\",\n  \"url\": \"https://example.com/sample.jpg\",\n  \"text\": \"Check out this image!\"\n}",
					"options": { "raw": { "language": "json" } }
				},
				"url": {
					"raw": "{{baseUrl}}/send",
					"host": ["{{baseUrl}}"],
					"path": ["send"]
				}
			}
		},
		{
			"name": "Check Logs",
			"request": {
				"method": "GET",
				"header": [
					{ "key": "x-api-key", "value": "{{apiKey}}", "type": "text" }
				],
				"url": {
					"raw": "{{baseUrl}}/logs",
					"host": ["{{baseUrl}}"],
					"path": ["logs"]
				}
			}
		}
	],
	"variable": [
		{ "key": "baseUrl", "value": "http://localhost:3001", "type": "string" },
		{ "key": "apiKey", "value": "your_api_key_here", "type": "string" }
	]
}
```

---

## 🛠️ How to use:
1. **Copy**: Click the copy button on the JSON block above.
2. **Save**: Paste into a text editor and save as `bridge.json`.
3. **Import**: Open Postman -> File -> Import -> Select `bridge.json`.
4. **Configure**: Set the `baseUrl` and `apiKey` variables in the collection tab.

---

## 🔒 Authentication
All requests (except `/health`) require the `x-api-key` header.

| Header | Value |
|--------|-------|
| `x-api-key` | *Your configured API_KEY* |

---

## 📡 Webhook Test Payload
When the bridge is connected and a message is delivered, it will send a POST request to your `WEBHOOK_URL` with this structure:

```json
{
  "event": "message.status",
  "whatsapp_id": "3EB0BC...",
  "status": "Delivered",
  "recipient": "919810000000",
  "timestamp": "2026-04-10T15:20:00Z"
}
```
