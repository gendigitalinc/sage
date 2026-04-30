# Branding

Sage supports white-label branding. Brand definitions are bundled inside Sage. AV installers set a `brand_key` in `~/.sage/config.json` to activate a brand.

## Configuration

AV installers add `brand_key` to `~/.sage/config.json`:

```json
{
  "brand_key": "norton"
}
```

If `brand_key` is missing or unknown, Sage falls back to default "Sage" branding.

## Brand registry

Brands are defined in `packages/core/src/brands.ts`:

```typescript
export const BRANDS: Record<string, { name: string; short_name: string }> = {
  norton: { name: "Norton AI Agent Protection", short_name: "Norton" },
};
```

Each brand has two name variants:

| Field | Usage | Example |
|-------|-------|---------|
| `name` | Startup banners, status line, block messages, log messages, tool descriptions | "Norton AI Agent Protection" |
| `short_name` | VS Code/Cursor notification bubbles (max ~50 chars) | "Norton" |

Default (no brand_key): `{ name: "Sage", short_name: "Sage" }`.

### Examples

| config.json | Banner | Status line | Notification |
|---|---|---|---|
| *(no brand_key)* | Sage | Sage: check | Sage blocked: ... |
| `{ "brand_key": "norton" }` | Norton AI Agent Protection | Norton AI Agent Protection: check | Norton blocked: ... |

### Fail-open behavior

If `brand_key` is missing, empty, or doesn't match any entry in the brand registry, all fields fall back to defaults. A warning is logged for unknown keys.

### Lifecycle

- `brand_key` is written by the installer (AV agent) as part of `config.json`.
- Read once at process startup and resolved from the bundled registry.
- Changes require a restart of the host (Claude Code session, OpenClaw gateway, Cursor/VS Code).

## Architecture

### Branding type

```typescript
// packages/core/src/types.ts
export interface Branding {
  name: string;
  short_name: string;
  brand_key?: string;
}
```

### Resolution

```typescript
// packages/core/src/brands.ts
export const defaultBranding: Branding;
export function resolveBranding(brandKey?: string, logger?: Logger): Branding;
```

Pure lookup — no file I/O. Callers load config first, then call `resolveBranding(config.brand_key)`.

### Data flow

```
Connector startup
  └─ loadConfig() or loadConfigSync()
       └─ resolveBranding(config.brand_key)
            └─ cached for session
                 ├─ passed to format functions (formatBlockReason, formatStatusLine, etc.)
                 ├─ passed to scan handler (runPluginScan, createScanHandler)
                 ├─ used in connector-specific messages (toasts, notifications, tool descriptions)
                 └─ brand_key → setContext for command palette filtering (extension only)
```

## How to add a brand

1. Add an entry to `BRANDS` in `packages/core/src/brands.ts`
2. Add an entry to `packages/extension/branded-commands.json`:
   ```json
   { "id": "newbrand", "category": "NewBrand AI Agent Protection" }
   ```
3. Run `node packages/extension/scripts/generate-brand-commands.mjs`
4. Commit all changes
5. Installer sets `"brand_key": "newbrand"` in `config.json`

## How to remove a brand

1. Remove the entry from `BRANDS` in `packages/core/src/brands.ts`
2. Remove the entry from `packages/extension/branded-commands.json`
3. Run `node packages/extension/scripts/generate-brand-commands.mjs`
4. Commit all changes

## How to add a new command

1. Add an entry to the `commands` array in `packages/extension/branded-commands.json`:
   ```json
   { "id": "newCommand", "title": "New command title" }
   ```
2. Register the handler in `packages/extension/src/shared_extension.ts` using `registerForAllVariants("sage.newCommand", handler)`
3. Run `node packages/extension/scripts/generate-brand-commands.mjs`
4. Commit `branded-commands.json`, `package.json`, and the TypeScript change

## Scope

### Branded at runtime

| Location | Uses `name` | Uses `short_name` |
|----------|:-----------:|:------------------:|
| `packages/core/src/format.ts` | ✓ | |
| `packages/core/src/statusline.ts` | ✓ | |
| `packages/core/src/guard.ts` | ✓ | |
| `packages/core/src/scan-handler.ts` | ✓ | |
| `packages/claude-code/src/format.ts` | ✓ | |
| `packages/claude-code/src/pre-tool-use.ts` | ✓ | |
| `packages/claude-code/src/session-start.ts` | ✓ | |
| `packages/claude-code/src/sage-statusline.ts` | ✓ | |
| `packages/openclaw/src/index.ts` | ✓ | |
| `packages/opencode/src/index.ts` | ✓ | |
| `packages/mcp/src/tools/false-positive.ts` | ✓ | |
| `packages/extension/src/shared_extension.ts` | | ✓ |
| `packages/extension/src/vscode_hook_installer.ts` | | ✓ |

### Extension command palette

Brand variants are generated at build time from `packages/extension/branded-commands.json` by `scripts/generate-brand-commands.mjs`. The script patches `package.json` with branded command entries, menu visibility `when` clauses, and activation events.

### Not branded

| Item | Reason |
|------|--------|
| Extension `displayName` in `package.json` | No runtime API to change — baked at install time. |
| Plugin manifests (`openclaw.plugin.json`, `.claude-plugin/plugin.json`) | Build-time concern |
| AMSI C#/PowerShell strings | Internal identifiers |
| `SKILL.md` files | Static assets, host-controlled loading |
| `formatMigrationNotice()`, `formatUpdateNotice()` | Reference specific GitHub URL |
| Icons and visual assets | Text-only branding for now |

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| `resolveBranding()` tests | Known key, unknown key, undefined key, logger warning | Verify correct resolution and fail-open |
| Parameterized format tests | `formatStartupClean`, `formatStatusLine`, `formatDenyMessage` with custom branding | Verify `name` appears in output, "Sage" does not |
| Extension integration tests | `sage.brandKey` context variable filtering | Set context variable, verify command variants |
