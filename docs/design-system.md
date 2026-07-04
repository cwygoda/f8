# f8 design system

A quiet Nordic/Japanese-inspired system for image-first publishing: restrained color, generous negative space, sans-serif typography, and Tailwind utilities backed by semantic CSS tokens.

## Principles

- **Quiet surface**: warm paper, soft stone, pine, and clay — never pure black/white.
- **Ma**: large margins and deliberate pauses around hero copy and image blocks.
- **Sans-only editorial type**: Fontsource `Noto Sans Variable` with tight display tracking and comfortable prose measure.
- **Image restraint**: subtle borders/radii, low shadows, and gentle hover motion.

## Tokens

Defined in `src/app.css` and exposed to Tailwind v4 through `@theme`.

| Token                            | Purpose                         |
| -------------------------------- | ------------------------------- |
| `--f8-bg` / `text-f8-paper`      | page paper                      |
| `--f8-surface` / `bg-f8-surface` | raised panels, code, image mats |
| `--f8-fg` / `text-f8-ink`        | primary text                    |
| `--f8-muted` / `text-f8-muted`   | captions and secondary text     |
| `--f8-border` / `border-f8-line` | hairline dividers               |
| `--f8-accent` / `text-f8-pine`   | primary pine accent             |
| `--f8-accent-2` / `text-f8-clay` | secondary clay accent           |
| `--f8-radius` / `rounded-f8`     | system radius                   |
| `--f8-shadow` / `shadow-f8-soft` | soft elevation                  |

## Components

Use these semantic classes instead of repeating utility bundles:

- `.f8-shell` — themed page shell with tinted background.
- `.f8-container` — balanced max-width container.
- `.f8-measure` — prose measure.
- `.f8-section` — generous vertical rhythm.
- `.f8-divider` — one-pixel accent rule.
- `.f8-eyebrow` — small uppercase section label.
- `.f8-display` — hero/display heading.
- `.f8-dek` — large muted intro copy.
- `.f8-card` — quiet raised surface.
- `.f8-button` — minimal pill action.
- `.prose-f8` — Tailwind Typography theme for rendered Markdown.

Example:

```svelte
<main class="f8-shell py-20">
  <header class="f8-container">
    <p class="f8-eyebrow mb-5">Journal</p>
    <h1 class="f8-display">Quiet image-first stories</h1>
    <p class="f8-dek mt-8">A calm system for long-form visual publishing.</p>
  </header>

  <article class="f8-page prose prose-f8 prose-lg sm:prose-xl max-w-none">
    {@html html}
  </article>
</main>
```

## Theme modes

Set `data-theme="light"`, `data-theme="dark"`, or leave `system` on `.f8-shell` / `.site-shell`. Tokens cascade into galleries, figures, and the viewer.
