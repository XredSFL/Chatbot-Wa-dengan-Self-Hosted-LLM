<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <div class="greetings">
    <h2>{{ msg }}</h2>
    <p>Klik tombol untuk menguji reaktivitas Vue.</p>
    <button type="button" @click="count++">count is {{ count }}</button>
  </div>
</template>

<style scoped>
.greetings h2 {
  margin: 0 0 0.5rem;
}

button {
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: #1a1a1a;
  color: white;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #42b883;
}
</style>
