# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Automatic image compression for dropped files (max 1200x1200px, 80% quality)
- Increased WebSocket payload limits to 50MB
- Smart compression for image sequences (max 800x800px, 70% quality)

### Fixed
- WebSocket crashes when sharing large base64 images during collaboration

## [1.1.1] - 2025-01-18
### Fixed
- Fixed ThreeJSNode race condition where font loader callback fired before scene initialization
- Added version tracking system with version.json
- Embedded version data in HTML for file:// protocol compatibility

## [1.1.0] - 2025-01-18
### Changed
- Removed edge physics system for better performance
- Optimized edge updates from O(n) to O(k) complexity

### Added
- Added shake-to-reconnect feature for node connections
- Implemented parallel loading for faster startup
- Made markdown parser and heavy libraries lazy-load

### Fixed
- Fixed module dependency loading issues

## [1.0.0] - 2025-01-17
### Added
- Initial release
- Node-based graph interface
- Collaboration support via WebSocket
- Multiple node types (Base, Group, Log, Routing, Settings, SubGraph, ThreeJS)
- Drag and drop file support
- Timeline animation system
- Context menu system
