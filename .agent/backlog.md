# Backlog - WhatsApp Automation Service [v1.5]

## High Priority
- [ ] **Project Setup**: Initialize `package.json` and basic directory structure.
- [ ] **WhatsApp Connection**: Implement Baileys initialization and QR code display in terminal.
- [ ] **API Security**: Implement `API_KEY` verification middleware.
- [ ] **Batch Dispatcher**: Implement sequential looping and randomized delays for multiple files.
- [ ] **Form Handling**: Implement `multer` memory-storage multipart support (up to 50MB).
- [ ] **Rich Formatting**: Implement message handler that preserves markdown and line breaks.
- [ ] **Verification**: Conduct tests for 10MB+ PDF delivery and multi-file sequence.

## Future Enhancements
- [ ] Support for **Real-time Status Webhooks** (sending success/fail back to Laravel).
- [ ] Automated **QR Emailing** if the session ever drops while unattended.
