# Code Audit Report — AI Skin Screening IoT Project

**Date:** 2026-10-08  
**Auditor:** Senior full-stack + embedded reviewer  
**Scope:** Full monorepo — frontend/, backend/, ai/, hardware/, scripts/, tests/, docs/, Docker  

> **Severity key:** 🔴 HIGH — broken/security/data, 🟡 MEDIUM — wrong behaviour/UX, 🟢 LOW — style/docs/minor.

---

## 1. Frontend Issues

### 1.1 🟡 MEDIUM — Frontend test expects old 12-item nav that no longer exists
`frontend/src/__tests__/app.test.tsx` line 31–37 asserts the existence of nav items
"Capture / Upload · Step 2", "New Screening · Full Flow", "AI Analysis", "History",
"Reports", "Reminders", "Device Status" — none of which exist in the current 4-item
nav (`App.tsx`). **Tests will fail on the navigation assertions.**

### 1.2 🟡 MEDIUM — CaptureUpload.tsx is a dead page (never routed)
`CaptureUpload.tsx` is imported nowhere. The `/capture` route redirects to
`/screening/new`. The component has 294 lines of dead code.

### 1.3 🟢 LOW — About.tsx has OLED I2C pins swapped
Line 85: `I2C (SDA: GPIO14, SCL: GPIO15)` — should be **SDA: GPIO15, SCL: GPIO14**
per the requirement, HARDWARE_CONNECTIONS.md, and docs/wiring.md.

### 1.4 🟢 LOW — About.tsx says "Internal Pull-Up" for button
Line 95: `GPIO13 (Internal Pull-Up)` — requirement specifies **external 10kΩ pull-up
to 3.3V**. Internal pull-up is a firmware fallback, not the canonical design.

### 1.5 🟡 MEDIUM — No indicator LED (GPIO12) documented anywhere in the frontend
The requirement calls for an optional indicator white LED on GPIO12 via 220Ω.
None of the About/Devices/DeviceStatusPage pages mention it. The BOM table in
About.tsx lists GPIO4 as the strobe but omits GPIO12.

### 1.6 🟡 MEDIUM — DashboardSummary type missing model_version and model_backend
The `DashboardSummary` TypeScript type was extended to include `model_version?` and
`model_backend?`, but the backend `DashboardSummaryOut` schema has them mandatory.
Test mock on line 83–94 of the test file omits `model_version` and `model_backend`,
which would cause type mismatches.

### 1.7 🟢 LOW — ResultPage links to `/history` and `/capture` (legacy routes)
Lines 134 and 137 of `ResultPage.tsx` link to `/history` and `/capture`. These
redirect correctly via the router but should use canonical paths `/records?tab=history`
and `/screening/new` for clarity.

### 1.8 🟢 LOW — PatientProfile links to `/capture?patient=${patient.id}`
Lines 126 and 146 use the old `/capture` route instead of `/screening/new`.
Works via redirect but is semantically stale.

### 1.9 🟡 MEDIUM — Dashboard links to `/history` and `/reminders` (redirect targets)
Dashboard buttons at lines 217, 227, 289, 313 link to `/history` and `/reminders`.
These redirect to `/records?tab=*`, but the user sees a flash redirect. Should use
canonical `/records?tab=history` etc.

### 1.10 🟢 LOW — No `<title>` or `<meta description>` SEO tags
`index.html` has a generic title. No per-page document titles.

---

## 2. Backend Issues

### 2.1 🔴 HIGH — `.env` file is committed to the repository
`.env` is listed in `.gitignore` but the file exists in the working tree (717 bytes).
Contains `APP_SECRET_KEY=change-me-in-production`. Must be removed from tracking.

### 2.2 🟡 MEDIUM — `.env` uses `AI_MODE=mock` but config expects `MODEL_BACKEND`
`AI_MODE` is accepted via `AliasChoices` but it is confusing. `.env.example` correctly
uses `MODEL_BACKEND`. The `.env` should be consistent.

