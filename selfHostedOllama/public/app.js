const $ = (s) => document.querySelector(s)
const log = $('#log')
const form = $('#form')
const input = $('#input')
const sendBtn = $('#send')
const banner = $('#banner')

let streaming = false

// Buat satu gelembung pesan, kembalikan elemen .content untuk diisi.
function bubble(role, text = '') {
  const label = role === 'user' ? 'Kamu' : role === 'error' ? 'Error' : 'AI'
  const el = document.createElement('div')
  el.className = `msg ${role}`
  const roleEl = document.createElement('div')
  roleEl.className = 'role'
  roleEl.textContent = label
  const content = document.createElement('div')
  content.className = 'content'
  content.textContent = text
  el.append(roleEl, content)
  log.appendChild(el)
  log.scrollTop = log.scrollHeight
  return content
}

// Indikator "sedang mengetik".
function typing() {
  const el = document.createElement('div')
  el.className = 'msg assistant typing'
  el.innerHTML =
    '<div class="role">AI</div><div class="content"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>'
  log.appendChild(el)
  log.scrollTop = log.scrollHeight
  return el
}

async function health() {
  try {
    const h = await (await fetch('/api/health')).json()
    if (!h.running) {
      banner.hidden = false
      banner.textContent = `⚠️ Ollama tidak berjalan. Jalankan "ollama serve". (${h.reason || ''})`
    } else if (!h.hasModel) {
      banner.hidden = false
      banner.textContent = `⚠️ Model "${h.model}" belum ada. Jalankan:  ollama pull ${h.model}`
    } else {
      banner.hidden = true
    }
  } catch {
    banner.hidden = false
    banner.textContent = '⚠️ Tidak bisa menghubungi backend.'
  }
}

async function loadHistory() {
  try {
    const items = await (await fetch('/api/history')).json()
    for (const m of items) bubble(m.role === 'user' ? 'user' : 'assistant', m.content)
  } catch {
    /* abaikan */
  }
}

async function sendMessage(text) {
  streaming = true
  sendBtn.disabled = true
  bubble('user', text)
  const indicator = typing()
  let target = null

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const line = frame.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue

        const obj = JSON.parse(line.slice(5).trim())
        if (obj.error) {
          if (indicator.parentNode) indicator.remove()
          bubble('error', obj.error)
          return
        }
        if (obj.token) {
          if (!target) {
            indicator.remove()
            target = bubble('assistant')
          }
          target.textContent += obj.token
          log.scrollTop = log.scrollHeight
        }
      }
    }
  } catch (err) {
    if (indicator.parentNode) indicator.remove()
    bubble('error', `Gagal terhubung ke server: ${err.message}`)
  } finally {
    if (indicator.parentNode) indicator.remove()
    streaming = false
    sendBtn.disabled = false
    input.focus()
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text || streaming) return
  input.value = ''
  input.style.height = 'auto'
  sendMessage(text)
})

// Enter kirim, Shift+Enter baris baru. Textarea auto-grow.
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    form.requestSubmit()
  }
})
input.addEventListener('input', () => {
  input.style.height = 'auto'
  input.style.height = Math.min(input.scrollHeight, 160) + 'px'
})

$('#reset').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' })
  log.innerHTML = ''
})

health()
loadHistory()
setInterval(health, 10000)
