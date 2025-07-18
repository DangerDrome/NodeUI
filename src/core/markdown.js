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
                                node.value = `<video controls width="100%"><source src="${blobUrl}"></video>`;
                            } catch (error) {
                                console.error(`Failed to load local video ${url}:`, error);
                                node.type = 'html';
                                node.value = `<p>Error loading video: ${url}</p>`;
                            }
                        } else {
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
                            } else {
                                node.type = 'html';
                                node.value = `<video controls width="100%"><source src="${url}"></video>`;
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