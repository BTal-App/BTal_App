# Plan de respuesta a incidentes · BTal

Documento operativo. Si pasa algo, abre este archivo, busca el escenario y ejecuta los pasos. **No** documento aspiracional · si añades algo aquí debe estar **probado** o **verificable en menos de 5 min**.

---

## 0 · Contactos y accesos rápidos

| Recurso | URL / Identidad |
|---|---|
| Firebase Console (proyecto) | https://console.firebase.google.com/project/btal-app |
| Cloud Console (mismo proyecto) | https://console.cloud.google.com/?project=btal-app |
| Hosting Live | https://btal-app.web.app |
| Repo (rama `main` despliega) | https://github.com/BTal-App/BTal_App |
| Owner Firebase | castillosogorbpablo@gmail.com (verificar 2FA en cuenta Google) |
| Email soporte público | soporte@btal.app *(pendiente de configurar · Fase -1)* |
| Identity Platform (MFA, providers) | https://console.cloud.google.com/customer-identity?project=btal-app |
| Firestore (datos) | https://console.firebase.google.com/project/btal-app/firestore |
| Firebase Hosting (deploys) | https://console.firebase.google.com/project/btal-app/hosting |
| Billing (gasto) | https://console.cloud.google.com/billing |

**Pre-requisitos para responder a un incidente:**
- Tener instalado `firebase-tools` (`npm i -g firebase-tools`) y `gcloud` CLI.
- Estar logueado: `firebase login` y `gcloud auth login` con la cuenta owner.
- Acceso al repo con permisos de push a `main`.

---

## 1 · Escenarios

### 1.1 · Cargo de Firebase inesperado (factura disparada)

**Síntomas**: alerta de presupuesto, email de "your usage is unusually high", factura mensual mucho mayor de lo esperado.

**Acción inmediata (orden crítico, NO saltarse pasos):**

1. **Cortar el sangrado**. En Cloud Console → Billing → "Disable billing" sobre el proyecto BTal. Esto **deja la app inaccesible** pero detiene cualquier costo nuevo. Mejor app caída 30 min que +500€/h.
2. **Identificar la fuente**. Console → Billing → "Reports" → filtra últimos 7 días, agrupa por SKU. Mira qué servicio (Firestore reads, Cloud Functions invocations, Cloud Storage egress) está disparado.
3. **Casos típicos**:
   - **Firestore reads**: un bug en la app hace `onSnapshot` en bucle, o una Cloud Function lee la colección entera repetidamente. Revisar logs de Cloud Functions y dashboards de Firestore.
   - **Cloud Functions invocations**: bucle infinito en una función (trigger que se auto-dispara). Pausar la función: `firebase functions:delete <nombre>` o desactivarla en Console.
   - **Egress de Hosting**: alguien está hotlinkeando assets pesados (típicamente splash images) o un script externo bombardea la app. Bloquear con headers de hotlink protection o usar Cloud Armor.
4. **Pedir crédito a Google**. Si el cargo es por un bug demostrable y es la primera vez, abrir ticket en https://support.google.com/cloud/contact/cloud_platform_general_support — Google suele otorgar crédito por errores de buena fe. Tener listo:
   - UID del proyecto: `btal-app`
   - Fecha y hora del spike
   - Causa raíz (commit que lo introdujo, screenshot de logs)
   - Acción correctiva ya aplicada
5. **Cuando se haya parcheado el bug**, reactivar billing y desplegar el fix.

**Prevención (debe estar configurado antes de Fase 6):**
- Alertas de presupuesto a 5€, 20€ y 50€/día en Cloud Console → Billing → Budgets.
- Si una Cloud Function nueva, siempre con `runWith({ maxInstances: 10 })` o similar para evitar runaway scale.

---

### 1.2 · Filtración de datos de usuarios

**Síntomas**: descubrimiento de que datos privados son accesibles sin auth, report externo de bug, dump en pastebin, login con UID ajeno funcionaba.

**Acción inmediata** (orden importa · primero contener, luego notificar):

