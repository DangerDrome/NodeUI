// Markdown Processing Setup - Lazy Loading
let markdownInitPromise = null;

// Function to initialize markdown processor on demand
window.initializeMarkdown = function() {
    if (markdownInitPromise) {
        return markdownInitPromise;
    }
    
    markdownInitPromise = new Promise(async (resolve) => {
        try {
            // Load all required modules from CDN in parallel
            const [
                { unified },
                { visit },
                remarkParse,
                remarkGfm,
                remarkBreaks,
                remarkRehype,
                rehypeRaw,
                rehypeHighlight,
                rehypeStringify
            ] = await Promise.all([
                import('https://cdn.jsdelivr.net/npm/unified@11/+esm'),
                import('https://cdn.jsdelivr.net/npm/unist-util-visit@5/+esm'),
                import('https://cdn.jsdelivr.net/npm/remark-parse@11/+esm'),
                import('https://cdn.jsdelivr.net/npm/remark-gfm@4/+esm'),
                import('https://cdn.jsdelivr.net/npm/remark-breaks@4/+esm'),
                import('https://cdn.jsdelivr.net/npm/remark-rehype@11/+esm'),
                import('https://cdn.jsdelivr.net/npm/rehype-raw@7/+esm'),
                import('https://cdn.jsdelivr.net/npm/rehype-highlight@7/+esm'),
                import('https://cdn.jsdelivr.net/npm/rehype-stringify@10/+esm')
            ]);

            function remarkVideo() {
                return async (tree) => {
                    const nodesToTransform = [];

                    visit(tree, 'image', (node) => {
                        if (node.alt && node.alt.toLowerCase() === 'video') {
                            nodesToTransform.push(node);
                        }
                    });

                    for (const node of nodesToTransform) {
                        const url = node.url.trim();

                        if (url.startsWith('local-video://')) {
                            try {
                                const fileId = url.substring('local-video://'.length);
                                const file = await assetDb.getFile(fileId);
                                const blobUrl = URL.createObjectURL(file);
                                node.type = 'html';
                                node.value = `<video controls loop muted width="100%" data-auto-resize="true"><source src="${blobUrl}"></video>`;
                            } catch (error) {
                                console.error(`Failed to load local video ${url}:`, error);
                                // Show a helpful placeholder for missing videos
                                node.type = 'html';
                                node.value = `<div style="
                                    background: #f0f0f0; 
                                    border: 2px dashed #ccc; 
                                    border-radius: 8px; 
                                    padding: 20px; 
                                    text-align: center; 
                                    color: #666;
                                    font-family: sans-serif;
                                ">
                                    <div style="font-size: 24px; margin-bottom: 10px;">🎬</div>
                                    <div style="font-weight: bold; margin-bottom: 5px;">Video not available</div>
                                    <div style="font-size: 12px;">This video was added by another user and is not synced.</div>
                                </div>`;
                            }
                        } else {
                            // YouTube support
                            const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
                            const youtubeMatch = url.match(youtubeRegex);

                            if (youtubeMatch) {
                                const videoId = youtubeMatch[1];
                                node.type = 'html';
                                node.value = `
                                    <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
                                        <iframe 
                                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                                            src="https://www.youtube.com/embed/${videoId}" 
                                            frameborder="0" 
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                            allowfullscreen>
                                        </iframe>
                                    </div>`;
                                return;
                            }
                            
                            // Vimeo support
                            const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
                            const vimeoMatch = url.match(vimeoRegex);
                            
                            if (vimeoMatch) {
                                const videoId = vimeoMatch[1];
                                node.type = 'html';
                                node.value = `
                                    <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%;">
                                        <iframe 
                                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                                            src="https://player.vimeo.com/video/${videoId}" 
                                            frameborder="0" 
                                            allow="autoplay; fullscreen; picture-in-picture" 
                                            allowfullscreen>
                                        </iframe>
                                    </div>`;
                                return;
                            }
                            
                            // Direct video files (mp4, webm, etc.)
                            const directVideoRegex = /\.(mp4|webm|ogg|mov|avi|mkv|m4v)(\?.*)?$/i;
                            if (directVideoRegex.test(url)) {
                                node.type = 'html';
                                node.value = `<video controls loop muted width="100%" data-auto-resize="true">
                                    <source src="${url}" type="video/${url.match(directVideoRegex)[1].toLowerCase()}">
                                    Your browser does not support the video tag.
                                </video>`;
                            } else {
                                // Fallback for unknown video URLs - try to embed as generic video
                                node.type = 'html';
                                node.value = `<video controls loop muted width="100%" data-auto-resize="true"><source src="${url}"></video>`;
                            }
                        }
                    }
                };
            }

            // Create and assign the markdown processor to the global window object
            window.markdownProcessor = unified()
                .use(remarkParse.default)
                .use(remarkGfm.default)
                .use(remarkBreaks.default)
                .use(remarkVideo)
                .use(remarkRehype.default, { allowDangerousHtml: true })
                .use(rehypeRaw.default)
                .use(rehypeHighlight.default)
                .use(rehypeStringify.default);

            console.log('Markdown processor initialized successfully');
            resolve();
        } catch (error) {
            console.error('Failed to initialize markdown processor:', error);
            resolve(); // Resolve anyway to prevent blocking
        }
    });
    
    return markdownInitPromise;
};

// For backward compatibility, set markdownReady to null initially
window.markdownReady = null; 