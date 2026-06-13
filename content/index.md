---
title: Image-first stories for SvelteKit
description: A polished starter site that turns Markdown and processed image metadata into a fast static photo essay.
theme: system
---

# Image-first stories for SvelteKit

Welcome to the first-party `f8` starter site. Write prose in Markdown, drop images into `images/`, run the image pipeline, and publish a static SvelteKit site with responsive image blocks.

## A calm editorial workflow

Use `f8 index images content/index.md` to create or refresh the image section below without replacing your prose. Single isolated images become captioned figures, while consecutive image lines become wide masonry galleries.

## Ready for static output

The starter route pre-renders Markdown pages, writes SEO metadata from frontmatter, and maps generated variants into `/assets/f8/` so SvelteKit's static adapter can ship optimized files.