### 2.3 🟡 MEDIUM — `.env` missing DEVICE_TRANSPORT and DEVICE_TOKEN
`.env.example` has `DEVICE_TRANSPORT` and `DEVICE_TOKEN` but the actual `.env` does
not. This means `.env` falls back to defaults, which is fine, but inconsistent.

### 2.4 🟡 MEDIUM — CORS_ORIGINS not configurable from docker-compose
`docker-compose.yml` sets `CORS_ORIGINS` directly in the environment. This is fine,
but not the recommended config-from-env pattern.

### 2.5 🟢 LOW — `app_secret_key` default is insecure placeholder
`config.py` line 15: `app_secret_key: str = "change-me-in-production"`. This is
a known-weak default. Not exploitable currently since auth is disabled, but should
have a warning.

### 2.6 🟡 MEDIUM — No authentication system
`AUTH_ENABLED=false` by default. The `auth_ready` dependency is a no-op when disabled.
No JWT/session implementation exists. Documented as a known limitation.

### 2.7 🟢 LOW — No Alembic or migration tool
Schema changes are applied via `init_db()` which uses `ALTER TABLE` for SQLite.
No migration history for PostgreSQL production. Acceptable for prototype.

### 2.8 🟢 LOW — Health endpoint leaks config details
`/api/v1/health` returns `auth_enabled`, `gateway_mode`, `hardware_confirmed`, etc.
Not a security risk in dev, but could leak in production.

### 2.9 🟡 MEDIUM — `screening_model_path` in config points to `./ai/weights/skin_model.pt`
This legacy path is unused by the current inference engine which reads from
`ai/models/model.pt`. Dead config field.

### 2.10 🟡 MEDIUM — `validate_image_bytes` rejects MIME hint mismatch
If `mime_hint` differs from detected MIME (e.g., browser sends `image/jpeg` for a PNG),
the image is rejected with "unsupported". This is overly strict.

---

## 3. AI Module Issues

### 3.1 🟢 LOW — `ai/real_model.py` and `ai/screening_model.py` appear unused
`real_model.py` (9555 bytes) and `screening_model.py` (1125 bytes) are never
imported by any active code path. The actual inference uses `ai/inference.py`.
Dead code.

### 3.2 🟢 LOW — `ai/models/model_weights.pth` should be gitignored
`.gitignore` has `*.pth` which excludes this file from git, but it physically
exists in the directory (16 MB). Not harmful but redundant with `model.pt`.

### 3.3 🟢 LOW — preprocessing.py color constancy not used by inference.py
`preprocessing.py` applies Shades-of-Gray color constancy by default, but
`inference.py._preprocess()` does not. The training script may or may not have
used it. Potential train/inference mismatch.

---

## 4. Hardware / Firmware Issues

### 4.1 🟡 MEDIUM — HARDWARE_CONNECTIONS.md says GPIO4 external LED via 220Ω
Table row: "White LED Anode (+) → GPIO4 (via 220Ω) → Strobe Flash". But the
requirement says the **main light = onboard flash LED GPIO4** (no external resistor)
and the **optional indicator LED = GPIO12 via 220Ω**. The doc conflates the two.

### 4.2 🟡 MEDIUM — docs/wiring.md same conflation: GPIO4 as "Auxiliary strobe"
Line 17: `GPIO4 via 220Ω` — the onboard GPIO4 flash LED needs no external resistor.
GPIO12 is the optional indicator LED.

### 4.3 🟡 MEDIUM — No mention of GPIO12 indicator LED anywhere in docs
The requirement specifies an optional white LED on GPIO12 (via 220Ω to GND).
None of the docs or code reference this pin.

### 4.4 🟡 MEDIUM — No power doc matching the requirement
The requirement specifies LiPo → TP4056 → switch → 5V boost → ESP32 5V, 470µF
capacitor, never connecting FT232 5V and boost together, charge with switch off.
No document in the repo covers this topology.

