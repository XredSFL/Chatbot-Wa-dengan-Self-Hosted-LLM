<script setup lang="ts">
import { ref } from 'vue'
import SessionPanel from './components/SessionPanel.vue'
import SendMessage from './components/SendMessage.vue'
import InboxPanel from './components/InboxPanel.vue'

const sessionId = ref('')
</script>

<template>
  <header>
    <img class="logo" src="./assets/logo.svg" alt="Vue logo" width="48" height="48" />
    <h1>OpenWA Sender</h1>
  </header>

  <main>
    <SessionPanel @select="sessionId = $event" />
    <SendMessage v-model:session-id="sessionId" />
    <InboxPanel :session-id="sessionId" />
  </main>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.logo {
  flex-shrink: 0;
}

main {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
}
</style>
