import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

function readRules(): string {
  if (fs.existsSync(rulesPath)) return fs.readFileSync(rulesPath, 'utf8');
  return fs.readFileSync(draftPath, 'utf8');
}

function readBlueprint(): {
  entities: Record<string, { properties: Record<string, { maxLength?: number; pattern?: string }> }>;
  firestore: Record<string, { schema: { $ref: string } }>;
} {
  return JSON.parse(fs.readFileSync(blueprintPath, 'utf8'));
}

test('Phase 0 / Pillar 0: rules_version 2 and default-deny safety net exist', () => {
  const rules = readRules();
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
});

test('Dirty Dozen #1 & #8: WasteReport enforces ownerUid identity and immutability', () => {
  const rules = readRules();
  assert.match(rules, /incoming\(\)\.ownerUid\s*==\s*request\.auth\.uid/);
  assert.match(rules, /incoming\(\)\.ownerUid\s*==\s*existing\(\)\.ownerUid/);
});

test('Dirty Dozen #2: Strict keys (hasAll + hasOnly) block shadow/ghost fields on all entities', () => {
  const rules = readRules();
  for (const fn of [
    'isValidAdminRecord',
    'isValidUserPublicProfile',
    'isValidUserPrivateProfile',
    'isValidNotification',
    'isValidMfy',
    'isValidWasteReport',
    'isValidEcoFact',
    'isValidMarketReward',
  ]) {
    assert.ok(rules.includes(`function ${fn}(`), `Missing validation blueprint ${fn}`);
  }
  const hasOnlyMatches = rules.match(/\.keys\(\)\.hasOnly\(/g) ?? [];
  assert.ok(hasOnlyMatches.length >= 8, 'Every entity blueprint must enforce keys().hasOnly()');
});

test('Dirty Dozen #3: Email spoofing blocked by email_verified == true check', () => {
  const rules = readRules();
  assert.match(rules, /request\.auth\.token\.email_verified\s*==\s*true/);
  assert.match(rules, /behruzbeknabijonov75@gmail\.com/);
});

test('Dirty Dozen #4: PII Split Collection isolates /users/{userId}/private/info to owner or admin', () => {
  const rules = readRules();
  assert.match(rules, /match\s+\/private\/info\s*\{[\s\S]*allow\s+get:\s*if\s+isSignedIn\(\)\s*&&\s*isValidId\(userId\)\s*&&\s*\(isOwner\(userId\)\s*\|\|\s*isAdmin\(\)\);/);
  assert.match(rules, /match\s+\/private\/info\s*\{[\s\S]*allow\s+list:\s*if\s+false;/);
});

test('Dirty Dozen #5: Orphaned wasteReports prevented via exists(/mfys/...)', () => {
  const rules = readRules();
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/mfys\/\$\(incoming\(\)\.mfyId\)\)/);
});

test('Dirty Dozen #6: Path ID poisoning blocked by isValidId regex and 128-char cap', () => {
  const rules = readRules();
  assert.match(rules, /function\s+isValidId\(id\)\s*\{[\s\S]*id\.size\(\)\s*<=\s*128[\s\S]*id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
});

test('Dirty Dozen #7: Temporal integrity enforces request.time on createdAt and updatedAt', () => {
  const rules = readRules();
  assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
});

test('Dirty Dozen #9: Terminal state lock blocks non-admin updates after completed/cancelled', () => {
  const rules = readRules();
  assert.match(rules, /!\(existing\(\)\.status\s+in\s+\['completed',\s*'cancelled'\]\)/);
});

test('Dirty Dozen #10: Value poisoning blocked by explicit .size() bounds synced with blueprint', () => {
  const rules = readRules();
  const blueprint = readBlueprint();
  assert.equal(blueprint.entities.WasteReport.properties.description.maxLength, 1000);
  assert.match(rules, /data\.description\.size\(\)\s*<=\s*1000/);
  assert.equal(blueprint.entities.EcoFact.properties.content.maxLength, 1500);
  assert.match(rules, /data\.content\.size\(\)\s*<=\s*1500/);
});

test('Dirty Dozen #11 & #12: Gamification fields and admin catalogs protected from non-admin mutation', () => {
  const rules = readRules();
  assert.match(rules, /!\('totalXp'\s+in\s+incoming\(\)\)\s*&&\s*!\('currentLevel'\s+in\s+incoming\(\)\)/);
  assert.match(rules, /match\s+\/marketRewards\/\{rewardId\}[\s\S]*allow\s+create:[\s\S]*isAdmin\(\)/);
  assert.match(rules, /match\s+\/ecoFacts\/\{factId\}[\s\S]*allow\s+create:[\s\S]*isAdmin\(\)/);
  assert.match(rules, /match\s+\/admins\/\{adminId\}[\s\S]*allow\s+create:[\s\S]*isAdmin\(\)/);
});

test('Pillar 8: No blanket allow list: if isSignedIn(); and no get()/exists() inside allow list', () => {
  const rules = readRules();
  assert.doesNotMatch(rules, /allow\s+list:\s*if\s+isSignedIn\(\)\s*;/);
  const listBlocks = rules.match(/allow\s+list:[^;]+;/g) ?? [];
  assert.ok(listBlocks.length > 0);
  for (const block of listBlocks) {
    assert.doesNotMatch(block, /\b(get|exists)\(/, `List rule must not call get()/exists(): ${block}`);
  }
});
