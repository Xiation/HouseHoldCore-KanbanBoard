<script setup>
defineProps({
  nudges: {
    type: Array,
    required: true
  }
})
</script>

<template>
    <div v-if="nudges.length > 0" class="nudge-banner">
        <p v-for="nudge in nudges" :key="nudge.memberId">
            {{ nudge.name }}
            {{ nudge.daysSinceLastActivity === null 
            ? " hasn't claimed anything in a while"
            : " hasn't claimed anything in " + nudge.daysSinceLastActivity + " days" }}
             days. Consider assigning them a chore.
        </p>
    </div>
</template>