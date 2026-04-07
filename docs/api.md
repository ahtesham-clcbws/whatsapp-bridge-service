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

---

## 💻 Multi-Technology Examples

Choose your environment to see how to integrate the Bridge Service.

::: code-group

```bash [cURL]
# Simple text dispatch
curl -X POST http://localhost:3001/send \
  -F "apiKey=your_secret_key" \
  -F "number=923123456789" \
  -F "type[]=text" \
  -F "text[]=*Bridge Alert*\nSuccessfully sent via cURL."

# Media dispatch with caption
curl -X POST http://localhost:3001/send \
  -F "apiKey=your_secret_key" \
  -F "number=923123456789" \
  -F "type[]=image" \
  -F "file[]=@/path/to/image.jpg" \
  -F "text[]=Check out this image!"
```

```php [PHP (Vanilla)]
<?php
$apiKey = 'your_secret_key';
$baseUrl = 'http://localhost:3001';

$data = [
    'apiKey' => $apiKey,
    'number' => '923123456789',
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
        'number' => '923123456789',
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
    "apiKey": "your_secret_key",
    "number": "923123456789",
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
  form.append('apiKey', 'your_secret_key');
  form.append('number', '923123456789');
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
  formData.append('apiKey', 'your_secret_key');
  formData.append('number', '923123456789');
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
    
    writer.WriteField("apiKey", "your_secret_key")
    writer.WriteField("number", "923123456789")
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
    .addFormDataPart("apiKey", "your_secret_key")
    .addFormDataPart("number", "923123456789")
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

requestContent.Add(new StringContent("your_secret_key"), "apiKey");
requestContent.Add(new StringContent("923123456789"), "number");
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
  apiKey: 'your_secret_key',
  number: '923123456789',
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

