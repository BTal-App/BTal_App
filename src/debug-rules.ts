// Helper temporal para probar firestore.rules desde DevTools.
//
// Carga: SOLO si la URL incluye `?debug-rules=1` o `&debug-rules=1`.
// El import dinámico desde main.tsx mantiene esto fuera del bundle
// principal de producción (chunk separado · solo descargado si pides).
//
// Uso:
//   1. Abrir https://btal-app.web.app/?debug-rules=1
//   2. Login con tu cuenta
//   3. DevTools > Console > `await window.__btalTestRules()`
//
// Hace 4 tests del estado de firestore.rules:
//   T1 · Lectura de otro user (debe BLOQUEAR)
//   T2 · Escribir plan_pro = true (debe BLOQUEAR)
//   T3 · Cambiar plan.tipo a 'pro' (debe BLOQUEAR)
//   T4 · Update legítimo `lastActive` (debe PASAR)
//
// Resultado verde: T1, T2, T3 bloqueados + T4 pasa = rules OK.
//
// Quitar este módulo después de verificar (no es necesario en prod).

import { app, auth } from './services/firebase';

declare global {
  interface Window {
    __btalTestRules?: () => Promise<void>;
  }
}

if (typeof window !== 'undefined') {
  window.__btalTestRules = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.log('[BTal] Login primero antes de testar rules');
      return;
    }

    const mod = await import('firebase/firestore');
    const db = mod.getFirestore(app);

    console.log('\n=== Test firestore.rules · uid:', uid, '===\n');

    // T1 · leer doc de otro user
    // Probamos contra el otro UID conocido del audit (cuentas reales).
    const knownUids = [
      'JdrAKs0cx2SX6kkU36Ksltp6NZt2',
      'bAzN1TygYNMoQxoQjmbAZFglG5g1',
      'a23DRLuNgiUsMnYzO2h5X4nCR983',
      'enAURsF398bRr7rMcPZdDOasoA73',
    ];
    const otherUid = knownUids.find((u) => u !== uid) ?? 'fake-uid-no-existe';
    try {
      await mod.getDoc(mod.doc(db, 'users', otherUid));
      console.log('❌ T1 FAIL · pudo leer doc ajeno (' + otherUid + ')');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      console.log('✅ T1 cross-user BLOQUEADO · ' + code);
    }

    // T2 · escribir plan_pro = true en tu propio doc
    try {
      await mod.updateDoc(mod.doc(db, 'users', uid), { plan_pro: true });
      console.log('❌ T2 FAIL · pudo escribir plan_pro=true');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      console.log('✅ T2 plan_pro BLOQUEADO · ' + code);
    }

    // T3 · cambiar plan.tipo a 'pro' en tu propio doc
    try {
      await mod.updateDoc(mod.doc(db, 'users', uid), {
        plan: { tipo: 'pro', vence_en: null, one_off_consumido: false },
      });
      console.log('❌ T3 FAIL · pudo cambiar plan.tipo a pro');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      console.log('✅ T3 plan.tipo BLOQUEADO · ' + code);
    }

    // T4 · update legítimo (lastActive)
    try {
      await mod.updateDoc(mod.doc(db, 'users', uid), { lastActive: Date.now() });
      console.log('✅ T4 lastActive legítimo PASÓ');
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'unknown';
      console.log('❌ T4 ROTO · update legítimo bloqueado: ' + code);
    }

    console.log('\n=== Fin tests ===\n');
  };

  console.log(
    '[BTal] debug-rules helper cargado · ejecuta',
    'await window.__btalTestRules()',
  );
}
