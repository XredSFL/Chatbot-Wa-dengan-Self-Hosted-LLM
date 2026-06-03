# Self-Hosted AI Chat (Ollama)

Aplikasi chat AI yang berjalan **sepenuhnya di localhost**, ditenagai
[Ollama](https://ollama.com) dengan model kecil. UI + API disajikan dari **satu
server Node.js** (tanpa dependency, tanpa framework, tanpa database). Balasan AI
muncul **streaming token demi token**.

Tujuan: jadi otak AI untuk menjawab pesan WhatsApp yang masuk (lihat bagian
[Integrasi WhatsApp](#integrasi-whatsapp)).

## Prasyarat: Ollama

Aplikasi ini butuh Ollama berjalan di `http://localhost:11434` dengan model `qwen2.5:3b`.

**Windows**

```powershell
winget install Ollama.Ollama     # atau unduh dari https://ollama.com/download
ollama pull qwen2.5:3b
```

**Linux / VPS**

```bash
curl -fsSL https://ollama.com/install.sh | sh   # systemd auto-start "ollama serve"
ollama pull qwen2.5:3b
```

> **Model:** `qwen2.5:3b` dipilih karena kualitas Bahasa Indonesia terbaik di
> kelas 3B dan ringan untuk CPU (~2 GB, butuh ±3–4 GB RAM). Untuk VPS sangat kecil,
> ganti ke `qwen2.5:1.5b` (set env `MODEL`).

## Menjalankan (satu perintah)

```bash
cd selfHostedOllama
npm start
```

Lalu buka **http://localhost:8787** di browser.

Tidak ada `npm install` — nol dependency, cukup Node.js ≥ 18.

## Konfigurasi (opsional, via env)

| Env             | Default                  | Keterangan                    |
| --------------- | ------------------------ | ----------------------------- |
| `PORT`          | `8787`                   | Port UI + API                 |
| `OLLAMA_URL`    | `http://localhost:11434` | Alamat Ollama                 |
| `MODEL`         | `qwen2.5:3b`             | Model yang dipakai            |
| `SYSTEM_PROMPT` | (asisten WA ringkas)     | Instruksi sistem untuk AI     |

Contoh: `MODEL=qwen2.5:1.5b PORT=9000 npm start`

## Struktur

```
selfHostedOllama/
├── server.js          # server Node (static + proxy streaming ke Ollama)
├── package.json       # tanpa dependency, script "start"
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js         # UI chat + parsing stream SSE
└── README.md
```

## API

| Method | Path           | Keterangan                                       |
| ------ | -------------- | ------------------------------------------------ |
| GET    | `/api/health`  | status Ollama + apakah model tersedia            |
| GET    | `/api/history` | riwayat percakapan (di memori)                   |
| POST   | `/api/reset`   | kosongkan riwayat                                |
| POST   | `/api/chat`    | `{ message }` → balasan streaming (SSE)          |

## Penanganan error

- **Ollama belum jalan** → banner peringatan + pesan jelas di chat ("Jalankan ollama serve").
- **Model belum ada** → "Jalankan: ollama pull qwen2.5:3b".
- **Koneksi terputus saat streaming** → pesan error muncul sebagai gelembung.

## Integrasi WhatsApp

Backend WA (folder `../backend`) bisa meneruskan pesan masuk ke sini lewat
`POST /api/chat`, lalu mengirim balasannya kembali via `send-text`. Endpoint chat
sudah siap dipakai program; integrasi otomatis bisa ditambahkan berikutnya.
