# Lemon Actions — Gemini & Antigravity Rules

See [AGENTS.md](./AGENTS.md), [`.agents/rules/component-architecture.md`](./.agents/rules/component-architecture.md), and [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md) for full project standards and rules.

### Component Architecture & SOLID Standards
All Angular components must implement:
1. **External Templates**: Always use `templateUrl: './[name].component.html'`. Prohibit inline templates exceeding 15 lines.
2. **Size Limits**: TS logic <= 200–300 lines; HTML template <= 150–250 lines. Decompose early.
3. **SOLID Principles**: Single responsibility (presentation only; extract logic/API/sockets/sound into services/helpers), composition over monolithic flags, narrow interface inputs, DI via `inject()`.
4. **Smart vs Dumb Separation**: Keep container templates lightweight; break down complex views into presentational child components.
5. **Modern Angular**: `ChangeDetectionStrategy.OnPush`, signals (`input()`, `output()`), and modern control flow (`@if`, `@for ... track`).

### Modal Dialogs
All modal dialog components must implement:
1. Outside / Backdrop click dismissal with mousedown origin tracking.
2. Escape key dismissal.
3. Clean state and form reset on dismiss/cancel.
4. Proper accessibility attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
5. The `ModalOverlayDirective` (`appModalOverlay`).

### Bounty Verification & Points
All bounty tasks must follow [`.agents/rules/bounty-verification.md`](./.agents/rules/bounty-verification.md):
- Keep tasks `IN_PROGRESS` and do **not** award `AP`/`GAP`/`FP` points until implementation is verified (tests/build + UI/stand verification or user acceptance).
