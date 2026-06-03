<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useOpenWa, type AiHealth, type Session, type SessionStatus } from '../lib/openwa'

const emit = defineEmits<{ select: [id: string] }>()

const {
  apiKey,
  setApiKey,
  listSessions,
  createSession,
  getSession,
  getQr,
  deleteSession,
  setAi,
  aiHealth,
} = useOpenWa()

const sessions = ref<Session[]>([])
const newName = ref('')
const error = ref('')
const loading = ref(false)
const ai = ref<AiHealth | null>(null)

// State QR untuk session yang sedang dihubungkan.
const qrSessionId = ref('')
const qrImage = ref('')
const qrStatus = ref<SessionStatus>('')

let pollTimer: ReturnType<typeof setInterval> | undefined

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
}

onUnmounted(stopPolling)

async function refresh() {
  error.value = ''
  loading.value = true
  try {
    sessions.value = (await listSessions()) ?? []
    loadAiHealth()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadAiHealth() {
  try {
    ai.value = await aiHealth()
  } catch {
    ai.value = null
  }
}

async function toggleAi(s: Session) {
  try {
    const r = await setAi(s.id, !s.aiEnabled)
    s.aiEnabled = r.aiEnabled
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function create() {
  if (!newName.value.trim()) return
  error.value = ''
  try {
    const session = await createSession(newName.value.trim())
    newName.value = ''
    await refresh()
    if (session?.id) connect(session.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

// Mulai pantau satu session: ambil status berkala, tampilkan QR saat SCAN_QR,
// berhenti saat sudah CONNECTED / gagal.
function connect(id: string) {
  stopPolling()
  qrSessionId.value = id
  qrImage.value = ''
  qrStatus.value = ''

  const tick = async () => {
    try {
      const session = await getSession(id)
      qrStatus.value = session?.status ?? ''

      if (qrStatus.value === 'SCAN_QR' || qrStatus.value === 'INITIALIZING') {
        qrImage.value = await getQr(id).catch(() => '')
      }
      if (
        qrStatus.value === 'CONNECTED' ||
        qrStatus.value === 'FAILED' ||
        qrStatus.value === 'DISCONNECTED'
      ) {
        qrImage.value = ''
        stopPolling()
        refresh()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      stopPolling()
    }
  }

  tick()
  pollTimer = setInterval(tick, 3000)
}

async function remove(id: string) {
  error.value = ''
  try {
    await deleteSession(id)
    if (qrSessionId.value === id) {
      stopPolling()
      qrSessionId.value = ''
      qrImage.value = ''
    }
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function badgeClass(status: SessionStatus): string {
  if (status === 'CONNECTED') return 'ok'
  if (status === 'FAILED' || status === 'DISCONNECTED') return 'bad'
  return 'pending'
}
</script>

<template>
  <section class="card">
    <h2>Session WhatsApp</h2>

    <label class="key">
      API Key
      <input
        :value="apiKey"
        type="password"
        placeholder="X-API-Key"
        @input="setApiKey(($event.target as HTMLInputElement).value)"
      />
    </label>

    <div class="row">
      <button type="button" :disabled="loading" @click="refresh">
        {{ loading ? 'Memuat...' : 'Muat session' }}
      </button>
      <form class="create" @submit.prevent="create">
        <input v-model="newName" type="text" placeholder="Nama session baru" />
        <button type="submit">Buat + QR</button>
      </form>
    </div>

    <p v-if="ai" class="ai-status" :class="{ bad: !ai.running || !ai.hasModel }">
      <template v-if="ai.running && ai.hasModel">🤖 AI siap — model {{ ai.model }}</template>
      <template v-else-if="ai.running && !ai.hasModel">
        ⚠️ Model {{ ai.model }} belum ada — jalankan: ollama pull {{ ai.model }}
      </template>
      <template v-else>⚠️ Ollama tidak berjalan ({{ ai.reason }}) — jalankan: ollama serve</template>
    </p>

    <ul v-if="sessions.length" class="list">
      <li v-for="s in sessions" :key="s.id">
        <div class="meta">
          <strong>{{ s.name || s.id }}</strong>
          <span class="badge" :class="badgeClass(s.status)">{{ s.status }}</span>
          <span v-if="s.aiEnabled" class="badge ai">AI auto-reply ON</span>
          <small v-if="s.phoneNumber">{{ s.phoneNumber }}</small>
        </div>
        <div class="actions">
          <button type="button" @click="emit('select', s.id)">Pakai</button>
          <button type="button" @click="connect(s.id)">QR</button>
          <button
            type="button"
            :class="s.aiEnabled ? 'ai-on' : 'ai-off'"
            :title="s.aiEnabled ? 'Matikan auto-reply AI' : 'Aktifkan auto-reply AI'"
            @click="toggleAi(s)"
          >
            {{ s.aiEnabled ? '🤖 AI ON' : '🤖 AI OFF' }}
          </button>
          <button type="button" class="danger" @click="remove(s.id)">Hapus</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">Belum ada session dimuat.</p>

    <div v-if="qrSessionId" class="qr">
      <p>
        Session <code>{{ qrSessionId }}</code> — status:
        <strong>{{ qrStatus || '...' }}</strong>
      </p>
      <img v-if="qrImage" :src="qrImage" alt="QR code WhatsApp" width="240" height="240" />
      <p v-else-if="qrStatus === 'CONNECTED'" class="ok-text">✅ Terhubung!</p>
      <p v-else class="hint">Menunggu QR...</p>
    </div>

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

h2 {
  margin: 0;
}

label.key {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.9rem;
}

input {
  font: inherit;
  padding: 0.55rem 0.7rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  background: transparent;
  color: inherit;
}

input:focus {
  outline: none;
  border-color: #42b883;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.create {
  display: flex;
  gap: 0.5rem;
  flex: 1;
  min-width: 220px;
}

.create input {
  flex: 1;
}

button {
  padding: 0.5rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: #42b883;
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button.danger {
  background-color: #c92a3a;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.actions button {
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
}

.badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.badge.ok {
  background: rgba(66, 184, 131, 0.2);
  color: #2c8c63;
}

.badge.bad {
  background: rgba(220, 53, 69, 0.18);
  color: #c92a3a;
}

.badge.pending {
  background: rgba(255, 193, 7, 0.22);
  color: #9a7b00;
}

.badge.ai {
  background: rgba(16, 163, 127, 0.2);
  color: #0d8c6d;
}

.ai-status {
  margin: 0;
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  font-size: 0.85rem;
  background: rgba(16, 163, 127, 0.12);
  color: #0d8c6d;
}

.ai-status.bad {
  background: rgba(255, 193, 7, 0.18);
  color: #9a7b00;
}

button.ai-on {
  background-color: #10a37f;
}

button.ai-off {
  background-color: var(--panel-2, #6b7280);
  background-color: #6b7280;
}

.empty,
.hint {
  opacity: 0.7;
  font-size: 0.9rem;
  margin: 0;
}

.qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px dashed rgba(128, 128, 128, 0.4);
  border-radius: 8px;
}

.qr img {
  border: 8px solid #fff;
  border-radius: 8px;
}

.ok-text {
  color: #2c8c63;
  font-weight: 600;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.error {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(220, 53, 69, 0.15);
  color: #c92a3a;
  font-size: 0.9rem;
}
</style>
