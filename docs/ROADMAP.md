# Roadmap

Eight-phase plan. Phases run sequentially with a strict gate: do not enter the next phase without explicit confirmation that the current phase's "definition of done" is met.

| Phase | Goal | Status |
|---|---|:--:|
| 0 | Discovery, data inventory, legacy app field mapping | ✅ Done |
| 1 | Backend data contract (read & write API, auth, schemas) | ◐ In progress |
| 2 | Frontend data model (types, field map, validators, mock layer) | ⏳ |
| 3 | App scaffold (Blazor Server, EF Core, UI library) | ⏳ Blocked on local .NET SDK |
| 4 | UI implementation (this prototype is the visual target) | ⏳ |
| 5 | Real DB integration (read + write, auth, role-based filtering) | ⏳ |
| 6 | Testing & legacy data migration | ⏳ |
| 7 | Internal deployment | ⏳ |

## Gates

- Phase advancement requires a written checklist confirming the previous phase's deliverables, reviewed with the project owner.
- Read paths can proceed in parallel with write paths if the write schema is still being defined.
- Migration of legacy data is a one-time job blocked on the write schema being finalised.
