# Privacy and data handling

Screening images and patient records are **sensitive**.

## Development

- Use **synthetic / demo patients** only.
- Do not commit real patient data, real clinical images, or production `.env` files.
- Logs must not include image payloads, names beyond what is required for debugging with synthetic data, or secrets.

## Application rules

- Uploaded files are stored under a configured upload directory with generated names (not original filenames).
- API validation rejects oversize and non-image uploads for capture paths.
- Reports are **screening reports**, not medical certificates or diagnoses.
- Medication reminders are **operator-entered instructions**, never auto-prescribed from AI output.

## Production (future)

- Enable authentication (`AUTH_ENABLED`).
- Restrict CORS, use HTTPS, encrypt at rest as required by the deployment environment.
- Define retention and access-control policies before any real patient use.
