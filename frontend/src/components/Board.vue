<script setup>
import { defineProps } from 'vue'
import ChoreCard from './ChoreCard.vue'
import NudgeBanner from './NudgeBanner.vue'
import ClaimForm from './ClaimForm.vue'
import Button from 'primevue/button'
const props = defineProps({
  board: {
    type: Object,
    required: true
  },
  claim: {
    type: Function,
    required: true
  },
  complete: {
    type: Function,
    required: true
  }
})
</script>

<template>
    <NudgeBanner :nudges="board.nudges" />
    <div class="board">
        <section>
            <h2>Unclaimed</h2>
                <ChoreCard v-for="chore in board.unclaimed" :key="chore.id" :chore="chore">
                    <ClaimForm :chore="chore" :claim="claim" :members="board.members" />
                </ChoreCard>
        </section>

        <!-- <section>
            <h2>Claimed</h2>
                <ChoreCard v-for="chore in board.claimedTodo" :key="chore.id" :chore="chore">
                    <Button label="Mark Done" @click="complete(chore.id)" />
                </ChoreCard>
        </section> -->

        <section>
            <h2>In Progress</h2>
                <ChoreCard v-for="chore in board.inProgress" :key="chore.id" :chore="chore">
                    <Button label="Mark Done" @click="complete(chore.id)" />
                </ChoreCard>
        </section>

        <section>
            <h2>Completed</h2>
            <ChoreCard v-for="chore in board.done" :key="chore.id" :chore="chore"/>
        </section>
    </div>

    <!-- <div class="board">
        <div v-for="(column, columnIndex) in board.columns" :key="columnIndex" class="column">
        <h2>{{ column.name }}</h2>
        <div v-for="(chore, choreIndex) in column.chores" :key="choreIndex" class="chore">
            <p>{{ chore.name }}</p>
            <button v-if="!chore.claimed" @click="claim(chore.id)">Claim</button>
            <button v-if="chore.claimed && !chore.completed" @click="complete(chore.id)">Complete</button>
            <span v-if="chore.completed">Completed</span>
        </div>
        </div>
    </div> -->
</template>