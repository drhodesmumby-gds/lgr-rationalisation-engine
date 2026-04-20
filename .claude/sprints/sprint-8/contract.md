# Sprint 8: GOV.UK Design System AI-Friendly Reference Document

## Scope

Create a comprehensive markdown reference file (`GOVUK-DESIGN-SYSTEM-REFERENCE.md`) that serves as a self-contained AI-agent-friendly guide to the GOV.UK Design System. This document enables future AI agents to:

- Know which GOV.UK components and patterns exist and when to use them
- Understand the user research behind design decisions
- Implement components correctly in single-page HTML prototypes (no Nunjucks, no Node.js server)
- Evaluate whether implementations are compliant
- Formally document deviations from the standard with justification

The document is structured for quick lookup and includes exact HTML markup, CSS class names, and contextual guidance throughout.

## Acceptance Criteria

- [ ] File exists at project root as `GOVUK-DESIGN-SYSTEM-REFERENCE.md`
- [ ] Document covers all 34 components from the GOV.UK Design System
- [ ] Document covers all 29 patterns from the GOV.UK Design System
- [ ] Document covers all 15 styles topics
- [ ] Each component section includes: description, when to use / when not to use, plain HTML markup, CSS classes, JS requirements, accessibility notes, and research findings where available
- [ ] Document includes CDN setup instructions for using GOV.UK Frontend without Node.js
- [ ] Document includes the complete colour palette with hex values
- [ ] Document includes the type scale with responsive sizes
- [ ] Document includes the spacing scale with override classes
- [ ] Document includes the grid/layout system with all column classes
- [ ] Document includes a "Deviations Log" section template for documenting project-specific departures from the standard
- [ ] Document includes a section mapping our project's current Tailwind/custom CSS approach to GOV.UK equivalents
- [ ] Document is well-structured with a table of contents for quick navigation
- [ ] All HTML examples use plain HTML (no Nunjucks macros)
- [ ] Document is valid markdown that renders correctly

## Document Structure

The Generator should create the file with the following structure:

### 1. Header & Purpose (lines ~1-30)
```
# GOV.UK Design System Reference
## Purpose
## How to Use This Document
## Quick Reference: CDN Setup
```

Content for this section:
- State that this is an AI-agent-friendly reference for implementing GOV.UK Design System patterns in single-file HTML prototypes
- Explain that all examples use plain HTML, not Nunjucks macros
- Provide the CDN setup snippet:
  ```html
  <!-- CSS -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/govuk-frontend@5.8.0/dist/govuk/govuk-frontend.min.css">
  <!-- JS (at end of body) -->
  <script type="module" src="https://cdn.jsdelivr.net/npm/govuk-frontend@5.8.0/dist/govuk/govuk-frontend.min.js"></script>
  <script type="module">
    import { initAll } from 'https://cdn.jsdelivr.net/npm/govuk-frontend@5.8.0/dist/govuk/govuk-frontend.min.js';
    initAll();
  </script>
  ```
- Note: For projects not on service.gov.uk (like ours), use Arial not GDS Transport font
- Note: The `data-module` attribute on components is what triggers JS initialization via `initAll()`

### 2. Page Template & Structure (lines ~30-120)
```
## Page Template
### Minimal HTML Boilerplate
### Required Classes
### Page Structure Hierarchy
```

Content:
- Full HTML5 boilerplate with `<html class="govuk-template">`, `<body class="govuk-template__body">`
- Page structure order: Skip link -> Header -> Service navigation -> Phase banner -> Width container -> Back link/Breadcrumbs -> Main wrapper -> Footer
- Required classes: `govuk-template` (html), `govuk-template__body` (body), `govuk-width-container`, `govuk-main-wrapper`
- JS feature detection script that adds `.js-enabled` and `.govuk-frontend-supported` to body

### 3. Styles (lines ~120-450)
```
## Styles
### Colour Palette
### Typography
### Type Scale
### Spacing
### Layout & Grid
### Section Breaks
### Utility Classes
```

#### 3.1 Colour Palette
Full table of functional colours:
| Purpose | Hex | Sass function |
|---|---|---|
| Text | #0b0c0c | `govuk-functional-colour("text")` |
| Secondary text | #484949 | |
| Link | #1a65a6 | `govuk-functional-colour("link")` |
| Link hover | #0f385c | |
| Link visited | #54319f | |
| Link active | #0b0c0c | |
| Focus | #ffdd00 | `govuk-functional-colour("focus")` |
| Focus text | #0b0c0c | |
| Error | #ca3535 | `govuk-functional-colour("error")` |
| Success | #0f7a52 | `govuk-functional-colour("success")` |
| Brand | #1d70b8 | `govuk-functional-colour("brand")` |
| Border | #cecece | |
| Input border | #0b0c0c | |
| Body background | #ffffff | |

