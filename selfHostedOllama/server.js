// Self-hosted AI chat — backend ringan TANPA dependency (hanya modul inti Node 18+).
// Menyajikan UI statis + meneruskan chat ke Ollama (endpoint OpenAI-compatible)
// dengan streaming token demi token (SSE). Riwayat percakapan disimpan di memori.
//
// Konfigurasi via env (semua opsional):
//   PORT          (default 8787)
//   OLLAMA_URL    (default http://localhost:11434)
//   MODEL         (default qwen2.5:3b)
//   SYSTEM_PROMPT (default: asisten WA ringkas)

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = Number(process.env.PORT || 8787)
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '')
const MODEL = process.env.MODEL || 'qwen2.5:1.5b'
const SYSTEM_PROMPT =
  process.env.SYSTEM_PROMPT ||
  'Kamu asisten WhatsApp yang ramah, membantu, dan ringkas. ' +
    'Jawab dalam bahasa yang sama dengan pengguna (biasanya Bahasa Indonesia).'

// Riwayat percakapan di memori — single-user localhost, tanpa database.
let history = [{ role: 'system', content: SYSTEM_PROMPT }]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type })
  res.end(body)
}

async function serveStatic(res, file) {
  try {
    const data = await readFile(join(__dirname, 'public', file))
    send(res, 200, MIME[extname(file)] || 'application/octet-stream', data)
  } catch {
    send(res, 404, 'text/plain; charset=utf-8', 'Not found')
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => resolve(b))
    req.on('error', reject)
  })
}

// Cek status Ollama + ketersediaan model.
async function checkOllama() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) })
    if (!r.ok) return { running: false, model: MODEL, reason: `Ollama menjawab HTTP ${r.status}` }
    const data = await r.json()
    const models = (data.models || []).map((m) => m.name)
    return { running: true, model: MODEL, hasModel: models.includes(MODEL), models }
  } catch (e) {
    return { running: false, model: MODEL, reason: e.message }
  }
}

async function handleChat(req, res) {
  const raw = await readBody(req)
  let message = ''
  try {
    message = JSON.parse(raw).message
  } catch {
    /* abaikan; ditangani di bawah */
  }
  if (!message || !String(message).trim()) {
    return send(res, 400, 'application/json', JSON.stringify({ error: 'Pesan kosong.' }))
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)

  history.push({ role: 'user', content: String(message) })

  let upstream
  try {
    upstream = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: history, stream: true }),
    })
  } catch (e) {
    history.pop()
    sse({
      error: `Tidak bisa terhubung ke Ollama di ${OLLAMA_URL}. Pastikan "ollama serve" berjalan. (${e.message})`,
    })
    return res.end()
  }

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => '')
    history.pop()
    let msg = `Ollama error HTTP ${upstream.status}.`
    if (upstream.status === 404 || /not found|no such model|try pulling/i.test(txt)) {
      msg = `Model "${MODEL}" belum tersedia. Jalankan:  ollama pull ${MODEL}`
    }
    sse({ error: msg })
    return res.end()
  }

  // Parse SSE dari Ollama (format OpenAI) → teruskan token ke browser.
  const decoder = new TextDecoder()
  let buffer = ''
  let assistant = ''
  try {
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let nl
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload)
          const token = json.choices?.[0]?.delta?.content || ''
          if (token) {
            assistant += token
            sse({ token })
          }
        } catch {
          /* lewati frame non-JSON */
        }
      }
    }
  } catch (e) {
    sse({ error: `Streaming terputus: ${e.message}` })
  }

  history.push({ role: 'assistant', content: assistant })
  sse({ done: true })
  res.end()
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req
  try {
    if (method === 'GET' && (url === '/' || url === '/index.html')) return serveStatic(res, 'index.html')
    if (method === 'GET' && url === '/style.css') return serveStatic(res, 'style.css')
    if (method === 'GET' && url === '/app.js') return serveStatic(res, 'app.js')

    if (method === 'GET' && url === '/api/health') {
      return send(res, 200, 'application/json', JSON.stringify(await checkOllama()))
    }
    if (method === 'GET' && url === '/api/history') {
      return send(res, 200, 'application/json', JSON.stringify(history.filter((m) => m.role !== 'system')))
    }
    if (method === 'POST' && url === '/api/reset') {
      history = [{ role: 'system', content: SYSTEM_PROMPT }]
      return send(res, 200, 'application/json', JSON.stringify({ ok: true }))
    }
    if (method === 'POST' && url === '/api/chat') return handleChat(req, res)

    send(res, 404, 'text/plain; charset=utf-8', 'Not found')
  } catch (e) {
    send(res, 500, 'application/json', JSON.stringify({ error: e.message }))
  }
})

server.listen(PORT, () => {
  console.log('────────────────────────────────────────────')
  console.log(`  Self-hosted Ollama chat`)
  console.log(`  UI + API : http://localhost:${PORT}`)
  console.log(`  Ollama   : ${OLLAMA_URL}`)
  console.log(`  Model    : ${MODEL}`)
  console.log('────────────────────────────────────────────')
})
