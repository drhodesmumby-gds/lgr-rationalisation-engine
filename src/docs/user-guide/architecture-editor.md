---
title: Architecture Editor
order: 2
section: user-guide
---

# Architecture Editor

The built-in Architecture Editor lets you inspect, modify, and extend your council's IT estate data without leaving the tool. You can fix errors, add missing systems, assign ESD function identifiers, and model capability dependencies - all before running the analysis.

## Opening the editor

After uploading a council file at Stage 1, click the **Edit Architecture** button on the uploaded file card. This opens the full-screen editor modal for that council.

## Focus mode (three-pane view)

Focus mode provides a detailed editing experience with three connected panes:

| Pane | Purpose |
|------|---------|
| **Left: Item list** | Browse all functions, systems, or edges with search and filtering |
| **Centre: Properties** | Edit all fields for the selected item |
| **Right: Relationships** | View and manage connections (which systems realize which functions, capability dependencies) |

This mode is ideal for detailed work on individual items - correcting vendor names, assigning ESD function IDs, or setting up capability relationships.

## Bulk mode (spreadsheet table)

Bulk mode presents your data as an editable spreadsheet table. Each row is a system or function, with columns for every field. You can:

- **Sort** by any column header (click to toggle ascending/descending)
- **Filter** using the search bar at the top
- **Edit cells inline** by clicking on them
- **Add rows** using the "Add" button at the bottom of the table
- **Delete rows** by selecting them and clicking "Remove"

Bulk mode is efficient for rapid data entry or correcting many records at once - for example, updating vendor names across 20 systems.

## Tabs

The editor organises data across four tabs:

### Council Info

Set the council's name, tier (county/district/borough/unitary), and financial distress status. These metadata fields affect how the system classifies cross-tier collisions and applies risk warnings throughout the analysis.

### Functions

Manage the council's service functions. Each function needs:

- **Label** - the local name (e.g., "Waste Collection")
- **ESD Function ID** - the national taxonomy identifier that enables cross-council matching

> **Note:** Functions without an ESD Function ID are excluded from the analysis matrix and flagged during baselining. Use the auto-suggest feature to find the correct identifier.

### IT Systems

Add, edit, and remove IT systems. Key fields include:

- **System name and vendor** - how the system is known locally
- **Contract details** - expiry year/month and notice period
- **Users and annual cost** - for volume and spend analysis
- **Portability** - High, Medium, or Low (determines data extraction risk)
- **Data partitioning** - Segmented or Monolithic (determines disaggregation complexity)
- **Hosting** - cloud, on-premise, or partner-hosted
- **Support model** - vendor-supported, community-supported, or unsupported
- **Capabilities provided** - tags like payments, forms, SMS (for dependency modelling)

### Edges (Relationships)

Define how systems relate to functions and to each other:

- **REALIZES** - a system delivers a business function (e.g., Liquidlogic realizes Adult Social Care)
- **CONSUMES_CAPABILITY** - a system depends on capabilities provided by another system (e.g., a case management system consumes payments from the ERP)

## Function assignment via ESD taxonomy

When assigning an ESD function ID, the editor provides:

- **Search** - type part of a function name to filter the 176-entry taxonomy
- **Auto-suggest** - token matching against your function's label suggests likely matches
- **Breadcrumb display** - shows where the function sits in the hierarchy (e.g., "Adult Services > Adult Social Care")

Getting the ESD function ID right is the single most important step for data quality. It determines whether your council's Adult Social Care systems appear alongside another council's "ASC" systems in the same matrix row.

## Capability modelling

The capability model tracks dependencies between systems:

### Providing capabilities

On the IT Systems tab, use the **Capabilities** field to tag what a system provides to others. Common capabilities include:

- `payments` - payment processing
- `forms` - online forms and submissions
- `sms` - text messaging
- `email` - email delivery
- `workflow` - process automation
- `identity` - authentication and user management

### Consuming capabilities

On the Edges tab, create a **CONSUMES_CAPABILITY** relationship to declare that one system depends on another's capabilities. For example:

- Source: "Housing Benefits System" (consumer)
- Target: "Oracle ERP" (provider)
- Capabilities: ["payments"]

This tells the engine that decommissioning the Oracle ERP would impact the Housing Benefits System - a "blast radius" dependency that surfaces during simulation.

## Council switcher

When multiple council files are uploaded, use the council switcher dropdown at the top of the editor to move between councils without closing and re-opening the modal. This is useful when checking consistency across councils - for example, verifying that both councils use the same vendor name spelling.

## Completeness indicators

The editor displays completeness indicators showing how many fields are populated across your systems:

- **Green** - all recommended fields populated
- **Amber** - missing some optional but useful fields (e.g., users, cost, portability)
- **Red** - missing required fields (e.g., no ESD function ID on a function, no vendor on a system)

## Error banners

If your data has issues that would prevent analysis (such as a REALIZES edge pointing to a non-existent node, or a system with no vendor), an error banner appears at the top of the editor explaining what needs fixing.

## Exporting edited data

After making changes, click **Save** to update the in-memory architecture. You can also **Export JSON** to download the modified council file for reuse in future sessions or sharing with colleagues.
