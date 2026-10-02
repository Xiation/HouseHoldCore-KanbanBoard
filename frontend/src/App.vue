<script setup>
// import HelloWorld from './components/HelloWorld.vue'
import { onMounted } from 'vue'
import { useBoard } from './service/useBoard.js'
import Board from './components/Board.vue'

const { board, loading, error, loadBoard, claim, complete } = useBoard()

onMounted(() => {
  loadBoard()
})

</script>

<template>
  <div v-if="loading" class="status-message">Loading...</div>
  <div v-else-if="error" class="status-message status-message--error"> {{ error }}</div>
  <div v-else>
    <Board :board="board" :claim="claim" :complete="complete" />
  </div>
</template>