Extended palette: 11 colour groups (Blue, Green, Teal, Purple, Magenta, Red, Orange, Yellow, Brown, Black, White) each with primary, tint, and shade variants. Note: "Do not copy hex values directly; use Sass functions so services update automatically with palette changes."

#### 3.2 Typography
- Typeface: GDS Transport for service.gov.uk; Arial/Helvetica for other subdomains
- Font fallback: `"GDS Transport", arial, sans-serif` (or just `arial, sans-serif` for non-GOV.UK)
- Heading classes: `govuk-heading-xl` (48px), `govuk-heading-l` (36px), `govuk-heading-m` (24px), `govuk-heading-s` (19px)
- Caption classes: `govuk-caption-xl`, `govuk-caption-l`, `govuk-caption-m`
- Body classes: `govuk-body` (19px), `govuk-body-l` (24px lead), `govuk-body-s` (16px small)
- Links: `govuk-link`, `govuk-link--no-visited-state`, `govuk-link--inverse`, `govuk-link--no-underline`
- Lists: `govuk-list`, `govuk-list--bullet`, `govuk-list--number`, `govuk-list--spaced`
- Standard pages: h1=`govuk-heading-l`, h2=`govuk-heading-m`, h3=`govuk-heading-s`
- Long-form pages: h1=`govuk-heading-xl`, h2=`govuk-heading-l`, h3=`govuk-heading-m`

#### 3.3 Type Scale
Full responsive table:
| Scale Point | Large Screen (>640px) | Small Screen (<640px) | CSS Class |
|---|---|---|---|
| 80 | 80px/80px | 53px/55px | Exceptional use only |
| 48 | 48px/50px | 32px/35px | `govuk-heading-xl` |
| 36 | 36px/40px | 27px/30px | `govuk-heading-l` |
| 27 | 27px/30px | 21px/25px | Exceptional use only |
| 24 | 24px/30px | 21px/25px | `govuk-heading-m`, `govuk-body-l` |
| 19 | 19px/25px | 19px/25px | `govuk-heading-s`, `govuk-body` |
| 16 | 16px/20px | 16px/20px | `govuk-body-s` |

#### 3.4 Spacing
Responsive spacing scale (units 0-9):
| Unit | Small Screen | Large Screen (>640px) |
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

Override classes: `govuk-!-margin-{direction}-{unit}`, `govuk-!-padding-{direction}-{unit}`
Static equivalents: `govuk-!-static-margin-{direction}-{unit}`
Directions: `top`, `right`, `bottom`, `left` (or omit for all sides)

#### 3.5 Layout & Grid
- Container: `govuk-width-container` (max 1020px)
- Main wrapper: `govuk-main-wrapper`
- Row: `govuk-grid-row`
- Columns: `govuk-grid-column-full`, `govuk-grid-column-three-quarters`, `govuk-grid-column-two-thirds`, `govuk-grid-column-one-half`, `govuk-grid-column-one-third`, `govuk-grid-column-one-quarter`
- Desktop-specific: append `-from-desktop` (e.g., `govuk-grid-column-two-thirds-from-desktop`)
- Width overrides: `govuk-!-width-{full|three-quarters|two-thirds|one-half|one-third|one-quarter}`
- Display: `govuk-!-display-{block|inline|inline-block|none|none-print}`
- Accessibility: `govuk-visually-hidden`, `govuk-visually-hidden-focusable`
- Recommended: two-thirds column for most pages; keep lines under 75 chars

#### 3.6 Section Breaks
`<hr class="govuk-section-break govuk-section-break--{xl|l|m} govuk-section-break--visible">`

#### 3.7 Font Override Classes
- Size: `govuk-!-font-size-{80|48|36|27|24|19|16}`
- Weight: `govuk-!-font-weight-regular`, `govuk-!-font-weight-bold`
- Alignment: `govuk-!-text-align-{left|right|centre}`
- Tabular numbers: `govuk-!-font-tabular-numbers`
- Word breaking: `govuk-!-text-break-word`

### 4. Components (lines ~450-2500)

For each of the 34 components below, include a subsection with:
1. **What it is** (1-2 sentences)
2. **When to use / When not to use** (bullet points)
3. **HTML** (complete plain HTML for each variant)
4. **CSS classes** (table of class names and what they do)
5. **JavaScript** (whether it needs `data-module`, what `initAll()` does for it)
6. **Accessibility** (ARIA attributes, screen reader behaviour, keyboard interaction)
7. **Research** (user research findings, if published by GDS)

#### Component List (in alphabetical order):

