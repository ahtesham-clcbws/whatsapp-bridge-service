# WhatsApp Automation Service - Unified Integration Guide [v1.7]

This guide provides examples for sending secure, multi-media requests to the standalone WhatsApp dispatcher using the **Unified Array Schema**.

## 🛡️ Authentication
All requests must include a valid `apiKey` in the form fields. This key is stored in the `.env` file of the Node.js service.

---

## 📨 1. Single Text Message
**Endpoint**: `POST /send`
**Content-Type**: `multipart/form-data`

### **Laravel (PHP)**
```php
use Illuminate\Support\Facades\Http;

Http::asMultipart()
    ->post('http://localhost:3001/send', [
        'number'  => '923123456789',
        'apiKey'  => 'YOUR_SECRET_KEY',
        'type[]'  => 'text',
        'text[]'  => "*School Attendance Report*",
    ]);
```

### **cURL**
```bash
curl -X POST http://localhost:3001/send \
  -F "number=923123456789" \
  -F "apiKey=YOUR_SECRET_KEY" \
  -F "type[]=text" \
  -F "text[]=*Hello World*"
```

---

## 📸 2. Single Image/Document with Caption
**Endpoint**: `POST /send`
**Content-Type**: `multipart/form-data`

### **Laravel (PHP)**
```php
use Illuminate\Support\Facades\Http;

Http::attach('file[0]', file_get_contents('/path/to/report.png'), 'report.png')
    ->post('http://localhost:3001/send', [
        'number'  => '923123456789',
        'apiKey'  => 'YOUR_SECRET_KEY',
        'type[]'  => 'image',
        'text[]'  => 'Check out this *important* report!',
    ]);
```

---

## 🔄 3. Batch Dispatcher (Mixed Types)
**Endpoint**: `POST /send`
**Content-Type**: `multipart/form-data`

### **Laravel (PHP)**
```php
use Illuminate\Support\Facades\Http;

Http::attach('file[1]', $pdfData, 'report.pdf')
    ->attach('file[2]', $imgData, 'photo.jpg')
    ->post('http://localhost:3001/send', [
        'number'  => '923123456789',
        'apiKey'  => 'YOUR_SECRET_KEY',
        'type'    => ['text', 'document', 'image'],
        'text'    => ['Welcome!', 'Final Report', 'School Photo']
    ]);
```

---

## 🔐 4. Remote Session Management
These endpoints allow your Laravel dashboard to manage the WhatsApp connection without terminal access.

### **Check Connection Status**
`GET /session/status?apiKey=YOUR_SECRET_KEY`
- **Response**: `{"connected": true/false}`

### **Fetch Remote QR Code**
`GET /session/qr?apiKey=YOUR_SECRET_KEY`
- **Response**: `{"qr": "2@..."}` 
- **Usage**: You can render this string as a QR image in your admin panel using a simple JS library.

### **Link via Pairing Code (No QR required)**
`POST /session/pairing-code`
- **Body**: `{"number": "923123456789", "apiKey": "..."}`
- **Response**: `{"code": "ABCD-1234"}`
- **Usage**: Enter this 8-digit code on your phone in **Linked Devices > Link with Phone Number**.

### **Remote Logout (Disconnect Switch)**
`POST /session/logout`
- **Body**: `{"apiKey": "..."}`
- **Response**: `{"status": "success", "message": "Session cleared"}`

---

## 🛠️ Formatting Reference
- **Bold**: `*text*`
- **Italic**: `_text_`
- **Strike**: `~text~`
- **Lists**: `- item`
- **Line Breaks**: Use `\n` (literal backslash and 'n') in your text fields. The service will automatically convert these into real WhatsApp line breaks.
    - Example: `*Day 1*\n- Attendance: 90%\n- Status: ✅`
