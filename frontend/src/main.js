import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import './style.css'
import App from './App.vue'

const ChoreBoardPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c',
      500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12', 950: '#431407'
        }
    }
})

const app = createApp(App)

app.use(PrimeVue, { 
    theme: {
        preset: ChoreBoardPreset,
    },
})

app.mount('#app')