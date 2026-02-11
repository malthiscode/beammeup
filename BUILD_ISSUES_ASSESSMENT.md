# Build Issues Assessment

Date: February 11, 2026

## Summary

This document outlines all warnings and errors identified during Docker build process, categorized by severity and breaking potential.

---

## FRONTEND ISSUES

### Security Vulnerabilities (3 total: 2 moderate, 1 high)

#### 1. **axios** - HIGH SEVERITY ⚠️
- **Current version:** 1.7.2
- **Issue:** CVE GHSA-43fc-jf86-j433 - DoS vulnerability via `__proto__` key in mergeConfig
- **Fix:** Update to axios 1.7.8 or later
- **Breaking:** NO (minor version update)
- **Priority:** HIGH

#### 2. **esbuild** - MODERATE SEVERITY
- **Affected versions:** <=0.24.2
- **Issue:** CVE GHSA-67mh-4wv8-2f99 - Development server request interception
- **Root cause:** Transitive dependency via vite
- **Fix:** Requires vite upgrade 5.4.2 → 7.3.1
- **Breaking:** YES (major version)
- **Priority:** MEDIUM (dev dependency only)

#### 3. **vite** - MODERATE SEVERITY
- **Current version:** 5.4.2
- **Issue:** Affected by esbuild vulnerability
- **Fix:** Update to vite 7.3.1
- **Breaking:** YES (major version)
- **Priority:** MEDIUM (affects build process)

### Build Warnings

#### 4. **Dynamic Import Warning** 🔧
- **File:** `/app/src/lib/api.ts`
- **Issue:** Dynamically imported in App.tsx but statically imported in 9 other files
- **Impact:** Module won't be code-split, slightly larger initial bundle
- **Fix:** Remove dynamic import from App.tsx (line 26)
- **Breaking:** NO
- **Priority:** LOW

---

## BACKEND ISSUES

### Security Vulnerabilities (10 total: 6 moderate, 4 high)

#### 1. **fastify** - HIGH SEVERITY ⚠️
- **Current version:** 4.28.1
- **Issues:**
  - CVE GHSA-mrq3-vjjr-p77c - DoS via unbounded memory allocation
  - CVE GHSA-jx2c-rxcm-jvmq - Content-Type header validation bypass
- **Fix:** Update to fastify 5.7.4
- **Breaking:** YES (major version)
- **Priority:** HIGH

#### 2. **@fastify/jwt** - MODERATE SEVERITY
- **Current version:** 7.2.4
- **Issue:** Depends on vulnerable fast-jwt <5.0.6
- **Fix:** Update to @fastify/jwt 10.0.0
- **Breaking:** YES (major version, requires fastify 5.x)
- **Priority:** HIGH

#### 3. **fast-jwt** - MODERATE SEVERITY
- **Current version:** 3.3.3 (transitive dependency)
- **Issue:** CVE GHSA-gm45-q3v2-6cf8 - Improper iss claims validation
- **Root cause:** Dependency of @fastify/jwt
- **Fix:** Upgrading @fastify/jwt will resolve
- **Breaking:** YES (via parent)
- **Priority:** HIGH

#### 4. **tar** - HIGH SEVERITY ⚠️
- **Affected versions:** <=7.5.6
- **Issues:**
  - CVE GHSA-8qq5-rm4j-mr97 - Arbitrary file overwrite
  - CVE GHSA-r6q2-hw4h-h46w - Race condition via Unicode ligatures (macOS)
  - CVE GHSA-34x7-hfp2-rc4v - Hardlink path traversal
- **Root cause:** Transitive via @mapbox/node-pre-gyp (from argon2)
- **Fix:** Update argon2 to version using updated dependencies
- **Breaking:** Depends on argon2 update
- **Priority:** HIGH

