# API Client Testing Guide

This guide provides a **Full Postman Collection JSON** that you can copy, save, and import into your favorite API client (Postman, Insomnia, etc.) to test all bridge features including Messaging, Session Management, and Administrative Purging.

---

## 📥 Direct Import Collection (v3.8.5)
Copy the JSON block below, save it as `whatsapp-bridge-v3.7.json` on your computer, and import it into Postman.

```json
{
	"info": {
		"_postman_id": "wa-bridge-v3-7",
		"name": "WhatsApp Bridge Service (v3.8.5)",
		"description": "Comprehensive collection for testing v3.8.5 features: Messaging, MFA Auth, Session Management, and Administrative Purging.",
		"schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
	},
	"item": [
		{
			"name": "System",
			"item": [
				{
					"name": "Health Check",
					"request": {
						"method": "GET",
						"header": [],
						"url": { "raw": "{{baseUrl}}/health", "host": ["{{baseUrl}}"], "path": ["health"] }
					}
				}
			]
		},
		{
			"name": "MFA Authentication",
			"item": [
				{
					"name": "Request OTP",
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"apiKey\": \"{{apiKey}}\"\n}",
							"options": { "raw": { "language": "json" } }
						},
						"url": { "raw": "{{baseUrl}}/api/auth/request", "host": ["{{baseUrl}}"], "path": ["api", "auth", "request"] }
					}
				},
				{
					"name": "Verify OTP",
					"request": {
						"method": "POST",
						"header": [],
						"body": {
							"mode": "raw",
							"raw": "{\n  \"attemptToken\": \"YOUR_ATTEMPT_TOKEN\",\n  \"code\": \"123456\"\n}",
							"options": { "raw": { "language": "json" } }
						},
						"url": { "raw": "{{baseUrl}}/api/auth/verify", "host": ["{{baseUrl}}"], "path": ["api", "auth", "verify"] }
					}
				}
			]
		},
		{
			"name": "Messaging Hub",
			"item": [
				{
					"name": "Send Bulk (Multipart)",
					"request": {
						"method": "POST",
						"header": [
							{ "key": "x-api-key", "value": "{{apiKey}}", "type": "text" }
						],
						"body": {
							"mode": "formdata",
							"formdata": [
								{ "key": "number", "value": "910000000000", "type": "text" },
								{ "key": "type[]", "value": "text", "type": "text" },
								{ "key": "text[]", "value": "Hello from Postman v3.7!", "type": "text" }
							]
						},
						"url": { "raw": "{{baseUrl}}/send", "host": ["{{baseUrl}}"], "path": ["send"] }
					}
				}
			]
		},
		{
			"name": "Administrative Controls",
			"item": [
				{
					"name": "Get Delivery Analytics",
					"request": {
						"method": "GET",
						"header": [
							{ "key": "x-admin-token", "value": "{{adminToken}}", "type": "text" }
						],
						"url": {
							"raw": "{{baseUrl}}/api/admin/analytics/delivery?days=30",
							"host": ["{{baseUrl}}"],
							"path": ["api", "admin", "analytics", "delivery"],
							"query": [{ "key": "days", "value": "30" }]
						}
					}
				},
				{
					"name": "Purge Log File",
					"request": {
						"method": "DELETE",
						"header": [
							{ "key": "x-admin-token", "value": "{{adminToken}}", "type": "text" }
						],
						"url": {
							"raw": "{{baseUrl}}/api/admin/logs?date=2024-04-11&level=info",
							"host": ["{{baseUrl}}"],
							"path": ["api", "admin", "logs"],
							"query": [
								{ "key": "date", "value": "2024-04-11" },
								{ "key": "level", "value": "info" }
							]
						}
					}
				}
			]
		}
	],
	"variable": [
		{ "key": "baseUrl", "value": "http://localhost:3001", "type": "string" },
		{ "key": "apiKey", "value": "your_api_key_here", "type": "string" },
		{ "key": "adminToken", "value": "your_mfa_token_here", "type": "string" }
	]
}
```

---

## 🛠️ How to use:
1. **Import**: Open Postman -> File -> Import -> Paste the JSON.
2. **Variables**: Set the `baseUrl`, `apiKey`, and `adminToken` (fetched from `/verify`) in the collection variables tab.
3. **Admin Routes**: All routes under the "Administrative Controls" and "Session" folders require the `x-admin-token` header.

---

## 🛡️ Authentication Matrix

| Endpoint | Auth Method | Requirement |
| :--- | :--- | :--- |
| `/send` | Header `x-api-key` | Static API_KEY |
| `/api/admin/*` | Header `x-admin-token` | Temporary Session Token |
| `/session/*` | Header `x-admin-token` | Temporary Session Token |

---

## 📡 Webhook Test Payload (v3.x)
```json
{
  "event": "message.status",
  "whatsapp_id": "3EB0BC...",
  "status": "Delivered",
  "recipient": "919810000000",
  "timestamp": "2026-04-10T15:20:00Z"
}
```
