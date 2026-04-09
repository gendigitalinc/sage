# Branding

Sage supports white-label branding. Product name, banner text, and extension command palette entries are configurable per installation.

Two audiences manage branding:

- **Installer** (antivirus agent) writes `~/.sage/branding.json` at install time — controls what the end user sees.
- **Developers** maintain `packages/extension/branded-commands.json` — controls which brands exist in the extension command palette.

## Configuration — `~/.sage/branding.json`

```json
{
  "product_name": "Norton Sage",
  "banner_text": "Norton Sage by Gen Digital",
  "brand_key": "norton"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `product_name` | string | `"Sage"` | Product name used in status line, notifications, log messages, and block reasons. |
| `banner_text` | string | value of `product_name` | Full text for startup banners and threat headers. The installer provides the composed string, so Sage has no hardcoded locale assumptions (e.g., "by", "par", "von"). |
| `brand_key` | string | *(none)* | Machine-readable brand identifier for extension command palette filtering. Lowercase alphanumeric, hyphens, underscores (e.g., `"norton"`, `"avast"`). Must match an entry in `packages/extension/branded-commands.json`. When absent, extension shows default "Sage" commands. |

**Validation:** `product_name` 1–64 chars, `banner_text` 1–128 chars, `brand_key` 1–32 chars `[a-z0-9_-]`. No control characters. Invalid values fall back to defaults.

### Examples

| branding.json | Banner | Status line | Messages |
|---|---|---|---|
| *(file missing)* | Sage | Sage: ✅ | Sage blocked this action. |
| `{ "product_name": "Norton Sage" }` | Norton Sage | Norton Sage: ✅ | Norton Sage blocked this action. |
| `{ "product_name": "Norton Sage", "banner_text": "Norton Sage by Gen Digital" }` | Norton Sage by Gen Digital | Norton Sage: ✅ | Norton Sage blocked this action. |

### Fail-open behavior

If `branding.json` is missing, unreadable, invalid JSON, or fails schema validation, all fields fall back to defaults. No error is raised.

### Lifecycle

- Written by the installer (antivirus agent), not hand-edited by users.
- **May be written before Sage is installed.** The installer drops `branding.json` as part of the AV agent setup. Sage reads it whenever it starts — the file must be self-contained.
- Read once at process startup and cached for the session.
- Changes require a restart of the host (Claude Code session, OpenClaw gateway, Cursor/VS Code).
- Separate from `config.json` — different lifecycle, different audience.

**No schema version field.** The installer may write `branding.json` before Sage is installed, so the two sides cannot coordinate versions. Forward compatibility is handled by Zod defaults (new fields get defaults, unknown fields are ignored). Backward compatibility is maintained by never removing or renaming fields.

## Architecture

### Schema (Zod)

```typescript
// packages/core/src/types.ts
const brandString = z.string().min(1).max(64).regex(/^[^\p{Cc}]+$/u, "No control characters");

export const BrandingSchema = z.object({
  product_name: brandString.default("Sage"),
  banner_text: z.string().min(1).max(128).regex(/^[^\p{Cc}]+$/u).optional(),
  brand_key: z.string().min(1).max(32).regex(/^[a-z0-9_-]+$/u).optional(),
}).transform(b => ({
  ...b,
  banner_text: b.banner_text ?? b.product_name,
}));
export type Branding = z.output<typeof BrandingSchema>;
```

### Loader

```typescript
// packages/core/src/branding.ts
export const defaultBranding: Branding;
export function loadBranding(logger?, brandingPath?): Promise<Branding>;
export function loadBrandingSync(logger?, brandingPath?): Branding;
```

Mirrors the `loadConfig()` pattern in `config.ts`: read file, parse JSON, validate with Zod, return defaults on any error. The `.transform()` step ensures `banner_text` falls back to `product_name` when absent.

### Field usage

| Field | Used for |
|-------|----------|
| `product_name` | Status line, notifications, log messages, block reasons, tool descriptions |
| `banner_text` | Startup banners, threat headers |
| `brand_key` | Extension command palette filtering via `setContext('sage.brandKey', ...)` |

### Data flow

```
Connector startup
  └─ loadBranding()
       └─ cached for session
            ├─ passed to format functions (formatBlockReason, formatStatusLine, etc.)
            ├─ passed to scan handler (runPluginScan, createScanHandler)
            ├─ used in connector-specific messages (toasts, notifications, tool descriptions)
            └─ brand_key → setContext for command palette filtering (extension only)
