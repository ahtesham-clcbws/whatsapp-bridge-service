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
| `number` | String | Yes | Destination with country code (e.g., `910000000000`) or Group JID (`120363... @g.us`). |
| `type[]` | Array | Yes | Message types (`text`, `image`, `document`). |
| `text[]` | Array | No | Corresponding captions or message bodies. |
| `file[]` | File | If media | Binary attachments for `image` or `document`. |

---

---

## 📡 Webhook Engine (v2.2.0)

The bridge can notify your external backend service in real-time when events occur. Configure your `WEBHOOK_URL` in the `.env` file to enable this.

### Event Types

| Event | Trigger |
| :--- | :--- |
| `message.status` | Triggered when a message status changes (Delivered, Read). |
| `message.upsert` | Triggered when a new incoming message is received. |

### Status Payload Example
```json
{
  "event": "message.status",
  "whatsapp_id": "3EB0BC...",
  "status": "Delivered",
  "recipient": "910000000000",
  "timestamp": "2026-04-10T12:00:00Z"
}
```

## 🧩 Administrative Endpoints (v3.7.0)

Beyond standard messaging, the bridge provides a suite of administrative tools for telemetry and data management. These require the `x-admin-token` header.

### 1. Delivery Analytics
Retrieve historical delivery success metrics across a dynamic time range.

```http
GET /api/admin/analytics/delivery?days=30
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `days` | `Integer` | Number of past days to aggregate (e.g., 7, 30, 90). |

**Response (200 OK):**
```json
[
  { "day": "2026-04-11", "success": 142, "failed": 3 },
  { "day": "2026-04-12", "success": 156, "failed": 0 }
]
```

### 2. Purge System Log File
Permanently delete a specific file-based log from the server.

```http
DELETE /api/admin/logs?date=2026-04-11&level=info
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `date` | `String` | The log date in `YYYY-MM-DD` format. |
| `level` | `String` | The log level (`info`, `warn`, `error`, `debug`). |

### 3. Destroy Audit Record
Permanently remove a specific message record from the weekly audit database.

```http
DELETE /api/admin/audit/:id?week=2026-W15
```

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `String` | The unique ID of the audit record. |
| `week` | `String` | The weekly database identifier (e.g., `2026-W15`). |

---

## 📜 Error Reference

## 🛡️ Resilience & Retries (v2.3.0)

The bridge features a built-in **Exponential Backoff** engine designed to recover from temporary network instability. 

### Retry Policy
- **Attempt 1**: Immediate failure.
- **Attempt 2**: Retries after **5 seconds**.
- **Attempt 3**: Retries after **15 seconds**.
- **Attempt 4**: Final retry after **60 seconds**.

### Audit Tracking
Every message in the `/logs` result now includes a `retry_count`.
- `retry_count: 0` -> Sent on the first attempt.
- `retry_count: 3` -> Succeeded after reaching the final retry tier.

---

## 🩺 System Health

### `GET /health`

Returns the current vitals of the bridge service. (Does not require API_KEY for monitoring compatibility).

**Response:**
```json
{
  "status": "online",
  "whatsapp": "connected",
  "uptime": 12450,
  "version": "3.7.0",
  "timestamp": "2026-04-10T10:00:00.000Z"
}
```

---

## 👥 Group Management

### `GET /session/groups`

Returns a list of all participating groups. Use this to discover the `id` (JID) for your group dispatches.

**Response:**
```json
[
  {
    "id": "120363000000000000@g.us",
    "subject": "Staff Announcements",
    "participants": 24
  }
]
```

---

## 💻 Multi-Technology Examples

Choose your environment to see how to integrate the Bridge Service.

::: code-group

```bash [cURL]
# Simple text dispatch
curl -X POST http://localhost:3001/send \
  -H "x-api-key: your_api_key" \
  -F "number=910000000000" \
  -F "type[]=text" \
  -F "text[]=*Bridge Alert*\nSuccessfully sent via cURL."

# Media dispatch with caption
curl -X POST http://localhost:3001/send \
  -H "x-api-key: your_api_key" \
  -F "number=910000000000" \
  -F "type[]=image" \
  -F "file[]=@/path/to/image.jpg" \
  -F "text[]=Check out this image!"
```

```php [PHP (Vanilla)]
<?php
$apiKey = 'your_api_key';
$baseUrl = 'http://localhost:3001';

$data = [
    'apiKey' => $apiKey,
    'number' => '910000000000',
    'type' => ['text'],
    'text' => ["*Bridge Alert*\nSent via PHP cURL."]
];

$ch = curl_init("$baseUrl/send");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>
```

