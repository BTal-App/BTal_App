// App Check debug token flag (DEV ONLY) — SIDE EFFECT MODULE.
//
// Este módulo NO exporta nada · solo tiene side-effect de setear la global
// `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` que Firebase SDK lee al
// inicializar AppCheck.
//
// CRÍTICO: debe importarse PRIMERO en main.tsx, ANTES que cualquier otro
// import que termine cargando `services/firebase.ts` (que es donde se
// inicializa AppCheck). ES modules hoistan los imports al top, pero
// ejecutan en orden de aparición · si este import aparece primero, su
// side-effect corre antes que firebase.ts.
//
// Cuando AppCheck arranca con la global=true, en lugar de pedir token
// real a reCAPTCHA v3 imprime un debug token aleatorio en la consola del
// browser. Para que ese token sea aceptado por Firebase backend:
//   1. Abre la app en dev → F12 → consola → busca línea con "App Check
//      debug token: <UUID>"
//   2. Firebase Console > App Check > Apps > tu web app > ⋮ > "Manage
//      debug tokens" > Add debug token
//   3. Pega el UUID + nombre descriptivo (ej. "laptop Pablo")
//   4. Las requests desde tu dev (con la global=true) pasan App Check
//      como si fueran reales
//
// En producción este archivo se sigue ejecutando pero el bloque `if`
// es falso · no setea nada · App Check usa el site key real.

if (import.meta.env.DEV) {
  // self funciona tanto en main thread como en service workers · más
  // portable que window. El cast es necesario porque la global es ad-hoc
  // de Firebase, no está en el tipo Window de TypeScript.
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
