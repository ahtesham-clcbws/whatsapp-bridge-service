# Coding Standards - WhatsApp Automation Service

- **Modular**: Core logic into separate modules (`whatsapp.js`, `server.js`, `auth.js`).
- **Efficient**: Avoid disk I/O; use Streams and Buffers for large files.
- **Robust**: Extensive error handling for WebSocket drops and multipart failures.
- **Secure**: All sensitive configuration (`API_KEY`) in `.env`.
- **Naming**: CamelCase for JS variables; kebab-case for filenames.
