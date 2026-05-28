# Hangul Note Staff OMR Server

Small OMR bridge server for Hangul Note Staff.

It accepts a PDF/image upload, runs Audiveris in CLI batch mode, and returns the generated MusicXML/MXL file.

## API

```http
GET /health
POST /omr/jobs
Content-Type: multipart/form-data
file=<score.pdf|score.png|score.jpg>
```

`POST /omr/jobs` returns a `.mxl`, `.musicxml`, or `.xml` file directly.

## Local Run

1. Install Audiveris and make sure the CLI command works:

```powershell
audiveris -help
```

If the command name/path differs, set `AUDIVERIS_BIN`.

2. Install and run this server:

```powershell
cd C:\Users\eunho\Desktop\VibeCoding\HangulNoteStaff\omr-server
npm install
copy .env.example .env
npm start
```

3. In Hangul Note Staff, set the OMR server URL to:

```text
http://localhost:8080/omr/jobs
```

## Environment

```text
PORT=8080
AUDIVERIS_BIN=audiveris
OMR_MAX_FILE_MB=30
OMR_TIMEOUT_MS=180000
OMR_CORS_ORIGIN=http://localhost:5174,https://your-vercel-domain.vercel.app
```

## Docker

```bash
docker build -t hangul-note-staff-omr .
docker run --rm -p 8080:8080 -e OMR_CORS_ORIGIN="*" hangul-note-staff-omr
```

The Dockerfile downloads an Audiveris Linux `.deb` from the official GitHub Releases URL via `AUDIVERIS_DEB_URL`.
If that asset changes, build with:

```bash
docker build --build-arg AUDIVERIS_DEB_URL="https://github.com/Audiveris/audiveris/releases/download/<tag>/<asset>.deb" -t hangul-note-staff-omr .
```

## Notes

- Audiveris works best on printed, clean sheet music.
- Handwritten sheet music is not a reliable first target. Use real samples to measure accuracy before promising support.
- Long OMR jobs can take minutes, so deploy this on a Docker-friendly host such as Render, Railway, Fly.io, or Cloud Run rather than Vercel Functions.
