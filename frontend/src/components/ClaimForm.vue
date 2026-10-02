<script setup>
import { ref } from 'vue'
import Select from 'primevue/select'
import Button from 'primevue/button'
const props = defineProps({
    claim: {
        type: Function,
        required: true
    },
    chore: {
        type: Object,
        required: true
    },
    members: {
        type: Array,
        required: true
    }
})

const selectedMemberId = ref(null)

function handleClaim() {
    // placeholder, NEED TO BE CHECKED LATER
    if (selectedMemberId.value) {
        props.claim(props.chore.id, selectedMemberId.value)
    } else {
        alert('Please select a member to claim the chore.')
    }
}

</script>

<template>
    <Select
        v-model="selectedMemberId"
        :options="members"
        optionLabel="name"
        optionValue="id"
        placeholder="Select a member..."
    />
    <Button label="Claim" @click="handleClaim" />
</template>