// Entry point de las Cloud Functions de BTal.
//
// Inicializa firebase-admin UNA VEZ (las funciones llaman a
// getFirestore()/getAuth() dentro de sus handlers, que corren después
// de este initializeApp en el cold start). Luego re-exporta cada función
// para que Firebase las descubra por nombre.

import { initializeApp } from 'firebase-admin/app';

initializeApp();

// Fase 6A · generación de planes con Gemini.
export { generatePlan } from './generatePlan.js';

// Borrado RGPD completo de cuenta (doc + subcolecciones + Auth user).
export { deleteAccount } from './deleteAccount.js';

// Fase 6C · limpieza en cascada de invitados expirados (TTL deja huérfanos).
export { cleanupExpiredGuests } from './cleanupGuests.js';
