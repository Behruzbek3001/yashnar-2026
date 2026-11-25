# YASHNAR Firestore Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants & Master Source of Truth

1. **Default Deny**: Every unmatched path under `/databases/{database}/documents` is explicitly denied (`allow read, write: if false`).
2. **Verified Identity Gate**: Standard writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin Authority**: Admin privileges are verified strictly via database lookup (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) or bootstrapped verified email (`request.auth.token.email == 'behruzbeknabijonov75@gmail.com' && request.auth.token.email_verified == true`). Client custom claims are never trusted.
4. **PII Split Collection Isolation**: User PII (`email`, `phone`, `fullName`) lives exclusively in `/users/{userId}/private/info` and is readable/writable ONLY by the matching owner (`request.auth.uid == userId`) or a verified admin. Non-PII public display info lives separately in `/users/{userId}/public/profile`.
5. **Relational Sync & Existence**: Every `/wasteReports/{reportId}` creation MUST verify that `/mfys/$(incoming().mfyId)` exists (`exists(...)`) and that `incoming().ownerUid == request.auth.uid`.
6. **Terminal State Locking**: Once a `/wasteReports/{reportId}` reaches `status == 'completed'` or `status == 'cancelled'`, non-admin users cannot perform further updates.
7. **System-Only Fields**: `totalXp` and `currentLevel` in `/users/{userId}/public/profile` and `stockQuantity`/`coinCost` in `/marketRewards/{rewardId}` cannot be forged or modified by regular users.
8. **Temporal & Immutability Integrity**: `createdAt` must equal `request.time` on create and remain immutable (`incoming().createdAt == existing().createdAt`) on update; `updatedAt` must equal `request.time` on every write; `ownerUid`/`uid`/`createdByUid` remain immutable after creation.
9. **Path ID & Size Hardening**: Every single-document path ID (`adminId`, `userId`, `notificationId`, `mfyId`, `reportId`, `factId`, `rewardId`) must pass `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars), and every string field enforces explicit `.size()` upper bounds.
10. **Secure List Queries**: No blanket `allow list: if isSignedIn()` on user-owned or PII collections. Every `allow list` validates `resource.data` directly (e.g., `resource.data.ownerUid == request.auth.uid`, `resource.data.status == 'approved'`, `resource.data.isActive == true`).

## 2. The "Dirty Dozen" Attack Payloads (All Must Return `PERMISSION_DENIED`)

1. **Identity Spoofing on Report Create**: Authenticated user `user-a` attempts to create `/wasteReports/rep-1` with `ownerUid: "user-b"`.
2. **Shadow / Ghost Field Injection**: User attempts to create `/users/user-a/private/info` with an undeclared field `isAdmin: true` or `role: "admin"`.
3. **Unverified Email Bypass**: User with `email_verified: false` (even with bootstrapped admin email) attempts to read `/admins/admin-1` or write `/wasteReports/rep-2`.
4. **PII Blanket Read Breach**: Authenticated `user-b` attempts `get` on `/users/user-a/private/info`.
5. **Orphaned Waste Report**: User attempts to create `/wasteReports/rep-orphan` referencing non-existent `mfyId: "nonexistent-mfy"`.
6. **Path ID Poisoning**: Attacker attempts to create `/wasteReports/<1500-char-invalid-id>` with special characters or length > 128.
7. **Timestamp Forgery**: User attempts to create `/wasteReports/rep-time` with a backdated client `createdAt` (`!= request.time`).
8. **Immutable Field Tampering**: Owner attempts to update `/wasteReports/rep-1` and change `ownerUid` or `createdAt`.
9. **Terminal State Mutation**: Citizen attempts to update `/wasteReports/rep-done` whose existing `status` is `'completed'` back to `'submitted'`.
10. **Value Poisoning / Resource Exhaustion**: User attempts to update `description` on `/wasteReports/rep-1` with a 50KB string (> 1000 chars) or non-string type.
11. **Privilege Escalation on Public Gamification Fields**: Citizen attempts to modify `totalXp: 999999` or `currentLevel: 100` in `/users/user-a/public/profile`.
12. **Unauthorized Admin Catalog Write**: Non-admin citizen attempts to create or modify `/marketRewards/reward-1` or `/ecoFacts/fact-1` or self-register in `/admins/user-a`.