**4.1 Accordion**
- Container: `<div class="govuk-accordion" data-module="govuk-accordion">`
- Sections: `govuk-accordion__section`, `govuk-accordion__section--expanded` (open by default)
- Heading: `govuk-accordion__section-heading` > `govuk-accordion__section-button`
- Content: `govuk-accordion__section-content`
- Optional summary: `govuk-accordion__section-summary`
- JS required: Yes (`data-module="govuk-accordion"`). Without JS, all sections display expanded with headings.
- Session storage remembers state (configurable via `rememberExpanded`)
- Accessibility: button text read as single statement, show/hide announced, keyboard nav supported, heading level adjustable (default h2)

**4.2 Back link**
- HTML: `<a href="#" class="govuk-back-link">Back</a>`
- Inverse variant: `govuk-back-link--inverse`
- Position before `<main>` element, at top of page
- Custom text: "Go back to [page]" for complex journeys

**4.3 Breadcrumbs**
- HTML: `<nav class="govuk-breadcrumbs" aria-label="Breadcrumb">` > `<ol class="govuk-breadcrumbs__list">` > `<li class="govuk-breadcrumbs__list-item">` > `<a class="govuk-breadcrumbs__link">`
- Collapse variant: `govuk-breadcrumbs--collapse-on-mobile`
- Inverse: `govuk-breadcrumbs--inverse`
- Place before `<main>` so skip link bypasses navigation

**4.4 Button**
- Primary: `<button type="submit" class="govuk-button" data-module="govuk-button">Save and continue</button>`
- Secondary: add `govuk-button--secondary`
- Warning: add `govuk-button--warning`
- Inverse: add `govuk-button--inverse` (white on dark backgrounds)
- Start: `<a href="#" role="button" draggable="false" class="govuk-button govuk-button--start" data-module="govuk-button">Start now <svg ...></a>`
- Disabled: add `disabled aria-disabled="true"`
- Button group: wrap in `<div class="govuk-button-group">`
- Double-click prevention: `data-prevent-double-click="true"`
- JS: `data-module="govuk-button"` prevents double submission
- Accessibility: disabled buttons have poor contrast; start buttons need `role="button"` on `<a>` tags
- Include full SVG for start button arrow icon

**4.5 Character count**
- Wrapper: `<div class="govuk-form-group govuk-character-count" data-module="govuk-character-count" data-maxlength="200">`
- Textarea: `govuk-textarea govuk-js-character-count`
- Message: `<div class="govuk-hint govuk-character-count__message">`
- Supports `data-maxwords` alternative and `data-threshold` (percentage)
- JS required: updates count as user types, announces to screen readers
- Does not restrict input; allows exceeding limits

**4.6 Checkboxes**
- Fieldset wrapper with `govuk-fieldset`, legend
- Container: `<div class="govuk-checkboxes" data-module="govuk-checkboxes">`
- Items: `govuk-checkboxes__item` > `govuk-checkboxes__input` + `govuk-checkboxes__label`
- Hint: `govuk-checkboxes__hint`
- Small variant: `govuk-checkboxes--small`
- Conditional reveal: `data-aria-controls="conditional-id"` on input, `govuk-checkboxes__conditional govuk-checkboxes__conditional--hidden` on target
- "None" exclusive: `data-behaviour="exclusive"` on the none checkbox
- Position checkboxes left of labels

**4.7 Cookie banner**
- Container: `<div class="govuk-cookie-banner" role="region" aria-label="Cookies on [service]">`
- Message: `govuk-cookie-banner__message govuk-width-container`
- Heading: `govuk-cookie-banner__heading govuk-heading-m`
- Content: `govuk-cookie-banner__content`
- Actions in `govuk-button-group`
- Requires custom JS for cookie management (1-year expiry, consent tracking)
- Place before skip link in DOM

**4.8 Date input**
- Fieldset with `role="group"` on the fieldset element
- Container: `<div class="govuk-date-input">`
- Three items: day (`govuk-input--width-2`), month (`govuk-input--width-2`), year (`govuk-input--width-4`)
- Use `type="text"` with `inputmode="numeric"` (NOT `type="number"`)
- For DOB: add `autocomplete="bday-day"` etc.
- Error: apply `govuk-input--error` to individual fields with errors

**4.9 Details**
- HTML: `<details class="govuk-details"><summary class="govuk-details__summary"><span class="govuk-details__summary-text">Summary</span></summary><div class="govuk-details__text">Content</div></details>`
- No JS required (native HTML5 element)
- Research: some users think clicking navigates away; voice assistant users may struggle

**4.10 Error message**
- HTML: `<p id="[id]-error" class="govuk-error-message"><span class="govuk-visually-hidden">Error:</span> [message]</p>`
- Container gets `govuk-form-group--error`
- Input gets `govuk-input--error` (red border)
- Link via `aria-describedby`
- Must also appear in Error Summary at page top
- Content: describe what happened and how to fix it, avoid jargon

