# Unified User Schema Documentation

## Problem Statement
User management is currently fragmented across multiple modules:
- **Admin Settings** (`/admin/users`) - Basic user creation with minimal fields
- **Commission Settings** (`/settings` Sales Team tab) - Commission-specific fields
- **Organization Settings** (`/settings` Organization tab) - Org hierarchy fields
- **Copper Sync** - Copper CRM integration fields
- **Commission Calculator** - Uses `isCommissioned`, `salesPerson`, `isActive`

This fragmentation causes:
- Duplicate user editing interfaces
- Inconsistent field usage across modules
- Confusion about which fields are authoritative
- Risk of data conflicts

## Solution: Single Source of Truth

**All modules must use the `users` collection in Firestore as the single source of truth.**

## Unified User Schema

```typescript
interface User {
  // === CORE IDENTITY (Required) ===
  id: string;                    // Firebase Auth UID
  email: string;                 // User email (unique)
  name: string;                  // Full name
  
  // === AUTHENTICATION ===
  role: 'admin' | 'sales' | 'manager';  // System role
  passwordChanged: boolean;      // Has user changed initial password?
  photoUrl: string | null;       // Profile photo URL
  createdAt: Date;              // Account creation timestamp
  updatedAt: Date;              // Last update timestamp
  
  // === COMMISSION FIELDS ===
  isCommissioned: boolean;       // Eligible for commissions?
  isActive: boolean;             // Currently active rep?
  salesPerson: string;           // Fishbowl username (e.g., "BenW", "JaredM")
  title: string;                 // Job title (e.g., "Account Executive")
  startDate: string;             // Start date (ISO format)
  notes: string;                 // Admin notes
  
  // === ORGANIZATIONAL HIERARCHY ===
  orgRole: 'executive' | 'director' | 'regional' | 'division' | 'territory' | 'rep';
  region: string;                // Region assignment (e.g., "West", "Central")
  regionalTerritory: string;     // Regional territory (e.g., "Pacific Northwest")
  division: string;              // Division (e.g., "Boise")
  territory: string;             // Territory number (e.g., "01")
  
  // === COPPER CRM INTEGRATION ===
  copperUserId: number;          // Copper CRM user ID
  copperUserEmail: string;       // Email used in Copper CRM
  
  // === OPTIONAL FIELDS ===
  disabled: boolean;             // Account disabled flag
  firstName: string;             // First name (for mapping)
}
```

## Field Usage by Module

### Admin User Management (`/admin/users`)
**Creates:** `id`, `email`, `name`, `role`, `photoUrl`, `passwordChanged`, `createdAt`, `updatedAt`
**Edits:** `name`, `role`

### Commission Settings - Sales Team (`/settings` Sales Team tab)
**Creates/Edits:** `name`, `email`, `title`, `salesPerson`, `startDate`, `active` (maps to `isActive`), `isCommissioned`, `notes`, `updatedAt`

### Commission Settings - Organization (`/settings` Organization tab)
**Creates/Edits:** `name`, `email`, `role`, `orgRole`, `title`, `salesPerson`, `region`, `regionalTerritory`, `division`, `territory`, `isActive`, `isCommissioned`, `updatedAt`

### Commission Calculator
**Reads:** `isCommissioned`, `isActive`, `salesPerson`, `name`, `title`

### Copper Sync
**Reads/Writes:** `copperUserId`, `copperUserEmail`, `salesPerson`, `name`, `email`, `region`, `title`

## Migration Plan

### Phase 1: Standardize Field Names ✅
- Ensure all modules use `isActive` (not `active`)
- Ensure all modules use `salesPerson` consistently
- Ensure all modules use `isCommissioned` consistently

### Phase 2: Consolidate User Editing
- Remove duplicate `handleSaveReps` function from `settings/page.tsx`
- Use `SalesTeamTab` component as primary sales team editor
- Use `UserModal` component as primary organization editor
- Ensure both components write to same `users` collection with all fields

### Phase 3: Update Admin User Creation
- Add commission fields to `/admin/users` creation
- Add organization fields to `/admin/users` creation
- Make admin interface comprehensive for all user fields

### Phase 4: Update All Read Operations
- Commission calculator: ✅ Already uses correct fields
- Copper sync: ✅ Already uses correct fields
- Customer management: Verify uses `salesPerson` correctly
- Reports: Verify uses `isCommissioned` and `isActive` correctly

## Current Issues Found

1. **Duplicate Save Handlers**: `settings/page.tsx` has unused `handleSaveReps` function (lines 1328-1375)
2. **Field Name Inconsistency**: Some places use `active`, others use `isActive`
3. **Incomplete Admin Creation**: `/admin/users` only creates basic fields, missing commission/org fields
4. **Multiple Edit Interfaces**: Users can be edited in 3 different places with different field sets

## Action Items

1. ✅ Fix Fishbowl import to use `salesPerson` correctly
2. Remove duplicate `handleSaveReps` from `settings/page.tsx`
3. Ensure `SalesTeamTab` saves all required fields
4. Ensure `UserModal` saves all required fields
5. Update admin user creation to include all fields
6. Add validation to prevent field conflicts
7. Document which interface should be used for what purpose
