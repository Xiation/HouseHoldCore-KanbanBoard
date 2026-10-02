<script setup>
import { computed } from 'vue'

const props = defineProps({
  chore: {
    type: Object,
    required: true
  }
})

const formattedDueDate = computed(() => {
  if (!props.chore.dueDate) return null
  return new Date(props.chore.dueDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})
</script>

<template>
    <div class="card" :class="{ 'card--stale': chore.isStale }">
        <p class = "chore-title">{{ chore.title }}</p>
        <p v-if="chore.claimedBy">Claimed by: {{ chore.claimedBy.name }}</p>
        <p v-if="formattedDueDate"> Due: {{ formattedDueDate }}</p>
        <span class="badge"> {{ chore.timeEstimate }}</span>
        <slot></slot>
    </div>
</template>