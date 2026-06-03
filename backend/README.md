# OpenWA backend (gateway)

WhatsApp gateway minimal yang kompatibel dengan endpoint yang dipakai frontend.
Memakai [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
(Chromium/Puppeteer), jadi benar-benar terhubung ke WhatsApp.

## Install & jalankan

```sh
cd backend
npm install        # mengunduh Chromium (~ratusan MB), butuh beberapa menit
npm start          # listening di http://localhost:2785
```

Saat start, **API KEY** ditampilkan di log (format `owa_…`). Salin ke field
**API Key** di frontend. Untuk memakai key sendiri, set `API_KEY` di environment
(lihat `.env.example`) atau edit `data/api-key.txt`.

## Endpoint

| Method | Path | Keterangan |
| ------ | ---- | ---------- |
| GET    | `/health` | cek hidup (tanpa auth) |
| GET    | `/api/sessions` | daftar session |
| POST   | `/api/sessions` | buat session `{ name }` |
| GET    | `/api/sessions/:id` | detail + status |
| GET    | `/api/sessions/:id/qr` | `{ code, image }` (image = data URL QR) |
| DELETE | `/api/sessions/:id` | logout/hapus |
| POST   | `/api/sessions/:id/messages/send-text` | `{ chatId, text }` (keluar) |
| GET    | `/api/sessions/:id/messages` | riwayat pesan **masuk** yang dibuffer |
| GET    | `/api/sessions/:id/events` | stream pesan **masuk** realtime (SSE) |

Semua `/api/*` butuh header `X-API-Key`. Khusus `/events` (SSE) — karena `EventSource`
tak bisa mengirim header — auth lewat query `?apiKey=...`.

Pesan masuk (dari orang lain ke nomor terhubung) ditangkap via event `message`
whatsapp-web.js, dibuffer (maks 100/ session) lalu di-broadcast ke semua subscriber SSE.

`DATA_DIR` bisa di-override lewat env untuk memakai folder data lain (mis. saat testing).

## Alur

1. `npm start`, salin API key dari log.
2. Di frontend: isi API Key → **Buat + QR** → scan QR dengan WhatsApp di HP.
3. Status berubah `SCAN_QR → CONNECTING → CONNECTED`.
4. Kirim pesan.

> Catatan: Auth WhatsApp dipersist di `data/sessions/` (LocalAuth), jadi session
> dengan nama sama tidak perlu scan ulang setelah restart. Butuh Google Chrome /
> Chromium; di Windows whatsapp-web.js mengunduhnya otomatis lewat Puppeteer.
