---
layout: home

hero:
  name: NodeUI
  text: "UI for Node, simplified."
  tagline: A collaborative canvas for engineering complex node-based architectures. Precision meets atmospheric depth.
  actions:
    - theme: brand
      text: Launch
      link: https://app.nodeui.io
    - theme: alt
      text: View Docs
      link: /guide/

---

<script setup>
import { onMounted } from 'vue'
onMounted(() => {
  // Prevent iframes from stealing focus and scrolling the page
  document.querySelectorAll('iframe').forEach(f => f.setAttribute('tabindex', '-1'))
  // Keep forcing top position until all iframes have loaded
  const forceTop = setInterval(() => window.scrollTo(0, 0), 100)
  setTimeout(() => clearInterval(forceTop), 3000)
})
</script>

<HomeContent />