```php [Laravel (Http)]
use Illuminate\Support\Facades\Http;

$response = Http::asMultipart()
    ->post('http://localhost:3001/send', [
        'apiKey' => config('services.whatsapp.key'),
        'number' => '910000000000',
        'type'   => ['text', 'image'],
        'text'   => ["*Hello from Laravel*", "Image Caption"],
        'file'   => [
            // Attach a file via multipart
            fopen(storage_path('app/report.pdf'), 'r')
        ]
    ]);

return $response->json();
```

```python [Python (Requests)]
import requests

url = "http://localhost:3001/send"
payload = {
    "apiKey": "your_api_key",
    "number": "910000000000",
    "type[]": ["text"],
    "text[]": ["*Bridge Alert*\nSent via Python Requests."]
}

# For media files, use the files parameter
# files = {"file[]": open("image.jpg", "rb")}
response = requests.post(url, data=payload)
print(response.json())
```

```javascript [Node.js (Axios)]
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function sendWhatsApp() {
  const form = new FormData();
  form.append('apiKey', 'your_api_key');
  form.append('number', '910000000000');
  form.append('type[]', 'text');
  form.append('text[]', '*Bridge Alert*\nSent via Axios.');

  try {
    const response = await axios.post('http://localhost:3001/send', form, {
      headers: form.getHeaders()
    });
    console.log(response.data);
  } catch (error) {
    console.error('Bridge Error:', error.response.data);
  }
}
```

```javascript [Fetch (React/Modern JS)]
const sendWhatsApp = async () => {
  const formData = new FormData();
  formData.append('apiKey', 'your_api_key');
  formData.append('number', '910000000000');
  formData.append('type[]', 'text');
  formData.append('text[]', '*Bridge Alert*\nSent via Fetch.');

  const res = await fetch('http://localhost:3001/send', {
    method: 'POST',
    body: formData
  });
  
  const data = await res.json();
  console.log(data);
};
```

```javascript [Next.js (Server Action)]
'use server'

export async function dispatchNotification(formData: FormData) {
  // Append API key server-side for security
  formData.append('apiKey', process.env.WHATSAPP_API_KEY!);
  
  const response = await fetch(`${process.env.BRIDGE_URL}/send`, {
    method: 'POST',
    body: formData
  });

  return response.json();
}
```

```go [Go]
package main

import (
    "bytes"
    "fmt"
    "mime/multipart"
    "net/http"
)

func main() {
    body := &bytes.Buffer{}
    writer := multipart.NewWriter(body)
    
    writer.WriteField("apiKey", "your_api_key")
    writer.WriteField("number", "910000000000")
    writer.WriteField("type[]", "text")
    writer.WriteField("text[]", "*Bridge Alert*\nSent via Go lang.")
    
    writer.Close()

    req, _ := http.NewRequest("POST", "http://localhost:3001/send", body)
    req.Header.Set("Content-Type", writer.FormDataContentType())

    client := &http.Client{}
    resp, _ := client.Do(req)
    fmt.Println("Status:", resp.Status)
}
```

```java [Java (OkHttp)]
OkHttpClient client = new OkHttpClient();

RequestBody requestBody = new MultipartBody.Builder()
    .setType(MultipartBody.FORM)
    .addFormDataPart("apiKey", "your_api_key")
    .addFormDataPart("number", "910000000000")
    .addFormDataPart("type[]", "text")
    .addFormDataPart("text[]", "*Bridge Alert*\nSent via OkHttp.")
    .build();

Request request = new Request.Builder()
    .url("http://localhost:3001/send")
    .post(requestBody)
    .build();

Response response = client.newCall(request).execute();
```

```csharp [C# (.NET)]
var client = new HttpClient();
var requestContent = new MultipartFormDataContent();

requestContent.Add(new StringContent("your_api_key"), "apiKey");
requestContent.Add(new StringContent("910000000000"), "number");
requestContent.Add(new StringContent("text"), "type[]");
requestContent.Add(new StringContent("*Bridge Alert*\nSent via .NET."), "text[]");

var response = await client.PostAsync("http://localhost:3001/send", requestContent);
var content = await response.Content.ReadAsStringAsync();
```

```ruby [Ruby (Faraday)]
require 'faraday'
require 'faraday/multipart'

conn = Faraday.new(url: 'http://localhost:3001') do |f|
  f.request :multipart
  f.adapter :net_http
end

payload = {
  apiKey: 'your_api_key',
  number: '910000000000',
  'type[]': 'text',
  'text[]': '*Bridge Alert*\nSent via Ruby Faraday.'
}

response = conn.post('/send', payload)
puts response.body
```

:::

---

## 🛠️ Data Objects

### Text Formatting
The service preserves **WhatsApp Markdown**:
- Use `*` for bold.
- Use `_` for italics.
- Use `~` for strikethrough.
- Use `\n` (literal backslash + n) for explicit newlines in your request.

---

## 📦 Large File Handling
Attachments up to **50MB** (default) are processed in-memory. You can adjust this limit in your `.env` file via `MAX_FILE_SIZE`.

