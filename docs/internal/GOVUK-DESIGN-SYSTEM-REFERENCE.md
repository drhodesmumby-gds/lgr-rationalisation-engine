# GOV.UK Design System Reference

> **Version**: Based on GOV.UK Frontend v6.1.0 (March 2025)
> **Format**: AI-agent-friendly reference for single-file HTML prototypes
> **Last updated**: 2026-04-19

GOV.UK Frontend v6.0.0 (February 2025) introduced the brand refresh with updated colours, revised type scale, and functional colour CSS custom properties. v6.1.0 is the current stable release and is used throughout this document.

---

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. How to Use This Document](#2-how-to-use-this-document)
- [3. Quick Reference: CDN Setup](#3-quick-reference-cdn-setup)
- [4. Page Template and Structure](#4-page-template-and-structure)
  - [4.1 Minimal HTML Boilerplate](#41-minimal-html-boilerplate)
  - [4.2 Required Classes](#42-required-classes)
  - [4.3 Page Structure Hierarchy](#43-page-structure-hierarchy)
- [5. Styles](#5-styles)
  - [5.1 Colour Palette](#51-colour-palette)
  - [5.2 Typography](#52-typography)
  - [5.3 Type Scale](#53-type-scale)
  - [5.4 Spacing](#54-spacing)
  - [5.5 Layout and Grid](#55-layout-and-grid)
  - [5.6 Section Breaks](#56-section-breaks)
  - [5.7 Font Override Classes](#57-font-override-classes)
  - [5.8 Images](#58-images)
- [6. Components](#6-components)
  - [6.1 Accordion](#61-accordion)
  - [6.2 Back Link](#62-back-link)
  - [6.3 Breadcrumbs](#63-breadcrumbs)
  - [6.4 Button](#64-button)
  - [6.5 Character Count](#65-character-count)
  - [6.6 Checkboxes](#66-checkboxes)
  - [6.7 Cookie Banner](#67-cookie-banner)
  - [6.8 Date Input](#68-date-input)
  - [6.9 Details](#69-details)
  - [6.10 Error Message](#610-error-message)
  - [6.11 Error Summary](#611-error-summary)
  - [6.12 Exit This Page](#612-exit-this-page)
  - [6.13 Fieldset](#613-fieldset)
  - [6.14 File Upload](#614-file-upload)
  - [6.15 Footer](#615-footer)
  - [6.16 Header](#616-header)
  - [6.17 Inset Text](#617-inset-text)
  - [6.18 Notification Banner](#618-notification-banner)
  - [6.19 Pagination](#619-pagination)
  - [6.20 Panel](#620-panel)
  - [6.21 Password Input](#621-password-input)
  - [6.22 Phase Banner](#622-phase-banner)
  - [6.23 Radios](#623-radios)
  - [6.24 Select](#624-select)
  - [6.25 Service Navigation](#625-service-navigation)
  - [6.26 Skip Link](#626-skip-link)
  - [6.27 Summary List](#627-summary-list)
  - [6.28 Table](#628-table)
  - [6.29 Tabs](#629-tabs)
  - [6.30 Tag](#630-tag)
  - [6.31 Task List](#631-task-list)
  - [6.32 Text Input](#632-text-input)
  - [6.33 Textarea](#633-textarea)
  - [6.34 Warning Text](#634-warning-text)
- [7. Patterns](#7-patterns)
  - [7.1 Ask Users For...](#71-ask-users-for)
  - [7.2 Help Users To...](#72-help-users-to)
  - [7.3 Pages](#73-pages)
- [8. Accessibility Requirements](#8-accessibility-requirements)
- [9. JavaScript Dependency Map](#9-javascript-dependency-map)
- [10. LGR Rationalisation Engine: Approach and Deviations](#10-lgr-rationalisation-engine-approach-and-deviations)
- [11. Community and Contribution Model](#11-community-and-contribution-model)
- [12. Quick Reference Tables](#12-quick-reference-tables)

---

## 1. Purpose

This document is a comprehensive, AI-agent-friendly reference for the GOV.UK Design System. It enables AI agents and developers to:

- Know which GOV.UK components and patterns exist and when to use them
- Understand the user research behind design decisions
- Implement components correctly in single-page HTML prototypes without Nunjucks or Node.js
- Evaluate whether implementations are compliant with GOV.UK standards
- Formally document deviations from the standard with justification

All examples in this document use **plain HTML**. No Nunjucks macros (`{% %}` or `{{ }}`), no server-side templating. Every code example can be copied directly into a `.html` file and will work when the GOV.UK Frontend CSS and JS are loaded via CDN.

---

## 2. How to Use This Document

- **Implementing a component**: Go to [Section 6: Components](#6-components), find the component alphabetically, and copy the HTML example. Check the CSS classes table and accessibility notes.
- **Implementing a pattern**: Go to [Section 7: Patterns](#7-patterns) for guidance on common user journeys and page types.
- **Styling**: Go to [Section 5: Styles](#5-styles) for colours, typography, spacing, and layout grid.
- **Checking compliance**: Use the accessibility section ([Section 8](#8-accessibility-requirements)) and the JavaScript dependency map ([Section 9](#9-javascript-dependency-map)).
- **Documenting deviations**: Use the deviation log template in [Section 10](#10-lgr-rationalisation-engine-approach-and-deviations).

---

## 3. Quick Reference: CDN Setup

To use GOV.UK Frontend in a single HTML file without Node.js or a build step, include the following in your HTML:

```html
<!-- In <head>: GOV.UK Frontend CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.css">

<!-- At end of <body>: GOV.UK Frontend JS -->
<script type="module" src="https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js"></script>
<script type="module">
  import { initAll } from 'https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js';
  initAll();
</script>
```

**Key notes:**

- **Font**: GDS Transport is restricted to services on `service.gov.uk`. For all other projects (including ours), use `Arial, Helvetica, sans-serif`.
- **`data-module` attribute**: This is what triggers JavaScript initialisation via `initAll()`. Components that require JS must have the correct `data-module` value on their container element.
- **Version pinning**: Always pin to a specific version (e.g., `@6.1.0`). Never use `@latest` -- major versions may introduce breaking changes.
- **v6.0.0 brand refresh**: Released February 2025, this major version updated the colour palette, type scale, and introduced functional colour CSS custom properties. v6.1.0 (March 2025) is the current stable patch release.

---

## 4. Page Template and Structure

### 4.1 Minimal HTML Boilerplate

```html
<!DOCTYPE html>
<html lang="en" class="govuk-template">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Page title - Service name - GOV.UK</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.css">
</head>
<body class="govuk-template__body">
  <script>
    document.body.className = document.body.className + ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');
  </script>

  <a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>

  <header class="govuk-header">
    <div class="govuk-header__container govuk-width-container">
      <div class="govuk-header__logo">
        <a href="/" class="govuk-header__homepage-link">
          <svg class="govuk-header__logotype" role="img" aria-label="GOV.UK" focusable="false" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 60" height="30" width="162">
            <title>GOV.UK</title>
            <!-- SVG path data from GOV.UK Frontend -->
          </svg>
        </a>
      </div>
    </div>
  </header>

  <div class="govuk-width-container">
    <main class="govuk-main-wrapper" id="main-content" role="main">
      <h1 class="govuk-heading-l">Page heading</h1>
      <p class="govuk-body">Page content goes here.</p>
    </main>
  </div>

  <footer class="govuk-footer">
    <div class="govuk-width-container">
      <div class="govuk-footer__meta">
        <div class="govuk-footer__meta-item govuk-footer__meta-item--grow">
          <span class="govuk-footer__licence-description">
            All content is available under the
            <a class="govuk-footer__link" href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="license">Open Government Licence v3.0</a>, except where otherwise stated
          </span>
        </div>
        <div class="govuk-footer__meta-item">
          <a class="govuk-footer__link govuk-footer__copyright-logo" href="https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/">
            &copy; Crown copyright
          </a>
        </div>
      </div>
    </div>
  </footer>

  <script type="module" src="https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js"></script>
  <script type="module">
    import { initAll } from 'https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js';
    initAll();
  </script>
</body>
</html>
```

### 4.2 Required Classes

| Element | Required Class | Purpose |
|---|---|---|
| `<html>` | `govuk-template` | Sets base styles, box-sizing, font |
| `<body>` | `govuk-template__body` | Sets body-level defaults |
| Width container | `govuk-width-container` | Max-width 1020px, centred |
| Main wrapper | `govuk-main-wrapper` | Top padding for main content area |

### 4.3 Page Structure Hierarchy

Elements should appear in the DOM in this order:

1. **Skip link** -- `<a class="govuk-skip-link">` (first focusable element after `<body>`)
2. **Header** -- `<header class="govuk-header">`, containing:
   - Service navigation -- `<section class="govuk-service-navigation">` (if used)
   - Phase banner -- `<div class="govuk-phase-banner">` (if in alpha/beta) -- **must be inside the `<header>` element**, directly after either the Service Navigation or the GOV.UK header container
3. **Width container** -- `<div class="govuk-width-container">`
4. **Back link or Breadcrumbs** -- before `<main>`, inside width container
5. **Main wrapper** -- `<main class="govuk-main-wrapper" id="main-content">`
6. **Footer** -- `<footer class="govuk-footer">`

The inline `<script>` block in `<body>` adds `js-enabled` and `govuk-frontend-supported` classes. These classes are used by GOV.UK Frontend CSS to show or hide JavaScript-dependent UI. For example, accordion show/hide buttons only appear when `js-enabled` is present.

---

## 5. Styles

### 5.1 Colour Palette

#### Functional Colours

These are the core colours used for text, links, focus states, and semantic indicators:

| Purpose | Hex | Sass Function |
|---|---|---|
| Text | `#0b0c0c` | `govuk-functional-colour("text")` |
| Secondary text | `#484949` | -- |
| Link | `#1a65a6` | `govuk-functional-colour("link")` |
| Link hover | `#0f385c` | -- |
| Link visited | `#54319f` | -- |
| Link active | `#0b0c0c` | -- |
| Focus | `#ffdd00` | `govuk-functional-colour("focus")` |
| Focus text | `#0b0c0c` | -- |
| Error | `#ca3535` | `govuk-functional-colour("error")` |
| Success | `#0f7a52` | `govuk-functional-colour("success")` |
| Brand | `#1d70b8` | `govuk-functional-colour("brand")` |
| Hover | `#cecece` | `govuk-functional-colour("hover")` |
| Border | `#cecece` | -- |
| Input border | `#0b0c0c` | -- |
| Body background | `#ffffff` | -- |
| Template background | `#f4f8fb` | `govuk-functional-colour("template-background")` |
| Surface background | `#f4f8fb` | `govuk-functional-colour("surface-background")` |
| Surface text | `#0b0c0c` | `govuk-functional-colour("surface-text")` |
| Surface border | `#8eb8dc` | `govuk-functional-colour("surface-border")` |

#### Extended Palette

The extended palette provides 11 colour groups, each with primary, tint, and shade variants. These are used for tags, status indicators, and decorative elements.

> **Important**: Do not copy hex values directly into production Sass. Use Sass functions (e.g., `govuk-colour("blue")`) so services update automatically when the palette changes.

| Colour Group | Primary (v6.x) | Tint-80 (v6.x) | Notes |
|---|---|---|---|
| Blue | `#1d70b8` | `#d2e2f1` | |
| Green | `#0f7a52` | `#cfe4dc` | |
| Teal | `#158187` | `#d0e6e7` | |
| Purple | `#54319f` | `#ddd6ec` | |
| Magenta | `#ca357c` | `#f4d7e5` | |
| Red | `#ca3535` | `#f4d7d7` | |
| Orange | `#f47738` | `#fde4d7` | |
| Yellow | `#ffdd00` | `#fff8cc` | |
| Brown | `#99704a` | `#faf8f6` | No tint-80 variant; this is tint-95 |
| Black | `#0b0c0c` | `#cecece` | |
| White | `#ffffff` | -- | |

> **Note:** Each colour group has multiple tint and shade variants (tint-25, tint-50, tint-80, tint-95, shade-25, shade-50). Only the tint-80 values are shown above. Use Sass functions (`govuk-colour("blue", "tint-80")`) rather than copying hex values directly.

### 5.2 Typography

#### Typeface

- **GOV.UK services** (on `service.gov.uk`): GDS Transport font
- **Other subdomains and non-GOV.UK projects**: Arial, Helvetica, sans-serif
- Font stack for GOV.UK services: `"GDS Transport", arial, sans-serif`
- Font stack for other projects: `arial, sans-serif`

#### Heading Classes

| Class | Size (large screen) | Usage |
|---|---|---|
| `govuk-heading-xl` | 48px | Long-form page h1 |
| `govuk-heading-l` | 36px | Standard page h1 |
| `govuk-heading-m` | 24px | h2 (standard) or h3 (long-form) |
| `govuk-heading-s` | 19px | h3 (standard) |

#### Caption Classes

Captions are secondary text that appear above headings:

| Class | Usage |
|---|---|
| `govuk-caption-xl` | Paired with `govuk-heading-xl` |
| `govuk-caption-l` | Paired with `govuk-heading-l` |
| `govuk-caption-m` | Paired with `govuk-heading-m` |

```html
<span class="govuk-caption-l">Section name</span>
<h1 class="govuk-heading-l">Page heading</h1>
```

#### Body Text Classes

| Class | Size | Usage |
|---|---|---|
| `govuk-body` | 19px | Default body text |
| `govuk-body-l` | 24px | Lead paragraph (intro text) |
| `govuk-body-s` | 16px | Small body text (supporting info) |

#### Link Classes

| Class | Effect |
|---|---|
| `govuk-link` | Standard link styling (underline, blue) |
| `govuk-link--no-visited-state` | No purple visited colour |
| `govuk-link--inverse` | White link on dark backgrounds |
| `govuk-link--no-underline` | No underline (use sparingly) |

#### List Classes

| Class | Effect |
|---|---|
| `govuk-list` | Base list styling (removes default bullets) |
| `govuk-list--bullet` | Bullet points |
| `govuk-list--number` | Numbered list |
| `govuk-list--spaced` | Extra spacing between items |

```html
<ul class="govuk-list govuk-list--bullet">
  <li>First item</li>
  <li>Second item</li>
</ul>
```

#### Heading Hierarchy by Page Type

**Standard pages:**
- h1: `govuk-heading-l`
- h2: `govuk-heading-m`
- h3: `govuk-heading-s`

**Long-form content pages:**
- h1: `govuk-heading-xl`
- h2: `govuk-heading-l`
- h3: `govuk-heading-m`

### 5.3 Type Scale

The type scale is responsive. Font sizes and line heights change at the 640px breakpoint.

| Scale Point | Large Screen (>640px) | Small Screen (<640px) | CSS Class |
|---|---|---|---|
| 80 | 80px / 80px | 53px / 55px | Exceptional use only |
| 48 | 48px / 50px | 32px / 35px | `govuk-heading-xl` |
| 36 | 36px / 40px | 27px / 30px | `govuk-heading-l` |
| 27 | 27px / 30px | 21px / 25px | Exceptional use only |
| 24 | 24px / 30px | 21px / 25px | `govuk-heading-m`, `govuk-body-l` |
| 19 | 19px / 25px | 19px / 25px | `govuk-heading-s`, `govuk-body` |
| 16 | 16px / 20px | 16px / 20px | `govuk-body-s` |

Format: font-size / line-height.

### 5.4 Spacing

GOV.UK uses a responsive spacing scale with units 0 through 9. Values change at the 640px breakpoint.

| Unit | Small Screen (<640px) | Large Screen (>640px) |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 5px | 5px |
| 2 | 10px | 10px |
| 3 | 15px | 15px |
| 4 | 15px | 20px |
| 5 | 15px | 25px |
| 6 | 20px | 30px |
| 7 | 25px | 40px |
| 8 | 30px | 50px |
| 9 | 40px | 60px |

#### Override Classes

**Responsive spacing** (changes at breakpoint):

- Margin: `govuk-!-margin-{direction}-{unit}` (e.g., `govuk-!-margin-top-5`)
- Padding: `govuk-!-padding-{direction}-{unit}` (e.g., `govuk-!-padding-bottom-3`)
- All sides: omit direction (e.g., `govuk-!-margin-6`)

**Static spacing** (same at all screen sizes):

- `govuk-!-static-margin-{direction}-{unit}`
- `govuk-!-static-padding-{direction}-{unit}`

**Directions**: `top`, `right`, `bottom`, `left` (or omit for all four sides).

### 5.5 Layout and Grid

#### Container

```html
<div class="govuk-width-container">
  <!-- Max width 1020px, centred -->
</div>
```

#### Main Wrapper

```html
<main class="govuk-main-wrapper" id="main-content" role="main">
  <!-- Page content -->
</main>
```

**Variants:**
- `govuk-main-wrapper--l` — Larger top padding (use when there is no back link or breadcrumbs above the main content)
- `govuk-main-wrapper--auto-spacing` — Automatically adjusts top padding based on whether a back link or breadcrumbs precede it

#### Grid System

The grid uses a row-and-column layout within `govuk-width-container`.

```html
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">
    <!-- Main content -->
  </div>
  <div class="govuk-grid-column-one-third">
    <!-- Sidebar -->
  </div>
</div>
```

**Column classes:**

| Class | Width |
|---|---|
| `govuk-grid-column-full` | 100% |
| `govuk-grid-column-three-quarters` | 75% |
| `govuk-grid-column-two-thirds` | 66.66% |
| `govuk-grid-column-one-half` | 50% |
| `govuk-grid-column-one-third` | 33.33% |
| `govuk-grid-column-one-quarter` | 25% |

**Desktop-specific columns** (full width on mobile, specified width on desktop):

Append `-from-desktop` to any column class, e.g. `govuk-grid-column-two-thirds-from-desktop`.

**Width override classes:**

`govuk-!-width-{full|three-quarters|two-thirds|one-half|one-third|one-quarter}`

**Display classes:**

| Class | Effect |
|---|---|
| `govuk-!-display-block` | `display: block` |
| `govuk-!-display-inline` | `display: inline` |
| `govuk-!-display-inline-block` | `display: inline-block` |
| `govuk-!-display-none` | `display: none` |
| `govuk-!-display-none-print` | Hidden in print |

**Accessibility utilities:**

| Class | Effect |
|---|---|
| `govuk-visually-hidden` | Hidden visually but available to screen readers |
| `govuk-visually-hidden-focusable` | Hidden until focused (used for skip links) |

**Recommendation**: Use a two-thirds column width for most page content. Keep lines under 75 characters for readability.

### 5.6 Section Breaks

Section breaks create visible horizontal rules with spacing.

```html
<hr class="govuk-section-break govuk-section-break--xl govuk-section-break--visible">
```

**Size modifiers:**

| Modifier | Spacing |
|---|---|
| `govuk-section-break--xl` | Extra large spacing above and below |
| `govuk-section-break--l` | Large spacing |
| `govuk-section-break--m` | Medium spacing |

Add `govuk-section-break--visible` to show the horizontal rule. Without it, only spacing is applied.

### 5.7 Font Override Classes

#### Size Overrides

`govuk-!-font-size-{80|48|36|27|24|19|16}`

#### Weight Overrides

| Class | Effect |
|---|---|
| `govuk-!-font-weight-regular` | Normal weight |
| `govuk-!-font-weight-bold` | Bold weight |

#### Alignment Overrides

| Class | Effect |
|---|---|
| `govuk-!-text-align-left` | Left-aligned |
| `govuk-!-text-align-right` | Right-aligned |
| `govuk-!-text-align-centre` | Centre-aligned |

#### Special Typography

| Class | Effect |
|---|---|
| `govuk-!-font-tabular-numbers` | Fixed-width numerals for aligned columns |
| `govuk-!-text-break-word` | Breaks long words to prevent overflow |

### 5.8 Images

#### When to Use Images

Only use images when there is a real user need. Do not use images for decoration.

**Appropriate uses:**

- Photography for lifelike representations of people, places, or objects
- Illustrations to simplify complex concepts or processes
- Icons in case management systems or specialist tools where they aid recognition

**Avoid:**

- Generic stock photography
- Images of abstract concepts
- Decorative images that add no informational value

#### Accessibility Requirements

All `<img>` elements must have an `alt` attribute, even if the value is empty:

```html
<!-- Informative image -->
<img src="chart.png" alt="Bar chart showing 60% of councils use cloud-first strategy">

<!-- Decorative image (empty alt) -->
<img src="divider.png" alt="">
```

- Text embedded in images creates barriers for screen readers, copy-paste, and resizing
- WCAG 2.2 criterion 1.4.3 requires minimum contrast ratio of 4.5:1 for text and images of text
- Screen magnification users may lose context if important information is only in images

#### Alt Text Guidance

- Be specific and meaningful -- describe what the image shows, not what it is
- Keep alt text concise: maximum 2 sentences
- Avoid starting with "Image of..." or "Photo of..." -- screen readers already announce the element as an image
- Use `alt=""` (empty string) for purely decorative images so screen readers skip the image entirely
- For complex images (charts, diagrams), provide a text equivalent nearby or use `aria-describedby` to link to a longer description

#### Illustrations

- Use minimal elements and flat colours
- Maintain consistent styling across a set of illustrations
- Avoid depicting people unless necessary for the content -- if depicting people, ensure diversity
- Do not use illustrations as the sole means of conveying critical information

#### Text in Images

- Avoid placing text in images -- it cannot be read by screen readers, resized by users, or copied
- If text in an image is essential, provide alt text that conveys the full meaning of the text
- Consider whether the text could be presented as HTML instead

---

## 6. Components

This section covers all 34 GOV.UK Design System components in alphabetical order. Each component includes a description, usage guidance, complete HTML markup, CSS classes, JavaScript requirements, and accessibility notes.

---

### 6.1 Accordion

An accordion lets users show and hide sections of related content on a page.

**When to use:**
- When users need to see an overview of multiple sections of content before choosing which to read
- When the page would otherwise be very long

**When not to use:**
- If users need to read all the content in order -- use separate pages or headings instead
- If there is only one section -- use the [Details](#69-details) component

**HTML:**

```html
<div class="govuk-accordion" data-module="govuk-accordion" id="accordion-default">
  <div class="govuk-accordion__section">
    <div class="govuk-accordion__section-header">
      <h2 class="govuk-accordion__section-heading">
        <span class="govuk-accordion__section-button" id="accordion-default-heading-1">
          Section 1 heading
        </span>
      </h2>
    </div>
    <div id="accordion-default-content-1" class="govuk-accordion__section-content">
      <p class="govuk-body">Section 1 content goes here.</p>
    </div>
  </div>
  <div class="govuk-accordion__section">
    <div class="govuk-accordion__section-header">
      <h2 class="govuk-accordion__section-heading">
        <span class="govuk-accordion__section-button" id="accordion-default-heading-2">
          Section 2 heading
        </span>
      </h2>
    </div>
    <div id="accordion-default-content-2" class="govuk-accordion__section-content">
      <p class="govuk-body">Section 2 content goes here.</p>
    </div>
  </div>
</div>
```

**With summary line:**

```html
<div class="govuk-accordion__section">
  <div class="govuk-accordion__section-header">
    <h2 class="govuk-accordion__section-heading">
      <span class="govuk-accordion__section-button" id="accordion-heading-1">
        Section heading
      </span>
    </h2>
    <div class="govuk-accordion__section-summary govuk-body" id="accordion-summary-1">
      Brief summary of the section contents
    </div>
  </div>
  <div id="accordion-content-1" class="govuk-accordion__section-content">
    <p class="govuk-body">Full content here.</p>
  </div>
</div>
```

**Section open by default:**

Add `govuk-accordion__section--expanded` to the section div:

```html
<div class="govuk-accordion__section govuk-accordion__section--expanded">
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-accordion` | Container element |
| `govuk-accordion__section` | Individual section wrapper |
| `govuk-accordion__section--expanded` | Opens section by default |
| `govuk-accordion__section-header` | Section header area |
| `govuk-accordion__section-heading` | Heading element (h2 by default) |
| `govuk-accordion__section-button` | The clickable heading text |
| `govuk-accordion__section-summary` | Optional summary below heading |
| `govuk-accordion__section-content` | Content area |

**JavaScript:** Required. Add `data-module="govuk-accordion"` to the container. Without JS, all sections display expanded with plain headings (no show/hide controls).

Session storage remembers which sections the user has opened or closed. This can be disabled with `data-remember-expanded="false"` on the container.

**Accessibility:**
- Button text is read as a single statement by screen readers
- Show/hide state changes are announced
- Keyboard navigation is supported (Enter/Space to toggle)
- Heading level is adjustable (default is h2) -- change the `<h2>` elements as appropriate for your page hierarchy

**Research:** User testing showed that some users do not notice the "Show all sections" link. Users with lower digital literacy sometimes find accordions confusing. Consider whether the content genuinely benefits from being hidden.

---

### 6.2 Back Link

A back link helps users go back to the previous page in a multi-page journey.

**When to use:**
- In multi-step transaction journeys
- On question pages within a service

**When not to use:**
- On content pages that are not part of a multi-step flow
- Together with breadcrumbs -- use one or the other

**HTML:**

```html
<a href="/previous-page" class="govuk-back-link">Back</a>
```

**Inverse variant** (for use on dark backgrounds):

```html
<a href="/previous-page" class="govuk-back-link govuk-back-link--inverse">Back</a>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-back-link` | Base back link styling with left-pointing arrow |
| `govuk-back-link--inverse` | White text for dark backgrounds |

**Position:** Place before the `<main>` element, at the top of the page, inside the width container.

**Custom text:** For complex journeys, use descriptive text such as "Go back to [page name]" instead of just "Back".

**JavaScript:** Not required.

**Accessibility:** The back link uses a CSS-generated left-pointing arrow. The link text provides the accessible name. Consider using `aria-label` if the link text alone is ambiguous.

---

### 6.3 Breadcrumbs

Breadcrumbs help users understand where they are in a website's structure and navigate back to higher-level pages.

**When to use:**
- On pages that are not the homepage and are more than one level deep
- When the site has a clear hierarchical structure

**When not to use:**
- Together with a back link -- use one or the other
- In multi-step transaction journeys (use back link instead)

**HTML:**

```html
<nav class="govuk-breadcrumbs" aria-label="Breadcrumb">
  <ol class="govuk-breadcrumbs__list">
    <li class="govuk-breadcrumbs__list-item">
      <a class="govuk-breadcrumbs__link" href="/">Home</a>
    </li>
    <li class="govuk-breadcrumbs__list-item">
      <a class="govuk-breadcrumbs__link" href="/section">Section</a>
    </li>
    <li class="govuk-breadcrumbs__list-item" aria-current="page">
      Current page
    </li>
  </ol>
</nav>
```

**Collapsible on mobile:**

```html
<nav class="govuk-breadcrumbs govuk-breadcrumbs--collapse-on-mobile" aria-label="Breadcrumb">
  <!-- Same inner structure -->
</nav>
```

**Inverse variant** (for dark backgrounds):

```html
<nav class="govuk-breadcrumbs govuk-breadcrumbs--inverse" aria-label="Breadcrumb">
  <!-- Same inner structure -->
</nav>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-breadcrumbs` | Container nav element |
| `govuk-breadcrumbs__list` | Ordered list |
| `govuk-breadcrumbs__list-item` | Individual breadcrumb |
| `govuk-breadcrumbs__link` | Link within a breadcrumb |
| `govuk-breadcrumbs--collapse-on-mobile` | Shows only first and last on mobile |
| `govuk-breadcrumbs--inverse` | White text for dark backgrounds |

**Position:** Place before `<main>` so the skip link bypasses navigation.

**JavaScript:** Not required.

**Accessibility:**
- The `<nav>` element has `aria-label="Breadcrumb"` to identify it as breadcrumb navigation
- The current page (last item) uses `aria-current="page"` and is not a link

---

### 6.4 Button

A button lets users carry out an action, such as submitting a form or starting an application.

**When to use:**
- To help users carry out an action on a page (submitting, continuing, starting)
- When the action changes data or state

**When not to use:**
- For navigation -- use a link instead
- If the action is not important enough for a button -- use a link

**HTML -- Primary button:**

```html
<button type="submit" class="govuk-button" data-module="govuk-button">
  Save and continue
</button>
```

**Secondary button:**

```html
<button type="button" class="govuk-button govuk-button--secondary" data-module="govuk-button">
  Find address
</button>
```

**Warning button:**

```html
<button type="button" class="govuk-button govuk-button--warning" data-module="govuk-button">
  Delete account
</button>
```

**Inverse button** (for dark backgrounds):

```html
<button type="button" class="govuk-button govuk-button--inverse" data-module="govuk-button">
  Sign in
</button>
```

**Start button:**

```html
<a href="/start" role="button" draggable="false" class="govuk-button govuk-button--start" data-module="govuk-button">
  Start now
  <svg class="govuk-button__start-icon" xmlns="http://www.w3.org/2000/svg" width="17.5" height="19" viewBox="0 0 33 40" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z"/>
  </svg>
</a>
```

**Disabled button:**

```html
<button type="button" disabled aria-disabled="true" class="govuk-button" data-module="govuk-button">
  Send application
</button>
```

**Button group** (multiple buttons side by side):

```html
<div class="govuk-button-group">
  <button type="submit" class="govuk-button" data-module="govuk-button">
    Save and continue
  </button>
  <a class="govuk-link" href="/cancel">Cancel</a>
</div>
```

**Double-click prevention:**

```html
<button type="submit" class="govuk-button" data-module="govuk-button" data-prevent-double-click="true">
  Pay now
</button>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-button` | Primary green button |
| `govuk-button--secondary` | Grey secondary button |
| `govuk-button--warning` | Red warning button |
| `govuk-button--inverse` | White button for dark backgrounds |
| `govuk-button--start` | Large start button with arrow icon |
| `govuk-button-group` | Container for grouping buttons and links |
| `govuk-button__start-icon` | SVG arrow icon class for start buttons |

**JavaScript:** `data-module="govuk-button"` prevents double form submission. Without JS, the button works but double-click protection is not available.

**Accessibility:**
- Disabled buttons have poor contrast and may not be perceivable -- avoid where possible; instead explain why an action is not available
- Start buttons that use `<a>` tags need `role="button"` and `draggable="false"`
- Use `<button>` for actions, `<a>` for navigation

---

### 6.5 Character Count

A character count tells users how many characters or words they have remaining as they type into a textarea.

**When to use:**
- When there is a character or word limit on a textarea that a user is likely to exceed
- When backend validation enforces a limit

**When not to use:**
- If the limit is very high and users are unlikely to reach it
- For single-line text inputs (not supported)

**HTML:**

```html
<div class="govuk-form-group govuk-character-count" data-module="govuk-character-count" data-maxlength="200">
  <label class="govuk-label" for="more-detail">
    Can you provide more detail?
  </label>
  <textarea class="govuk-textarea govuk-js-character-count" id="more-detail" name="moreDetail" rows="5" aria-describedby="more-detail-info"></textarea>
  <div id="more-detail-info" class="govuk-hint govuk-character-count__message">
    You can enter up to 200 characters
  </div>
</div>
```

**Word count variant:**

```html
<div class="govuk-character-count" data-module="govuk-character-count" data-maxwords="150">
  <!-- Same inner structure, change message text -->
  <div id="word-count-info" class="govuk-hint govuk-character-count__message">
    You can enter up to 150 words
  </div>
</div>
```

**Threshold** (show count only after a percentage of the limit):

```html
<div class="govuk-character-count" data-module="govuk-character-count" data-maxlength="400" data-threshold="75">
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-character-count` | Container with data attributes |
| `govuk-textarea` | Standard textarea styling |
| `govuk-js-character-count` | JS hook for the character count script |
| `govuk-character-count__message` | The count message element |

**JavaScript:** Required. `data-module="govuk-character-count"` activates live count updates as the user types and announces changes to screen readers. Without JS, only the static message is shown.

The component does not restrict input. Users can exceed the limit -- validation must be handled separately.

**Accessibility:** The remaining count is announced to screen readers via `aria-live` region. The `aria-describedby` on the textarea links to the message element.

---

### 6.6 Checkboxes

Checkboxes let users select one or more options from a list.

**When to use:**
- When users can select multiple options from a list
- When toggling a single option on or off

**When not to use:**
- When users should only select one option -- use [Radios](#623-radios) instead
- For very long lists -- consider an alternative approach

**HTML:**

```html
<div class="govuk-form-group">
  <fieldset class="govuk-fieldset" aria-describedby="waste-hint">
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
      <h1 class="govuk-fieldset__heading">
        Which types of waste do you transport?
      </h1>
    </legend>
    <div id="waste-hint" class="govuk-hint">
      Select all that apply.
    </div>
    <div class="govuk-checkboxes" data-module="govuk-checkboxes">
      <div class="govuk-checkboxes__item">
        <input class="govuk-checkboxes__input" id="waste-1" name="waste" type="checkbox" value="animal">
        <label class="govuk-label govuk-checkboxes__label" for="waste-1">
          Waste from animal carcasses
        </label>
      </div>
      <div class="govuk-checkboxes__item">
        <input class="govuk-checkboxes__input" id="waste-2" name="waste" type="checkbox" value="mines">
        <label class="govuk-label govuk-checkboxes__label" for="waste-2">
          Waste from mines or quarries
        </label>
      </div>
      <div class="govuk-checkboxes__item">
        <input class="govuk-checkboxes__input" id="waste-3" name="waste" type="checkbox" value="farm">
        <label class="govuk-label govuk-checkboxes__label" for="waste-3">
          Farm or agricultural waste
        </label>
      </div>
    </div>
  </fieldset>
</div>
```

**With hints on individual options:**

```html
<div class="govuk-checkboxes__item">
  <input class="govuk-checkboxes__input" id="org-1" name="org" type="checkbox" value="hmrc" aria-describedby="org-1-hint">
  <label class="govuk-label govuk-checkboxes__label" for="org-1">
    HM Revenue and Customs (HMRC)
  </label>
  <div id="org-1-hint" class="govuk-hint govuk-checkboxes__hint">
    Tax, self assessment, and VAT
  </div>
</div>
```

**Small variant:**

```html
<div class="govuk-checkboxes govuk-checkboxes--small" data-module="govuk-checkboxes">
```

**Conditional reveal:**

```html
<div class="govuk-checkboxes" data-module="govuk-checkboxes">
  <div class="govuk-checkboxes__item">
    <input class="govuk-checkboxes__input" id="contact-1" name="contact" type="checkbox" value="email" data-aria-controls="conditional-contact-1">
    <label class="govuk-label govuk-checkboxes__label" for="contact-1">
      Email
    </label>
  </div>
  <div class="govuk-checkboxes__conditional govuk-checkboxes__conditional--hidden" id="conditional-contact-1">
    <div class="govuk-form-group">
      <label class="govuk-label" for="email-address">
        Email address
      </label>
      <input class="govuk-input govuk-!-width-one-third" id="email-address" name="emailAddress" type="email" spellcheck="false" autocomplete="email">
    </div>
  </div>
</div>
```

**"None" exclusive option:**

```html
<div class="govuk-checkboxes__divider">or</div>
<div class="govuk-checkboxes__item">
  <input class="govuk-checkboxes__input" id="contact-none" name="contact" type="checkbox" value="none" data-behaviour="exclusive">
  <label class="govuk-label govuk-checkboxes__label" for="contact-none">
    None of these
  </label>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-checkboxes` | Container |
| `govuk-checkboxes--small` | Smaller checkboxes |
| `govuk-checkboxes__item` | Individual checkbox wrapper |
| `govuk-checkboxes__input` | The checkbox input |
| `govuk-checkboxes__label` | Label for checkbox |
| `govuk-checkboxes__hint` | Hint text for individual option |
| `govuk-checkboxes__conditional` | Conditionally revealed content |
| `govuk-checkboxes__conditional--hidden` | Hides conditional content by default |
| `govuk-checkboxes__divider` | Divider text (e.g., "or") |

**JavaScript:** `data-module="govuk-checkboxes"` enables conditional reveal and exclusive "none" behaviour. Without JS, conditional content is always visible and the exclusive behaviour does not work.

**Accessibility:** Checkboxes are positioned to the left of their labels. The fieldset and legend group the options and provide a question context for screen readers. `aria-describedby` links hints to inputs.

---

### 6.7 Cookie Banner

A cookie banner lets users accept or reject cookies which are not essential to making a service work.

**When to use:**
- On any service that uses non-essential cookies (analytics, marketing)
- Required by law in the UK (Privacy and Electronic Communications Regulations)

**When not to use:**
- If a service only uses strictly necessary cookies

**HTML:**

```html
<div class="govuk-cookie-banner" data-nosnippet role="region" aria-label="Cookies on [service name]">
  <div class="govuk-cookie-banner__message govuk-width-container">
    <div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        <h2 class="govuk-cookie-banner__heading govuk-heading-m">Cookies on [service name]</h2>
        <div class="govuk-cookie-banner__content">
          <p class="govuk-body">We use some essential cookies to make this service work.</p>
          <p class="govuk-body">We'd also like to use analytics cookies so we can understand how you use the service and make improvements.</p>
        </div>
      </div>
    </div>
    <div class="govuk-button-group">
      <button type="button" class="govuk-button" data-module="govuk-button">
        Accept analytics cookies
      </button>
      <button type="button" class="govuk-button" data-module="govuk-button">
        Reject analytics cookies
      </button>
      <a class="govuk-link" href="/cookies">View cookies</a>
    </div>
  </div>
</div>
```

**Confirmation message** (shown after user accepts or rejects). For client-side implementations, add `role="alert"` and `tabindex="-1"` to the confirmation message, and shift focus to it so screen readers announce the change:

```html
<div class="govuk-cookie-banner" data-nosnippet role="region" aria-label="Cookies on [service name]">
  <div class="govuk-cookie-banner__message govuk-width-container" role="alert" tabindex="-1">
    <div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        <div class="govuk-cookie-banner__content">
          <p class="govuk-body">You've accepted analytics cookies. You can <a class="govuk-link" href="/cookies">change your cookie settings</a> at any time.</p>
        </div>
      </div>
    </div>
    <div class="govuk-button-group">
      <button type="button" class="govuk-button" data-module="govuk-button">Hide cookie message</button>
    </div>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-cookie-banner` | Container element |
| `govuk-cookie-banner__message` | Message wrapper |
| `govuk-cookie-banner__heading` | Banner heading |
| `govuk-cookie-banner__content` | Body content area |

**Position:** Place before the skip link in the DOM (first element after `<body>` tag).

**JavaScript:** Requires custom JavaScript for cookie management. The GOV.UK Frontend does not provide cookie-handling JS -- you must implement accept/reject logic, cookie storage (1-year expiry), and consent tracking yourself.

**Accessibility:**
- `role="region"` with `aria-label` identifies the banner as a landmark
- `data-nosnippet` prevents search engines from using the banner text in snippets
- The banner must be dismissible

---

### 6.8 Date Input

A date input lets users enter a memorable date, such as a date of birth, using three separate fields for day, month, and year.

**When to use:**
- When asking users for a date they already know (date of birth, start date, etc.)

**When not to use:**
- For dates that users need to look up or calculate -- consider a different approach
- For approximate dates -- use text input or select

**HTML:**

```html
<div class="govuk-form-group">
  <fieldset class="govuk-fieldset" role="group" aria-describedby="dob-hint">
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
      <h1 class="govuk-fieldset__heading">
        What is your date of birth?
      </h1>
    </legend>
    <div id="dob-hint" class="govuk-hint">
      For example, 27 3 2007
    </div>
    <div class="govuk-date-input" id="dob">
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label class="govuk-label govuk-date-input__label" for="dob-day">
            Day
          </label>
          <input class="govuk-input govuk-date-input__input govuk-input--width-2" id="dob-day" name="dob-day" type="text" inputmode="numeric" autocomplete="bday-day">
        </div>
      </div>
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label class="govuk-label govuk-date-input__label" for="dob-month">
            Month
          </label>
          <input class="govuk-input govuk-date-input__input govuk-input--width-2" id="dob-month" name="dob-month" type="text" inputmode="numeric" autocomplete="bday-month">
        </div>
      </div>
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label class="govuk-label govuk-date-input__label" for="dob-year">
            Year
          </label>
          <input class="govuk-input govuk-date-input__input govuk-input--width-4" id="dob-year" name="dob-year" type="text" inputmode="numeric" autocomplete="bday-year">
        </div>
      </div>
    </div>
  </fieldset>
</div>
```

**Key implementation details:**
- Use `type="text"` with `inputmode="numeric"` -- NOT `type="number"` (number inputs have spinner buttons and inconsistent behaviour across browsers)
- Day and month fields: `govuk-input--width-2`
- Year field: `govuk-input--width-4`
- For date of birth, add `autocomplete="bday-day"`, `autocomplete="bday-month"`, `autocomplete="bday-year"`

**Error state:**

Apply `govuk-input--error` to the specific field(s) with errors, and `govuk-form-group--error` to the parent form group:

```html
<div class="govuk-form-group govuk-form-group--error">
  <fieldset class="govuk-fieldset" role="group" aria-describedby="dob-hint dob-error">
    <!-- legend and hint -->
    <p id="dob-error" class="govuk-error-message">
      <span class="govuk-visually-hidden">Error:</span> Date of birth must include a year
    </p>
    <div class="govuk-date-input" id="dob">
      <!-- day and month fields unchanged -->
      <div class="govuk-date-input__item">
        <div class="govuk-form-group">
          <label class="govuk-label govuk-date-input__label" for="dob-year">Year</label>
          <input class="govuk-input govuk-date-input__input govuk-input--width-4 govuk-input--error" id="dob-year" name="dob-year" type="text" inputmode="numeric">
        </div>
      </div>
    </div>
  </fieldset>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-date-input` | Container for the three date fields |
| `govuk-date-input__item` | Wrapper for each field |
| `govuk-date-input__input` | Additional styling for date inputs |
| `govuk-date-input__label` | Label styling for day/month/year |

**JavaScript:** Not required.

**Accessibility:** The fieldset uses `role="group"` to associate the three fields. `aria-describedby` links the hint and any error message to the fieldset.

---

### 6.9 Details

The details component lets users reveal more information only if they need it.

**When to use:**
- To make a page easier to scan by hiding secondary information
- For content that only some users will need

**When not to use:**
- If most users need the information -- show it in the page content
- For hiding important warnings or critical information

**HTML:**

```html
<details class="govuk-details">
  <summary class="govuk-details__summary">
    <span class="govuk-details__summary-text">
      Help with nationality
    </span>
  </summary>
  <div class="govuk-details__text">
    <p class="govuk-body">If you're not sure about your nationality, try to find out from an official document like a passport or national identity card.</p>
  </div>
</details>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-details` | Container (native HTML5 `<details>` element) |
| `govuk-details__summary` | The clickable summary text |
| `govuk-details__summary-text` | Text within the summary |
| `govuk-details__text` | The revealed content area |

**JavaScript:** Not required. This uses the native HTML5 `<details>` element.

**Accessibility:** The native `<details>` element handles expand/collapse semantics. Screen readers announce the expanded/collapsed state. **Important:** Some voice assistant software users may struggle to interact with this component — test with your users before relying on it for critical content.

**Research:** Some users think clicking the summary will navigate them away from the page. Users of voice assistant software may not be able to interact with the component at all. Test with your users and avoid hiding essential information inside details.

---

### 6.10 Error Message

An error message tells the user that there is a problem with a form field and how to fix it.

**When to use:**
- When a form field fails validation
- Always alongside an [Error Summary](#611-error-summary) at the top of the page

**When not to use:**
- For information that is not an error -- use hint text or inset text instead
- Without a corresponding entry in the error summary

**HTML:**

```html
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="national-insurance-number">
    National Insurance number
  </label>
  <div id="ni-number-hint" class="govuk-hint">
    It's on your National Insurance card, benefit letter, payslip or P60. For example, QQ 12 34 56 C.
  </div>
  <p id="ni-number-error" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Enter a National Insurance number in the correct format
  </p>
  <input class="govuk-input govuk-input--error" id="national-insurance-number" name="niNumber" type="text" aria-describedby="ni-number-hint ni-number-error">
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-error-message` | Error message text styling (red) |
| `govuk-form-group--error` | Adds red left border to the form group |
| `govuk-input--error` | Red border on the input field |

**JavaScript:** Not required.

**Accessibility:**
- The `<span class="govuk-visually-hidden">Error:</span>` prefix is announced by screen readers but not shown visually
- `aria-describedby` on the input links to both the hint and the error message
- Error messages must also appear in the [Error Summary](#611-error-summary) at the top of the page

**Content guidance:**
- Describe what went wrong and how to fix it
- Be specific (e.g., "Enter a date after 1 January 2024" not "Enter a valid date")
- Avoid jargon and technical language
- Do not use "please" -- be direct

---

### 6.11 Error Summary

An error summary lists all the errors on a page, with links to each problem field.

**When to use:**
- When a form page has one or more validation errors
- Always combined with inline [Error Messages](#610-error-message)

**When not to use:**
- On pages without form validation errors

**HTML:**

```html
<div class="govuk-error-summary" data-module="govuk-error-summary">
  <div role="alert">
    <h2 class="govuk-error-summary__title">
      There is a problem
    </h2>
    <div class="govuk-error-summary__body">
      <ul class="govuk-list govuk-error-summary__list">
        <li>
          <a href="#national-insurance-number">Enter a National Insurance number in the correct format</a>
        </li>
        <li>
          <a href="#date-of-birth-day">Date of birth must include a year</a>
        </li>
      </ul>
    </div>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-error-summary` | Container with red top border |
| `govuk-error-summary__title` | "There is a problem" heading |
| `govuk-error-summary__body` | Body wrapper |
| `govuk-error-summary__list` | List of error links |

**Position:** Top of main content, below breadcrumbs/back link, above the h1 heading.

**JavaScript:** `data-module="govuk-error-summary"` auto-focuses the error summary on page load so screen reader users hear the errors immediately. Without JS, the summary is still visible but does not receive focus automatically.

**Accessibility:**
- `role="alert"` on the inner div announces the error summary to screen readers
- Each error links to the corresponding form field using `href="#field-id"`
- For radio and checkbox groups, link to the first option in the group
- For date inputs, link to the day field (or whichever field has the error)

---

### 6.12 Exit This Page

The exit this page component gives users a way to quickly leave a service and navigate to a safe page, such as the BBC weather website.

**When to use:**
- For services where users may be at risk, such as domestic abuse or violence support services
- Where a user might need to quickly hide what they are viewing

**When not to use:**
- On general government services where users are not at risk

**HTML:**

```html
<div class="govuk-exit-this-page" data-module="govuk-exit-this-page">
  <a href="https://www.bbc.co.uk/weather" role="button" draggable="false" class="govuk-button govuk-button--warning govuk-exit-this-page__button govuk-js-exit-this-page-button" data-module="govuk-button" rel="nofollow noreferrer">
    <span class="govuk-visually-hidden">Emergency</span> Exit this page
  </a>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-exit-this-page` | Container |
| `govuk-exit-this-page__button` | The exit button |
| `govuk-js-exit-this-page-button` | JS hook for keyboard shortcut |

**JavaScript:** Required. `data-module="govuk-exit-this-page"` enables:
- Pressing Shift key 3 times within 5 seconds activates the exit
- Loading overlay with progress dots during navigation
- Screen reader announcements

Without JS, the button still works as a regular link to the safe page, but the keyboard shortcut and overlay are not available.

**Accessibility:**
- The `<span class="govuk-visually-hidden">Emergency</span>` prefix is announced by screen readers
- Skip link activation is provided as an alternative
- Keyboard shortcut (triple Shift) works from anywhere on the page

---

### 6.13 Fieldset

A fieldset groups related form inputs and provides a legend that describes the group.

**When to use:**
- When grouping related form fields (e.g., address fields, date fields, radio/checkbox groups)
- When a group of inputs answers a single question

**When not to use:**
- For a single input that has its own label

**HTML:**

```html
<fieldset class="govuk-fieldset">
  <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
    <h1 class="govuk-fieldset__heading">
      What is your address?
    </h1>
  </legend>
  <!-- Form fields here -->
</fieldset>
```

**Legend size variants:**

```html
<legend class="govuk-fieldset__legend govuk-fieldset__legend--xl">
<legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
<legend class="govuk-fieldset__legend govuk-fieldset__legend--m">
```

**Legend as page heading:**

When the legend text is the same as the page heading, wrap an h1 inside the legend to avoid duplication:

```html
<legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
  <h1 class="govuk-fieldset__heading">
    What is your date of birth?
  </h1>
</legend>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-fieldset` | Base fieldset styling |
| `govuk-fieldset__legend` | Legend styling |
| `govuk-fieldset__legend--xl` | Extra large legend text |
| `govuk-fieldset__legend--l` | Large legend text |
| `govuk-fieldset__legend--m` | Medium legend text |
| `govuk-fieldset__legend--s` | Small legend text |
| `govuk-fieldset__heading` | Heading inside legend |

**JavaScript:** Not required.

**Accessibility:** The `<fieldset>` and `<legend>` elements are essential for screen readers to understand the relationship between grouped inputs. Screen readers announce the legend text when a user focuses on any input within the fieldset.

---

### 6.14 File Upload

A file upload lets users select and upload a file.

**When to use:**
- When users need to provide a file as part of a service

**When not to use:**
- When you can get the information another way (e.g., through form fields)

**HTML -- Basic:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="file-upload">
    Upload a file
  </label>
  <input class="govuk-file-upload" id="file-upload" name="fileUpload" type="file">
</div>
```

**Enhanced drop zone** (March 2025):

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="file-upload-enhanced">
    Upload a file
  </label>
  <div class="govuk-drop-zone" data-module="govuk-file-upload">
    <input class="govuk-file-upload" id="file-upload-enhanced" name="fileUpload" type="file">
  </div>
</div>
```

**Error state:**

```html
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="file-upload-error">
    Upload a file
  </label>
  <p id="file-upload-error-msg" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> The selected file must be smaller than 2MB
  </p>
  <input class="govuk-file-upload govuk-file-upload--error" id="file-upload-error" name="fileUpload" type="file" aria-describedby="file-upload-error-msg">
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-file-upload` | File input styling |
| `govuk-file-upload--error` | Error state border |
| `govuk-drop-zone` | Enhanced drag-and-drop area |

**JavaScript:** The enhanced drop zone uses `data-module="govuk-file-upload"`. Without JS, the basic file input is shown without the drop zone. The enhanced version was introduced in GOV.UK Frontend v5.9.0 (March 2025) and is included in v6.1.0. It provides a drag-and-drop area with accessibility announcements for file selection status.

**Specific error messages to use:**
- No file selected: "Select a [file type]"
- Wrong file type: "The selected file must be a [list of types]"
- File too large: "The selected file must be smaller than [size]"
- Virus detected: "The selected file contains a virus"
- Empty file: "The selected file is empty"
- Password protected: "The selected file is password protected"

---

### 6.15 Footer

The footer provides copyright, licensing, and navigation links at the bottom of every page.

**When to use:**
- On every page of a GOV.UK service

**HTML:**

```html
<footer class="govuk-footer">
  <div class="govuk-width-container">
    <div class="govuk-footer__navigation">
      <div class="govuk-footer__section">
        <h2 class="govuk-footer__heading govuk-heading-m">Services and information</h2>
        <ul class="govuk-footer__list govuk-footer__list--columns-2">
          <li class="govuk-footer__list-item">
            <a class="govuk-footer__link" href="#">Benefits</a>
          </li>
          <li class="govuk-footer__list-item">
            <a class="govuk-footer__link" href="#">Births, deaths, marriages</a>
          </li>
        </ul>
      </div>
    </div>
    <hr class="govuk-footer__section-break">
    <div class="govuk-footer__meta">
      <div class="govuk-footer__meta-item govuk-footer__meta-item--grow">
        <h2 class="govuk-visually-hidden">Support links</h2>
        <ul class="govuk-footer__inline-list">
          <li class="govuk-footer__inline-list-item">
            <a class="govuk-footer__link" href="#">Help</a>
          </li>
          <li class="govuk-footer__inline-list-item">
            <a class="govuk-footer__link" href="#">Cookies</a>
          </li>
          <li class="govuk-footer__inline-list-item">
            <a class="govuk-footer__link" href="#">Accessibility statement</a>
          </li>
        </ul>
        <span class="govuk-footer__licence-description">
          All content is available under the
          <a class="govuk-footer__link" href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="license">Open Government Licence v3.0</a>, except where otherwise stated
        </span>
      </div>
      <div class="govuk-footer__meta-item">
        <a class="govuk-footer__link govuk-footer__copyright-logo" href="https://www.nationalarchives.gov.uk/information-management/re-using-public-sector-information/uk-government-licensing-framework/crown-copyright/">
          &copy; Crown copyright
        </a>
      </div>
    </div>
  </div>
</footer>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-footer` | Footer container |
| `govuk-footer__navigation` | Navigation section wrapper |
| `govuk-footer__section` | Individual navigation section |
| `govuk-footer__heading` | Section heading |
| `govuk-footer__list` | Link list |
| `govuk-footer__list--columns-2` | Two-column layout for lists |
| `govuk-footer__list-item` | Individual list item |
| `govuk-footer__link` | Footer link styling |
| `govuk-footer__meta` | Meta section (licence, copyright) |
| `govuk-footer__meta-item` | Meta section item |
| `govuk-footer__meta-item--grow` | Fills available space |
| `govuk-footer__inline-list` | Horizontal list of links |
| `govuk-footer__inline-list-item` | Item in horizontal list |
| `govuk-footer__copyright-logo` | Crown copyright link/logo |
| `govuk-footer__licence-description` | Open Government Licence text |
| `govuk-footer__licence-logo` | OGL licence logo |
| `govuk-footer__crown` | Crown SVG element (v6.x brand refresh) |
| `govuk-footer__meta-custom` | Custom meta content area |
| `govuk-footer__section-break` | Horizontal rule between sections |

**JavaScript:** Not required.

**Accessibility:** Footer navigation is contained within a `<footer>` landmark element. The "Support links" heading is visually hidden but available to screen readers.

---

### 6.16 Header

The header shows users that they are on a GOV.UK page and provides the crown logo.

**When to use:**
- On services hosted on `gov.uk`, `service.gov.uk`, or `blog.gov.uk` domains

**When not to use:**
- On pages that are not part of GOV.UK

**HTML:**

```html
<header class="govuk-header">
  <div class="govuk-header__container govuk-width-container">
    <div class="govuk-header__logo">
      <a href="/" class="govuk-header__homepage-link">
        <svg class="govuk-header__logotype" role="img" aria-label="GOV.UK" focusable="false" fill="currentcolor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 324 60" height="30" width="162">
          <title>GOV.UK</title>
          <!-- SVG path data from GOV.UK Frontend -->
        </svg>
      </a>
    </div>
  </div>
</header>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-header` | Header container (black background) |
| `govuk-header__container` | Inner container with width constraint |
| `govuk-header__logo` | Logo area |
| `govuk-header__homepage-link` | Link wrapping the logo |
| `govuk-header__logotype` | SVG logo element (post-brand-refresh uses SVG, not text spans) |

**Post-brand-refresh note:** After the 2024/2025 brand refresh, service names and navigation links should go in the [Service Navigation](#625-service-navigation) component, NOT in the header. The header is now purely for the GOV.UK logo. The logo changed from text spans to an SVG element with `role="img"` and `aria-label="GOV.UK"`.

**JavaScript:** The header does not require JavaScript. No `data-module` attribute is needed.

**Accessibility:** The header is a `<header>` landmark element, recognised by assistive technology as the page banner.

**Note on HTML element:** The GOV.UK Frontend Nunjucks template actually renders `<div class="govuk-header">` inside a `<header class="govuk-template__header">` wrapper (and similarly `<div class="govuk-footer">` inside `<footer class="govuk-template__footer">`). This document simplifies this to `<header class="govuk-header">` and `<footer class="govuk-footer">` for brevity in single-file prototypes — the accessibility outcome is the same.

---

### 6.17 Inset Text

Inset text is a block of text with a vertical left border, used to draw attention to supplementary information.

**When to use:**
- For quotes or cited material
- For examples
- For additional but non-critical information related to the main content

**When not to use:**
- For critical information the user must know -- use [Warning Text](#634-warning-text) instead
- For errors -- use [Error Message](#610-error-message)
- For success messages -- use [Notification Banner](#618-notification-banner)

**HTML:**

```html
<div class="govuk-inset-text">
  It can take up to 8 weeks to register a lasting power of attorney if there are no mistakes in the application.
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-inset-text` | Left-bordered block for supplementary information |

**JavaScript:** Not required.

**Accessibility:** Inset text has no special ARIA semantics. It relies on visual styling (left border) to distinguish it from body text. Do not use it as the only way to communicate important information -- some users may not notice the visual distinction.

**Research:** User research found that some users do not notice inset text on complex, content-heavy pages. Use sparingly and consider whether the information should be in the main body text instead.

---

### 6.18 Notification Banner

A notification banner tells the user about something important, such as a successful action or a change that affects them.

**When to use:**
- To tell users about the outcome of something they have just done (success variant)
- To tell users about something that has changed or is important (standard variant)

**When not to use:**
- For form validation errors -- use [Error Summary](#611-error-summary) instead
- For supplementary information -- use [Inset Text](#617-inset-text)

**HTML -- Standard:**

```html
<div class="govuk-notification-banner" role="region" aria-labelledby="govuk-notification-banner-title" data-module="govuk-notification-banner">
  <div class="govuk-notification-banner__header">
    <h2 class="govuk-notification-banner__title" id="govuk-notification-banner-title">
      Important
    </h2>
  </div>
  <div class="govuk-notification-banner__content">
    <p class="govuk-notification-banner__heading">
      You have 7 days left to send your application.
      <a class="govuk-notification-banner__link" href="#">View application</a>.
    </p>
  </div>
</div>
```

**Success variant:**

```html
<div class="govuk-notification-banner govuk-notification-banner--success" role="alert" aria-labelledby="govuk-notification-banner-title" data-module="govuk-notification-banner">
  <div class="govuk-notification-banner__header">
    <h2 class="govuk-notification-banner__title" id="govuk-notification-banner-title">
      Success
    </h2>
  </div>
  <div class="govuk-notification-banner__content">
    <h3 class="govuk-notification-banner__heading">
      Training provider  and target updated
    </h3>
    <p class="govuk-body">Contact <a class="govuk-notification-banner__link" href="#">example@email.com</a> if you think there is a problem.</p>
  </div>
</div>
```

**Key difference:** Standard uses `role="region"`, success uses `role="alert"`.

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-notification-banner` | Container (blue top border) |
| `govuk-notification-banner--success` | Green success variant |
| `govuk-notification-banner__header` | Header area |
| `govuk-notification-banner__title` | "Important" or "Success" heading |
| `govuk-notification-banner__content` | Body content |
| `govuk-notification-banner__heading` | Main message heading |
| `govuk-notification-banner__link` | Link within the banner |

**Position:** Before the page h1 heading.

**JavaScript:** `data-module="govuk-notification-banner"` auto-focuses the success variant on page load. Without JS, the banner is visible but does not receive focus.

**Accessibility:**
- Standard variant uses `role="region"` with `aria-labelledby` -- a landmark that screen readers can navigate to
- Success variant uses `role="alert"` -- immediately announced by screen readers when it appears
- The banner title heading level defaults to `h2`. Adjust the heading level to fit your page's heading hierarchy (e.g., if the banner appears under an `h1`, use `h2` for the title; content headings within the banner should follow accordingly)

---

### 6.19 Pagination

Pagination helps users navigate through a set of related pages.

**When to use:**
- For navigating between pages of search results or list items
- For navigating between pages in a sequence (e.g., guidance chapters)

**When not to use:**
- To navigate between steps in a transaction -- use the task list pattern instead

**HTML -- Numbered pagination:**

```html
<nav class="govuk-pagination" aria-label="Pagination">
  <div class="govuk-pagination__prev">
    <a class="govuk-link govuk-pagination__link" href="/page/1" rel="prev">
      <svg class="govuk-pagination__icon govuk-pagination__icon--prev" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13">
        <path d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z"></path>
      </svg>
      <span class="govuk-pagination__link-title">
        Previous<span class="govuk-visually-hidden"> page</span>
      </span>
    </a>
  </div>
  <ul class="govuk-pagination__list">
    <li class="govuk-pagination__item">
      <a class="govuk-pagination__link" href="/page/1" aria-label="Page 1">
        1
      </a>
    </li>
    <li class="govuk-pagination__item govuk-pagination__item--current">
      <a class="govuk-pagination__link" href="/page/2" aria-label="Page 2" aria-current="page">
        2
      </a>
    </li>
    <li class="govuk-pagination__item govuk-pagination__item--ellipsis">
      &ctdot;
    </li>
    <li class="govuk-pagination__item">
      <a class="govuk-pagination__link" href="/page/10" aria-label="Page 10">
        10
      </a>
    </li>
  </ul>
  <div class="govuk-pagination__next">
    <a class="govuk-link govuk-pagination__link" href="/page/3" rel="next">
      <span class="govuk-pagination__link-title">
        Next<span class="govuk-visually-hidden"> page</span>
      </span>
      <svg class="govuk-pagination__icon govuk-pagination__icon--next" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13">
        <path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z"></path>
      </svg>
    </a>
  </div>
</nav>
```

**Block (previous/next only) pagination:**

```html
<nav class="govuk-pagination govuk-pagination--block" aria-label="Pagination">
  <div class="govuk-pagination__prev">
    <a class="govuk-link govuk-pagination__link" href="/page/1" rel="prev">
      <svg class="govuk-pagination__icon govuk-pagination__icon--prev" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13">
        <path d="m6.5938-0.0078125-6.7266 6.7266 6.7441 6.4062 1.377-1.449-4.1856-3.9768h12.896v-2h-12.984l4.2931-4.293-1.414-1.414z"></path>
      </svg>
      <span class="govuk-pagination__link-title">
        Previous<span class="govuk-visually-hidden"> page</span>
      </span>
      <span class="govuk-pagination__link-label">Previous page title</span>
    </a>
  </div>
  <div class="govuk-pagination__next">
    <a class="govuk-link govuk-pagination__link" href="/page/3" rel="next">
      <span class="govuk-pagination__link-title">
        Next<span class="govuk-visually-hidden"> page</span>
      </span>
      <span class="govuk-pagination__link-label">Next page title</span>
      <svg class="govuk-pagination__icon govuk-pagination__icon--next" xmlns="http://www.w3.org/2000/svg" height="13" width="15" aria-hidden="true" focusable="false" viewBox="0 0 15 13">
        <path d="m8.107-0.0078125-1.4136 1.414 4.2926 4.293h-12.986v2h12.896l-4.1855 3.9766 1.377 1.4492 6.7441-6.4062-6.7246-6.7266z"></path>
      </svg>
    </a>
  </div>
</nav>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-pagination` | Container nav element |
| `govuk-pagination--block` | Block layout (prev/next only, full width) |
| `govuk-pagination__list` | Page number list |
| `govuk-pagination__item` | Page number item |
| `govuk-pagination__item--current` | Currently active page |
| `govuk-pagination__item--ellipsis` | Ellipsis between page numbers |
| `govuk-pagination__prev` | Previous link wrapper |
| `govuk-pagination__next` | Next link wrapper |
| `govuk-pagination__link` | Pagination link |
| `govuk-pagination__link-title` | "Previous" or "Next" text |
| `govuk-pagination__link-label` | Page description (block variant) |
| `govuk-pagination__icon` | SVG arrow icon |
| `govuk-pagination__icon--prev` | Left-pointing arrow |
| `govuk-pagination__icon--next` | Right-pointing arrow |

**JavaScript:** Not required.

**Accessibility:**
- Include SVG arrows with `aria-hidden="true"` and `focusable="false"`
- Current page uses `aria-current="page"`
- Each page link has `aria-label="Page N"`
- "Previous" and "Next" have visually hidden " page" suffix for screen readers
- Update the page `<title>` to include the page number (e.g., "Search results (page 2 of 10)")

---

### 6.20 Panel

A panel is a large-format box used on confirmation pages to highlight the outcome of a completed transaction.

**When to use:**
- On confirmation pages after a user has successfully completed a transaction
- To display a reference number

**When not to use:**
- In the middle of body content
- For status updates -- use [Notification Banner](#618-notification-banner)
- For non-confirmation information

**HTML:**

```html
<div class="govuk-panel govuk-panel--confirmation">
  <h1 class="govuk-panel__title">
    Application complete
  </h1>
  <div class="govuk-panel__body">
    Your reference number<br><strong>HDJ2123F</strong>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-panel` | Base panel styling |
| `govuk-panel--confirmation` | Green confirmation panel |
| `govuk-panel__title` | Large heading text |
| `govuk-panel__body` | Reference number or body text |

**JavaScript:** Not required.

**Accessibility:** The panel uses standard heading and text elements. No special ARIA attributes needed. Ensure the heading level (h1) is appropriate for the page.

---

### 6.21 Password Input

A password input lets users enter a password, with an option to show what they have typed.

**When to use:**
- When asking users to create or enter a password

**When not to use:**
- For other types of sensitive information (use text input with appropriate attributes)

**HTML:**

```html
<div class="govuk-form-group govuk-password-input" data-module="govuk-password-input">
  <label class="govuk-label" for="password-input">
    Create a password
  </label>
  <div id="password-hint" class="govuk-hint">
    Your password must be at least 8 characters
  </div>
  <div class="govuk-input__wrapper govuk-password-input__wrapper">
    <input class="govuk-input govuk-password-input__input govuk-js-password-input-input" id="password-input" name="password" type="password" spellcheck="false" autocapitalize="none" autocomplete="new-password" aria-describedby="password-hint">
    <button type="button" class="govuk-button govuk-button--secondary govuk-password-input__toggle govuk-js-password-input-toggle" data-module="govuk-button" aria-controls="password-input" aria-label="Show password" hidden>
      Show
    </button>
  </div>
</div>
```

**For existing password entry** (e.g., sign-in), change `autocomplete` to `current-password`:

```html
<input ... autocomplete="current-password" ...>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-password-input` | Container with data-module |
| `govuk-password-input__wrapper` | Wrapper for input and toggle |
| `govuk-password-input__input` | The password input field |
| `govuk-js-password-input-input` | JS hook for the input |
| `govuk-password-input__toggle` | Show/hide toggle button |
| `govuk-js-password-input-toggle` | JS hook for the toggle button |

**JavaScript:** Required. `data-module="govuk-password-input"` enables the show/hide toggle button. The toggle button has `hidden` by default and is revealed by JS. Without JS, the password field works normally but the show/hide button is not visible.

**Accessibility:**
- `spellcheck="false"` prevents spell-checkers from flagging passwords
- `autocapitalize="none"` prevents mobile keyboards from auto-capitalising
- The toggle button uses `aria-controls` to reference the input and `aria-label` to describe its action
- Toggle button text changes between "Show" and "Hide" with corresponding `aria-label` updates

---

### 6.22 Phase Banner

A phase banner indicates that a service is in alpha or beta and invites user feedback.

**When to use:**
- On all services that have not yet passed a live assessment
- Alpha: early testing phase
- Beta: public testing before full launch

**When not to use:**
- On live, fully assessed services

**HTML:**

```html
<div class="govuk-phase-banner govuk-width-container">
  <p class="govuk-phase-banner__content">
    <strong class="govuk-tag govuk-phase-banner__content__tag">
      Alpha
    </strong>
    <span class="govuk-phase-banner__text">
      This is a new service -- your <a class="govuk-link" href="/feedback">feedback</a> will help us improve it.
    </span>
  </p>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-phase-banner` | Container |
| `govuk-phase-banner__content` | Content wrapper |
| `govuk-phase-banner__content__tag` | The alpha/beta tag |
| `govuk-phase-banner__text` | Feedback message text |

**Position:** Place **inside the `<header>` element**, directly after either the Service Navigation component or the GOV.UK header container and its blue colour bar.

**JavaScript:** Not required.

**Accessibility:** The phase tag uses the [Tag](#630-tag) component. Ensure the feedback link is descriptive.

---

### 6.23 Radios

Radios let users select a single option from a list.

**When to use:**
- When users can only select one option from a list
- When the list has 2 or more options

**When not to use:**
- When users can select multiple options -- use [Checkboxes](#66-checkboxes)
- For very long lists -- consider [Select](#624-select) as a last resort

**HTML:**

```html
<div class="govuk-form-group">
  <fieldset class="govuk-fieldset">
    <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
      <h1 class="govuk-fieldset__heading">
        Where do you live?
      </h1>
    </legend>
    <div class="govuk-radios" data-module="govuk-radios">
      <div class="govuk-radios__item">
        <input class="govuk-radios__input" id="where-1" name="where" type="radio" value="england">
        <label class="govuk-label govuk-radios__label" for="where-1">
          England
        </label>
      </div>
      <div class="govuk-radios__item">
        <input class="govuk-radios__input" id="where-2" name="where" type="radio" value="scotland">
        <label class="govuk-label govuk-radios__label" for="where-2">
          Scotland
        </label>
      </div>
      <div class="govuk-radios__item">
        <input class="govuk-radios__input" id="where-3" name="where" type="radio" value="wales">
        <label class="govuk-label govuk-radios__label" for="where-3">
          Wales
        </label>
      </div>
    </div>
  </fieldset>
</div>
```

**Inline variant** (for 2 short options only):

```html
<div class="govuk-radios govuk-radios--inline" data-module="govuk-radios">
```

**Small variant:**

```html
<div class="govuk-radios govuk-radios--small" data-module="govuk-radios">
```

**With divider:**

```html
<div class="govuk-radios" data-module="govuk-radios">
  <div class="govuk-radios__item">
    <input class="govuk-radios__input" id="option-1" name="option" type="radio" value="yes">
    <label class="govuk-label govuk-radios__label" for="option-1">Yes</label>
  </div>
  <div class="govuk-radios__item">
    <input class="govuk-radios__input" id="option-2" name="option" type="radio" value="no">
    <label class="govuk-label govuk-radios__label" for="option-2">No</label>
  </div>
  <div class="govuk-radios__divider">or</div>
  <div class="govuk-radios__item">
    <input class="govuk-radios__input" id="option-3" name="option" type="radio" value="not-sure">
    <label class="govuk-label govuk-radios__label" for="option-3">Not sure</label>
  </div>
</div>
```

**Conditional reveal:**

```html
<div class="govuk-radios" data-module="govuk-radios">
  <div class="govuk-radios__item">
    <input class="govuk-radios__input" id="contact-email" name="contact" type="radio" value="email" data-aria-controls="conditional-contact-email">
    <label class="govuk-label govuk-radios__label" for="contact-email">
      Email
    </label>
  </div>
  <div class="govuk-radios__conditional govuk-radios__conditional--hidden" id="conditional-contact-email">
    <div class="govuk-form-group">
      <label class="govuk-label" for="email">
        Email address
      </label>
      <input class="govuk-input govuk-!-width-one-third" id="email" name="email" type="email" spellcheck="false" autocomplete="email">
    </div>
  </div>
  <div class="govuk-radios__item">
    <input class="govuk-radios__input" id="contact-phone" name="contact" type="radio" value="phone" data-aria-controls="conditional-contact-phone">
    <label class="govuk-label govuk-radios__label" for="contact-phone">
      Phone
    </label>
  </div>
  <div class="govuk-radios__conditional govuk-radios__conditional--hidden" id="conditional-contact-phone">
    <div class="govuk-form-group">
      <label class="govuk-label" for="phone">
        Phone number
      </label>
      <input class="govuk-input govuk-input--width-20" id="phone" name="phone" type="tel" autocomplete="tel">
    </div>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-radios` | Container |
| `govuk-radios--inline` | Inline layout (2 short options) |
| `govuk-radios--small` | Smaller radio buttons |
| `govuk-radios__item` | Individual radio wrapper |
| `govuk-radios__input` | The radio input |
| `govuk-radios__label` | Label for radio |
| `govuk-radios__hint` | Hint text for individual option |
| `govuk-radios__divider` | Divider text (e.g., "or") |
| `govuk-radios__conditional` | Conditionally revealed content |
| `govuk-radios__conditional--hidden` | Hides conditional content by default |

**JavaScript:** `data-module="govuk-radios"` enables conditional reveal. Without JS, conditional content is always visible.

**Accessibility:** Radios are positioned to the left of their labels. The fieldset and legend group the options. `data-aria-controls` links radio inputs to their conditional content panels.

---

### 6.24 Select

A select component lets users choose an option from a long list using a dropdown.

**When to use:**
- **Only as a last resort in public-facing services** — research shows that some users find selects very difficult to use
- Only when the list is genuinely too long for radios AND the options are well-known to the user (e.g., countries, months)

**When not to use:**
- When there are fewer than about 7 options -- use [Radios](#623-radios) instead
- For multiple selections (`<select multiple>` has poor accessibility -- do not use)

**HTML:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="sort">
    Sort by
  </label>
  <select class="govuk-select" id="sort" name="sort">
    <option value="published">Recently published</option>
    <option value="updated" selected>Recently updated</option>
    <option value="views">Most views</option>
    <option value="comments">Most comments</option>
  </select>
</div>
```

**Error state:**

```html
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="sort-error">
    Sort by
  </label>
  <p id="sort-error-msg" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Select a sort option
  </p>
  <select class="govuk-select govuk-select--error" id="sort-error" name="sort" aria-describedby="sort-error-msg">
    <option value="">Select an option</option>
    <option value="published">Recently published</option>
  </select>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-select` | Select element styling |
| `govuk-select--error` | Error state (red border) |

**JavaScript:** Not required.

**Accessibility:** Do not use `<select multiple>` -- it has poor accessibility support. The native `<select>` element is accessible by default but presents usability challenges.

**Research:** User research shows users struggle with select elements: closing the dropdown, typing to search, and distinguishing between focused and selected items. Consider alternatives such as radios or an accessible autocomplete component.

---

### 6.25 Service Navigation

Service navigation helps users understand which part of a service they are in and navigate between top-level sections.

**When to use:**
- On services with multiple top-level sections
- To display the service name in the header area

**When not to use:**
- For in-page navigation -- use tabs or contents list
- For step-by-step processes -- use task list

**HTML:**

```html
<section class="govuk-service-navigation" data-module="govuk-service-navigation" aria-label="Service information">
  <div class="govuk-width-container">
    <div class="govuk-service-navigation__container">
      <span class="govuk-service-navigation__service-name">
        <a href="/" class="govuk-service-navigation__link">
          Service name
        </a>
      </span>
      <nav aria-label="Menu" class="govuk-service-navigation__wrapper">
        <button type="button" class="govuk-service-navigation__toggle govuk-js-service-navigation-toggle" aria-controls="navigation" hidden aria-hidden="true">
          Menu
        </button>
        <ul class="govuk-service-navigation__list" id="navigation">
          <li class="govuk-service-navigation__item govuk-service-navigation__item--active">
            <a class="govuk-service-navigation__link" href="#" aria-current="true">
              <strong class="govuk-service-navigation__active-fallback">Dashboard</strong>
            </a>
          </li>
          <li class="govuk-service-navigation__item">
            <a class="govuk-service-navigation__link" href="#">
              Cases
            </a>
          </li>
          <li class="govuk-service-navigation__item">
            <a class="govuk-service-navigation__link" href="#">
              Settings
            </a>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</section>
```

**Service name only (no navigation links):**

```html
<section class="govuk-service-navigation" data-module="govuk-service-navigation" aria-label="Service information">
  <div class="govuk-width-container">
    <div class="govuk-service-navigation__container">
      <span class="govuk-service-navigation__service-name">
        <a href="/" class="govuk-service-navigation__link">
          Service name
        </a>
      </span>
    </div>
  </div>
</section>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-service-navigation` | Container section |
| `govuk-service-navigation__container` | Inner flex container |
| `govuk-service-navigation__service-name` | Service name text |
| `govuk-service-navigation__link` | Link styling |
| `govuk-service-navigation__wrapper` | Nav wrapper |
| `govuk-service-navigation__toggle` | Mobile menu toggle button |
| `govuk-js-service-navigation-toggle` | JS hook for toggle |
| `govuk-service-navigation__list` | Navigation list |
| `govuk-service-navigation__item` | Navigation item |
| `govuk-service-navigation__item--active` | Active/current item |

**JavaScript:** `data-module="govuk-service-navigation"` manages the mobile menu toggle and `aria-controls` relationship. Without JS, the navigation list is always visible (no hamburger menu).

**Accessibility:**
- The active item uses `aria-current="true"` (note: `"true"`, not `"page"` — this differs from breadcrumbs/pagination which use `"page"`)
- The `<strong class="govuk-service-navigation__active-fallback">` element inside the active link provides a visual bold fallback when CSS/JS is not available
- The mobile toggle button has `hidden` by default and is shown by JS
- `aria-label` on the `<section>` and `<nav>` elements identifies them as landmarks

---

### 6.26 Skip Link

A skip link lets keyboard users bypass repeated navigation and jump directly to the main content.

**When to use:**
- On every page -- it is required for accessibility

**When not to use:**
- There is no case where you should omit it

**HTML:**

```html
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">
  Skip to main content
</a>
```

The `href` must match the `id` on the `<main>` element. **Note:** The GOV.UK Frontend default is `href="#content"` with `id="content"` on main. This document uses `#main-content` throughout for clarity — either convention works as long as the `href` and `id` match.

```html
<main class="govuk-main-wrapper" id="main-content" role="main">
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-skip-link` | Visually hidden until focused, then positioned at top of page |

**Position:** Immediately after `<body>` (or after cookie banner if present). NOT inside `<nav>` or `<header>`.

**JavaScript:** `data-module="govuk-skip-link"` adds enhanced behaviour. Without JS, it works as a normal anchor link.

**Accessibility:** The skip link is the first focusable element on the page. It is visually hidden using CSS until it receives keyboard focus (Tab key), at which point it appears at the top of the viewport.

---

### 6.27 Summary List

A summary list displays information in key-value pairs, commonly used on check-your-answers pages.

**When to use:**
- On check-your-answers pages before form submission
- To display a summary of submitted information
- To present metadata about a record

**When not to use:**
- For tabular data with multiple columns -- use [Table](#628-table)

**HTML:**

```html
<dl class="govuk-summary-list">
  <div class="govuk-summary-list__row">
    <dt class="govuk-summary-list__key">
      Name
    </dt>
    <dd class="govuk-summary-list__value">
      Sarah Phillips
    </dd>
    <dd class="govuk-summary-list__actions">
      <a class="govuk-link" href="#">
        Change<span class="govuk-visually-hidden"> name</span>
      </a>
    </dd>
  </div>
  <div class="govuk-summary-list__row">
    <dt class="govuk-summary-list__key">
      Date of birth
    </dt>
    <dd class="govuk-summary-list__value">
      5 January 1978
    </dd>
    <dd class="govuk-summary-list__actions">
      <a class="govuk-link" href="#">
        Change<span class="govuk-visually-hidden"> date of birth</span>
      </a>
    </dd>
  </div>
</dl>
```

**Without borders:**

```html
<dl class="govuk-summary-list govuk-summary-list--no-border">
```

**Card variant** (for grouping related summary lists):

```html
<div class="govuk-summary-card">
  <div class="govuk-summary-card__title-wrapper">
    <h2 class="govuk-summary-card__title">Lead tenant</h2>
    <ul class="govuk-summary-card__actions">
      <li class="govuk-summary-card__action">
        <a class="govuk-link" href="#">
          Delete<span class="govuk-visually-hidden"> Lead tenant</span>
        </a>
      </li>
      <li class="govuk-summary-card__action">
        <a class="govuk-link" href="#">
          Change<span class="govuk-visually-hidden"> Lead tenant</span>
        </a>
      </li>
    </ul>
  </div>
  <div class="govuk-summary-card__content">
    <dl class="govuk-summary-list">
      <div class="govuk-summary-list__row">
        <dt class="govuk-summary-list__key">Age</dt>
        <dd class="govuk-summary-list__value">38</dd>
      </div>
    </dl>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-summary-list` | Definition list container |
| `govuk-summary-list--no-border` | Removes row borders |
| `govuk-summary-list__row` | Key-value row |
| `govuk-summary-list__key` | Key (label) |
| `govuk-summary-list__value` | Value |
| `govuk-summary-list__actions` | Change/delete links column |
| `govuk-summary-card` | Card wrapper |
| `govuk-summary-card__title-wrapper` | Card header |
| `govuk-summary-card__title` | Card heading |
| `govuk-summary-card__actions` | Card-level actions list (`<ul>` element, no intermediate wrapper) |
| `govuk-summary-card__action` | Individual card action (`<li>` element) |
| `govuk-summary-card__content` | Card body |

**JavaScript:** Not required.

**Accessibility:** The visually hidden text in "Change" links (e.g., `Change<span class="govuk-visually-hidden"> name</span>`) provides a unique accessible name for each link, so screen reader users can distinguish between them when navigating by link.

---

### 6.28 Table

A table organises data into rows and columns, making it easier to compare and scan.

**When to use:**
- To display data that users need to compare or look up
- When the data has a consistent structure (same columns across rows)

**When not to use:**
- For layout purposes -- use the grid system
- For key-value pairs -- use [Summary List](#627-summary-list)

**HTML:**

```html
<table class="govuk-table">
  <caption class="govuk-table__caption govuk-table__caption--m">Dates and amounts</caption>
  <thead class="govuk-table__head">
    <tr class="govuk-table__row">
      <th scope="col" class="govuk-table__header">Date</th>
      <th scope="col" class="govuk-table__header">Amount</th>
    </tr>
  </thead>
  <tbody class="govuk-table__body">
    <tr class="govuk-table__row">
      <th scope="row" class="govuk-table__header">First 6 weeks</th>
      <td class="govuk-table__cell">£109.80 per week</td>
    </tr>
    <tr class="govuk-table__row">
      <th scope="row" class="govuk-table__header">Next 33 weeks</th>
      <td class="govuk-table__cell">£109.80 per week</td>
    </tr>
  </tbody>
</table>
```

**Numeric columns** (right-aligned):

```html
<th scope="col" class="govuk-table__header govuk-table__header--numeric">Amount</th>
<td class="govuk-table__cell govuk-table__cell--numeric">&pound;109.80</td>
```

**Small text on mobile:**

```html
<table class="govuk-table govuk-table--small-text-until-tablet">
```

**Column widths:**

```html
<th scope="col" class="govuk-table__header govuk-!-width-one-half">Description</th>
<th scope="col" class="govuk-table__header govuk-!-width-one-quarter">Amount</th>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-table` | Table container |
| `govuk-table__caption` | Table caption |
| `govuk-table__caption--s` | Small caption |
| `govuk-table__caption--m` | Medium caption |
| `govuk-table__caption--l` | Large caption |
| `govuk-table__caption--xl` | Extra large caption |
| `govuk-table__head` | Table head |
| `govuk-table__body` | Table body |
| `govuk-table__row` | Table row |
| `govuk-table__header` | Header cell (th) |
| `govuk-table__header--numeric` | Right-aligned header |
| `govuk-table__cell` | Data cell (td) |
| `govuk-table__cell--numeric` | Right-aligned data cell |
| `govuk-table--small-text-until-tablet` | Smaller text on mobile (requires GOV.UK Frontend v5.2+) |

**JavaScript:** Not required.

**Accessibility:**
- Always include `scope="col"` on column headers and `scope="row"` on row headers
- Always include a `<caption>` element -- it acts as a heading for the table
- Never use tables for layout
- Use width classes (e.g., `govuk-!-width-one-half`) on header cells to control column widths

---

### 6.29 Tabs

Tabs let users switch between related sections of content, displaying one section at a time.

**When to use:**
- When content can be clearly separated into labelled sections
- When the first section is the most commonly needed
- When users do not need to view multiple sections simultaneously

**When not to use:**
- If users need to compare content across tabs
- If the tab labels are long or there are many tabs
- If the content in each tab is short -- just show it all on the page

**HTML:**

```html
<div class="govuk-tabs" data-module="govuk-tabs">
  <h2 class="govuk-tabs__title">
    Contents
  </h2>
  <ul class="govuk-tabs__list">
    <li class="govuk-tabs__list-item govuk-tabs__list-item--selected">
      <a class="govuk-tabs__tab" href="#past-day">
        Past day
      </a>
    </li>
    <li class="govuk-tabs__list-item">
      <a class="govuk-tabs__tab" href="#past-week">
        Past week
      </a>
    </li>
    <li class="govuk-tabs__list-item">
      <a class="govuk-tabs__tab" href="#past-month">
        Past month
      </a>
    </li>
  </ul>
  <div class="govuk-tabs__panel" id="past-day">
    <h2 class="govuk-heading-l">Past day</h2>
    <p class="govuk-body">Content for past day.</p>
  </div>
  <div class="govuk-tabs__panel govuk-tabs__panel--hidden" id="past-week">
    <h2 class="govuk-heading-l">Past week</h2>
    <p class="govuk-body">Content for past week.</p>
  </div>
  <div class="govuk-tabs__panel govuk-tabs__panel--hidden" id="past-month">
    <h2 class="govuk-heading-l">Past month</h2>
    <p class="govuk-body">Content for past month.</p>
  </div>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-tabs` | Container |
| `govuk-tabs__title` | "Contents" heading (shown without JS) |
| `govuk-tabs__list` | Tab navigation list |
| `govuk-tabs__list-item` | Tab item |
| `govuk-tabs__list-item--selected` | Active tab |
| `govuk-tabs__tab` | Tab link |
| `govuk-tabs__panel` | Content panel |
| `govuk-tabs__panel--hidden` | Hidden panel |

**JavaScript:** Required. `data-module="govuk-tabs"` enables tab switching via keyboard and click. Without JS, all panels are displayed sequentially with the tab list acting as a table of contents with anchor links -- a perfectly usable fallback.

**Accessibility:**
- Tab list uses standard `<ul>/<li>/<a>` markup
- JS adds ARIA roles (`tablist`, `tab`, `tabpanel`) dynamically
- Keyboard: arrow keys move between tabs, Tab key moves to the panel content
- Each tab link `href` matches the panel `id`

---

### 6.30 Tag

A tag is a small coloured label used to indicate a status.

**When to use:**
- To indicate the status of something (e.g., "Completed", "In progress", "Overdue")
- In task lists, tables, or summary pages

**When not to use:**
- As a link or button -- tags must not be interactive
- For decorative purposes without meaningful status information

**HTML:**

```html
<strong class="govuk-tag">
  Completed
</strong>
```

**Colour variants:**

```html
<strong class="govuk-tag govuk-tag--grey">Not started</strong>
<strong class="govuk-tag govuk-tag--green">Complete</strong>
<strong class="govuk-tag govuk-tag--teal">Active</strong>
<strong class="govuk-tag govuk-tag--blue">In progress</strong>
<strong class="govuk-tag govuk-tag--purple">Received</strong>
<strong class="govuk-tag govuk-tag--magenta">Escalated</strong>
<strong class="govuk-tag govuk-tag--red">Urgent</strong>
<strong class="govuk-tag govuk-tag--orange">Declined</strong>
<strong class="govuk-tag govuk-tag--yellow">Delayed</strong>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-tag` | Base tag styling (default blue) |
| `govuk-tag--grey` | Grey tag |
| `govuk-tag--green` | Green tag |
| `govuk-tag--teal` | Teal tag |
| `govuk-tag--blue` | Blue tag |
| `govuk-tag--purple` | Purple tag |
| `govuk-tag--magenta` | Magenta tag |
| `govuk-tag--red` | Red tag |
| `govuk-tag--orange` | Orange tag |
| `govuk-tag--yellow` | Yellow tag |

All 9 colour variants are listed above.

**JavaScript:** Not required.

**Accessibility:**
- Never make tags interactive (no links, no buttons)
- Do not rely on colour alone to convey meaning -- the text must make the status clear
- Use adjectives for status text (e.g., "Completed" not "Complete this task")

---

### 6.31 Task List

A task list displays a list of tasks a user needs to complete, with status indicators.

**When to use:**
- When users need to complete multiple tasks that can be done in any order
- At the start of a multi-step process to show progress

**When not to use:**
- For sequential steps that must be done in order -- use step-by-step navigation
- For navigation -- use service navigation

**HTML:**

```html
<ul class="govuk-task-list">
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a class="govuk-link govuk-task-list__link" href="/company-details" aria-describedby="company-details-status">
        Company details
      </a>
    </div>
    <div class="govuk-task-list__status" id="company-details-status">
      Completed
    </div>
  </li>
  <li class="govuk-task-list__item govuk-task-list__item--with-link">
    <div class="govuk-task-list__name-and-hint">
      <a class="govuk-link govuk-task-list__link" href="/contact-details" aria-describedby="contact-details-status">
        Contact details
      </a>
      <div class="govuk-task-list__hint" id="contact-details-hint">
        Including phone and email
      </div>
    </div>
    <div class="govuk-task-list__status" id="contact-details-status">
      <strong class="govuk-tag govuk-tag--teal">
        In progress
      </strong>
    </div>
  </li>
  <li class="govuk-task-list__item">
    <div class="govuk-task-list__name-and-hint">
      Submit application
    </div>
    <div class="govuk-task-list__status" id="submit-status">
      Cannot start yet
    </div>
  </li>
</ul>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-task-list` | Container list |
| `govuk-task-list__item` | Individual task |
| `govuk-task-list__item--with-link` | Task that has a link |
| `govuk-task-list__name-and-hint` | Name and hint wrapper |
| `govuk-task-list__link` | Task link |
| `govuk-task-list__hint` | Hint text below task name |
| `govuk-task-list__status` | Status indicator |

**Status conventions (Task List component):**
- **Completed**: plain black text "Completed" (no tag)
- **Incomplete**: `govuk-tag govuk-tag--blue` with "Incomplete"

**Extended statuses (from the "Complete multiple tasks" pattern, Section 7.2.3):**
- **Not yet started**: `govuk-tag govuk-tag--blue` with "Not yet started"
- **In progress**: `govuk-tag govuk-tag--teal` with "In progress" (note: teal, not blue)
- **There is a problem**: `govuk-tag govuk-tag--red` with "There is a problem"
- **Cannot start yet**: plain grey text, no tag (no link on the task)

**JavaScript:** Not required.

**Accessibility:** `aria-describedby` on each task link references the status element, so screen readers announce the task name and its status together.

---

### 6.32 Text Input

A text input lets users enter a single line of text.

**When to use:**
- For short, single-line text answers (names, email addresses, reference numbers)

**When not to use:**
- For multi-line text -- use [Textarea](#633-textarea)
- For choosing from a fixed set of options -- use [Radios](#623-radios), [Checkboxes](#66-checkboxes), or [Select](#624-select)

**HTML:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="event-name">
    Event name
  </label>
  <input class="govuk-input" id="event-name" name="eventName" type="text">
</div>
```

**With hint:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="ni-number">
    National Insurance number
  </label>
  <div id="ni-number-hint" class="govuk-hint">
    It's on your National Insurance card, benefit letter, payslip or P60. For example, QQ 12 34 56 C.
  </div>
  <input class="govuk-input" id="ni-number" name="niNumber" type="text" aria-describedby="ni-number-hint">
</div>
```

**Fixed width variants:**

```html
<input class="govuk-input govuk-input--width-20" ...>  <!-- 20 chars -->
<input class="govuk-input govuk-input--width-10" ...>  <!-- 10 chars -->
<input class="govuk-input govuk-input--width-5" ...>   <!-- 5 chars -->
<input class="govuk-input govuk-input--width-4" ...>   <!-- 4 chars -->
<input class="govuk-input govuk-input--width-3" ...>   <!-- 3 chars -->
<input class="govuk-input govuk-input--width-2" ...>   <!-- 2 chars -->
```

**Fluid width variants:**

```html
<input class="govuk-input govuk-!-width-full" ...>
<input class="govuk-input govuk-!-width-three-quarters" ...>
<input class="govuk-input govuk-!-width-two-thirds" ...>
<input class="govuk-input govuk-!-width-one-half" ...>
<input class="govuk-input govuk-!-width-one-third" ...>
<input class="govuk-input govuk-!-width-one-quarter" ...>
```

**Extra letter spacing** (for reference codes):

```html
<input class="govuk-input govuk-input--extra-letter-spacing" ...>
```

**Prefix and suffix:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="cost">
    Cost, in pounds
  </label>
  <div class="govuk-input__wrapper">
    <div class="govuk-input__prefix" aria-hidden="true">&pound;</div>
    <input class="govuk-input" id="cost" name="cost" type="text" spellcheck="false">
    <div class="govuk-input__suffix" aria-hidden="true">per item</div>
  </div>
</div>
```

**Error state:**

```html
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="event-name-error">
    Event name
  </label>
  <p id="event-name-error-msg" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Enter an event name
  </p>
  <input class="govuk-input govuk-input--error" id="event-name-error" name="eventName" type="text" aria-describedby="event-name-error-msg">
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-input` | Base input styling |
| `govuk-input--width-{2,3,4,5,10,20}` | Fixed character-width inputs |
| `govuk-input--extra-letter-spacing` | Extra spacing for reference codes |
| `govuk-input--error` | Red error border |
| `govuk-input__wrapper` | Wrapper for prefix/suffix |
| `govuk-input__prefix` | Prefix element (e.g., currency symbol) |
| `govuk-input__suffix` | Suffix element (e.g., unit) |

**JavaScript:** Not required.

**Accessibility:**
- `aria-describedby` links hints and error messages to the input
- `aria-hidden="true"` on prefix/suffix elements prevents them being read as separate items
- For numeric input, use `inputmode="numeric"` not `type="number"` (number inputs have problematic spinner buttons)

---

### 6.33 Textarea

A textarea lets users enter multi-line text.

**When to use:**
- When users need to enter text longer than a single line
- For descriptions, explanations, or comments

**When not to use:**
- For single-line input -- use [Text Input](#632-text-input)

**HTML:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="more-detail">
    Can you provide more detail?
  </label>
  <div id="more-detail-hint" class="govuk-hint">
    Do not include personal or financial information, like your National Insurance number or credit card details.
  </div>
  <textarea class="govuk-textarea" id="more-detail" name="moreDetail" rows="5" aria-describedby="more-detail-hint"></textarea>
</div>
```

**Error state:**

```html
<div class="govuk-form-group govuk-form-group--error">
  <label class="govuk-label" for="more-detail-error">
    Can you provide more detail?
  </label>
  <p id="more-detail-error-msg" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Enter more detail
  </p>
  <textarea class="govuk-textarea govuk-textarea--error" id="more-detail-error" name="moreDetail" rows="5" aria-describedby="more-detail-error-msg"></textarea>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-textarea` | Base textarea styling |
| `govuk-textarea--error` | Red error border |

**JavaScript:** Not required.

**Accessibility:** Use `aria-describedby` to link both hint text and error messages to the textarea. If using with [Character Count](#65-character-count), the character count component wraps the textarea.

---

### 6.34 Warning Text

Warning text tells users about something important that they need to be aware of.

**When to use:**
- For critical information that users must know to avoid problems
- For legal consequences or penalties

**When not to use:**
- For supplementary information -- use [Inset Text](#617-inset-text)
- For success messages -- use [Notification Banner](#618-notification-banner)

**HTML:**

```html
<div class="govuk-warning-text">
  <span class="govuk-warning-text__icon" aria-hidden="true">!</span>
  <strong class="govuk-warning-text__text">
    <span class="govuk-visually-hidden">Warning</span>
    You can be fined up to &pound;5,000 if you do not register.
  </strong>
</div>
```

**CSS classes:**

| Class | Purpose |
|---|---|
| `govuk-warning-text` | Container |
| `govuk-warning-text__icon` | Exclamation mark icon (triangle) |
| `govuk-warning-text__text` | Warning message text |

**JavaScript:** Not required.

**Accessibility:**
- The `!` icon has `aria-hidden="true"` so it is not read by screen readers
- The `<span class="govuk-visually-hidden">Warning</span>` provides the semantic announcement
- Customise the visually hidden text for context (e.g., "Warning", "Important", "Deadline")

---

## 7. Patterns

Patterns are best-practice design solutions for common tasks and page types. They combine components, content guidance, and interaction design to solve user needs.

Patterns are organised into three groups:
1. **Ask users for...** -- collecting specific types of information
2. **Help users to...** -- guiding users through tasks and interactions
3. **Pages** -- standard page types used across services

---

### 7.1 Ask Users For...

#### 7.1.1 Addresses

**Purpose:** Collect a postal address from the user.

**Guidance:**
- Use multiple text inputs for UK addresses (Address line 1, Address line 2, Town or city, County, Postcode)
- Use a single textarea for international addresses
- A postcode lookup is acceptable as a progressive enhancement but must have a manual entry fallback
- Do not assume address formats -- UK addresses vary widely

**Components used:** [Text Input](#632-text-input), [Fieldset](#613-fieldset)

**HTML approach:**

```html
<fieldset class="govuk-fieldset">
  <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
    <h1 class="govuk-fieldset__heading">What is your address?</h1>
  </legend>
  <div class="govuk-form-group">
    <label class="govuk-label" for="address-line-1">Address line 1</label>
    <input class="govuk-input" id="address-line-1" name="addressLine1" type="text" autocomplete="address-line1">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="address-line-2">Address line 2 (optional)</label>
    <input class="govuk-input" id="address-line-2" name="addressLine2" type="text" autocomplete="address-line2">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="address-town">Town or city</label>
    <input class="govuk-input govuk-!-width-two-thirds" id="address-town" name="addressTown" type="text" autocomplete="address-level2">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="address-county">County (optional)</label>
    <input class="govuk-input govuk-!-width-two-thirds" id="address-county" name="addressCounty" type="text">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="address-postcode">Postcode</label>
    <input class="govuk-input govuk-input--width-10" id="address-postcode" name="addressPostcode" type="text" autocomplete="postal-code">
  </div>
</fieldset>
```

#### 7.1.2 Bank Details

**Purpose:** Collect bank account information for payments.

**Guidance:**
- Sort code: single text input with `govuk-input--width-5`, `inputmode="numeric"`, and `govuk-input--extra-letter-spacing`
- Account number: single input with `govuk-input--width-10`, `inputmode="numeric"`, and `govuk-input--extra-letter-spacing`
- Do not use `type="number"` (spinner buttons are inappropriate for bank details)
- Use `spellcheck="false"` on all fields
- Consider asking for account holder name as a separate field

**Components used:** [Text Input](#632-text-input), [Fieldset](#613-fieldset)

**HTML approach:**

```html
<fieldset class="govuk-fieldset">
  <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
    <h1 class="govuk-fieldset__heading">What are your bank details?</h1>
  </legend>
  <div class="govuk-form-group">
    <label class="govuk-label" for="account-name">Name on the account</label>
    <input class="govuk-input" id="account-name" name="accountName" type="text" spellcheck="false" autocomplete="name">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="sort-code">Sort code</label>
    <div id="sort-code-hint" class="govuk-hint">Must be 6 digits long</div>
    <input class="govuk-input govuk-input--width-5 govuk-input--extra-letter-spacing" id="sort-code" name="sortCode" type="text" inputmode="numeric" spellcheck="false" aria-describedby="sort-code-hint">
  </div>
  <div class="govuk-form-group">
    <label class="govuk-label" for="account-number">Account number</label>
    <div id="account-hint" class="govuk-hint">Must be between 6 and 8 digits long</div>
    <input class="govuk-input govuk-input--width-10 govuk-input--extra-letter-spacing" id="account-number" name="accountNumber" type="text" inputmode="numeric" spellcheck="false" aria-describedby="account-hint">
  </div>
</fieldset>
```

#### 7.1.3 Dates

**Purpose:** Collect a specific date from the user.

**Guidance:**
- Use the [Date Input](#68-date-input) component with 3 separate fields (day, month, year)
- Use `type="text"` with `inputmode="numeric"` -- never `type="number"`
- Provide a hint showing the expected format (e.g., "27 3 2007")
- For errors, highlight only the specific field(s) with problems
- For approximate dates (e.g., "around June 2024"), consider a different approach such as separate month/year fields

**Components used:** [Date Input](#68-date-input), [Fieldset](#613-fieldset)

See the [Date Input](#68-date-input) component section for full HTML.

#### 7.1.4 Email Addresses

**Purpose:** Collect an email address.

**Guidance:**
- Use a single text input with `type="email"`
- Add `autocomplete="email"` and `spellcheck="false"`
- Label: "Email address"
- Allow the full range of valid email formats
- Consider asking users to confirm by entering it twice, or sending a confirmation email

**Components used:** [Text Input](#632-text-input)

**HTML approach:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="email">
    Email address
  </label>
  <input class="govuk-input" id="email" name="email" type="email" spellcheck="false" autocomplete="email">
</div>
```

#### 7.1.5 Equality Information

**Purpose:** Collect equality and diversity information (ethnicity, gender, disability, etc.).

**Guidance:**
- Only collect equality information when there is a genuine need
- Follow Government Statistical Service (GSS) harmonised standards for question wording and response options
- Always include a "Prefer not to say" option
- Explain why the information is being collected and how it will be used
- Store equality data separately from identifiable personal information where possible

**Components used:** [Radios](#623-radios), [Checkboxes](#66-checkboxes), [Text Input](#632-text-input)

#### 7.1.6 Names

**Purpose:** Collect a person's name.

**Guidance:**
- Use a single "Full name" field unless the service specifically requires structured name components
- Add `autocomplete="name"` for auto-fill
- If you must split into parts: "First name" and "Last name" (not "Forename"/"Surname")
- Do not restrict characters -- names may contain apostrophes, hyphens, accents, spaces
- Do not impose minimum length

**Components used:** [Text Input](#632-text-input)

**HTML approach:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="full-name">
    Full name
  </label>
  <input class="govuk-input" id="full-name" name="fullName" type="text" spellcheck="false" autocomplete="name">
</div>
```

#### 7.1.7 National Insurance Numbers

**Purpose:** Collect a UK National Insurance number.

**Guidance:**
- Use a single text input with `govuk-input--width-10` and `govuk-input--extra-letter-spacing`
- Format: 2 letters, 6 numbers, 1 letter (e.g., QQ 12 34 56 C)
- Allow users to enter with or without spaces
- Hint text should show the format example

**Components used:** [Text Input](#632-text-input)

**HTML approach:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="ni-number">
    National Insurance number
  </label>
  <div id="ni-hint" class="govuk-hint">
    It's on your National Insurance card, benefit letter, payslip or P60. For example, QQ 12 34 56 C.
  </div>
  <input class="govuk-input govuk-input--width-10 govuk-input--extra-letter-spacing" id="ni-number" name="niNumber" type="text" spellcheck="false" aria-describedby="ni-hint">
</div>
```

#### 7.1.8 Passwords

**Purpose:** Collect a password from the user.

**Guidance:**
- Use the [Password Input](#621-password-input) component
- Minimum 8 characters for user-set passwords
- Include a show/hide password toggle
- For new passwords: `autocomplete="new-password"`
- For existing passwords: `autocomplete="current-password"`
- Allow passwords up to 128 characters

**Components used:** [Password Input](#621-password-input)

See the [Password Input](#621-password-input) component section for full HTML.

#### 7.1.9 Payment Card Details

**Purpose:** Collect payment card information (card number, expiry, security code).

**Guidance:**
- Card number: `govuk-input--width-20` (recommended), `inputmode="numeric"`, `autocomplete="cc-number"`
- Expiry month: `govuk-input--width-4` (recommended), `inputmode="numeric"`, `autocomplete="cc-exp-month"`
- Expiry year: `govuk-input--width-4` (recommended), `inputmode="numeric"`, `autocomplete="cc-exp-year"`
- Security code: `govuk-input--width-4` (recommended), `inputmode="numeric"`, `autocomplete="cc-csc"`
- Do not use `type="number"` for any of these fields
- Note: The Design System pattern page does not prescribe specific width classes; the widths above are recommended defaults based on typical field content

**Components used:** [Text Input](#632-text-input), [Fieldset](#613-fieldset)

**HTML approach:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="card-number">Card number</label>
  <input class="govuk-input govuk-input--width-20" id="card-number" name="cardNumber" type="text" inputmode="numeric" autocomplete="cc-number" spellcheck="false">
</div>
<fieldset class="govuk-fieldset" role="group">
  <legend class="govuk-fieldset__legend">Expiry date</legend>
  <div id="expiry-hint" class="govuk-hint">For example, 3 2025</div>
  <div class="govuk-date-input">
    <div class="govuk-date-input__item">
      <div class="govuk-form-group">
        <label class="govuk-label govuk-date-input__label" for="expiry-month">Month</label>
        <input class="govuk-input govuk-date-input__input govuk-input--width-2" id="expiry-month" name="expiryMonth" type="text" inputmode="numeric" autocomplete="cc-exp-month">
      </div>
    </div>
    <div class="govuk-date-input__item">
      <div class="govuk-form-group">
        <label class="govuk-label govuk-date-input__label" for="expiry-year">Year</label>
        <input class="govuk-input govuk-date-input__input govuk-input--width-4" id="expiry-year" name="expiryYear" type="text" inputmode="numeric" autocomplete="cc-exp-year">
      </div>
    </div>
  </div>
</fieldset>
<div class="govuk-form-group">
  <label class="govuk-label" for="security-code">Security code</label>
  <div id="security-hint" class="govuk-hint">The last 3 digits on the back of the card</div>
  <input class="govuk-input govuk-input--width-4" id="security-code" name="securityCode" type="text" inputmode="numeric" autocomplete="cc-csc" spellcheck="false" aria-describedby="security-hint">
</div>
```

#### 7.1.10 Phone Numbers

**Purpose:** Collect a phone number.

**Guidance:**
- Use a single text input with `type="tel"` and `autocomplete="tel"`
- Allow spaces, hyphens, brackets, and plus signs -- users format phone numbers in many ways
- Do not split into separate fields (country code, area code, number)
- Validate loosely on the server side

**Components used:** [Text Input](#632-text-input)

**HTML approach:**

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="phone">
    UK phone number
  </label>
  <div id="phone-hint" class="govuk-hint">
    For international numbers include the country code
  </div>
  <input class="govuk-input govuk-input--width-20" id="phone" name="phone" type="tel" autocomplete="tel" aria-describedby="phone-hint">
</div>
```

---

### 7.2 Help Users To...

#### 7.2.1 Check a Service Is Suitable

**Purpose:** Help users find out whether a service is right for them before they invest time in it.

**Guidance:**
- Ask filtering questions early to save users time
- Use the question pages pattern (one question per page)
- If the user is not eligible, tell them clearly and explain alternatives
- Keep eligibility questions simple and use plain language
- Consider showing a summary of requirements on the start page

**Components used:** [Radios](#623-radios), [Button](#64-button), [Panel](#620-panel) or [Inset Text](#617-inset-text) for results

#### 7.2.2 Check Answers

**Purpose:** Let users review and confirm their answers before submitting a form.

**Guidance:**
- Use the [Summary List](#627-summary-list) component to display answers as key-value pairs
- Include a "Change" link on each row that takes the user back to the relevant question
- Present the check-your-answers page before the final submission
- Make "Change" links visually hidden-text descriptive (e.g., `Change<span class="govuk-visually-hidden"> name</span>`)
- Group related answers using summary list card variant or section headings

**Components used:** [Summary List](#627-summary-list), [Button](#64-button)

**HTML approach:**

```html
<h1 class="govuk-heading-l">Check your answers</h1>
<h2 class="govuk-heading-m">Personal details</h2>
<dl class="govuk-summary-list">
  <div class="govuk-summary-list__row">
    <dt class="govuk-summary-list__key">Name</dt>
    <dd class="govuk-summary-list__value">Sarah Phillips</dd>
    <dd class="govuk-summary-list__actions">
      <a class="govuk-link" href="/name">Change<span class="govuk-visually-hidden"> name</span></a>
    </dd>
  </div>
</dl>
<div class="govuk-button-group">
  <button type="submit" class="govuk-button" data-module="govuk-button">
    Submit application
  </button>
</div>
```

#### 7.2.3 Complete Multiple Tasks

**Purpose:** Help users understand and complete multiple tasks that make up a larger transaction.

**Guidance:**
- Use the [Task List](#631-task-list) component
- Group related tasks under section headings
- Show completion status for each task (Completed, In progress, Not yet started, Cannot start yet)
- Allow users to complete tasks in any order where possible
- Mark dependent tasks as "Cannot start yet" until prerequisites are done
- Show the total number of completed tasks (e.g., "You have completed 2 of 4 sections")

**Components used:** [Task List](#631-task-list), [Tag](#630-tag)

See the [Task List](#631-task-list) component section for full HTML.

#### 7.2.4 Confirm a Phone Number

**Purpose:** Verify a user's phone number by sending a security code via SMS.

**Guidance:**
- Send a short numeric code (e.g., 6 digits) via SMS
- Use a text input for code entry with `inputmode="numeric"` and `autocomplete="one-time-code"`
- Allow the user to request a new code
- Set a reasonable expiry time and tell the user how long the code is valid
- Provide an alternative method (e.g., phone call) for users who cannot receive SMS

**Components used:** [Text Input](#632-text-input), [Button](#64-button)

#### 7.2.5 Confirm an Email Address

**Purpose:** Verify a user's email address.

**Guidance:**
- Send a confirmation link or code to the email address
- Check the email address exists before sending (basic format validation)
- Tell users to check their spam or junk folder
- Allow users to change the email address if they made a mistake
- Set a reasonable expiry time for confirmation links

**Components used:** [Text Input](#632-text-input), [Button](#64-button), [Notification Banner](#618-notification-banner)

#### 7.2.6 Contact a Department or Service Team

**Purpose:** Provide contact information when users need human help.

**Guidance:**
- Provide multiple contact methods (email, phone, post) where available
- Use [Inset Text](#617-inset-text) for contact details to make them visually distinct
- Include opening hours for phone lines
- Set expectations about response times for email
- Consider the context: provide contact information where users are likely to get stuck

**Components used:** [Inset Text](#617-inset-text)

**HTML approach:**

```html
<div class="govuk-inset-text">
  <h2 class="govuk-heading-m">Get help</h2>
  <p class="govuk-body">
    Telephone: 0300 123 4567<br>
    Monday to Friday, 8am to 6pm<br>
    <a class="govuk-link" href="mailto:help@example.gov.uk">help@example.gov.uk</a>
  </p>
</div>
```

#### 7.2.7 Create a Username

**Purpose:** Help users create a username for account access.

**Guidance:**
- Explain any requirements clearly (length, allowed characters)
- Show requirements before the user starts typing, not only on error
- Allow email addresses as usernames where appropriate
- Check availability before submission where possible
- Do not impose unnecessary complexity requirements

**Components used:** [Text Input](#632-text-input)

#### 7.2.8 Create Accounts

**Purpose:** Guide users through account creation.

**Guidance:**
- Only create accounts if there is a genuine need -- let users try the service before requiring an account
- Keep the sign-up process as short as possible
- Ask only for essential information (email, password)
- Send a confirmation email
- Consider allowing users to save progress without creating an account

**Components used:** [Text Input](#632-text-input), [Password Input](#621-password-input), [Button](#64-button)

#### 7.2.9 Exit a Page Quickly

**Purpose:** Help users quickly and safely leave a service.

**Guidance:**
- Use the [Exit This Page](#612-exit-this-page) component
- For services where users may be at risk (e.g., domestic abuse services)
- The exit page should be something innocuous (e.g., BBC Weather)
- Include information about browser history and clearing traces
- Position the exit button prominently

**Components used:** [Exit This Page](#612-exit-this-page)

See the [Exit This Page](#612-exit-this-page) component section for full HTML.

#### 7.2.10 Navigate a Service

**Purpose:** Help users find their way around a service with multiple sections.

**Guidance:**
- Use [Service Navigation](#625-service-navigation) for top-level sections
- Navigation goes in the header area (after the GOV.UK header)
- Highlight the current section with `aria-current="true"` and `govuk-service-navigation__item--active`
- Keep navigation labels short and descriptive
- Do not use more than about 5-6 top-level navigation items

**Components used:** [Service Navigation](#625-service-navigation)

See the [Service Navigation](#625-service-navigation) component section for full HTML.

#### 7.2.11 Start Using a Service

**Purpose:** Introduce users to a service and help them begin.

**Guidance:**
- Start page must explain: what the service does, who can use it, what information users need to prepare
- Use the Start button (green, with arrow icon) to begin the service
- Include typical completion time if known
- Link to related guidance if available
- The start page sets user expectations for the entire journey

**Components used:** [Button](#64-button) (start variant)

**HTML approach:**

```html
<h1 class="govuk-heading-xl">Apply for a licence</h1>
<p class="govuk-body-l">Use this service to apply for a licence to do something.</p>
<p class="govuk-body">Applying takes around 10 minutes. You'll need:</p>
<ul class="govuk-list govuk-list--bullet">
  <li>your National Insurance number</li>
  <li>your passport</li>
</ul>
<a href="/start" role="button" draggable="false" class="govuk-button govuk-button--start" data-module="govuk-button">
  Start now
  <svg class="govuk-button__start-icon" xmlns="http://www.w3.org/2000/svg" width="17.5" height="19" viewBox="0 0 33 40" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M0 0h13l20 20-20 20H0l20-20z"/>
  </svg>
</a>
```

#### 7.2.12 Recover from Validation Errors

**Purpose:** Help users understand and fix form errors.

**Guidance:**
- Show an [Error Summary](#611-error-summary) at the top of the page listing all errors
- Show inline [Error Messages](#610-error-message) next to each field with an error
- Error summary links must jump to the corresponding field
- Fix one thing at a time -- focus on the most critical error
- Use clear, specific error messages that explain what went wrong and how to fix it
- Never blame the user ("You did not enter..." is wrong; "Enter a..." is correct)

**Components used:** [Error Summary](#611-error-summary), [Error Message](#610-error-message)

See the [Error Summary](#611-error-summary) and [Error Message](#610-error-message) component sections for full HTML.

---

### 7.3 Pages

#### 7.3.1 Confirmation Pages

**Purpose:** Tell users that they have successfully completed a transaction.

**Guidance:**
- Use the [Panel](#620-panel) component with a green confirmation banner
- Show a reference number if one was generated
- Explain what happens next (e.g., "We'll send you an email confirmation")
- Include contact information in case of problems
- Do not include navigation that could take users away accidentally

**Components used:** [Panel](#620-panel)

**HTML approach:**

```html
<div class="govuk-grid-row">
  <div class="govuk-grid-column-two-thirds">
    <div class="govuk-panel govuk-panel--confirmation">
      <h1 class="govuk-panel__title">Application complete</h1>
      <div class="govuk-panel__body">
        Your reference number<br><strong>HDJ2123F</strong>
      </div>
    </div>
    <p class="govuk-body">We have sent you a confirmation email.</p>
    <h2 class="govuk-heading-m">What happens next</h2>
    <p class="govuk-body">We've sent your application to Borderforce. They will contact you within 5 working days.</p>
    <p class="govuk-body">
      <a class="govuk-link" href="#">What did you think of this service?</a> (takes 30 seconds)
    </p>
  </div>
</div>
```

#### 7.3.2 Cookies Page

**Purpose:** Explain which cookies the service uses and provide controls for non-essential cookies.

**Guidance:**
- Explain what cookies are used and why
- Group cookies by purpose (essential, analytics, functional)
- Provide accept/reject controls for non-essential cookies
- Use the [Cookie Banner](#67-cookie-banner) component for the initial prompt
- Include a table of cookies with name, purpose, and expiry
- Link to the cookies page from the footer

**Components used:** [Cookie Banner](#67-cookie-banner), [Table](#628-table), [Radios](#623-radios), [Button](#64-button)

#### 7.3.3 Page Not Found (404)

**Purpose:** Tell users that the page they were looking for cannot be found.

**Guidance:**
- Heading: "Page not found"
- Do not blame the user
- Suggest what to do next (check the URL, go to the homepage, use search)
- Include contact information
- Use the standard page layout

**HTML approach:**

```html
<h1 class="govuk-heading-l">Page not found</h1>
<p class="govuk-body">If you typed the web address, check it is correct.</p>
<p class="govuk-body">If you pasted the web address, check you copied the entire address.</p>
<p class="govuk-body">If the web address is correct or you selected a link or button, <a class="govuk-link" href="#">contact the service team</a> if you need to speak to someone about your application.</p>
```

#### 7.3.4 Problem with the Service (500)

**Purpose:** Tell users there is a technical problem and what they can do.

**Guidance:**
- Heading: "Sorry, there is a problem with the service"
- Suggest trying again later
- Provide contact information as an alternative
- Do not expose technical details (stack traces, error codes)

**HTML approach:**

```html
<h1 class="govuk-heading-l">Sorry, there is a problem with the service</h1>
<p class="govuk-body">Try again later.</p>
<p class="govuk-body">If you need help, contact <a class="govuk-link" href="#">the support team</a> (phone: 0300 123 4567).</p>
```

#### 7.3.5 Question Pages

**Purpose:** Ask users one question per page in a multi-step form.

**Guidance:**
- Ask one question per page (the "one thing per page" principle)
- Include a [Back Link](#62-back-link) at the top
- The question should be the page heading (h1)
- For radio/checkbox questions, the legend should be the h1 (wrap h1 inside legend)
- For text inputs, the label can be the h1 (wrap h1 inside label)
- Use a "Continue" button, not "Submit" or "Next"
- Set the page `<title>` to "[Question] - [Service name] - GOV.UK"

**Components used:** [Back Link](#62-back-link), [Radios](#623-radios) or [Text Input](#632-text-input), [Button](#64-button), [Fieldset](#613-fieldset)

**HTML approach (radio question):**

```html
<a href="/previous" class="govuk-back-link">Back</a>
<div class="govuk-width-container">
  <main class="govuk-main-wrapper" id="main-content">
    <div class="govuk-grid-row">
      <div class="govuk-grid-column-two-thirds">
        <form method="post" action="/answer">
          <div class="govuk-form-group">
            <fieldset class="govuk-fieldset">
              <legend class="govuk-fieldset__legend govuk-fieldset__legend--l">
                <h1 class="govuk-fieldset__heading">
                  Where do you live?
                </h1>
              </legend>
              <div class="govuk-radios" data-module="govuk-radios">
                <div class="govuk-radios__item">
                  <input class="govuk-radios__input" id="where-1" name="where" type="radio" value="england">
                  <label class="govuk-label govuk-radios__label" for="where-1">England</label>
                </div>
                <div class="govuk-radios__item">
                  <input class="govuk-radios__input" id="where-2" name="where" type="radio" value="scotland">
                  <label class="govuk-label govuk-radios__label" for="where-2">Scotland</label>
                </div>
              </div>
            </fieldset>
          </div>
          <button type="submit" class="govuk-button" data-module="govuk-button">Continue</button>
        </form>
      </div>
    </div>
  </main>
</div>
```

#### 7.3.6 Service Unavailable

**Purpose:** Tell users a service is temporarily unavailable.

**Guidance:**
- Heading: "Sorry, the service is unavailable"
- Explain when the service will be available if known (e.g., "You will be able to use the service from 9am on Monday 1 January 2025")
- Provide an alternative way to complete the task (phone, post)
- If planned maintenance, notify users in advance

**HTML approach:**

```html
<h1 class="govuk-heading-l">Sorry, the service is unavailable</h1>
<p class="govuk-body">You will be able to use the service from 9am on Monday 1 January 2025.</p>
<p class="govuk-body">If you need to speak to someone, contact <a class="govuk-link" href="#">the support team</a>.</p>
```

#### 7.3.7 Step by Step Navigation

**Purpose:** Show users the end-to-end steps of a process they need to complete.

**Guidance:**
- Use numbered steps with expandable sections
- For end-to-end journeys that span multiple services or organisations
- Each step shows what the user needs to do and links to the relevant service or guidance
- Steps can be marked as completed or in progress
- Users can open and close individual steps
- The sidebar shows a summary of all steps with the current step highlighted

**Components used:** [Accordion](#61-accordion) (modified pattern), custom step-by-step markup

**Note:** Step by step navigation has specific markup that goes beyond standard components. It is typically used on GOV.UK content pages, not within transactional services.

---

## 8. Accessibility Requirements

### 8.1 WCAG 2.2 AA Requirements

All GOV.UK services must meet the Web Content Accessibility Guidelines (WCAG) 2.2 at Level AA. This is a legal requirement under the Public Sector Bodies (Websites and Mobile Applications) Accessibility Regulations 2018.

Key principles (POUR):
- **Perceivable** -- Information and UI components must be presentable in ways users can perceive
- **Operable** -- UI components and navigation must be operable
- **Understandable** -- Information and operation of the UI must be understandable
- **Robust** -- Content must be robust enough to be interpreted by assistive technologies

### 8.2 Focus States

GOV.UK uses a distinctive dual focus indicator:
- **Outer ring**: Yellow (`#ffdd00`) 3px outline
- **Inner border**: Dark (`#0b0c0c`) 3px bottom border on text elements

All interactive elements must have visible focus states. The GOV.UK Frontend CSS provides these automatically for all components.

Never override or remove focus styles. If customising components, ensure the focus indicator meets WCAG 2.2 criterion 2.4.7 (Focus Visible) and 2.4.11 (Focus Not Obscured - Minimum).

### 8.3 Screen Reader Support

GOV.UK Frontend is tested with the following screen reader combinations:
- JAWS with Internet Explorer/Edge on Windows
- NVDA with Firefox on Windows
- VoiceOver with Safari on macOS and iOS

Key ARIA patterns used throughout the Design System:

| Pattern | Usage |
|---|---|
| `aria-describedby` | Links hints and error messages to form inputs |
| `role="alert"` | Dynamic status changes (success banners, error summaries) |
| `role="region"` with `aria-labelledby` | Landmark sections (notification banners, cookie banners) |
| `role="group"` | Grouping related inputs (date input fields) |
| `aria-current="page"` | Indicates current page in breadcrumbs and pagination |
| `aria-current="true"` | Indicates active item in Service Navigation |
| `aria-controls` | Links toggle buttons to the content they control |
| `aria-expanded` | Indicates expanded/collapsed state (accordions, mobile nav) |
| `aria-hidden="true"` | Hides decorative elements (icons, prefixes/suffixes) |
| `aria-live` | Announces dynamic content changes (character count) |

### 8.4 Keyboard Navigation

All interactive elements must be operable via keyboard alone:
- **Tab**: Move between interactive elements
- **Shift+Tab**: Move backwards
- **Enter/Space**: Activate buttons and links
- **Arrow keys**: Navigate within component groups (radio buttons, tabs, accordion)
- **Escape**: Close modals, menus, or overlays

Ensure a logical tab order that follows the visual reading order. Never use `tabindex` values greater than 0.

### 8.5 Colour Contrast

Minimum contrast ratios (WCAG 2.2 Level AA):
- **Normal text** (under 18pt or 14pt bold): 4.5:1 ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 ratio
- **UI components and graphical objects**: 3:1 ratio

GOV.UK functional colours are designed to meet these ratios. When using custom colours or the extended palette, verify contrast ratios.

**Critical rule:** Never rely on colour alone to convey information. Always pair colour with text labels, patterns, or icons. For example, error states use red colour AND the text prefix "Error:".

### 8.6 Visually Hidden Text

Use `govuk-visually-hidden` to provide context for screen readers without displaying it visually:

```html
<span class="govuk-visually-hidden">Error:</span> Enter your name

<a href="/change-name">Change<span class="govuk-visually-hidden"> name</span></a>
```

Common uses:
- Error message prefixes ("Error:")
- Descriptive link text ("Change name" instead of just "Change")
- Warning prefixes ("Warning")
- Table/list context for screen readers

### 8.7 Skip Link

The [Skip Link](#626-skip-link) must be the first focusable element on every page. It allows keyboard users to bypass navigation and jump directly to the main content.

```html
<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">
  Skip to main content
</a>
```

---

## 9. JavaScript Dependency Map

### 9.1 Components Requiring JavaScript

These components need the `data-module` attribute and `initAll()` to function fully:

| Component | `data-module` Value | Without JS Behaviour |
|---|---|---|
| Accordion | `govuk-accordion` | All sections expanded, headings visible, no show/hide |
| Button | `govuk-button` | Works normally, but no double-click prevention |
| Character count | `govuk-character-count` | No live count feedback, static message shown |
| Checkboxes | `govuk-checkboxes` | No conditional reveal, all conditional content visible |
| Cookie banner | N/A (custom JS) | Banner always shown, no accept/reject functionality |
| Error summary | `govuk-error-summary` | Visible but does not auto-focus |
| Exit this page | `govuk-exit-this-page` | Button link works, no keyboard shortcut or overlay |
| File upload | `govuk-file-upload` | Basic file input, no drag-and-drop zone |
| Notification banner | `govuk-notification-banner` | Visible but success variant does not auto-focus |
| Password input | `govuk-password-input` | Password field works, show/hide toggle hidden |
| Radios | `govuk-radios` | No conditional reveal, all conditional content visible |
| Service navigation | `govuk-service-navigation` | Mobile menu always visible (no hamburger toggle) |
| Skip link | `govuk-skip-link` | Works as normal anchor link |
| Tabs | `govuk-tabs` | All content shown sequentially with table of contents links |

### 9.2 Components Working Without JavaScript

These components are fully functional without JavaScript:

- Back link
- Breadcrumbs
- Date input
- Details (native HTML5 element)
- Error message
- Fieldset
- Footer
- Header
- Inset text
- Pagination
- Panel
- Phase banner
- Select
- Summary list
- Table
- Tag
- Task list
- Text input
- Textarea
- Warning text

### 9.3 Graceful Degradation

GOV.UK Frontend is designed to work without JavaScript. The `js-enabled` class (added by the inline script in `<body>`) is used in CSS to conditionally show/hide JS-dependent UI elements.

The `govuk-frontend-supported` class indicates that the browser supports ES modules (`type="module"`). Components check for this before initialising.

**Pattern for JS initialisation:**

```html
<body class="govuk-template__body">
  <script>
    document.body.className = document.body.className + ' js-enabled' + ('noModule' in HTMLScriptElement.prototype ? ' govuk-frontend-supported' : '');
  </script>
  <!-- Page content -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js"></script>
  <script type="module">
    import { initAll } from 'https://cdn.jsdelivr.net/npm/govuk-frontend@6.1.0/dist/govuk/govuk-frontend.min.js';
    initAll();
  </script>
</body>
```

**Key behaviour:**
- Without JS: all content is visible, interactive enhancements are absent but content is accessible
- With JS: `initAll()` scans the DOM for elements with `data-module` attributes and initialises the corresponding component class
- Individual component initialisation is also possible: `new Accordion(element)` for targeted setup

---

## 10. LGR Rationalisation Engine: Approach and Deviations

### 10.1 Current Implementation

The LGR Rationalisation Engine is a single-file HTML application (`lgr-rationalisation-engine.html`) that approximates the GOV.UK Design System aesthetic while using a different CSS framework. Key characteristics:

- **CSS framework**: Tailwind CSS via CDN (`https://cdn.tailwindcss.com`) instead of GOV.UK Frontend CSS
- **Custom CSS properties** approximate GOV.UK colours (note: these are pre-v6 brand refresh values — see Section 5.1 for current v6.x values):
  - `--govuk-black: #0b0c0c` (unchanged in v6)
  - `--govuk-blue: #1d70b8` (v6 brand colour is same; link colour changed to `#1a65a6`)
  - `--govuk-light-grey: #f3f2f1` (v6 equivalent is `#f3f3f3`)
  - `--govuk-red: #d4351c` (v6 error is `#ca3535`)
  - `--govuk-green: #00703c` (v6 success is `#0f7a52`)
  - `--govuk-purple: #53284f` (v6 purple is `#54319f`)
  - `--govuk-orange: #f47738` (unchanged in v6)
- **Font**: Arial (correct for non-`service.gov.uk` usage)
- **Custom component approximations**:
  - `.gds-btn` approximates `govuk-button` (green background, bottom border shadow, active push effect)
  - `.gds-btn-secondary` approximates `govuk-button--secondary`
  - `.gds-table` approximates `govuk-table`
  - `.gds-tag` approximates `govuk-tag` with custom colour variants (`.tag-blue`, `.tag-red`, etc.)
- **Header**: Black background with blue bottom border matches the GOV.UK header pattern
- **Modals**: `border-t-8 border-[#1d70b8]` panels (modals are not a standard GOV.UK component)
- **Stage panels**: `border-t-4 border-[#1d70b8]` (approximates GOV.UK panel/card patterns)

### 10.2 Deviation Log

| # | Component/Pattern | GOV.UK Standard | Our Implementation | Justification |
|---|---|---|---|---|
| 1 | CSS Framework | GOV.UK Frontend CSS | Tailwind CSS CDN | Single-file constraint; no build step required |
| 2 | Buttons | `govuk-button` classes | `.gds-btn` custom CSS | Tailwind-compatible; same visual appearance |
| 3 | Tags | `govuk-tag` with modifiers | `.gds-tag` + `.tag-{colour}` | Custom colour scheme for rationalisation patterns |
| 4 | Tables | `govuk-table` | `.gds-table` | Custom styling for analysis matrix layout |
| 5 | Modals | No standard modal | Custom modal pattern | GDS has no modal component; custom implementation required |
| 6 | Header | `govuk-header` | Custom Tailwind | Matches visual appearance; no crown logo (not a GOV.UK service) |
| 7 | File upload | `govuk-file-upload` | Custom drag-and-drop | Enhanced UX for multi-file upload workflow |
| 8 | Tooltips | No standard tooltip | Custom `.tooltip-wrapper` | GDS does not provide tooltips; needed for domain term definitions |
| 9 | Timeline | No standard timeline | Custom `.timeline-*` CSS | Domain-specific contract visualisation; no GDS equivalent |
| 10 | Signal indicators | No standard equivalent | Custom `.signal-dot-*` | Domain-specific RAG indicators for signal-based analysis |

### 10.3 Migration Path

If migrating to GOV.UK Frontend CSS:

1. **Replace the CSS CDN**: Swap Tailwind CDN link for GOV.UK Frontend CDN link
2. **Replace custom classes**: Map `.gds-btn` to `govuk-button`, `.gds-table` to `govuk-table`, `.gds-tag` to `govuk-tag`, etc.
3. **Add required page structure**: Add `govuk-template` class to `<html>`, `govuk-template__body` to `<body>`, wrap content in `govuk-width-container`
4. **Keep custom components**: Where no GDS equivalent exists (modals, tooltips, timeline, signal indicators), retain custom CSS
5. **Add JS initialisation**: Include the GOV.UK Frontend JS bundle and `initAll()` for any interactive components

**For GDS compliance assessment**: Document each deviation with justification as shown in the table above. Deviations are acceptable when:
- No equivalent GOV.UK component exists
- Technical constraints (single-file architecture) prevent using the standard approach
- The deviation achieves the same accessibility and usability outcomes

---

## 11. Community and Contribution Model

### 11.1 Design System Working Group

The GOV.UK Design System is maintained by a team within the Government Digital Service (GDS). A working group of designers, developers, and content specialists reviews and approves changes to components and patterns.

### 11.2 Contribution Process

Components and patterns progress through a defined lifecycle:

1. **Proposal** -- Community member raises a proposal via GitHub discussion, describing the user need and proposed solution
2. **Development with support** -- The proposer develops the component/pattern, supported by the Design System team
3. **Review against contribution criteria** -- The working group evaluates the proposal against established criteria (user research evidence, accessibility, cross-browser testing, content design)
4. **Approval and publication** -- Approved components are added to the Design System and the Frontend library

### 11.3 Component Lifecycle

Components have different maturity levels:
- **Experimental** -- In development, not yet recommended for production use
- **Published** -- Reviewed, tested, and recommended for use in GOV.UK services
- **Deprecated** -- No longer recommended; guidance provided for migration to alternatives

### 11.4 Engagement Channels

- **Slack**: `#govuk-design-system` channel in the cross-government Slack workspace
- **GitHub**: Discussions and issue tracking on the `alphagov/govuk-frontend` and `alphagov/govuk-design-system` repositories
- **Monthly catch-up calls**: Open sessions for community discussion
- **Research sessions**: "Always on" continuous research to understand user needs and validate design decisions
- **Community proposals**: Anyone in the UK public sector can propose new components or patterns, or upstream existing ones that have been proven in individual services

---

## 12. Quick Reference Tables

### 12.1 All CSS Class Prefixes

| Prefix | Purpose | Example |
|---|---|---|
| `govuk-` | Standard component/element classes | `govuk-button`, `govuk-table` |
| `govuk-!-` | Override/utility classes | `govuk-!-margin-top-5`, `govuk-!-font-weight-bold` |
| `govuk-js-` | JavaScript hooks (not for styling) | `govuk-js-character-count` |

### 12.2 BEM Naming Convention

GOV.UK Frontend uses a BEM (Block, Element, Modifier) naming convention:

```
govuk-{block}__{element}--{modifier}
```

**Examples:**

| Pattern | Example | Meaning |
|---|---|---|
| Block | `govuk-button` | The button component |
| Block--Modifier | `govuk-button--secondary` | Secondary variant of button |
| Block__Element | `govuk-header__logo` | Logo element within header |
| Block__Element--Modifier | `govuk-pagination__item--current` | Current page item in pagination |

### 12.3 Common Class Patterns

#### Form Pattern

Every form input follows this structure:

```html
<div class="govuk-form-group">
  <label class="govuk-label" for="input-id">Label text</label>
  <div id="input-id-hint" class="govuk-hint">Hint text</div>
  <!-- Error message (only when there is an error) -->
  <p id="input-id-error" class="govuk-error-message">
    <span class="govuk-visually-hidden">Error:</span> Error text
  </p>
  <input class="govuk-input" id="input-id" name="inputName" type="text"
         aria-describedby="input-id-hint input-id-error">
</div>
```

#### Error Pattern

When a field has an error, three things change:

1. **Form group**: Add `govuk-form-group--error` to the wrapper
2. **Input**: Add `govuk-{input-type}--error` to the input (e.g., `govuk-input--error`, `govuk-textarea--error`, `govuk-select--error`)
3. **Error message**: Add `<p class="govuk-error-message">` with `<span class="govuk-visually-hidden">Error:</span>` prefix
4. **aria-describedby**: Update to include both hint and error message IDs

#### Common Data Attributes

| Attribute | Purpose | Example |
|---|---|---|
| `data-module` | Triggers JS initialisation via `initAll()` | `data-module="govuk-accordion"` |
| `data-prevent-double-click` | Prevents double form submission | `data-prevent-double-click="true"` |
| `data-aria-controls` | Links input to conditional content panel | `data-aria-controls="conditional-email"` |
| `data-behaviour` | Special behaviour modifier | `data-behaviour="exclusive"` (none checkbox) |
| `data-maxlength` | Character limit for character count | `data-maxlength="200"` |
| `data-maxwords` | Word limit for character count | `data-maxwords="150"` |
| `data-threshold` | Show count after percentage of limit | `data-threshold="75"` |
| `data-remember-expanded` | Accordion state persistence | `data-remember-expanded="false"` |

### 12.4 Complete Component Quick Reference

| Component | Primary Class | Needs JS | Key Data Attribute |
|---|---|---|---|
| Accordion | `govuk-accordion` | Yes | `data-module="govuk-accordion"` |
| Back link | `govuk-back-link` | No | -- |
| Breadcrumbs | `govuk-breadcrumbs` | No | -- |
| Button | `govuk-button` | Yes | `data-module="govuk-button"` |
| Character count | `govuk-character-count` | Yes | `data-module="govuk-character-count"` |
| Checkboxes | `govuk-checkboxes` | Yes | `data-module="govuk-checkboxes"` |
| Cookie banner | `govuk-cookie-banner` | Custom | -- |
| Date input | `govuk-date-input` | No | -- |
| Details | `govuk-details` | No | -- |
| Error message | `govuk-error-message` | No | -- |
| Error summary | `govuk-error-summary` | Yes | `data-module="govuk-error-summary"` |
| Exit this page | `govuk-exit-this-page` | Yes | `data-module="govuk-exit-this-page"` |
| Fieldset | `govuk-fieldset` | No | -- |
| File upload | `govuk-file-upload` | Optional | `data-module="govuk-file-upload"` |
| Footer | `govuk-footer` | No | -- |
| Header | `govuk-header` | No | -- |
| Inset text | `govuk-inset-text` | No | -- |
| Notification banner | `govuk-notification-banner` | Yes | `data-module="govuk-notification-banner"` |
| Pagination | `govuk-pagination` | No | -- |
| Panel | `govuk-panel` | No | -- |
| Password input | `govuk-password-input` | Yes | `data-module="govuk-password-input"` |
| Phase banner | `govuk-phase-banner` | No | -- |
| Radios | `govuk-radios` | Yes | `data-module="govuk-radios"` |
| Select | `govuk-select` | No | -- |
| Service navigation | `govuk-service-navigation` | Yes | `data-module="govuk-service-navigation"` |
| Skip link | `govuk-skip-link` | Yes | `data-module="govuk-skip-link"` |
| Summary list | `govuk-summary-list` | No | -- |
| Table | `govuk-table` | No | -- |
| Tabs | `govuk-tabs` | Yes | `data-module="govuk-tabs"` |
| Tag | `govuk-tag` | No | -- |
| Task list | `govuk-task-list` | No | -- |
| Text input | `govuk-input` | No | -- |
| Textarea | `govuk-textarea` | No | -- |
| Warning text | `govuk-warning-text` | No | -- |

---

*End of GOV.UK Design System Reference. Document generated for the LGR Rationalisation Engine project.*
