import { ref } from 'vue'

// ---------------------------------------------------------------------------
// Fungsi murni (mudah diuji tanpa server)
// ---------------------------------------------------------------------------

/**
 * Ubah nomor lokal jadi chatId WhatsApp: 628xxx@c.us
 * - buang semua karakter non-digit
 * - awalan "0" -> "62"; "+62"/"62" tetap (setelah non-digit dibuang)
 */
export function toChatId(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  return `${digits}@c.us`
}

/**
 * Normalisasi respons OpenWA. Beberapa endpoint membungkus payload dalam
 * `{ success, data }`, sebagian mengembalikan objek mentah. Kembalikan `.data`
 * bila ada, selain itu body apa adanya.
 */
export function unwrap<T = unknown>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in (json as Record<string, unknown>)) {
    return (json as { data: T }).data
  }
  return json as T
}

/**
 * Ambil data URL gambar QR dari berbagai bentuk respons yang mungkin:
 * `data.image`, `data.qr`, atau langsung `image` / `qr`.
 * Mengembalikan string kosong bila tidak ada.
 */
export function getQrImage(json: unknown): string {
  const d = unwrap<Record<string, unknown>>(json) ?? {}
  const candidate = d.image ?? d.qr ?? d.code
  return typeof candidate === 'string' ? candidate : ''
}

// ---------------------------------------------------------------------------
// Tipe
// ---------------------------------------------------------------------------

export type SessionStatus =
  | 'INITIALIZING'
  | 'SCAN_QR'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'FAILED'
  | string

export interface Session {
  id: string
  name?: string
  status: SessionStatus
  phoneNumber?: string
  aiEnabled?: boolean
}

export interface AiHealth {
  running: boolean
  model: string
  hasModel?: boolean
  reason?: string
}

export interface InboxMessage {
  id: string
  sessionId: string
  from: string
  fromName?: string
  body: string
  type?: string
  hasMedia?: boolean
  outgoing?: boolean
  timestamp: number
}

/** Bangun URL SSE untuk inbox (auth via query karena EventSource tak bisa set header). */
export function buildEventsUrl(id: string, key: string): string {
  return `/api/sessions/${encodeURIComponent(id)}/events?apiKey=${encodeURIComponent(key)}`
}

// ---------------------------------------------------------------------------
// Composable: kredensial + wrapper fetch ke gateway (proxy /api)
// ---------------------------------------------------------------------------

// API key dibagikan lintas komponen + persist ke localStorage.
const apiKey = ref<string>(localStorage.getItem('owa.apiKey') ?? '')

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-API-Key': apiKey.value,
    ...(init.headers as Record<string, string> | undefined),
  }
  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`/api${path}`, { ...init, headers })
  const text = await res.text()
  let json: unknown = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = text
  }

  if (!res.ok) {
    const detail =
      (json && typeof json === 'object' && 'message' in json
        ? String((json as Record<string, unknown>).message)
        : '') || text || res.statusText
    throw new Error(`HTTP ${res.status} — ${detail}`)
  }

  return unwrap<T>(json)
}

export function useOpenWa() {
  function setApiKey(key: string) {
    apiKey.value = key
    localStorage.setItem('owa.apiKey', key)
  }

  return {
    apiKey,
    setApiKey,
    request,

    listSessions: () => request<Session[]>('/sessions'),
    listMessages: (id: string) =>
      request<InboxMessage[]>(`/sessions/${encodeURIComponent(id)}/messages`),
    eventsUrl: (id: string) => buildEventsUrl(id, apiKey.value),
    createSession: (name: string) =>
      request<Session>('/sessions', { method: 'POST', body: JSON.stringify({ name }) }),
    getSession: (id: string) => request<Session>(`/sessions/${encodeURIComponent(id)}`),
    // QR butuh respons mentah agar getQrImage bisa cek beberapa bentuk field.
    getQr: (id: string) =>
      request<unknown>(`/sessions/${encodeURIComponent(id)}/qr`).then(getQrImage),
    deleteSession: (id: string) =>
      request<unknown>(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    setAi: (id: string, enabled: boolean) =>
      request<{ id: string; aiEnabled: boolean }>(`/sessions/${encodeURIComponent(id)}/ai`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      }),
    aiHealth: () => request<AiHealth>('/ai/health'),
    sendText: (id: string, chatId: string, text: string) =>
      request<unknown>(`/sessions/${encodeURIComponent(id)}/messages/send-text`, {
        method: 'POST',
        body: JSON.stringify({ chatId, text }),
      }),
  }
}
