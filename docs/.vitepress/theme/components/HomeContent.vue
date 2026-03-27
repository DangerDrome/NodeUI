<script setup>
const nodeTypes = [
  { name: 'BaseNode', desc: 'Standard nodes with rich markdown content, resizing, and color variants.', color: 'green', link: '/nodes/base-node' },
  { name: 'GroupNode', desc: 'Container nodes for organizing and managing collections of child nodes.', color: 'blue', link: '/nodes/group-node' },
  { name: 'SubGraphNode', desc: 'Nested graph containers with independent state and breadcrumb navigation.', color: 'purple', link: '/nodes/subgraph-node' },
  { name: 'ThreeJSNode', desc: 'Full 3D viewport with integrated Three.js scene, camera controls, and lighting.', color: 'blue', link: '/nodes/threejs-node' },
  { name: 'RoutingNode', desc: 'Minimalist nodes for managing edge paths and routing connections cleanly.', color: 'yellow', link: '/nodes/routing-node' },
  { name: 'LogNode', desc: 'Real-time event logging and debugging interface for monitoring graph activity.', color: 'red', link: '/nodes/log-node' },
  { name: 'SettingsNode', desc: 'Application configuration and preferences with a built-in settings panel.', color: 'green', link: '/nodes/settings-node' },
  { name: 'ImageSequenceNode', desc: 'Frame-by-frame image animation with playback controls and timeline integration.', color: 'yellow', link: '/nodes/image-sequence-node' },
]

const archItems = [
  { icon: '📡', title: 'Event-Driven', desc: 'Central pub/sub event bus for decoupled inter-module communication.' },
  { icon: '🧩', title: 'Modular', desc: 'Self-contained modules with clear interfaces and single responsibilities.' },
  { icon: '⚡', title: 'GPU Accelerated', desc: 'Hardware-accelerated 3D rendering with lazy-loaded Three.js.' },
  { icon: '💾', title: 'Auto-Persist', desc: 'Continuous local storage and IndexedDB persistence with auto-save.' },
  { icon: '☁️', title: 'Serverless', desc: 'Cloudflare Durable Objects for zero-server collaboration infrastructure.' },
  { icon: '📦', title: 'Zero Dependencies', desc: 'Pure vanilla JavaScript with CDN-loaded libraries on demand.' },
]
</script>

<template>
  <!-- Screenshot Showcase -->
  <div class="nodeui-section">
    <h2 class="nodeui-section-title">See it in action</h2>
    <p class="nodeui-section-subtitle">A powerful visual editor that runs entirely in your browser</p>
    <div class="nodeui-screenshot">
      <img src="/screenshot.png" alt="NodeUI Interface" loading="lazy" />
    </div>
  </div>

  <!-- Node Types -->
  <div class="nodeui-section">
    <h2 class="nodeui-section-title">Built-in Node Types</h2>
    <p class="nodeui-section-subtitle">8 specialized node types for every use case</p>
    <div class="nodeui-node-grid">
      <a
        v-for="node in nodeTypes"
        :key="node.name"
        :href="node.link"
        :class="['nodeui-node-card', `color-${node.color}`]"
      >
        <h3>{{ node.name }}</h3>
        <p>{{ node.desc }}</p>
      </a>
    </div>
  </div>

  <!-- Architecture -->
  <div class="nodeui-section">
    <h2 class="nodeui-section-title">Built for Performance</h2>
    <p class="nodeui-section-subtitle">Modern architecture designed for speed and reliability</p>
    <div class="nodeui-arch-grid">
      <div v-for="item in archItems" :key="item.title" class="nodeui-arch-item">
        <div class="arch-icon">{{ item.icon }}</div>
        <h3>{{ item.title }}</h3>
        <p>{{ item.desc }}</p>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="nodeui-cta">
    <h2>Ready to build?</h2>
    <p>Get started with NodeUI in seconds. No installation required.</p>
    <div class="nodeui-cta-buttons">
      <a href="https://app.nodeui.io" class="nodeui-btn nodeui-btn-primary" target="_blank">Launch App</a>
      <a href="/guide/quick-start" class="nodeui-btn nodeui-btn-secondary">Quick Start Guide</a>
      <a href="https://github.com/megasupersoft/nodeui" class="nodeui-btn nodeui-btn-secondary" target="_blank">View Source</a>
    </div>
  </div>
</template>
