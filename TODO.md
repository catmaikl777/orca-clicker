# Orca Clicker Save Bug Fix - TODO

## Approved Plan (User: Y)
**Files:** websocket-server.js, database-adapter.js, client.js  
**Risk:** LOW (logging + await)  
**Goal:** Fix auto/manual saves (coins 278→204 lost)

## Phase 1: Diagnostic Logging + Await ✅
- ✅ websocket-server.js: Await savePlayerToDB() everywhere
- ✅ Add BEFORE/AFTER logs with coins/clan values  
- 🔄 Test: `npm start` → earn coins → check "✅ SUCCESS" log

## Phase 2: Fix SQL + Clan 🔄
- [ ] database-adapter.js: Validate 30 params exist
- [ ] Fix clan: always string ID or null (no objects)
- [ ] Simplify JSON serialization with fallbacks  
- [ ] Test Phase 1 logs first

## Phase 3: Client Debug Button [PENDING]
- [ ] client.js: Add "FORCE SAVE" button + coin display
- [ ] auth-client.js: Log saveGameData payload

## Phase 4: Test Cycle [PENDING]
- [ ] Login whk59d7n8 → earn coins → FORCE SAVE
- [ ] Reload → verify coins persisted in DB
- [ ] Check admin panel: coins match

## Commands to Run
```
npm start
# Test: login → earn → force save → reload → check coins
```

**Next Step:** Phase 1 edits (websocket-server.js)