```

## How to add a brand

1. Add an entry to `packages/extension/branded-commands.json`:
   ```json
   { "id": "newbrand", "category": "NewBrand Sage" }
   ```
2. Run `node packages/extension/scripts/generate-brand-commands.mjs`
3. Commit `branded-commands.json` + updated `package.json`
4. Installer sets `"brand_key": "newbrand"` in `branding.json`

No TypeScript changes needed.

## How to remove a brand

1. Remove the entry from `packages/extension/branded-commands.json`
2. Run `node packages/extension/scripts/generate-brand-commands.mjs`
3. Commit both files

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

| Location | Examples |
|----------|---------|
| `packages/core/src/format.ts` | Startup banner, threat banner |
| `packages/core/src/statusline.ts` | Status line prefix |
| `packages/core/src/guard.ts` | Block/ask messages, allowlist messages |
| `packages/core/src/scan-handler.ts` | Scan log messages |
| `packages/claude-code/src/format.ts` | Block reason banner |
| `packages/claude-code/src/pre-tool-use.ts` | Permission decision reason |
| `packages/claude-code/src/session-start.ts` | Status line hints, error messages |
| `packages/claude-code/src/sage-statusline.ts` | Fallback status line |
| `packages/openclaw/src/gate-tool.ts` | Tool description, field descriptions |
| `packages/opencode/src/index.ts` | Toast titles |
| `packages/extension/src/shared_extension.ts` | Notification messages |
| `packages/extension/src/vscode_hook_installer.ts` | Status messages |
| `packages/mcp/src/tools/false-positive.ts` | MCP tool titles |

### Extension command palette

Brand variants are generated at build time from `packages/extension/branded-commands.json` by `scripts/generate-brand-commands.mjs`. The script patches `package.json` with branded command entries, menu visibility `when` clauses, and activation events. The extension TypeScript code registers handlers dynamically by reading its own manifest — no brand names are hardcoded in TypeScript.

### Not branded

| Item | Reason |
|------|--------|
| Extension `displayName` in `package.json` | No runtime API to change — baked in at install time. Post-install patching of the manifest is unsupported by VS Code and fragile across extension updates. |
| Plugin manifests (`openclaw.plugin.json`, `.claude-plugin/plugin.json`) | Build-time concern |
| AMSI C#/PowerShell strings (`SageAmsi`, `AmsiInitialize`) | Internal identifiers, no user-facing benefit |
| `SKILL.md` files | Static asset read directly from disk by host platforms (Claude Code). Sage does not control loading, so runtime templating is not possible. The AI paraphrases freely, so "Sage" in prompt context rarely surfaces verbatim to users. |
| `formatMigrationNotice()` | Temporary, references specific GitHub URL |
| `formatUpdateNotice()` | References specific GitHub URL |
| Icons and visual assets | Text-only branding for now. Revisit if white-label partners require icon/logo branding. |

## Relationship to l10n

Branding and l10n are orthogonal:

- **Branding** = *what* the product is called (varies per installation)
- **l10n** = *which language* to speak (varies per user/locale)

The `banner_text` field handles one l10n pain point: the installer provides the fully composed banner string, so Sage never hardcodes locale-sensitive prepositions like "by". When full l10n arrives, branding variables become parameters to the translation system:

```
// en.json
{ "startup_clean": "🛡️ {banner_text} v{version} ✅ No threats found" }

// fr.json
{ "startup_clean": "🛡️ {banner_text} v{version} ✅ Aucune menace détectée" }
```

The branding system stays unchanged. The l10n system layers on top. No redesign needed.

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| **`loadBranding()` unit tests** | Missing file, empty file, invalid JSON, valid partial, valid full, extra unknown fields, exceeds max length, control characters, `banner_text` fallback to `product_name` | Verify fail-open on every error path; verify defaults are correct |
| **Parameterized format tests** | `formatStartupClean`, `formatStatusLine`, `formatDenyMessage` with custom branding | Verify `product_name` and `banner_text` appear in output, "Sage" does not |
| **Extension integration tests** | `sage.brandKey` context variable filtering | Set context variable, verify all command variants are registered |
