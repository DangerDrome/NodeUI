<script setup>
// Unique session ID per page load so each visitor gets their own collab demo
const collabSession = 'DEMO-' + Math.random().toString(36).substring(2, 8).toUpperCase()

const mediaShowcase = {
  id: 'media',
  label: 'Rich Media',
  title: 'Not just text.',
  subtitle: 'Drop images, YouTube videos, Vimeo, and direct video URLs straight onto the canvas. Any node can hold any content.',
  graph: 'examples/media.json',
}

const showcases = [
  {
    id: 'brainstorm',
    label: 'Whiteboarding',
    title: 'Your thoughts, connected.',
    subtitle: 'Brainstorm, plan, and map out ideas on an infinite canvas. Every node supports full markdown — headings, lists, code blocks.',
    graph: 'examples/brainstorm.json',
    zoom: 1.5,
  },
  {
    id: 'groups',
    label: 'Organization',
    title: 'Structure at any scale.',
    subtitle: 'Group nodes into containers to build swimlanes, kanban boards, or layered system diagrams. Drag in, drag out.',
    graph: 'examples/groups.json',
    zoom: 1.5,
  },
  {
    id: 'routing',
    label: 'Data Pipelines',
    title: 'Model real systems.',
    subtitle: 'Route edges through waypoints to keep complex graphs readable. Map out APIs, event streams, and data flows without the mess.',
    graph: 'examples/routing.json',
    zoom: 1.5,
  },
  {
    id: 'subgraphs',
    label: 'Nested Graphs',
    title: 'Infinite depth.',
    subtitle: 'Embed entire graphs inside a single node. Double-click to go deeper, use the breadcrumb to come back. No limit on nesting.',
    graph: 'examples/subgraphs.json',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    title: 'Write, don\'t just draw.',
    subtitle: 'Every node is a markdown editor. Headings, lists, code blocks, bold, inline code — full formatting inside any node on the canvas.',
    graph: 'examples/markdown.json',
  },
]

const features = [
  { icon: '&#9881;', title: 'Nothing to install', desc: 'No build step, no server, no account. Open the URL and you\'re in.', accent: 'purple' },
  { icon: '&#8644;', title: 'Real-time collaboration', desc: 'Multiple people, one canvas. Every move syncs instantly via Cloudflare Durable Objects.', accent: 'teal' },
  { icon: '&#60;/&#62;', title: 'Vanilla JavaScript', desc: 'No framework, no lock-in. Drop it anywhere a browser runs — local file, CDN, USB stick.', accent: 'gold' },
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
          :data-src="`/embed.html?graph=${mediaShowcase.graph}`"
          class="nodeui-embed-iframe"
          :title="`NodeUI ${mediaShowcase.label} example`"
          allow="clipboard-read; clipboard-write"
        ></iframe>
      </div>
    </div>
  </div>

  <!-- Collaboration — two live embeds sharing a session -->
  <div class="collab-section">
    <div class="nodeui-section">
      <p class="nodeui-section-label">Real-time Collaboration</p>
      <h2 class="nodeui-section-title">Built for teams.</h2>
      <p class="nodeui-section-subtitle">Move a node on the left — watch it move on the right. Real-time sync powered by Cloudflare Durable Objects.</p>
    </div>
    <div class="collab-embeds">
      <div class="collab-embed-col">
        <div class="collab-embed-label">User A</div>
        <div class="nodeui-embed-wrapper">
          <iframe
            :data-src="`https://app.nodeui.io/?session=${collabSession}&graph=examples/collab-demo.json`"
            class="nodeui-embed-iframe"
            title="Collaboration  User A"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
      </div>
      <div class="collab-embed-col">
        <div class="collab-embed-label">User B</div>
        <div class="nodeui-embed-wrapper">
          <iframe
            :data-src="`https://app.nodeui.io/?session=${collabSession}&graph=examples/collab-demo.json&zoom=0.6`"
            class="nodeui-embed-iframe"
            title="Collaboration — User B"
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
          :data-src="`/embed.html?lite&graph=${item.graph}${item.zoom ? '&zoom=' + item.zoom : ''}`"
          class="nodeui-embed-iframe"
          :title="`NodeUI ${item.label} example`"
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
    <p class="nodeui-section-subtitle">Eight node types, ready to use out of the box.</p>
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
    <h2>Open it and start.</h2>
    <p>No installation, no account, no waiting. NodeUI runs entirely in your browser.</p>
    <div class="nodeui-cta-buttons">
      <a href="https://app.nodeui.io" class="nodeui-btn nodeui-btn-primary" target="_blank">Launch</a>
      <a href="/guide/quick-start" class="nodeui-btn nodeui-btn-secondary">Quick Start Guide</a>
    </div>
  </div>
</template>