**4.11 Error summary**
- HTML: `<div class="govuk-error-summary" data-module="govuk-error-summary"><div role="alert"><h2 class="govuk-error-summary__title">There is a problem</h2><div class="govuk-error-summary__body"><ul class="govuk-list govuk-error-summary__list"><li><a href="#field-id">Error text</a></li></ul></div></div></div>`
- Position: top of main content, below breadcrumbs, above h1
- JS: auto-focuses on page load
- Link errors to corresponding form fields

**4.12 Exit this page**
- Warning button with `data-module="govuk-exit-this-page"`
- Shift key x3 in 5 seconds activates
- Includes loading overlay, progress dots
- Accessibility: screen reader announcements, skip link activation
- For services where users may be at risk (e.g., domestic abuse)

**4.13 Fieldset**
- HTML: `<fieldset class="govuk-fieldset"><legend class="govuk-fieldset__legend">Legend text</legend>...</fieldset>`
- Legend size variants: `govuk-fieldset__legend--l`, `govuk-fieldset__legend--xl`
- Legend as page heading: wrap `<h1 class="govuk-fieldset__heading">` inside legend
- Use when grouping related form inputs

**4.14 File upload**
- Basic: `<input class="govuk-file-upload" type="file">`
- Enhanced (March 2025): wrap in `<div class="govuk-drop-zone" data-module="govuk-file-upload">`
- Error: `govuk-file-upload--error`
- Specific error messages: no file, wrong type, too large, virus, empty, password protected

**4.15 Footer**
- Container: `<footer class="govuk-footer">`
- Navigation: `govuk-footer__navigation` with `govuk-footer__section`
- Meta: `govuk-footer__meta` with licence logo and copyright
- Two-column lists: `govuk-footer__list--columns-2`
- Links: `govuk-footer__link`
- Crown copyright: `govuk-footer__copyright-logo`

**4.16 Header**
- Container: `<header class="govuk-header">`
- Inner: `govuk-header__container govuk-width-container`
- Logo: `govuk-header__logo` > `govuk-header__homepage-link` > SVG crown logo
- After brand refresh: service name and nav links go in Service Navigation, NOT in header
- Use only for services on gov.uk, service.gov.uk, or blog.gov.uk domains

**4.17 Inset text**
- HTML: `<div class="govuk-inset-text">Content</div>`
- Use for quotes, examples, additional (non-critical) information
- NOT for critical information (use Warning text instead)
- Some users don't notice it on complex pages; use sparingly

**4.18 Notification banner**
- Standard: `<div class="govuk-notification-banner" role="region" aria-labelledby="govuk-notification-banner-title" data-module="govuk-notification-banner">`
- Success variant: add `govuk-notification-banner--success` and change `role="region"` to `role="alert"`
- Heading: `govuk-notification-banner__title`
- Content: `govuk-notification-banner__content` > `govuk-notification-banner__heading`
- Links: `govuk-notification-banner__link`
- Success variant auto-focuses via JS
- NOT for validation errors (use Error Summary)
- Position before page h1

**4.19 Pagination**
- Numbered: `<nav class="govuk-pagination">` > `govuk-pagination__list` with `govuk-pagination__item`
- Current page: `govuk-pagination__item--current`
- Ellipsis: `govuk-pagination__item--ellipsis`
- Block (prev/next only): add `govuk-pagination--block`
- Include SVG arrows in prev/next links
- Show page number in `<title>` tag

**4.20 Panel**
- HTML: `<div class="govuk-panel govuk-panel--confirmation"><h1 class="govuk-panel__title">Application complete</h1><div class="govuk-panel__body">Reference: <strong>HDJ2123F</strong></div></div>`
- Only for confirmation pages (transaction complete)
- Never in body content

**4.21 Password input**
- Wrapper: `<div class="govuk-form-group govuk-password-input" data-module="govuk-password-input">`
- Input: `govuk-input govuk-password-input__input govuk-js-password-input-input` with `type="password"`
- Toggle button: `govuk-button govuk-button--secondary govuk-password-input__toggle govuk-js-password-input-toggle` with `hidden` attribute
- Attributes: `spellcheck="false"`, `autocapitalize="none"`, `autocomplete="current-password"` or `"new-password"`

**4.22 Phase banner**
- HTML: `<div class="govuk-phase-banner"><p class="govuk-phase-banner__content"><strong class="govuk-tag govuk-phase-banner__content__tag">Alpha</strong><span class="govuk-phase-banner__text">This is a new service - your <a class="govuk-link" href="#">feedback</a> will help us improve it.</span></p></div>`
- Place after header/service navigation
- Required until service passes live assessment

