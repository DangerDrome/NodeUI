Build the VitePress docs site and deploy to Cloudflare Pages (nodeui.io).

Steps:
1. Run `npm run docs:build` to build the docs
2. Run `wrangler pages deploy docs/.vitepress/dist --project-name nodeui-docs --branch master` to deploy
3. Report the deployment URL when done