### 4.5 🟡 MEDIUM — HARDWARE_CONNECTIONS.md FTDI VCC row says "5V Pin" but adds confusing note
"Set FTDI jumper to 3.3V logic level; power from stable 5V 2A" — this is correct
(FTDI logic at 3.3V, power at 5V), but the row header "VCC (5V)" could mislead.
Requirement says FTDI VCC → ESP32 5V, FTDI GND → GND.

### 4.6 🟢 LOW — Firmware pin map not verified
Cannot compile-check: PlatformIO CLI not available in this environment.
All GPIO assignments in firmware source must be manually verified against the spec.

### 4.7 🟡 MEDIUM — No mention of GPIO12/15 strapping pin warnings in docs
Requirement: "GPIO12/15 are strapping pins — keep them safe at boot". No doc warns
about this.

---

## 5. Test Issues

### 5.1 🔴 HIGH — Frontend test will fail on nav assertions
As noted in §1.1, the test expects 12 nav items that were removed.

### 5.2 🟡 MEDIUM — Backend tests not yet run — cannot confirm pass/fail
`tests/` has 13 test files but none have been executed in this audit.

### 5.3 🟡 MEDIUM — conftest.py deletes DB on import; no parallel-safe isolation
Each test run shares a single SQLite file. Not a problem for serial runs, but
fragile.

---

## 6. Docker / Infrastructure Issues

### 6.1 🟢 LOW — docker-compose.yml has no health check
Neither `api` nor `web` services define `healthcheck`. The backend has
`/api/v1/health` that could be used.

### 6.2 🟢 LOW — No `.dockerignore`
Builds will COPY the entire context (node_modules, .venv, .git, data/) into the
image. Should have a `.dockerignore`.

---

## 7. Documentation Inconsistencies

### 7.1 🟡 MEDIUM — README.md does not match current nav/architecture
The README likely references old page structure. Needs update after nav simplification.

### 7.2 🟡 MEDIUM — No docs/PROJECT_STATUS.md
Required by the spec; does not exist yet.

### 7.3 🟡 MEDIUM — No docs/MANUAL_TEST.md
Required by the spec; does not exist yet.

---

## 8. Security / Privacy Issues

### 8.1 🔴 HIGH — .env committed with default secret key
See §2.1.

### 8.2 🟢 LOW — Patient names visible in API responses
Patient `display_name` is returned in all endpoints including health/reports.
Not logged to console currently (good), but API responses contain PII. Acceptable
for prototype; should be noted as a limitation.

### 8.3 🟢 LOW — No rate limiting on any endpoint
Acceptable for prototype.

---

## 9. Known Limitations (not bugs, just gaps)

| Limitation | Status |
|---|---|
| No authentication/authorization | Known; `AUTH_ENABLED=false` |
| No Alembic migrations | Known; `init_db()` with `ALTER TABLE` |
| No rate limiting | Known |
| No HTTPS enforcement | Known |
| Model not validated on ESP32-CAM images | Documented in model_card.md |
| Firmware not hardware-tested | NOT TESTED |
| Docker Compose not tested | NOT TESTED |
| Real model inference not tested (torch may not install) | NOT TESTED |

---

## Summary

| Severity | Count |
|---|---|
| 🔴 HIGH | 3 |
| 🟡 MEDIUM | 19 |
| 🟢 LOW | 14 |
| **Total** | **36** |

The highest-priority fixes are:
1. Remove `.env` from version control (or at least reset the secret).
2. Fix the frontend test to match the current 4-item nav.
3. Fix OLED pin labels in About.tsx (SDA/SCL swapped).
4. Add GPIO12 indicator LED to docs and About page.
5. Fix hardware docs to distinguish GPIO4 onboard flash from GPIO12 external LED.
6. Add the power topology documentation.
7. Create PROJECT_STATUS.md and MANUAL_TEST.md.
