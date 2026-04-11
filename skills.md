---
name: antigravity-ide
description: Standard instructions for antigravity IDE projects - Next.js app with ONNX ML model for drug-drug interaction checking. Use for any task related to this clinic-ddi project.
version: "1.0"
author: antigravity
license: MIT
compatibility:
  - OpenCode
  - Claude Code
  - Cursor
  - VS Code
allowed-tools: Bash Read Write Edit Glob Grep
---

# Antigravity IDE Standard

Use these instructions for any task related to antigravity IDE projects.

## Project Conventions

- **Framework**: Next.js 15+ (App Router)
- **Package Manager**: pnpm
- **Styling**: Inline React styles or CSS modules (no Tailwind unless specified)
- **Language**: TypeScript

## Standard Commands

```bash
pnpm dev      # Start dev server
pnpm build    # Build for production
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

## Common Patterns

- Always use `workdir` parameter instead of `cd` in bash commands
- For Windows, use PowerShell syntax
- Read files before editing
- Check package.json for available scripts

## File Organization

```
/app          # Next.js pages and API routes
/public       # Static assets (models, tokenizers)
/components  # Reusable React components
/lib          # Utility functions
```

## Important Notes

- This is an offline-first ML application
- Model runs in browser via WebAssembly
- No data is ever transmitted to external servers
