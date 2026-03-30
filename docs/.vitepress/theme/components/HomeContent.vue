<script setup>
const nodeTypes = [
  { name: 'BaseNode', desc: 'Standard nodes with rich markdown content, resizing, and color variants.', color: 'purple', link: '/nodes/base-node' },
  { name: 'GroupNode', desc: 'Container nodes for organizing and managing collections of child nodes.', color: 'teal', link: '/nodes/group-node' },
  { name: 'SubGraphNode', desc: 'Nested graph containers with independent state and breadcrumb navigation.', color: 'purple', link: '/nodes/subgraph-node' },
  { name: 'ThreeJSNode', desc: 'Full 3D viewport with integrated Three.js scene, camera controls, and lighting.', color: 'teal', link: '/nodes/threejs-node' },
  { name: 'RoutingNode', desc: 'Minimalist nodes for managing edge paths and routing connections cleanly.', color: 'gold', link: '/nodes/routing-node' },
  { name: 'LogNode', desc: 'Real-time event logging and debugging interface for monitoring graph activity.', color: 'error', link: '/nodes/log-node' },
  { name: 'SettingsNode', desc: 'Application configuration and preferences with a built-in settings panel.', color: 'purple', link: '/nodes/settings-node' },
  { name: 'ImageSequenceNode', desc: 'Frame-by-frame image animation with playback controls and timeline integration.', color: 'gold', link: '/nodes/image-sequence-node' },
]

const features = [
  { icon: '&#9881;', title: 'Precision Engineering', desc: 'Every node is built with type-safe precision, ensuring your logic flows exactly as intended.', accent: 'purple' },
  { icon: '&#8644;', title: 'Real-time Sync', desc: 'Collaborate with your team on a single canvas. Watch updates propagate across the cluster instantly.', accent: 'teal' },
  { icon: '&#60;/&#62;', title: 'Production-Ready', desc: 'Export optimized configurations directly from your visual architecture. Zero bloat, zero dependencies.', accent: 'gold' },
]

const archItems = [
  { icon: '&#128225;', title: 'Event-Driven', desc: 'Central pub/sub event bus for decoupled inter-module communication.' },
  { icon: '&#129513;', title: 'Modular', desc: 'Self-contained modules with clear interfaces and single responsibilities.' },
  { icon: '&#9889;', title: 'GPU Accelerated', desc: 'Hardware-accelerated 3D rendering with lazy-loaded Three.js.' },
  { icon: '&#128190;', title: 'Auto-Persist', desc: 'Continuous local storage and IndexedDB persistence with auto-save.' },
  { icon: '&#9729;', title: 'Serverless', desc: 'Cloudflare Durable Objects for zero-server collaboration infrastructure.' },
  { icon: '&#128230;', title: 'Zero Dependencies', desc: 'Pure vanilla JavaScript with CDN-loaded libraries on demand.' },
]
</script>

<template>
  <!-- Interactive Graph Canvas — actual NodeUI app embedded -->
  <div class="nodeui-section">
    <p class="nodeui-section-label">The Live Canvas</p>
    <h2 class="nodeui-section-title">Try it yourself</h2>
    <p class="nodeui-section-subtitle">This is a real NodeUI canvas. Pan, zoom, drag nodes, and explore the graph.</p>

    <div class="nodeui-embed-wrapper">
      <iframe
        src="/embed.html"
        class="nodeui-embed-iframe"
        title="Interactive NodeUI Graph"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
      ></iframe>
    </div>
  </div>

  <!-- Feature Cards -->
  <div class="nodeui-section">
    <div class="nodeui-feature-grid">
      <div v-for="feat in features" :key="feat.title" class="nodeui-feature-card">
        <div :class="['feature-icon', feat.accent]" v-html="feat.icon"></div>
        <h3>{{ feat.title }}</h3>
        <p>{{ feat.desc }}</p>
      </div>
    </div>
  </div>

  <!-- Code Preview Section -->
  <div class="nodeui-code-section">
    <div class="nodeui-code-split">
      <div class="nodeui-code-left">
        <div class="label">The Live Canvas</div>
        <h2>Visual flow meets logical depth.</h2>
        <div class="nodeui-code-visual">
          <div class="mini-node purple">&#9889;</div>
          <div class="mini-node teal">&#9776;</div>
        </div>
      </div>
      <div class="nodeui-code-right">
        <div class="nodeui-code-editor">
          <div class="editor-titlebar">
            <div class="dot red"></div>
            <div class="dot yellow"></div>
            <div class="dot green"></div>
            <span class="editor-filename">NodeUI_Engine.js</span>
          </div>
          <div class="editor-body">
            <div><span class="line-num">01</span><span class="kw">import</span> { NodeEngine } <span class="kw">from</span> <span class="str">'@nodeui/core'</span>;</div>
            <div><span class="line-num">02</span></div>
            <div><span class="line-num">03</span><span class="kw">const</span> <span class="fn">workflow</span> = <span class="kw">new</span> NodeEngine({</div>
            <div><span class="line-num">04</span>&nbsp;&nbsp;id: <span class="str">'main-canvas-01'</span>,</div>
            <div><span class="line-num">05</span>&nbsp;&nbsp;sync: <span class="kw">true</span>,</div>
            <div><span class="line-num">06</span>&nbsp;&nbsp;autoOptimize: <span class="kw">true</span></div>
            <div><span class="line-num">07</span>});</div>
            <div><span class="line-num">08</span></div>
            <div><span class="line-num">09</span><span class="fn">workflow</span>.onConnect((<span class="fn">event</span>) => {</div>
            <div><span class="line-num">10</span>&nbsp;&nbsp;<span class="fn">console</span>.log(<span class="str">`Nodes connected`</span>);</div>
            <div><span class="line-num">11</span>});</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Node Types -->
  <div class="nodeui-section">
    <p class="nodeui-section-label">Components</p>
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
    <p class="nodeui-section-label">Architecture</p>
    <h2 class="nodeui-section-title">Built for Performance</h2>
    <p class="nodeui-section-subtitle">Modern architecture designed for speed and reliability</p>
    <div class="nodeui-arch-grid">
      <div v-for="item in archItems" :key="item.title" class="nodeui-arch-item">
        <div class="arch-icon" v-html="item.icon"></div>
        <h3>{{ item.title }}</h3>
        <p>{{ item.desc }}</p>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="nodeui-cta">
    <h2>Ready to Build the Future?</h2>
    <p>Get started with NodeUI in seconds. No installation required.</p>
    <div class="nodeui-cta-buttons">
      <a href="https://app.nodeui.io" class="nodeui-btn nodeui-btn-primary" target="_blank">Start Building Free</a>
      <a href="/guide/quick-start" class="nodeui-btn nodeui-btn-secondary">Quick Start Guide</a>
      <a href="https://github.com/megasupersoft/nodeui" class="nodeui-btn nodeui-btn-secondary" target="_blank">View Source</a>
    </div>
  </div>
</template>