#### 5. **@mapbox/node-pre-gyp** - HIGH SEVERITY
- **Affected versions:** <=1.0.11
- **Issue:** Depends on vulnerable tar
- **Root cause:** Transitive via argon2
- **Fix:** Update argon2
- **Breaking:** Depends on argon2 update
- **Priority:** HIGH

#### 6. **vitest** - MODERATE SEVERITY
- **Current version:** 2.1.8
- **Issue:** Affected by vite/esbuild vulnerability chain
- **Fix:** Update to vitest 4.0.18
- **Breaking:** YES (major version, dev dependency only)
- **Priority:** MEDIUM

#### 7. **vite** - MODERATE SEVERITY (dev dependency)
- **Issue:** Same as frontend
- **Fix:** Update via vitest
- **Breaking:** YES
- **Priority:** MEDIUM

### Engine Compatibility Warnings

#### 8. **fast-jwt Engine Mismatch** ⚙️
- **Package:** fast-jwt@3.3.3
- **Required:** Node >=16 <22
- **Current:** Node v22.22.0
- **Impact:** May cause runtime issues
- **Fix:** Update @fastify/jwt (which updates fast-jwt to 5.x supporting Node 22)
- **Breaking:** YES (via parent)
- **Priority:** HIGH

### Deprecated Packages ⏰

All deprecated packages are transitive dependencies:

1. **rimraf@3.0.2** - No longer supported
2. **npmlog@5.0.1** - No longer supported
3. **inflight@1.0.6** - Not supported, memory leaks
4. **tar@6.2.1** - Old version with security issues
5. **glob@7.2.3** - Old version with security issues
6. **gauge@3.0.2** - No longer supported
7. **are-we-there-yet@2.0.0** - No longer supported

**Root cause:** These come from @mapbox/node-pre-gyp (via argon2)
**Fix:** Update argon2 to newer version with updated dependencies
**Priority:** MEDIUM

---

## INFORMATIONAL

### npm Version Notice
- **Current:** npm 10.9.4
- **Available:** npm 11.9.0
- **Action:** None required (informational only)
- **Priority:** LOW

---

## RECOMMENDED ACTION PLAN

### Phase 1: Non-Breaking Fixes (Simple & Safe) ✅

1. **Fix dynamic import warning** - Remove unnecessary dynamic import
2. **Update axios** - Update to latest 1.x (1.7.8+)
3. **Check argon2 version** - May resolve tar/node-pre-gyp issues

### Phase 2: Breaking Changes (Requires Testing) ⚠️

These require major version upgrades and may have breaking changes:

4. **Update fastify ecosystem:**
   - fastify: 4.28.1 → 5.7.4
   - @fastify/jwt: 7.2.4 → 10.0.0
   - This resolves fast-jwt engine compatibility issue

5. **Update build tools (if needed):**
   - vite: 5.4.2 → 7.3.1 (frontend)
   - vitest: 2.1.8 → 4.0.18 (backend dev)

### Breaking Change Impact Assessment

**fastify 4 → 5 Breaking Changes:**
- API changes in request/reply handling
- Some plugin API changes
- TypeScript type changes
- Requires testing all endpoints

**@fastify/jwt 7 → 10 Breaking Changes:**
- Requires fastify 5.x
- JWT API may have changes
- Requires testing authentication flows

**vite 5 → 7 Breaking Changes:**
- Build configuration changes
- Plugin API changes
- May affect frontend build pipeline

**vitest 2 → 4 Breaking Changes:**
- Test API changes
- Configuration changes
- Dev dependency only, lower risk

---

## DECISION REQUIRED

The user requested "simplest changes and least breaking fixes." 

**I recommend:**
1. Implement Phase 1 fixes immediately (non-breaking)
2. Ask user whether to proceed with Phase 2 breaking changes, or defer them

**If deferring Phase 2:**
- High severity vulnerabilities remain
- Production security risk continues
- Engine compatibility warning persists

**If proceeding with Phase 2:**
- Requires comprehensive testing
- May require code changes
- Resolves all security issues
