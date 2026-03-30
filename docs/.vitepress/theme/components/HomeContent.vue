<script setup>
// Unique session ID per page load so each visitor gets their own collab demo
const collabSession = 'DEMO-' + Math.random().toString(36).substring(2, 8).toUpperCase()

const mediaShowcase = {
  id: 'media',
  label: 'Rich Media',
  title: 'Images, video, YouTube',
  subtitle: 'Embed images, YouTube videos, Vimeo, and direct video files in any node. Just paste a URL or drag and drop.',
  graph: 'examples/media.json',
}

const showcases = [
  {
    id: 'brainstorm',
    label: 'Whiteboarding',
    title: 'Think visually',
    subtitle: 'Map out ideas, connect concepts, and plan projects on an infinite canvas. Markdown content in every node.',
    graph: 'examples/brainstorm.json',
  },
  {
    id: 'groups',
    label: 'Organization',
    title: 'Group and structure',
    subtitle: 'Use GroupNodes to organize related nodes into containers. Drag nodes in and out, collapse groups, and build layered architectures.',
    graph: 'examples/groups.json',
  },
  {
    id: 'routing',
    label: 'Edge Routing',
    title: 'Clean connections',
    subtitle: 'RoutingNodes act as waypoints for edges, keeping complex graphs readable. Build data pipelines, flowcharts, and system diagrams.',
    graph: 'examples/routing.json',
  },
  {
    id: 'subgraphs',
    label: 'Nested Graphs',
    title: 'Drill into detail',
    subtitle: 'SubGraphNodes contain entire graphs inside them. Double-click to dive in, breadcrumb your way back. Infinite depth.',
    graph: 'examples/subgraphs.json',
  },
]

const features = [
  { icon: '&#9881;', title: 'Zero Installation', desc: 'No build tools, no server, no signup. Open a file and start working.', accent: 'purple' },
  { icon: '&#8644;', title: 'Real-time Collaboration', desc: 'Work together on a shared canvas. Live cursors, synced edits, powered by Cloudflare Durable Objects.', accent: 'teal' },
  { icon: '&#60;/&#62;', title: 'Pure Web Tech', desc: 'Vanilla JavaScript. No framework lock-in. Runs anywhere a browser runs — even from a USB stick.', accent: 'gold' },
]

const nodeTypes = [
  { name: 'BaseNode', desc: 'Rich markdown content, resizing, 6 color variants, inline editing.', color: 'purple', link: '/nodes/base-node' },
  { name: 'GroupNode', desc: 'Container nodes for organizing collections of child nodes.', color: 'teal', link: '/nodes/group-node' },
  { name: 'SubGraphNode', desc: 'Nested graphs with independent state and breadcrumb navigation.', color: 'purple', link: '/nodes/subgraph-node' },
  { name: 'ThreeJSNode', desc: 'Full 3D viewport with Three.js scene, camera controls, and lighting.', color: 'teal', link: '/nodes/threejs-node' },
  { name: 'RoutingNode', desc: 'Minimalist waypoints for clean edge path management.', color: 'gold', link: '/nodes/routing-node' },
  { name: 'LogNode', desc: 'Real-time event logging and debugging interface.', color: 'error', link: '/nodes/log-node' },
  { name: 'SettingsNode', desc: 'Application configuration and preferences panel.', color: 'purple', link: '/nodes/settings-node' },
  { name: 'ImageSequenceNode', desc: 'Frame-by-frame animation with playback controls.', color: 'gold', link: '/nodes/image-sequence-node' },
]
</script>

<template>
  <!-- Media showcase first -->
  <div class="showcase-section">
    <div class="showcase-text">
      <p class="nodeui-section-label">{{ mediaShowcase.label }}</p>
      <h2 class="showcase-title">{{ mediaShowcase.title }}</h2>
      <p class="showcase-subtitle">{{ mediaShowcase.subtitle }}</p>
    </div>
    <div class="showcase-embed">
      <div class="nodeui-embed-wrapper">
        <iframe
          :src="`/embed.html?graph=${mediaShowcase.graph}`"
          class="nodeui-embed-iframe"
          :title="`NodeUI ${mediaShowcase.label} example`"
          loading="lazy"
          allow="clipboard-read; clipboard-write"
        ></iframe>
      </div>
    </div>
  </div>

  <!-- Collaboration — two live embeds sharing a session -->
  <div class="collab-section">
    <div class="nodeui-section">
      <p class="nodeui-section-label">Real-time Collaboration</p>
      <h2 class="nodeui-section-title">Two canvases, one session</h2>
      <p class="nodeui-section-subtitle">Move a node on the left — watch it move on the right. Powered by Cloudflare Durable Objects.</p>
    </div>
    <div class="collab-embeds">
      <div class="collab-embed-col">
        <div class="collab-embed-label">User A</div>
        <div class="nodeui-embed-wrapper">
          <iframe
            :src="`https://app.nodeui.io/?session=${collabSession}&graph=examples/collab-demo.json`"
            class="nodeui-embed-iframe"
            title="Collaboration — User A"
            loading="lazy"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
      </div>
      <div class="collab-embed-col">
        <div class="collab-embed-label">User B</div>
        <div class="nodeui-embed-wrapper">
          <iframe
            :src="`https://app.nodeui.io/?session=${collabSession}&graph=examples/collab-demo.json`"
            class="nodeui-embed-iframe"
            title="Collaboration — User B"
            loading="lazy"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
      </div>
    </div>
  </div>

  <!-- Remaining showcase sections -->
  <div
    v-for="(item, index) in showcases"
    :key="item.id"
    :class="['showcase-section', index % 2 === 1 ? 'showcase-reversed' : '']"
  >
    <div class="showcase-text">
      <p class="nodeui-section-label">{{ item.label }}</p>
      <h2 class="showcase-title">{{ item.title }}</h2>
      <p class="showcase-subtitle">{{ item.subtitle }}</p>
    </div>
    <div class="showcase-embed">
      <div class="nodeui-embed-wrapper">
        <iframe
          :src="`/embed.html?graph=${item.graph}`"
          class="nodeui-embed-iframe"
          :title="`NodeUI ${item.label} example`"
          loading="lazy"
          allow="clipboard-read; clipboard-write"
        ></iframe>
      </div>
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

  <!-- CTA -->
  <div class="nodeui-cta">
    <h2>Start building on an infinite canvas</h2>
    <p>No installation. No signup. Just open and go.</p>
    <div class="nodeui-cta-buttons">
      <a href="https://app.nodeui.io" class="nodeui-btn nodeui-btn-primary" target="_blank">Launch</a>
      <a href="/guide/quick-start" class="nodeui-btn nodeui-btn-secondary">Quick Start Guide</a>
      <a href="https://github.com/megasupersoft/nodeui" class="nodeui-btn nodeui-btn-secondary" target="_blank">View Source</a>
    </div>
  </div>
</template>
