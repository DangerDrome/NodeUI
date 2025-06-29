// Markdown Processing Setup
// Load dependencies from CDN
(async function() {
    // Create a promise that resolves when markdown processor is ready
    window.markdownReady = new Promise(async (resolve) => {
        try {
            // Load the required modules from CDN
            const { unified } = await import('https://esm.sh/unified');
            const { visit } = await import('https://esm.sh/unist-util-visit');
            const remarkParse = await import('https://esm.sh/remark-parse');
            const remarkGfm = await import('https://esm.sh/remark-gfm');
            const remarkBreaks = await import('https://esm.sh/remark-breaks');
            const remarkRehype = await import('https://esm.sh/remark-rehype');
            const rehypeRaw = await import('https://esm.sh/rehype-raw');
            const rehypeHighlight = await import('https://esm.sh/rehype-highlight');
            const rehypeStringify = await import('https://esm.sh/rehype-stringify');

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
})(); 