# WhatsApp Automation Service - Architecture [v1.5]

## Core Modules

### 1. HTTP Server (Express + Multer)
- **Role**: High-capacity entry point for multipart/form-data requests.
- **Security**: Mandatory static `apiKey` in form fields.
- **Configuration**: 50MB payload limit to support large PDF reports.
- **Multipart Handler**: In-memory `multer` storage for zero-disk-latency transfers.

### 2. WhatsApp Core (Baileys)
- **Role**: Event-driven connection to WhatsApp Web servers.
- **Persistence**: Multi-file authentication state stored in `./auth/`.
- **Auto-Reconnect**: Exponential backoff logic for dropped connections.

### 3. Batch Dispatcher & Messaging Utility
- **Role**: Extracts fields and files from the multipart request.
- **Media Handler**: Directly sends buffers received from `multer` to Baileys.
- **Newline Unescaper**: Automatically converts literal `\n` character sequences into actual newline characters for WhatsApp compatibility.
- **Efficiency**: No temporary local disk writes; pure memory stream.
- **Formatting**: Preserves markdown (`*`, `_`, `~`) and newlines for rich text delivery.

## Data Flow (Secure Multipart)
1. **Request Received**: API gets multipart payload (number, apiKey, files[], captions[], types[]).
2. **Authorized**: Middleware verifies `apiKey`.
3. **Queued**: Batch dispatcher starts a sequential loop.
4. **Sent**: Baileys socket sends each part (text, image, or document) with its paired caption.
5. **Logged**: Event results are logged via `pino`.

## Security & Privacy
- **Direct Transfer**: Content is sent via production-to-local multipart upload; no public URLs or staging servers are used.
- **Encryption**: WhatsApp Web protocol use end-to-end encryption for the socket connection.
