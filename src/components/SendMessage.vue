<script setup lang="ts">
import { computed, ref } from 'vue'
import { toChatId, useOpenWa } from '../lib/openwa'

type Status = 'idle' | 'sending' | 'success' | 'error'

// sessionId dikontrol parent (diisi dari tombol "Pakai" di SessionPanel).
const sessionId = defineModel<string>('sessionId', { default: '' })

const { apiKey, setApiKey, sendText } = useOpenWa()

const phone = ref('')
const text = ref('')
const status = ref<Status>('idle')
const message = ref('')

const chatIdPreview = computed(() => (phone.value ? toChatId(phone.value) : '—'))

async function send() {
  if (!sessionId.value || !apiKey.value || !phone.value || !text.value) {
    status.value = 'error'
    message.value = 'Session ID, API Key, nomor, dan pesan wajib diisi.'
    return
  }

  status.value = 'sending'
  message.value = ''

  try {
    await sendText(sessionId.value, toChatId(phone.value), text.value)
    status.value = 'success'
    message.value = `Pesan terkirim ke ${toChatId(phone.value)}.`
    text.value = ''
  } catch (err) {
    status.value = 'error'
    message.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <form class="card" @submit.prevent="send">
    <h2>Kirim Pesan WhatsApp</h2>
    <p class="hint">via OpenWA gateway (proxy ke <code>localhost:2785</code>)</p>

    <div class="grid">
      <label>
        Session ID
        <input v-model.trim="sessionId" type="text" placeholder="pilih dari panel session" />
      </label>
      <label>
        API Key
        <input
          :value="apiKey"
          type="password"
          placeholder="X-API-Key"
          @input="setApiKey(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <label>
      Nomor Tujuan
      <input v-model.trim="phone" type="tel" placeholder="0812xxxx atau 62812xxxx" />
      <small>chatId: <code>{{ chatIdPreview }}</code></small>
    </label>

    <label>
      Pesan
      <textarea v-model="text" rows="4" placeholder="Tulis pesan..."></textarea>
    </label>

    <button type="submit" :disabled="status === 'sending'">
      {{ status === 'sending' ? 'Mengirim...' : 'Kirim' }}
    </button>

    <p v-if="message" class="result" :class="status" role="status">{{ message }}</p>
  </form>
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

.hint {
  margin: -0.75rem 0 0;
  font-size: 0.85rem;
  opacity: 0.7;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.9rem;
}

input,
textarea {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  background: transparent;
  color: inherit;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #42b883;
}

small {
  font-weight: 400;
  opacity: 0.7;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

button {
  padding: 0.7rem 1.2rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background-color: #42b883;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result {
  margin: 0;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.result.success {
  background: rgba(66, 184, 131, 0.15);
  color: #2c8c63;
}

.result.error {
  background: rgba(220, 53, 69, 0.15);
  color: #c92a3a;
}

@media (max-width: 480px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
