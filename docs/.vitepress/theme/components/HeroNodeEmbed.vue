<template>
  <div
    class="node"
    data-color="yellow"
    :style="{
      '--icon-color': 'var(--color-node-yellow-border)',
      '--icon-color-bg': 'var(--color-node-yellow-bg)',
      '--node-accent-color': 'var(--color-node-yellow-border)',
      position: 'relative',
      width: '280px',
      height: '160px',
    }"
  >
    <div class="node-title-bar" style="border-bottom: none;">
      <div class="node-icon icon-file-text"></div>
      <div class="node-pin-icon icon-pin"></div>
      <span class="node-title-text">Note</span>
      <div class="node-cycle-color-icon icon-sun-medium"></div>
      <div class="node-settings-icon icon-more-horizontal"></div>
    </div>
    <div class="node-content">
      <h1>NodeUI</h1>
    </div>
  </div>
</template>
