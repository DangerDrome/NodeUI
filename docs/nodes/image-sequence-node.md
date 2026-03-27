# ImageSequenceNode

A frame-by-frame image sequence player. ImageSequenceNode displays a thumbnail from an array of image paths and supports mouse scrubbing, keyboard navigation, and animated playback at configurable frame rates.

## Key Features

- **Image sequence display** -- loads and displays an ordered array of image file paths
- **Mouse scrubbing** -- click and drag horizontally across the thumbnail to scrub through frames
- **Keyboard navigation** -- use arrow keys to step one frame at a time
- **Animated playback** -- press Space to play/pause at a configurable FPS (default: 24)
- **Frame indicator** -- overlay showing current frame number, total frames, and playback state
- **Drop-to-create** -- drag multiple images onto the node to populate the sequence
- **Serialization** -- image paths, current frame, and FPS are saved with the graph

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `width` | `number` | `300` | Width in pixels |
| `height` | `number` | `200` | Height in pixels |
| `title` | `string` | `'Image Sequence'` | Display title in the title bar |
| `imageSequence` | `string[]` | `[]` | Array of image file paths |
| `currentFrame` | `number` | `0` | Initial frame index (clamped to valid range) |
| `fps` | `number` | `24` | Playback speed in frames per second (1 -- 60) |

## Usage

### Loading Images

Populate the sequence by dropping multiple image files onto the node. The node accepts an array of file paths and resets to frame 0 when a new sequence is loaded.

When no images are loaded, the node displays a placeholder message: "No images in sequence -- Drop multiple images to create a sequence."

### Scrubbing Through Frames

Click and hold anywhere on the thumbnail, then drag left or right. The frame advances proportionally to how far you drag relative to the container width. The scrub sensitivity scales with the total number of frames so long sequences feel consistent.

Scrubbing automatically pauses any active playback.

### Keyboard Controls

Click the node to give it focus (the node sets `tabindex="0"`), then use:

| Key | Action |
|-----|--------|
| `ArrowRight` | Advance one frame |
| `ArrowLeft` | Go back one frame |
| `Space` | Toggle play/pause |

Frame navigation wraps around: stepping forward from the last frame returns to frame 0, and stepping back from frame 0 jumps to the last frame.

### Playback

Press Space or call `play()` to start animated playback at the configured FPS. The frame indicator appends a play icon during playback. Playback loops continuously.

To change the playback speed, update the `fps` property. The valid range is 1 to 60 FPS. Changing FPS while playing restarts the animation interval at the new rate.

### Events

ImageSequenceNode publishes events during interaction:

| Event | Payload | When |
|-------|---------|------|
| `imagesequence:frame-changed` | `{ nodeId, frame, totalFrames }` | Any frame change (scrub, keyboard, playback) |
| `imagesequence:play` | `{ nodeId }` | Playback starts |
| `imagesequence:pause` | `{ nodeId }` | Playback pauses |

::: tip
ImageSequenceNode works well paired with a LogNode for debugging frame events, or connected to other nodes that react to the `imagesequence:frame-changed` event.
:::
