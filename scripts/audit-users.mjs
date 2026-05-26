// Diagnostico de discrepancias Auth <-> Firestore /users.
// Lista todos los usuarios Auth + todos los docs Firestore y marca:
//   - HUERFANO: doc Firestore sin Auth user
//   - SIN_DOC: Auth user sin doc Firestore (esperado para anonymous viejos)
//
// Read-only · no borra nada.
//
// Uso: node scripts/audit-users.mjs

import { execSync } from 'child_process';

const PROJECT_ID = 'btal-app';
const TOKEN = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
const H = {
  Authorization: `Bearer ${TOKEN}`,
  'x-goog-user-project': PROJECT_ID,
};

async function call(url) {
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

// ===== Auth =====
const auth = new Map();
let pt;
do {
  const params = new URLSearchParams({ maxResults: '1000' });
  if (pt) params.set('nextPageToken', pt);
  const d = await call(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?${params}`,
  );
  for (const u of d.users || []) {
    auth.set(u.localId, {
      email: u.email || null,
      providers: (u.providerUserInfo || []).map((p) => p.providerId).join(','),
      created: u.createdAt
        ? new Date(parseInt(u.createdAt, 10)).toISOString().slice(0, 10)
        : '?',
    });
  }
  pt = d.nextPageToken;
} while (pt);

// ===== Firestore /users =====
const docs = new Map();
let fpt;
do {
  const params = new URLSearchParams({ pageSize: '300' });
  if (fpt) params.set('pageToken', fpt);
  const d = await call(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?${params}`,
  );
  for (const doc of d.documents || []) {
    const uid = doc.name.split('/').pop();
    docs.set(uid, {
      hasExpiresAt: !!doc.fields?.expiresAt,
      hasProfile: !!doc.fields?.profile,
      created: doc.createTime
        ? doc.createTime.slice(0, 10)
        : '?',
    });
  }
  fpt = d.nextPageToken;
} while (fpt);

console.log(`\nAuth users: ${auth.size}`);
console.log(`Firestore /users docs: ${docs.size}\n`);

console.log('=== Auth users ===');
for (const [uid, i] of auth) {
  const prov = i.providers || '(anonymous)';
  const email = i.email || '(no email)';
  const inDoc = docs.has(uid) ? '' : '  <- SIN_DOC';
  console.log(`  ${uid}  ${i.created}  ${email}  [${prov}]${inDoc}`);
}

console.log('\n=== Firestore /users docs ===');
for (const [uid, i] of docs) {
  const inAuth = auth.has(uid);
  const expires = i.hasExpiresAt ? 'expiresAt=Y' : 'expiresAt=N';
  const profile = i.hasProfile ? 'profile=Y' : 'profile=N';
  const flag = !inAuth ? '  <- HUERFANO (no esta en Auth)' : '';
  console.log(`  ${uid}  ${i.created}  ${expires}  ${profile}${flag}`);
}

const huerfanos = [...docs.keys()].filter((u) => !auth.has(u));
const sinDoc = [...auth.keys()].filter((u) => !docs.has(u));
console.log(`\n=== Resumen ===`);
console.log(`  Huerfanos (doc Firestore sin Auth): ${huerfanos.length}`);
console.log(`  Sin doc (Auth sin Firestore):       ${sinDoc.length}`);
console.log(`  En ambos lados:                     ${auth.size - sinDoc.length}`);
