# Security Specification — Voz & Folha Pre-Rendered Audio Database

## 1. Data Invariants

1. **Master Gate & Ownership**: Every `/prerenderedAudios/{cacheKey}/chunks/{chunkId}` document MUST belong to an existing `/prerenderedAudios/{cacheKey}` parent whose `createdByUid == request.auth.uid`, and `parentCacheKey == cacheKey`.
2. **Verified Identity**: All writes (`create`, `update`, `delete`) require a signed-in user with `request.auth.token.email_verified == true`. `createdByUid` MUST strictly equal `request.auth.uid` on creation and is immutable on update.
3. **Strict Schema & No Shadow Fields**: Every write validates required + allowed keys via `hasAll` and `hasOnly` (and `affectedKeys().hasOnly(...)` on updates). No unknown or privilege fields (e.g. `isAdmin`, `role`, `isVerified`) are accepted.
4. **Terminal State Locking**: Once a `PrerenderedAudio` reaches `status == 'ready'`, non-admin users cannot revert it to `'uploading'` or mutate its audio manifest (`chunkCount`, `fileSizeBytes`, `segments`, `voiceMap`, `storageType`).
5. **Atomicity / Referential Integrity**: Transitioning a chunked `PrerenderedAudio` (`storageType == 'chunks'`) from `'uploading'` to `'ready'` requires `exists(/databases/$(database)/documents/prerenderedAudios/$(cacheKey)/chunks/chunk-000)` to confirm audio binary chunks are present.
6. **Path & Volumetric Hardening**: All path IDs (`cacheKey`, `chunkId`, `adminId`) match `^[a-zA-Z0-9_\\-]+$` and `size() <= 128`. Every string and list has explicit `.size()` bounds. Chunks cap `dataBase64.size() <= 750000` (well below Firestore's 1MB limit).
7. **Zero PII & Secure List Queries**: No email, phone, or address fields are stored. `allow list` evaluates `resource.data.isPublic == true || (request.auth != null && resource.data.createdByUid == request.auth.uid)` with zero `get()`/`exists()` lookups inside `allow list`.
8. **Temporal Integrity**: `createdAt == request.time` on create; `createdAt` is immutable on update and `updatedAt == request.time` on update.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)

1. **Unauthenticated Create**: Anonymous client attempts `create` on `/prerenderedAudios/esopo-cigarra-formiga-mv-aae4b20ec72aa6d1`.
2. **Unverified Email Create (Email Spoofing)**: Signed-in user with `email_verified: false` (even with admin email `diegolindolfo100@gmail.com`) attempts `create` or `delete`.
3. **Identity Spoofing**: Verified user `uid-A` attempts to create a `PrerenderedAudio` with `createdByUid: "uid-B"`.
4. **Shadow Field Injection**: Verified user includes extra ghost field `isAdmin: true` or `isVerified: true` in `PrerenderedAudio` create payload.
5. **ID Poisoning**: Verified user attempts `create` at `/prerenderedAudios/` with a 200-character ID or invalid characters (`../evil$id`).
6. **Oversized String / Resource Poisoning**: Verified user submits `chapterTitle` with 500 characters (> 200) or `dataBase64` with 900,000 characters (> 750,000).
7. **Orphaned Chunk Write**: Verified user attempts to create `/prerenderedAudios/nonexistent-key/chunks/chunk-000` without an existing parent document.
8. **Cross-Owner Chunk Hijack**: Verified user `uid-B` attempts to insert a chunk under `uid-A`'s `/prerenderedAudios/{cacheKey}` document.
9. **Client Timestamp Forgery**: Verified user submits a past/future client timestamp for `createdAt` instead of `serverTimestamp()` (`request.time`).
10. **Terminal State Bypass**: Verified creator attempts to mutate `status: 'ready'` back to `'uploading'` or alter `fileSizeBytes` on an already `'ready'` document.
11. **Value Poisoning on Update**: Verified creator attempts to update whitelisted key `isPublic` to a string `"true"` instead of boolean `true`.
12. **Unauthorized Admin Escalation / Private List Scraping**: Non-admin user attempts to write to `/admins/{uid}` or list private (`isPublic: false`) documents belonging to another user.