**4.23 Radios**
- Fieldset wrapper, legend, `<div class="govuk-radios" data-module="govuk-radios">`
- Items: `govuk-radios__item` > `govuk-radios__input` + `govuk-radios__label`
- Inline: `govuk-radios--inline` (only for 2 short options)
- Small: `govuk-radios--small`
- Divider: `<div class="govuk-radios__divider">or</div>`
- Conditional: `data-aria-controls="conditional-id"`, target `govuk-radios__conditional govuk-radios__conditional--hidden`
- Position radios left of labels

**4.24 Select**
- HTML: `<select class="govuk-select">` with `govuk-form-group` wrapper
- Error: `govuk-select--error`
- Use as LAST RESORT; prefer radios for fewer options
- Does not support `<select multiple>` (poor accessibility)
- Research: users struggle with closing, typing, distinguishing focus vs selected

**4.25 Service navigation**
- Container: `<section class="govuk-service-navigation" data-module="govuk-service-navigation">`
- Service name: `govuk-service-navigation__service-name`
- Nav list: `govuk-service-navigation__list`
- Active item: `govuk-service-navigation__item--active`
- Mobile toggle: `govuk-service-navigation__toggle`
- JS: manages mobile menu toggle, aria-controls

**4.26 Skip link**
- HTML: `<a href="#main-content" class="govuk-skip-link" data-module="govuk-skip-link">Skip to main content</a>`
- Place immediately after `<body>` (or after cookie banner)
- NOT inside `<nav>` or header
- Visually hidden until keyboard focus

**4.27 Summary list**
- Container: `<dl class="govuk-summary-list">`
- Row: `govuk-summary-list__row`
- Key: `<dt class="govuk-summary-list__key">`
- Value: `<dd class="govuk-summary-list__value">`
- Actions: `<dd class="govuk-summary-list__actions">`
- No borders: `govuk-summary-list--no-border`
- Card variant: wrap in `<div class="govuk-summary-card">` with `govuk-summary-card__title-wrapper` and `govuk-summary-card__content`

**4.28 Table**
- HTML: `<table class="govuk-table">` with `<caption class="govuk-table__caption">`, `<thead>`, `<tbody>`
- Headers: `<th class="govuk-table__header" scope="col|row">`
- Cells: `<td class="govuk-table__cell">`
- Numeric: `govuk-table__header--numeric`, `govuk-table__cell--numeric` (right-aligned)
- Caption sizes: `govuk-table__caption--{s|m|l|xl}`
- Small text: `govuk-table--small-text-until-tablet`
- Never use tables for layout; use the grid system
- Width: `govuk-!-width-one-half`, `govuk-!-width-one-quarter` on columns

**4.29 Tabs**
- Container: `<div class="govuk-tabs" data-module="govuk-tabs">`
- Title: `<h2 class="govuk-tabs__title">Contents</h2>`
- Tab list: `<ul class="govuk-tabs__list">` > `<li class="govuk-tabs__list-item">` > `<a class="govuk-tabs__tab" href="#panel-id">`
- Active: `govuk-tabs__list-item--selected`
- Panels: `<div class="govuk-tabs__panel" id="panel-id">`
- Hidden panels: `govuk-tabs__panel--hidden`
- JS required: without JS, displays all content sequentially with table of contents links
- Use when content clearly separates into labelled sections and first section is most important
- Don't use if users need to compare across tabs or read sequentially

**4.30 Tag**
- HTML: `<strong class="govuk-tag">Completed</strong>`
- Colour variants: `govuk-tag--{grey|green|teal|blue|purple|magenta|red|orange|yellow}`
- Use for status information; use adjectives not verbs
- Never make tags interactive (links/buttons)
- Don't rely on colour alone; text must be clear

**4.31 Task list**
- Container: `<ul class="govuk-task-list">`
- Item: `govuk-task-list__item`, with link: `govuk-task-list__item--with-link`
- Name: `govuk-task-list__name-and-hint` > `govuk-task-list__link`
- Status: `govuk-task-list__status`
- Hint: `govuk-task-list__hint`
- Completed = plain text; Incomplete = `govuk-tag govuk-tag--blue`
- Uses `aria-describedby` for status association

**4.32 Text input**
- Wrapper: `govuk-form-group` > `govuk-label` + `<input class="govuk-input">`
- Fixed widths: `govuk-input--width-{2|3|4|5|10|20}`
- Fluid widths: `govuk-!-width-{full|three-quarters|two-thirds|one-half|one-third|one-quarter}`
- Extra letter spacing: `govuk-input--extra-letter-spacing` (for codes)
- Prefix/suffix: `<div class="govuk-input__wrapper">` > `govuk-input__prefix` + input + `govuk-input__suffix`
- Prefix/suffix: `aria-hidden="true"` on decorative elements
- Hints: `govuk-hint` with `aria-describedby`
- Numeric: `inputmode="numeric"` (not `type="number"`)

