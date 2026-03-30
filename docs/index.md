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
  // Prevent all iframes from stealing focus
  document.querySelectorAll('iframe').forEach(f => {
    f.setAttribute('tabindex', '-1')
    f.setAttribute('sandbox', f.getAttribute('sandbox') || 'allow-scripts allow-same-origin')
  })

  // Lazy-load iframes only when scrolled into view
  document.querySelectorAll('iframe[data-src]').forEach(frame => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        frame.src = frame.dataset.src
        observer.disconnect()
      }
    }, { rootMargin: '300px' })
    observer.observe(frame)
  })

  // Single scroll reset after everything is set up
  requestAnimationFrame(() => window.scrollTo(0, 0))
})
</script>

<HomeContent />
