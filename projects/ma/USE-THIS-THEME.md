## Use this theme

Ma is a static blog theme: four HTML pages, a little TypeScript, and a folder of markdown files. There is no server and no database. Everything below takes a few minutes.

### 1. Add an essay

Drop a markdown file into `content/posts/`. The file name becomes the URL, so `content/posts/first-snow.md` is published at `post.html?p=first-snow`. Start it with a frontmatter block:

```
---
title: First Snow
date: 2026-12-04
tags: [seasons, walking]
excerpt: One or two sentences for the home page and archive.
kanji: 雪
reading: yuki · snow
cover: mountains
coverAlt: Describe the cover image for people who can't see it.
caption: Optional caption under the cover.
---
```

Only `title` and `date` are required. Posts are sorted by date, newest first, and the newest one becomes the featured essay on the home page. Reading time is worked out from the word count.

### 2. Write with three extras

Ordinary markdown works: headings, lists, links, *emphasis*. Three additions:

```
::: pull
A sentence worth pulling out. Vertical in the margin on desktop.
:::

![Alt text for the image](persimmon "An optional caption")

A claim that needs a note.[^1]

[^1]: The note. Shown in the left margin on wide screens.
```

An image name without a path refers to the generated set in `public/img/`. Any other URL is used as-is.

### 3. Use your own images

Responsive images come in three widths. Either save your own as `public/img/name-480.webp`, `name-960.webp` and `name-1600.webp` and add an entry for `name` to `src/images.json`, or edit and re-run the generator, which paints the theme's ink-wash pictures and writes that file for you:

```
python3 tools/gen-images.py
```

If a post uses a kanji the font doesn't cover yet, run `python3 tools/pick-kanji.py`. It adds just the font chunk that contains it.

### 4. Change the name and the colours

- **Name, author, locale, reading speed:** `src/site.ts`.
- **Wordmark and footer text:** the header and footer of the four `.html` files (search for `Ma`).
- **Colours:** the custom properties at the top of `src/style.css`. Every colour comes from about eight tokens, defined once for paper-white light mode and once for ink-black dark mode. Change `--shu` (the vermilion accent) and `--seal` to recolour the whole theme.
- **The seal:** the `<symbol id="seal">` in each page is the 間 character drawn as rectangles on a 100-unit grid. Replace the path to carve a different mark.

### 5. Build

The theme is a set of Vite pages. `npm run dev` serves it with hot reload and `npm run build` writes a static site you can host anywhere.
