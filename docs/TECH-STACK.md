# Tech Stack

Two stacks: the **current prototype** (what's in this repo) and the **production target** (what will be built once the backend is ready).

---

## Current — Prototype (v0.2)

A deliberately minimal stack so the prototype runs anywhere with zero setup.

| Layer | Tech | Why |
|---|---|---|
| Markup | HTML5 | Direct, no framework |
| Styling | CSS3 (vanilla) | Form-style layout, flat aesthetic, no preprocessor |
| Logic | Vanilla JavaScript (ES2017+) | No build step, no `node_modules`, no transpiler |
| State | Plain JS object | Right-size for a single-page prototype |
| Rich text | `contenteditable` + `document.execCommand` | Built into the browser; matches the legacy app's behavior |
| Data | Embedded `mock-data.js` (synthetic) | Avoids `fetch()` CORS issues on `file://` |
| Run | Open `index.html` in browser | No server, no build, no install |

**What it intentionally does NOT have:**
- No framework (React/Vue/Angular)
- No bundler (Vite/Webpack)
- No package manager (npm/yarn)
- No build step
- No real network calls

This is a **visual + interaction reference**, not a production codebase.

### Browser features used

| Feature | Used for |
|---|---|
| `contenteditable` | Rich text fields |
| `document.execCommand` | Bold/italic/list/link in toolbars |
| `Intl.NumberFormat` (via `toLocaleString`) | Number formatting |
| `localStorage` | _not yet used; could persist drafts_ |

---

## Target — Production (Phase 3 onward)

Microsoft-aligned end-to-end stack chosen for:
- Single language across UI + backend (C#)
- Native integration with corporate Windows / Azure AD
- No JavaScript build toolchain
- Server-side rendering + SignalR for reactivity

### Application

| Layer | Tech | Version | Notes |
|---|---|---|---|
| Runtime | .NET | 8 LTS | Long-term support until Nov 2026 |
| App framework | ASP.NET Core | 8 | Hosts Blazor Server |
| UI framework | Blazor Server | 8 | Component model in C# (.razor) |
| Component library | MudBlazor (primary) or FluentUI Blazor | latest | Material-style or Fluent-style components |
| Rich text | TinyMCE Blazor or Syncfusion Blazor RTE | latest | Replaces `contenteditable` with a managed editor |
| HTML sanitization | `HtmlSanitizer` NuGet | latest | Server-side whitelist of safe tags |
| Auth | Negotiate (Windows Auth) or `Microsoft.Identity.Web` | 2.x | Driven by IT preference |
| Logging | Serilog + Console / File sinks | latest | Per-request correlation IDs |

### Data Access

| Layer | Tech | Notes |
|---|---|---|
| ORM | EF Core 8 | For read models (LINQ over views) |
| Micro-ORM | Dapper | For high-throughput writes and ad-hoc SQL |
| Driver | Microsoft.Data.SqlClient | Modern ADO.NET driver |

### Database

| Layer | Tech | Notes |
|---|---|---|
| Engine | SQL Server | 2022 (or whatever IT provides) |
| Schema | 3 read views + 1 write table | See ARCHITECTURE.md |

### Tooling

| Tool | Use |
|---|---|
| Visual Studio 2022 or VS Code + C# Dev Kit | IDE |
| dotnet CLI | Build, restore, run |
| `dotnet user-secrets` | Local connection string storage (never committed) |
| Git | Version control |

### Deployment

| Layer | Tech | Notes |
|---|---|---|
| Hosting | IIS on Windows Server (intranet) | Kestrel optional |
| Process | In-process (IIS) | Single deployment unit |
| Reverse proxy | IIS or none | Depends on IT's stack |

---

## Why this stack — design constraints addressed

| Constraint | Stack response |
|---|---|
| No `node.js` allowed locally (corporate IT policy) | Blazor Server has zero JavaScript build chain |
| Existing Microsoft shop (SQL Server, AD, Windows servers) | C# / EF Core / Windows Auth all native |
| Internal application, intranet only | SignalR latency acceptable; no public hardening needed |
| Single small team must maintain after handover | One language end-to-end |
| Future migration to a wider BI suite | Keep view names generic, decouple read/write repositories |

---

## What changes between prototype and production

| Aspect | Prototype | Production |
|---|---|---|
| Layout & styling | HTML + CSS | `.razor` components, same look |
| State | Plain JS object | `@code` block, scoped per session |
| Save action | `setTimeout` + `console.log` | Real `MERGE` via EF Core / Dapper |
| Data | Synthetic `mock-data.js` | Live SQL queries |
| Auth | None | Windows Auth or Azure AD |
| Validation | Inline JS | DataAnnotations + custom validators |
| Rich text | `contenteditable` | Managed component (TinyMCE / Syncfusion) |
| Sanitization | None | `HtmlSanitizer` NuGet with whitelist |
| Persistence | None | SQL Server |

The **layout, business logic, and UX flows** are designed once in the prototype and ported as-is to Blazor. The prototype is the spec.
