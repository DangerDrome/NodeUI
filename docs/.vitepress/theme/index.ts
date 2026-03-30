import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { h } from 'vue'
import HomeContent from './components/HomeContent.vue'
import HeroNodeEmbed from './components/HeroNodeEmbed.vue'
import './custom.css'
import '../../../src/styles/variables.css'
import '../../../src/styles/icons.css'
import '../../../src/styles/nodes.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-image': () => h(HeroNodeEmbed)
    })
  },
  enhanceApp({ app }) {
    app.component('HomeContent', HomeContent)
  }
} satisfies Theme
