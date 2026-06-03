<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useOpenWa, type InboxMessage } from '../lib/openwa'

// sessionId yang dipilih di app (dari SessionPanel / SendMessage).
const props = defineProps<{ sessionId: string }>()

const { listMessages, eventsUrl } = useOpenWa()

const messages = ref<InboxMessage[]>([])
const connected = ref(false)
const error = ref('')

let source: EventSource | undefined

function close() {
  source?.close()
  source = undefined
  connected.value = false
}

onUnmounted(close)

function add(msg: InboxMessage) {
  // Hindari duplikat (muatan awal vs stream).
  if (messages.value.some((m) => m.id === msg.id)) return
  messages.value.unshift(msg)
}

async function start(id: string) {
  close()
  messages.value = []
  error.value = ''
  if (!id) return

  // Muatan awal: riwayat yang dibuffer server.
  try {
    const history = await listMessages(id)
    messages.value = [...(history ?? [])].reverse()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }

  // Stream realtime via SSE.
  source = new EventSource(eventsUrl(id))
  source.onopen = () => {
    connected.value = true
    error.value = ''
  }
  source.onmessage = (ev) => {
    try {
      add(JSON.parse(ev.data) as InboxMessage)
    } catch {
      /* abaikan frame non-JSON */
    }
  }
  source.onerror = () => {
    connected.value = false
    error.value = 'Koneksi inbox terputus, mencoba menyambung ulang...'
  }
}

watch(() => props.sessionId, start, { immediate: true })

function fmtTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString()
}
</script>

<template>
  <section class="card">
    <header class="head">
      <h2>Inbox (pesan masuk)</h2>
      <span class="dot" :class="{ live: connected }" :title="connected ? 'Live' : 'Terputus'">
        {{ connected ? 'live' : 'off' }}
      </span>
    </header>

    <p v-if="!sessionId" class="hint">Pilih/aktifkan session (klik "Pakai") untuk mendengarkan pesan masuk.</p>
    <p v-else-if="!messages.length" class="hint">
      Mendengarkan session <code>{{ sessionId }}</code>… belum ada pesan masuk.
    </p>

    <ul v-if="messages.length" class="list">
      <li v-for="m in messages" :key="m.id" :class="{ outgoing: m.outgoing }">
        <div class="meta">
          <strong>{{ m.fromName || m.from }}</strong>
          <small>{{ m.from }}</small>
          <small class="time">{{ fmtTime(m.timestamp) }}</small>
        </div>
        <p class="body">
          <span v-if="m.hasMedia" class="media">[media]</span>
          {{ m.body || (m.hasMedia ? '(lampiran tanpa teks)' : '') }}
        </p>
      </li>
    </ul>

    <p v-if="error" class="error" role="status">{{ error }}</p>
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 520px;
  padding: 1.75rem;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 12px;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
}

.dot {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.25);
  color: #777;
}

.dot.live {
  background: rgba(66, 184, 131, 0.2);
  color: #2c8c63;
}

.hint {
  opacity: 0.7;
  font-size: 0.9rem;
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 420px;
  overflow-y: auto;
}

.list li {
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
}

.list li.outgoing {
  background: rgba(16, 163, 127, 0.1);
  border-color: rgba(16, 163, 127, 0.35);
  margin-left: 1.5rem;
}

.meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.meta small {
  opacity: 0.65;
}

.time {
  margin-left: auto;
}

.body {
  margin: 0.35rem 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.media {
  font-weight: 700;
  color: #42b883;
  margin-right: 0.25rem;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.error {
  margin: 0;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: rgba(255, 193, 7, 0.18);
  color: #9a7b00;
  font-size: 0.85rem;
}
</style>
