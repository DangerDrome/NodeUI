import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'NodeUI',
  description: 'A serverless, node-based visual programming interface for creating interactive graphs and 3D visualizations.',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap', rel: 'stylesheet' }],
    ['meta', { name: 'theme-color', content: '#3ecf8e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'NodeUI - Visual Programming Interface' }],
    ['meta', { property: 'og:description', content: 'A serverless, node-based visual programming interface for creating interactive graphs and 3D visualizations.' }],
  ],

  appearance: 'dark',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Node Types', link: '/nodes/', activeMatch: '/nodes/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      { text: 'Collaboration', link: '/collaboration/', activeMatch: '/collaboration/' },
      {
        text: 'v1.1.22',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'GitHub Releases', link: 'https://github.com/megasupersoft/nodeui/releases' }
        ]
      },
      { text: 'Launch App', link: 'https://app.nodeui.io', target: '_blank', rel: 'noopener' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Basic Operations', link: '/guide/basic-operations' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
            { text: 'File Format', link: '/guide/file-format' },
          ]
        }
      ],
      '/nodes/': [
        {
          text: 'Node Types',
          items: [
            { text: 'Overview', link: '/nodes/' },
            { text: 'BaseNode', link: '/nodes/base-node' },
            { text: 'GroupNode', link: '/nodes/group-node' },
            { text: 'RoutingNode', link: '/nodes/routing-node' },
            { text: 'LogNode', link: '/nodes/log-node' },
            { text: 'SettingsNode', link: '/nodes/settings-node' },
            { text: 'SubGraphNode', link: '/nodes/subgraph-node' },
            { text: 'ThreeJSNode', link: '/nodes/threejs-node' },
            { text: 'ImageSequenceNode', link: '/nodes/image-sequence-node' },
          ]
        }
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'Event System', link: '/api/events' },
            { text: 'Canvas', link: '/api/canvas' },
            { text: 'Edges', link: '/api/edges' },
            { text: 'Custom Nodes', link: '/api/custom-nodes' },
          ]
        }
      ],
      '/collaboration/': [
        {
          text: 'Collaboration',
          items: [
            { text: 'Overview', link: '/collaboration/' },
            { text: 'WebSocket Setup', link: '/collaboration/websocket-setup' },
            { text: 'Durable Objects', link: '/collaboration/durable-objects' },
          ]
        }
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Overview', link: '/deployment/' },
            { text: 'Cloudflare Pages', link: '/deployment/cloudflare-pages' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/megasupersoft/nodeui' }
    ],

    editLink: {
      pattern: 'https://github.com/megasupersoft/nodeui/edit/master/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright &copy; 2024-present NodeUI'
    }
  }
})
