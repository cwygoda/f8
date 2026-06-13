---
title: Image-first stories for SvelteKit
description: A polished starter site that turns colocated Markdown images into fast responsive photo essays.
theme: system
---

# Image-first stories for SvelteKit

Welcome to the first-party `f8` starter site. Write prose in Markdown, drop images next to your stories, and publish a static SvelteKit site with responsive image blocks generated on demand.

## A calm editorial workflow

Keep writing and imagery together: place `hero.jpg` beside `content/travel/kyoto.md`, reference it with `![Hero](./hero.jpg)`, and f8 will process it as the page loads in dev or prerenders during build. Single isolated images become captioned figures, while consecutive image lines become wide masonry galleries.

## Ready for static output

The starter route pre-renders Markdown pages and writes SEO metadata from frontmatter. The f8 Vite plugin serves `/@f8/` image URLs from `.f8/cache` in dev and emits the referenced optimized assets into the static build output.
