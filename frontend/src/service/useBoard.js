import { ref } from 'vue'
import { fetchBoard, claimChore, completeChore } from '../api.js'

export function useBoard() {
    const board = ref(null)
    const loading = ref(true)
    const error = ref(null)

    async function loadBoard() {
        // set loading true, try fethchBoard, store in board.value
        // catch into error.value, finally set loading to false
        loading.value = true
        try {
            const data = await fetchBoard()
            board.value = data
        } catch (err) {
            error.value = err.message
        } finally {
            loading.value = false
        }
    }
    
    async function claim(choreId, memberId) {
        // await claimChore(...)
        // then re run loadBoard() to refresh state
        loading.value = true
        try {
            await claimChore(choreId, memberId)
            await loadBoard()
        }
        catch (err) {
            error.value = err.message
        } finally {
            loading.value = false
        }
    }
    async function complete(choreId) {
        // await completeChore(...)
        // then re run loadBoard() to refresh state
        loading.value = true
        try {
            await completeChore(choreId)
            await loadBoard()
        }
        catch (err) {
            error.value = err.message
        } finally {
            loading.value = false
        }
    }

    return { board, loading, error, loadBoard, claim, complete}
}