# Test Scenarios Index

All scenario files share the same 6-column format:
`cycle#, test#, module_name, test_desc, test_step, expected_result`

Cycles: **C1** = smoke, **C2** = full regression, **C3** = edge cases & error states.

---

## By Role

### SYSADMIN
| File | IDs | Cases | C1 | C2 | C3 |
|------|-----|-------|----|----|----|
| `system-admin.csv` | SA-001 – SA-028 | 28 | 6 | 14 | 8 |

### ADMIN (Tenant Administrator)
| File | IDs | Cases | C1 | C2 | C3 |
|------|-----|-------|----|----|----|
| `tenant-admin-operations.csv` | TA-001 – TA-050 | 50 | 13 | 37 | 0 ⚠ |
| `location-management.csv` | LOC-001 – LOC-0xx | ~15 | — | — | — |
| `tax-configuration.csv` | TAX-001 – TAX-0xx | ~12 | — | — | — |
| `product-catalog.csv` | PRD-001 – PRD-0xx | ~25 | — | — | — |
| `supplier-management.csv` | SUP-001 – SUP-0xx | ~18 | — | — | — |
| `purchase-order.csv` | PO-001 – PO-0xx | ~22 | — | — | — |
| `grn.csv` | GRN-001 – GRN-0xx | ~20 | — | — | — |
| `supplier-return.csv` | SR-001 – SR-0xx | ~18 | — | — | — |
| `transfer.csv` | TRF-001 – TRF-0xx | ~15 | — | — | — |
| `inventory-management.csv` | INV-001 – INV-019 | 19 | — | — | — |
| `inventory-consolidated.csv` | CON-001 – CON-015 | 15 | — | — | — |
| `report.csv` | RPT-001 – RPT-016 | 16 | — | — | — |
| `report-extended.csv` | EXT-001 – EXT-020 | 20 | — | — | — |
| `approval-engine.csv` | APR-001 – APR-0xx | ~14 | — | — | — |

> ⚠ `tenant-admin-operations.csv` has zero C3 cases — planned addition in Phase 3 (TA-051 to TA-060).

### MANAGER + CASHIER (End Users)
| File | IDs | Cases | C1 | C2 | C3 |
|------|-----|-------|----|----|----|
| `end-user-operations.csv` | EU-001 – EU-052 | 52 | 5 | 25 | 22 |
| `pos.csv` | POS-001 – POS-026 | 26 | — | — | — |
| `pos-checkout.csv` | CHK-001 – CHK-016 | 16 | — | — | — |
| `pos-shift.csv` | SHF-001 – SHF-019 | 19 | — | — | — |
| `pos-printing.csv` | PRT-001 – PRT-013 | 13 | — | — | — |
| `pos-offline-sync.csv` | SYN-001 – SYN-015 | 15 | — | — | — |

---

## File Relationships

### POS (5 files, all complementary)
```
pos-shift.csv          ← must run first (opens the shift)
├── pos.csv            ← core product/cart/transaction flows
├── pos-checkout.csv   ← payment methods (cash, card, QRIS, split)
├── pos-printing.csv   ← receipt and printer control
└── pos-offline-sync.csv ← offline transactions + IndexedDB sync
```

### Inventory (2 files, different focus)
```
inventory-management.csv    ← operational: stock counts, adjustments, movements, alerts
inventory-consolidated.csv  ← analytics: multi-location aggregation, valuation, drill-down
```

### Reports (2 files, complementary)
```
report.csv          ← core dashboard: KPIs, revenue trends, inventory snapshot
report-extended.csv ← specialized: POS shift summary, tax (PPN), procurement, transfers
```

### Role-based overview files (3 files, hierarchical by role)
```
system-admin.csv           ← SYSADMIN: tenants, modules, global users/roles
tenant-admin-operations.csv ← ADMIN: full tenant setup + all module workflows
end-user-operations.csv    ← MANAGER/CASHIER: POS sales, shifts, reports, RBAC boundaries
```

---

## Recommended Execution Order

When running manually or building Playwright suites, follow this dependency order:

```
1. system-admin.csv          — create tenant + authorize modules first
2. tenant-admin-operations.csv — set up locations, products, suppliers
3. location-management.csv
   tax-configuration.csv
   product-catalog.csv
   supplier-management.csv
4. purchase-order.csv → grn.csv → supplier-return.csv  (serial chain)
5. transfer.csv
   inventory-management.csv
   inventory-consolidated.csv
6. approval-engine.csv
7. report.csv + report-extended.csv  (parallel, needs prior data)
8. pos-shift.csv → pos.csv + pos-checkout.csv + pos-printing.csv + pos-offline-sync.csv
9. end-user-operations.csv
```

---

## Total Coverage

| Role | Files | Cases |
|------|-------|-------|
| SYSADMIN | 1 | 28 |
| ADMIN | 14 | ~264 |
| MANAGER / CASHIER | 6 | ~141 |
| **Total** | **21** | **~433** |

All test IDs are unique across files. No scenario appears in more than one file.