**4.33 Textarea**
- Wrapper: `govuk-form-group` > `govuk-label` + `<textarea class="govuk-textarea" rows="5">`
- Error: `govuk-textarea--error`, `govuk-form-group--error`
- Hint + error linked via `aria-describedby`

**4.34 Warning text**
- HTML: `<div class="govuk-warning-text"><span class="govuk-warning-text__icon" aria-hidden="true">!</span><strong class="govuk-warning-text__text"><span class="govuk-visually-hidden">Warning</span> You can be fined up to 5,000 if you do not register.</strong></div>`
- Icon hidden from assistive tech; "Warning" announced via visually-hidden text
- Customise hidden text for context

### 5. Patterns (lines ~2500-3200)

Group patterns into three categories as per the Design System:

#### 5.1 Ask users for...
For each, include: purpose, key guidance, which components to use, and HTML approach.

1. **Addresses** — Use multiple text inputs for UK addresses; single textarea for international. Postcode lookup acceptable as enhancement.
2. **Bank details** — Sort code: 3 inputs with `govuk-input--width-2`. Account number: single `govuk-input--width-10`. Use `inputmode="numeric"`.
3. **Dates** — Use Date input component with 3 separate fields (day, month, year). Use `type="text" inputmode="numeric"`. Error: highlight specific fields.
4. **Email addresses** — Single text input, `type="email"`, `autocomplete="email"`, `spellcheck="false"`.
5. **Equality information** — Collect only what's needed. Follow ONS harmonised standards. Allow "Prefer not to say".
6. **Names** — Single field preferred unless service needs structured name. `autocomplete="name"`.
7. **National Insurance numbers** — Single text input, `govuk-input--width-10`, `govuk-input--extra-letter-spacing`. Format: 2 letters, 6 numbers, 1 letter (e.g., QQ 12 34 56 C).
8. **Passwords** — Use Password input component. Min 8 chars for user-set passwords. Show password toggle.
9. **Payment card details** — Card number `govuk-input--width-20`, expiry `govuk-input--width-4` x2, security code `govuk-input--width-4`.
10. **Phone numbers** — Single text input, `type="tel"`, `autocomplete="tel"`. Allow spaces and special chars.

#### 5.2 Help users to...
1. **Check a service is suitable** — Ask filtering questions early to save users time. Use question pages pattern.
2. **Check answers** — Use Summary list component with change links. Present before final submission.
3. **Complete multiple tasks** — Use Task list component. Group related tasks. Show completion status.
4. **Confirm a phone number** — Send security code via SMS. Use text input for code entry.
5. **Confirm an email address** — Send confirmation link or code. Check email exists before sending.
6. **Contact a department** — Provide multiple contact methods. Use Inset text for contact details.
7. **Create a username** — Guidance on username requirements and validation.
8. **Create accounts** — Only if needed. Let users try service before creating account.
9. **Exit a page quickly** — Use Exit this page component. For services where users may be at risk.
10. **Navigate a service** — Use Service navigation. Header-level nav for top-level sections.
11. **Start using a service** — Start page with Start button. Explain what service does, what user needs.
12. **Recover from validation errors** — Error summary at top + inline error messages. Fix one thing at a time.

#### 5.3 Pages
1. **Confirmation pages** — Use Panel component. Show reference number. Explain what happens next.
2. **Cookies page** — Explain cookies used. Provide accept/reject controls. Use Cookie banner for initial prompt.
3. **Page not found (404)** — Clear heading "Page not found". Suggest what to do next. Don't blame user.
4. **Problem with the service (500)** — "Sorry, there is a problem with the service". Suggest trying again later. Provide contact info.
5. **Question pages** — One question per page. Back link + heading + continue button. Legend or label as heading.
6. **Service unavailable** — Clear heading. Explain when service will be available. Provide alternative contact.
7. **Step by step navigation** — Numbered steps with expandable sections. For end-to-end journeys.

### 6. Accessibility Requirements (lines ~3200-3350)
```
## Accessibility
### WCAG 2.2 AA Requirements
### Focus States
### Screen Reader Support
### Keyboard Navigation
### Colour Contrast
```

