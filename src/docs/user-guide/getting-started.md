---
title: Getting Started
order: 1
section: user-guide
---

# Getting Started

This guide walks you through the first steps of using the LGR Rationalisation Engine to analyse your combined IT estate during Local Government Reorganisation.

## Prerequisites

Before you begin, you need:

- **A modern web browser** - Chrome, Firefox, Edge, or Safari (latest version recommended)
- **Council IT estate data** - one file per predecessor council describing their systems, functions, and contracts
- **A transition configuration** (optional) - defines your successor authorities and vesting date

No installation is required. The tool runs entirely in your browser with no server, no login, and no data leaving your machine.

## Three ways to get your data in

The engine supports multiple import paths depending on how your councils have documented their estate.

### 1. Direct JSON upload

If your councils have prepared structured JSON files following the engine's schema, drag and drop them onto the upload area or click to browse. You can upload multiple council files at once. If a transition configuration file is included, it is detected and applied automatically.

### 2. Excel or CSV upload

A structured Excel template (.xlsx) is available for download from Stage 1. It provides domain-grouped sheets (Health & Social Care, Environmental Protection, etc.) with pre-populated ESD function references, dropdown validation for enum fields, and guidance text. Councils fill in their systems per domain, and upload the completed workbook directly - the engine converts it to the internal architecture format automatically.

### 3. Import Wizard

The Import Wizard provides a guided multi-step process for councils starting from any format:

1. **Select source** - choose between file upload, clipboard paste, or manual entry
2. **Map columns** - the wizard auto-detects headers and suggests mappings
3. **Assign ESD functions** - token-overlap matching auto-suggests function identifiers from department or service names
4. **Review and confirm** - preview the mapped data before import

> **Note:** You can mix and match import methods. Upload some councils as JSON and use the Import Wizard for others - all data merges into the same workspace.

## Quick start flow

The engine operates as a four-stage pipeline:

1. **Upload** - load one or more council architecture files
2. **Configure transition** - define successor authorities and vesting date (or skip for discovery mode)
3. **Baseline** - the engine reconciles functions against the national ESD taxonomy
4. **Analyse** - view the dashboard with rationalisation patterns, signals, and contract timelines

A typical first session takes 10-15 minutes if your data is already prepared.

## What "good" architecture data looks like

The most useful council submissions include:

- **Every IT system** that delivers a council service function - even small ones
- **ESD function identifiers** for each service function (this enables cross-council reconciliation)
- **Contract dates and notice periods** - without these, the tool cannot surface contract urgency
- **Vendor names** - consistent naming enables vendor density detection across councils
- **User counts** - even approximate figures help identify anchor systems
- **Portability and data partitioning ratings** - these drive the data risk signals

A council file with just system names and vendors is usable but will produce limited analysis. The more fields you populate, the richer the insights.

## Common data preparation tips

| Tip | Why it matters |
|-----|----------------|
| Use consistent vendor names across councils | "System C" and "SystemC Ltd" will be treated as different vendors |
| Include the `lgaFunctionId` for every function | Functions without this identifier are excluded from cross-council analysis |
| Provide contract end dates as year and month | The engine calculates notice triggers from these - missing dates mean missing urgency signals |
| Record user counts consistently | Decide whether you are counting concurrent users, named users, or total licensed users - and use the same measure across all councils |
| Flag shared services explicitly | Use the `sharedWith` field to list other councils sharing each system instance |
| Mark ERP systems | Setting `isERP: true` triggers additional monolithic risk analysis |

## What happens to your data

All processing happens locally in your browser. No data is sent to any server. When you close the browser tab, your session is gone unless you have exported your work (architecture files, transition configuration, or scenario decisions).