1. **Contener el vector**. Si el agujero está en `firestore.rules`: editar las rules localmente, dejar la regla afectada como `allow read, write: if false;` y desplegar SOLO las rules: `firebase deploy --only firestore:rules` (despliega en ~30 s, no necesita rebuild de Hosting).
2. **Si el vector NO es Firestore Rules** (ej. API key expuesta, Cloud Function con bug): pasar a maintenance mode (ver §3 · Kill switch).
3. **Auditar el alcance**. Cloud Logging → buscar accesos sospechosos en las últimas 72 h al recurso afectado. Anotar UIDs/IPs.
4. **Snapshot inmediato** de Firestore para forense: Console → Firestore → Import/Export → Export (requiere Blaze). Si Spark, copia manual de los docs afectados.
5. **Notificar a usuarios afectados**. **GDPR art. 33 obliga a notificar a la autoridad supervisora (AEPD en España) en ≤72 h** si hay riesgo para los derechos del afectado. Plantilla mínima:
   - Qué pasó (en lenguaje claro, sin minimizar)
   - Qué datos están involucrados
   - Qué hemos hecho para contenerlo
   - Qué deben hacer ellos (cambiar contraseña, revisar actividad)
   - Cómo nos contactan: soporte@btal.app
6. **Public disclosure**. Una vez contenido, escribir post-mortem público en el repo o blog (cuando exista). La transparencia ahora es preferible al rumor después.

**Endurecer post-incidente:**
- Habilitar App Check (Fase 6) si no estaba.
- Revisar `firestore.rules` con el escenario concreto añadido al banco de tests (Fase 6, Vitest + emulator).
- Rotar API keys públicas si la fuga incluye estructuras que indiquen formato (no son secretas pero conviene).

---

### 1.3 · App caída / inaccesible

**Síntomas**: Hosting devuelve 5xx, la página queda en blanco tras splash, errores masivos en consola del cliente.

**Acción inmediata:**

1. **Rollback de Hosting** al último release que funcionaba:
   ```
   firebase hosting:releases:list
   firebase hosting:rollback
   ```
   El rollback es atómico (<10 s). Esto resuelve cualquier incidente cuya causa sea un deploy reciente.
2. **Si el rollback no soluciona** (causa externa: Firebase down, DNS, Cloudflare): revisar https://status.firebase.google.com y avisar a usuarios vía banner si lo tuviéramos. Por ahora, esperar.
3. **Si el problema es Firestore o Auth caídos**: nada que hacer del lado app · esperar a que Google los restablezca.

**Análisis post-rollback:**
- Revisar el commit que rompió: `git log --since="2 hours ago"`.
- Reproducir local con `npm run build && npx serve dist` antes de re-desplegar.
- Añadir lo aprendido a la lista de smoke tests para CI (Fase 12).

---

### 1.4 · Cuenta admin (owner) comprometida

**Síntomas**: actividad rara en Firebase Console que no recuerdas hacer, email de "new sign-in to your Google account" desconocido, cambios en Console que no hiciste, factura aparece en cuenta de pago distinta.

**Acción inmediata (cuenta Google del owner):**

1. **Cerrar sesión en todas partes**: https://myaccount.google.com/device-activity → "Sign out" en todas las sesiones activas.
2. **Cambiar la contraseña** con una nueva fuerte (gestor de contraseñas).
3. **Activar 2FA si no lo tenías ya** (debería ser obligatorio desde hace tiempo). Authenticator app, no SMS.
4. **Revisar app passwords**: https://myaccount.google.com/apppasswords → revocar cualquiera que no reconozcas.
5. **Recovery options**: confirmar que el email/teléfono de recuperación son tuyos: https://myaccount.google.com/security.

**Acción inmediata (proyecto Firebase):**

1. Console → IAM → revisar `Members` del proyecto · si hay alguien que no debería estar, eliminar.
2. Console → Service Accounts → revisar las cuentas de servicio existentes. Si alguna tiene `Owner` y no es la default, sospechar.
3. **Revisar Firebase Hosting releases** · si hay un deploy reciente que no hiciste, rollback (§1.3).
4. **Revisar Firestore** · diff entre dato esperado y dato actual. Si hay manipulación, restaurar desde backup (cuando exista, Fase 6/Blaze).
5. **Rotar todas las secretas**: API keys de Google APIs (Console → APIs & Services → Credentials → regenerar), Firebase API key (regenerable en Firebase Settings).

---

### 1.5 · Ataque de spam / abuso de signup

**Síntomas**: spike de usuarios anónimos, miles de cuentas creadas en horas, Cloud Functions invocadas con payloads basura, costo subiendo por reads/writes.

**Acción inmediata:**