Content:
- GOV.UK services must meet WCAG 2.2 Level AA
- Focus state: yellow outline (#ffdd00) with dark inner border
- All interactive elements must be keyboard accessible
- Colour contrast minimum 4.5:1 for text, 3:1 for large text and UI components
- Never rely on colour alone to convey information
- `aria-describedby` for linking hints/errors to inputs
- `role="alert"` for dynamic status changes (success banners)
- `role="region"` with `aria-labelledby` for landmark sections
- `scope="col|row"` on table headers
- Visually hidden text (`govuk-visually-hidden`) for screen reader context
- Skip link must be first focusable element

### 7. JavaScript Dependency Map (lines ~3350-3420)
```
## JavaScript Dependency Map
### Components Requiring JavaScript
### Components Working Without JavaScript
### Graceful Degradation
```

Content — components that need JS (via `data-module`):
| Component | `data-module` value | Without JS behaviour |
|---|---|---|
| Accordion | `govuk-accordion` | All sections expanded, headings visible |
| Button | `govuk-button` | Works, but no double-click prevention |
| Character count | `govuk-character-count` | No live count feedback |
| Checkboxes | `govuk-checkboxes` | No conditional reveal |
| Cookie banner | N/A (custom JS) | Banner always shown |
| Error summary | `govuk-error-summary` | No auto-focus |
| Exit this page | `govuk-exit-this-page` | Button link works, no keyboard shortcut |
| File upload | `govuk-file-upload` | Basic file input, no drop zone |
| Notification banner | `govuk-notification-banner` | No auto-focus for success variant |
| Password input | `govuk-password-input` | Password field works, no show/hide toggle |
| Radios | `govuk-radios` | No conditional reveal |
| Service navigation | `govuk-service-navigation` | Mobile menu always visible |
| Skip link | `govuk-skip-link` | Works as normal link |
| Tabs | `govuk-tabs` | All content shown sequentially with TOC |

Components that work fully WITHOUT JavaScript:
- Back link, Breadcrumbs, Date input, Details, Error message, Fieldset, Footer, Header, Inset text, Pagination, Panel, Phase banner, Select, Summary list, Table, Tag, Task list, Text input, Textarea, Warning text

### 8. Our Project: Current Approach & Deviations (lines ~3420-3550)
```
## LGR Rationalisation Engine: Approach & Deviations
### Current Implementation
### Deviation Log
### Migration Path
```

Content:
- Our project uses **Tailwind CSS from CDN** (`https://cdn.tailwindcss.com`) instead of GOV.UK Frontend CSS
- Custom CSS properties approximate GOV.UK colours: `--govuk-black: #0b0c0c`, `--govuk-blue: #1d70b8`, `--govuk-light-grey: #f3f2f1`, `--govuk-red: #d4351c`, `--govuk-green: #00703c`, `--govuk-purple: #53284f`, `--govuk-orange: #f47738`
- Font: Arial (correct for non-service.gov.uk usage)
- Custom component approximations:
  - `.gds-btn` approximates `govuk-button` (green, bottom border shadow, active push)
  - `.gds-btn-secondary` approximates `govuk-button--secondary`
  - `.gds-table` approximates `govuk-table`
  - `.gds-tag` approximates `govuk-tag` with custom colour variants
- Header: black background with blue bottom border matches GOV.UK header pattern
- Modals: `border-t-8 border-[#1d70b8]` panels (not a standard GOV.UK component)
- Stage panels: `border-t-4 border-[#1d70b8]` (approximates GOV.UK panel/card patterns)

Deviation Log template:
```markdown
| # | Component/Pattern | Standard | Our Implementation | Justification |
|---|---|---|---|---|
| 1 | CSS Framework | GOV.UK Frontend | Tailwind CSS CDN | Single-file constraint; no build step |
| 2 | Buttons | `govuk-button` classes | `.gds-btn` custom CSS | Tailwind-compatible; same visual appearance |
| 3 | Tags | `govuk-tag` with modifiers | `.gds-tag` + `.tag-{colour}` | Custom colour scheme for rationalisation patterns |
| 4 | Tables | `govuk-table` | `.gds-table` | Custom styling for analysis matrix |
| 5 | Modals | No standard modal | Custom modal pattern | GDS has no modal component; custom implementation required |
| 6 | Header | `govuk-header` | Custom Tailwind | Matches visual appearance; no crown logo (not a GOV.UK service) |
| 7 | File upload | `govuk-file-upload` | Custom drag-and-drop | Enhanced UX for multi-file upload |
| 8 | Tooltips | No standard tooltip | Custom `.tooltip-wrapper` | GDS doesn't provide tooltips; needed for domain term definitions |
| 9 | Timeline | No standard timeline | Custom `.timeline-*` CSS | Domain-specific visualisation; no GDS equivalent |
| 10 | Signal indicators | No standard equivalent | Custom `.signal-dot-*` | Domain-specific RAG indicators |
```

Migration path notes:
- If migrating to GOV.UK Frontend CSS: replace Tailwind CDN with GOV.UK Frontend CDN link, replace custom classes with `govuk-*` equivalents, keep custom components where no GDS equivalent exists
- For assessment/GDS compliance: document each deviation with justification as shown above

### 9. Community & Contribution (lines ~3550-3600)
```
## Community & Contribution Model
### Design System Working Group
### Contribution Process
### Component Lifecycle
### Channels
```

Content:
- GOV.UK Design System working group reviews and approves components
- Components progress through: proposal -> development with support -> review against contribution criteria -> approval
- Engagement channels: Slack (#govuk-design-system), GitHub discussions, monthly catchup calls, research sessions
- "Always on" continuous research to understand user needs
- Community can propose new components/patterns and upstream existing ones

### 10. Quick Reference Tables (lines ~3600-3700)
```
## Quick Reference
### All CSS Class Prefixes
### BEM Naming Convention
### Common Class Patterns
```

Content:
- All GOV.UK Frontend classes use `govuk-` prefix
- BEM naming: `govuk-{block}__{element}--{modifier}` (e.g., `govuk-button--secondary`)
- Override classes use `govuk-!-` prefix (e.g., `govuk-!-margin-top-5`)
- Form pattern: `govuk-form-group` > `govuk-label` + `govuk-hint` + `govuk-error-message` + input
- Error pattern: `govuk-form-group--error` on wrapper, `govuk-{input-type}--error` on input, `aria-describedby` linking
- Common data attributes: `data-module` (JS init), `data-prevent-double-click`, `data-aria-controls`, `data-behaviour`

## Implementation Notes for Generator

1. **Single file**: Create `GOVUK-DESIGN-SYSTEM-REFERENCE.md` at project root
2. **Markdown format**: Use GitHub-flavoured markdown with fenced code blocks for all HTML examples
3. **Table of contents**: Generate a linked TOC at the top of the document
4. **HTML examples**: Always use complete, copy-pasteable HTML (no Nunjucks, no `{% %}` syntax)
5. **No external fetching**: All content should be embedded in the document; the Generator should use the content specified in this contract rather than re-fetching from the web
6. **Length target**: Approximately 3,500-4,500 lines of markdown
7. **Code blocks**: Use `html` language identifier for HTML examples, `css` for CSS
8. **Cross-references**: Link between sections using markdown anchors (e.g., `[see Buttons](#44-button)`)

## Test Plan

### Evaluator Checks
- **Structure**: Verify all 10 top-level sections exist with correct heading hierarchy
- **Components**: Count component subsections — must be exactly 34
- **Patterns**: Count pattern entries — must be exactly 29 (10 + 12 + 7)
- **Styles**: Verify colour palette, type scale, and spacing tables are complete
- **HTML examples**: Spot-check 10 component HTML examples against the GOV.UK Design System site
- **CSS classes**: Verify key class names (e.g., `govuk-button`, `govuk-table`, `govuk-tag--red`) are correctly documented
- **CDN links**: Verify CDN URLs are functional (fetch test)
- **Deviation log**: Verify our project's deviations are accurately described by comparing against `lgr-rationalisation-engine.html`
- **Markdown validity**: Confirm document renders correctly (no broken links, unclosed code blocks)
- **No Nunjucks**: Search for `{%` or `{{` in code blocks — should find none

### Sample Verification Points
1. Button HTML should include `data-module="govuk-button"`
2. Tag colour variants should list all 9 colours (grey, green, teal, blue, purple, magenta, red, orange, yellow)
3. Type scale should show both large-screen and small-screen values
4. Table component should mention `scope="col"` and `scope="row"`
5. Error pattern should include `govuk-visually-hidden` "Error:" prefix
6. Our deviation log should mention Tailwind CSS as framework

## Risk Notes

1. **CDN version pinning**: The Generator should use a specific version (5.8.0) in CDN URLs, not `@latest`. Version 6.x may have breaking changes.
2. **Brand refresh**: GOV.UK underwent a brand refresh in late 2024/early 2025 that changed some colour values and moved service name out of header into Service Navigation. The document should reflect the current (post-refresh) guidance.
3. **Colour hex values**: The research found slightly different hex values between old and new GOV.UK versions. Use the values from the current Design System site (which may differ from our project's `--govuk-*` custom properties).
4. **Document size**: At ~3,500-4,500 lines, this is a large file. The Generator should work section by section, not attempt to write it all at once.
5. **Font licensing**: GDS Transport font is restricted to service.gov.uk. Our project correctly uses Arial. This must be clearly stated.
6. **Single-file constraint**: This reference document is a `.md` file at project root, separate from the HTML application. It does NOT modify `lgr-rationalisation-engine.html`.
