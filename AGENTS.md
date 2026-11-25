# Lemon Actions — Agent Guidelines & Project Rules

## Component Architecture & SOLID Rules
All Angular components in this repository must comply with the rule defined in [`.agents/rules/component-architecture.md`](./.agents/rules/component-architecture.md):
- **External Templates (`templateUrl`)**: Always use external HTML templates (`templateUrl: './[name].component.html'`). Inline templates (`template: `...``) are strictly prohibited for components with more than 15 lines of markup to prevent `.ts` file bloat.
- **Strict Size Limits**:
  - Component Logic (`.component.ts`): Recommended 50–200 lines, soft limit 250 lines, hard limit 350 lines.
  - Template (`.component.html`): Recommended 30–150 lines, soft limit 200 lines, hard limit 300 lines.
  - If a component approaches these limits, decompose into subcomponents or extract facade services/helpers.
- **SOLID Principles**:
  - **Single Responsibility (S)**: Components are responsible *only* for rendering UI and delegating user events. Business logic, HTTP requests, WebSockets, complex transformations, and sound triggers must reside in dedicated services, stores, helpers, or adapters.
  - **Open/Closed (O)**: Extend via composition, content projection (`<ng-content>`), template refs, and directives rather than piling up boolean flags and massive `@if/else` blocks.
  - **Liskov Substitution (L)**: Consistent component contracts and inputs/outputs.
  - **Interface Segregation (I)**: Pass only required fields or focused ViewModels instead of massive monolithic domain objects.
  - **Dependency Inversion (D)**: Inject dependencies via Angular DI (`inject(...)`), never instantiate services with `new`.
- **Smart vs Presentational (Dumb)**: Separate container/routed orchestrator components from presentational, reusable dumb components.
- **Angular Best Practices**: Use `ChangeDetectionStrategy.OnPush`, signal inputs (`input()`, `input.required()`), signal outputs (`output()`), and modern control flow (`@if`, `@for ... track`, `@switch`).

## Modal Dialogs Rule
All modal dialogs in this repository must comply with the rule defined in [`.agents/rules/modal-interaction.md`](./.agents/rules/modal-interaction.md):
- **Escape Key (`document:keydown.escape`)**: Closes the open modal.
- **Backdrop / Outside Click**: Closes the modal only when both `mousedown` and `click` originated directly on the backdrop (prevents accidental closure when selecting text inside inputs and dragging mouse outside).
- **Close & Cancel**: Explicit close button in the header and cancel button in the footer.
- **State Reset on Close**: Form fields and transient state must be reset cleanly upon closing without saving.
- **Accessibility**: Include `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`.
- **Reusable Directive**: Apply `ModalOverlayDirective` (`appModalOverlay` from `src/app/core/directives/modal-overlay.directive.ts`).

## Bounty Verification & Points Rule
All bounty tasks and economy rewards must comply with [`.agents/rules/bounty-verification.md`](./.agents/rules/bounty-verification.md):
- **No Premature Done / No Premature Points**: Never transition a bounty task to `COMPLETED` / `Done` or award `AP` / `GAP` / `FP` points before verification and acceptance are completed.
- **Verification Gate**: Keep the task `IN_PROGRESS` with a pending verification step until tests, build, and functional/UI checks pass and are accepted.