1. **Desactivar Anonymous Auth temporalmente**: Console → Authentication → Sign-in method → Anonymous → Disable. Esto **rompe el Modo Prueba** pero corta el sangrado de cuentas zombies (el TTL de 3 días ya configurado va limpiando lo creado).
2. **Activar App Check** (si no estaba) · bloquea tráfico que no provenga de la app oficial firmada.
3. **Revisar la TTL policy** sobre `/users/expiresAt` → deberían ir borrándose en ≤72 h.
4. **Si el ataque persiste**: añadir reCAPTCHA Enterprise como gate del signup (Fase 11).

---

## 2 · Severidad / SLA propio

| Nivel | Ejemplo | Tiempo objetivo de respuesta |
|---|---|---|
| **P0** | Filtración de datos · cargo masivo · cuenta admin comprometida | < 1 hora |
| **P1** | App caída para todos los users | < 4 horas |
| **P2** | Feature rota para un % de users · pérdida de datos para 1 user | < 24 horas |
| **P3** | Bug visual · degradación menor | < 1 semana |

**Importante**: BTal no tiene SLA contractual con nadie hoy. Estos tiempos son la barra que se intenta cumplir. Si en algún momento se ofrece suscripción Pro (Fase 7), considerar añadir SLA explícito en términos.

---

## 3 · Kill switch (cómo desactivar la app rápido)

### Opción A · Maintenance mode app-level (recomendado · requiere implementación previa)

**Estado**: ⚠️ NO IMPLEMENTADO TODAVÍA. Es un TODO de la Fase 11. Lo describo aquí para que cuando se implemente, el flujo esté listo.

**Diseño previsto**:
- Documento Firestore `/config/global` con campo `maintenanceMode: boolean`.
- `AuthProvider` lee este doc al arrancar (single read, cacheable).
- Si `true`: la app muestra una pantalla "Estamos haciendo mantenimiento. Vuelve en unos minutos." y bloquea cualquier write.
- Toggle desde Firebase Console editando el doc · efecto instantáneo (todas las app abiertas reciben snapshot).

**Acción para activar (cuando exista)**: Console → Firestore → `/config/global` → editar `maintenanceMode: true` → guardar. App entra en modo solo-lectura inmediatamente.

### Opción B · Disable Auth providers (radical · funciona ya)

Console → Authentication → Sign-in method → Disable todos los providers. Los users con sesión activa siguen pudiendo usar la app cacheada, pero nadie nuevo entra y los reauths fallan. No es elegante; sirve para emergencias mientras se construye la Opción A.

### Opción C · Rollback de Hosting (sirve si el problema es un deploy)

```
firebase hosting:rollback
```

Vuelve a la versión anterior atómica. No bloquea writes pero quita el código nuevo del aire.

### Opción D · Desactivar Cloud Functions (cuando existan, Fase 6)

```
firebase functions:delete <nombre>
```

O Console → Functions → seleccionar → "Disable trigger". Útil si una función concreta es la fuente del incidente.

---

## 4 · Checklist tras cualquier incidente P0/P1

- [ ] Causa raíz identificada y documentada
- [ ] Fix desplegado y verificado en producción
- [ ] Post-mortem escrito en `docs/postmortems/YYYY-MM-DD-<slug>.md` con: timeline, impacto, qué falló, qué hicimos bien, action items
- [ ] Action items añadidos al roadmap con prioridad clara
- [ ] Si hubo notificación legal (GDPR §1.2), copia archivada en `docs/legal/`
- [ ] Si afectó a users, comunicación pública/email enviada
- [ ] Test añadido al banco que cubre el escenario concreto (Vitest o manual con instrucciones)

---

## 5 · Logs y dónde mirar

| Síntoma | Dónde mirar |
|---|---|
| Errores cliente | DevTools Console del user (pedir copia) · Sentry cuando exista (Fase 13) |
| Errores Firestore Rules | Console → Firestore → Rules → "Monitor rules" |
| Errores Cloud Functions | `firebase functions:log` o Console → Functions → Logs |
| Cargas anómalas | Cloud Console → Billing → Reports |
| Acceso sospechoso a Console | Cloud Console → IAM → "Audit Logs" |
| Caídas de Firebase | https://status.firebase.google.com |

---

## 6 · Mantenimiento de este documento

Este documento se actualiza:
- **Tras cada incidente P0/P1**, con lo aprendido.
- **Cuando se añade un nuevo servicio crítico** (Cloud Functions, Stripe, etc.).
- **Cuando cambia el equipo** (hoy solo un owner; si llega cofundador, añadir entradas).

Última actualización: 2026-05-12 · creado como parte del Sprint 1 (item 11-6 del roadmap).
