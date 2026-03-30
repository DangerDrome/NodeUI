---
layout: home

hero:
  name: NodeUI
  text: "Connecting ideas, and sharing them."
  tagline: Build node graphs, flowcharts, and diagrams directly in the browser. No installs, no accounts — just open and start connecting ideas and share.
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
  // Lazy-load iframes only when scrolled into view
  document.querySelectorAll('iframe[data-src]').forEach(frame => {
    frame.setAttribute('tabindex', '-1')
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        frame.src = frame.dataset.src
        observer.disconnect()
      }
    }, { rootMargin: '300px' })
    observer.observe(frame)
  })
})
</script>

<HomeContent />
