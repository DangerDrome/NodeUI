---
layout: home

hero:
  name: NodeUI
  text: "Connecting ideas, and sharing them."
  tagline: A browser-based node graph editor. Free, open source, and works without any setup.
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
