# Changelog

All notable changes to this project will be documented in this file.
For detailed minor release notes, visit the `docs/changelogs/` directory or the online documentation portal.

## [v3.7.0] - 2026-04-11
### Added
- **Administrative Data Purging**: Granular deletion of file-based logs and individual audit records via the dashboard.
- **Premium Analytics (7D/30D/90D)**: Dynamic area-chart visualization with historical range scaling and telemetry tooltips.
- **Modular Router Pattern**: Complete refactor of the monolithic server into domain-driven routers (`auth`, `message`, `session`, `admin`).
- **Safety Backups in Upgrade**: `upgrade.sh` now automatically creates `.tar.gz` backups before performing migrations.

### Fixed
- **Admin UI Mismatches**: Resolved ID conflicts in the log selector and improved delete confirmation UX.
- **SQLite Format Standard**: Optimized datetime handling for SQLite `now` comparisons in OTP verification.

## [v3.2.1] - 2026-04-11
### Fixed
- **Silent Boot**: Removed redundant "System connected" WhatsApp messages to improve UX during socket reconnections.
- **MFA Hardening**: Standardized `expires_at` storage for session tokens.

## [v3.2.0] - 2026-04-11
### Added
- **Invincible Sessions**: Migration of the in-memory Message Queue and Admin Sessions to a persistent `system.db`.
- **Reboot Resilience**: Messages in the queue now survive server restarts and PM2 reboots.

## [v3.1.0] - 2026-04-10
### Added
- **Remote Maintenance Hub**: Remote `git pull` and System Reboot triggers added to the Admin Panel.
- **Hardware Pulse**: Integration of CPU Load and RAM usage metrics in the dashboard header.

## [v3.0.0] - 2026-04-11 (The Admin Era)
### Added
- **Interactive Admin Dashboard:** (`/dashboard/`) A lightweight interface for monitoring queues and system telemetry.
- **Orchestrator System:** Fully functional manual payload dispatch directly via the dashboard supporting text, image, and PDF documents.
- **Centralized Telemetry Logger:** Dual-stream JSONL log engine (`bridge-YYYY-MM-DD.log` and `bridge-debug-YYYY-MM-DD.log`) with integrated frontend UI rendering.
- **WhatsApp Native MFA:** Password-less admin authentication using dynamic OTPs sent to your own WhatsApp account.
- **Intelligent Queue Management:** Stateful database architecture to manage API thresholds, pace bulk shipments, and emulate human typing behavior.

### Fixed
- **Silent Drop Patch:** Resolved an API dispatch error where payloads missing the `.type` parameter defaulted to file assumptions, leading to dead queues and false-positive "Sent" audit status. The router now safely defaults to `text`.
- **Ethereal Connection Ban Patch:** Reverted custom user-agent browser fingerprint settings back to the official default `Browsers.macOS('Desktop')` to prevent Meta server blocking and `bad-request` loops.

## [v2.4.0] - 2026-04-09
### Added
- Pre-flight automated test scripts (`tests/api_check.js`) using cURL.
- Unified response structures.

## [v2.3.0] - 2026-04-08
### Added
- Exponential Backoff Engine: Automated socket retry bounds and infinite reconnection loops to restore dropped connections smoothly.
- Real-time event emitters for `messaging-history.set` and `chats.update` bounds.

## [v2.2.0] - 2026-04-07
### Added
- Webhook Engine (`/webhook`) routing to instantly notify external servers on generic WhatsApp events, Delivery updates, and Read receipts.

## [v2.0.0] - 2026-04-05
### Added
- Global WhatsApp Bridge initialization.
- Group messaging (`@g.us`) support alongside individual contacts.
- High-level Multipart payload form generation for base API consumption.
