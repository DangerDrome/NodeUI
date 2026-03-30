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
  window.scrollTo(0, 0)

  // Lazy-load iframes only when scrolled into view
  document.querySelectorAll('iframe[data-src]').forEach(frame => {
    frame.setAttribute('tabindex', '-1')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          frame.src = frame.dataset.src
          observer.disconnect()
        }
      })
    }, { rootMargin: '200px' })
    observer.observe(frame)
  })
})
</script>

<HomeContent />
