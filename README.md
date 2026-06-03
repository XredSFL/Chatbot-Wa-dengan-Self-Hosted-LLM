# vue-app

Vue 3 + Vite + TypeScript + Vitest. Berisi halaman sederhana untuk
mengirim pesan WhatsApp lewat [OpenWA](https://github.com/rmyndharis/OpenWA) gateway.

## OpenWA

Tersedia juga backend gateway sendiri di folder [backend/](backend/) (Express +
whatsapp-web.js) yang menyediakan endpoint yang sama di port `2785` — tidak wajib
pakai OpenWA asli.

Vite dev server mem-proxy `/api` ke `http://localhost:2785` (lihat `vite.config.ts`)
agar tidak terkena CORS. Ubah `target` proxy jika host/port berbeda.

Alur pakai (dengan backend lokal):
1. Jalankan backend: `cd backend && npm install && npm start` → salin **API Key** dari log (format `owa_…`).
2. Jalankan frontend: `npm run dev`, isi API Key.
3. **Buat + QR** session baru → scan QR yang muncul dengan WhatsApp → tunggu status `CONNECTED`.
4. Klik **Pakai** pada session untuk mengisi Session ID, lalu kirim pesan dari form di sebelahnya.

**Inbox live:** pesan yang masuk ke nomor terhubung tampil realtime di panel Inbox
(via Server-Sent Events `GET /api/sessions/:id/events`). Pilih session aktif (klik "Pakai"),
panel inbox otomatis mendengarkan.

**AI auto-reply:** klik tombol **🤖 AI OFF → ON** pada sebuah session untuk mengaktifkan
balasan otomatis. Setiap pesan pribadi yang masuk diteruskan ke Ollama (`qwen2.5:3b`),
dan balasannya langsung dikirim kembali ke pengirimnya via WhatsApp. Riwayat percakapan
disimpan **per pengirim** di memori. Butuh Ollama berjalan + model ter-pull
(lihat [selfHostedOllama/](selfHostedOllama/)). Default OFF demi keamanan.
Endpoint: `POST /api/sessions/:id/ai { enabled }`, `GET /api/ai/health`.

Endpoint yang dipakai: `GET/POST/DELETE /api/sessions`, `GET /api/sessions/:id/qr`,
`POST /api/sessions/:id/messages/send-text`, `GET /api/sessions/:id/messages`,
`GET /api/sessions/:id/events` (SSE). Logika gateway dibungkus di
[src/lib/openwa.ts](src/lib/openwa.ts) (komposabel `useOpenWa` + helper murni yang diuji di Vitest).

## Setup

```sh
npm install
```

## Perintah

| Perintah            | Keterangan                                  |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Jalankan dev server (hot reload)            |
| `npm run build`     | Type-check + build produksi ke `dist/`      |
| `npm run preview`   | Preview hasil build secara lokal            |
| `npm run test`      | Jalankan Vitest (watch mode)                |
| `npm run test:run`  | Jalankan Vitest sekali (untuk CI)           |

## Struktur

```
src/
  assets/        aset statis (css, gambar)
  components/    komponen Vue
    __tests__/   unit test (Vitest)
  App.vue        komponen root
  main.ts        entry point
```
