# Limpieza pre-lanzamiento · checklist

Procedimiento para vaciar la base de datos de **todos los usuarios y datos
de testing** antes del lanzamiento público de BTal. **Irreversible** salvo
restauración desde backup (que existe gracias a la configuración del
14-may · 7 días de retención + PITR de 7 días).

> **Cuándo ejecutar**: el día antes del lanzamiento, o como muy tarde
> la madrugada del día D. Tras la limpieza, el primer usuario real
> que se registre será el #1 oficial.

> **Cuándo NO ejecutar**: durante desarrollo (necesitas datos de testing).

---

## 1 · Pre-cleanup checklist

Antes de tocar nada:

- [ ] Confirmar que estás en el proyecto correcto:
  ```powershell
  gcloud config get-value project
  # debe decir: btal-app
  firebase use --add
  # seleccionar btal-app
  ```

- [ ] Verificar que tienes un backup **manual** reciente (no fiarse del backup automático):
  - Firebase Console > Firestore > "Recuperación ante desastres" > "Ver copias de seguridad"
  - Crear uno **on-demand** ahora mismo · te dará una copia con timestamp pre-limpieza
  - Alternativamente vía CLI:
    ```powershell
    gcloud firestore export gs://btal-app-backups/pre-launch-cleanup-$(Get-Date -Format yyyyMMdd-HHmm) --project=btal-app
    ```
    (requiere bucket de Cloud Storage · si no existe, crearlo previamente)

- [ ] Exportar lista de users por si quieres referencia:
  ```powershell
  firebase auth:export users-pre-cleanup-$(Get-Date -Format yyyyMMdd).json --project btal-app
  ```

- [ ] Anotar el contador actual de users:
  ```powershell
  # Cuenta Firestore:
  gcloud firestore documents list users --project=btal-app | Measure-Object -Line
  # Cuenta Auth:
  # No hay comando directo CLI · contar líneas del export del paso anterior
  ```

- [ ] Confirmar que NO hay un user real ya (no eres el #1 que se ha registrado por error):
  - Firebase Console > Authentication > Users · revisar que todos los emails son de testing tuyo

---

## 2 · Ejecución de la limpieza

### Opción A · Script automático (recomendado)

```powershell
cd "e:\Descargas\BTAL APP\btal"
node scripts/cleanup-prelaunch.mjs
```

El script:
1. Pide confirmación tipeando `BORRAR TODO` (case-sensitive)
2. Lista cuántos users y docs hay
3. Borra `/users` collection completa de Firestore (incluyendo subcolecciones `/registros`)
4. Borra todos los usuarios de Firebase Auth en bulk (max 1000/batch · iterando)
5. Verifica que ambos contadores son 0
6. Imprime resumen final

### Opción B · Manual paso a paso

**Si prefieres no usar el script** (o quieres revisar cada paso):

1. **Wipe Firestore `/users` collection completa**:
   ```powershell
   firebase firestore:delete users --recursive --force --project btal-app
   ```
   ⚠ Esto borra **todo** dentro de `/users/{uid}/...` incluyendo `/registros`. Tarda varios minutos según volumen.

2. **Bulk delete Auth users**:
   - Firebase CLI **NO** tiene comando bulk-delete-by-query
   - Pero `firebase auth:export` + script de iteración funciona:
     ```powershell
     firebase auth:export users.json --project btal-app
     $users = Get-Content users.json | ConvertFrom-Json
     foreach ($u in $users.users) {
       firebase auth:delete $u.localId --project btal-app
     }
     ```
   - **Alternativa más rápida**: usar el script Node.js (Opción A) que usa Admin SDK con `deleteUsers([uid1, uid2, ...])` por lotes de 1000.

---

## 3 · Verificación post-cleanup

- [ ] Firestore vacío:
  ```powershell
  firebase firestore:get users --project btal-app
  # debe devolver: No documents found
  ```
  o desde Firebase Console > Firestore Database > colección `users` debe estar vacía.

- [ ] Auth vacío:
  - Firebase Console > Authentication > Users · listado vacío

- [ ] **Test smoke**: registrar una cuenta de prueba (puedes borrarla después) para confirmar que el flujo signup → onboarding → AppShell funciona desde cero:
  ```
  btal-app.web.app → "Crear cuenta nueva" → email+password → onboarding 5 pasos → /app/hoy
  ```

- [ ] Si tras el smoke test quieres dejarlo realmente vacío, repite la limpieza solo para ese user de test:
  ```powershell
  firebase auth:delete <UID-del-test> --project btal-app
  firebase firestore:delete users/<UID-del-test> --recursive --project btal-app
  ```

---

## 4 · Post-cleanup · acciones administrativas

- [ ] **Reset budget alerts**: actualmente está a 5€/mes para pre-launch. Tras tener users reales considerar:
  - Subir a 15-25€/mes si esperas tráfico moderado
  - Mantener 5€/mes con alertas tempranas (si pasa, hay un problema)

- [ ] **TTL policy**: ya configurada (14-may). NO tocar.

- [ ] **Backups + PITR**: ya configurados (14-may). NO tocar.

- [ ] **App Check**: si para entonces el 401 sigue, considerar:
  - Pasar a Monitor mode con tráfico real para ver datos
  - Si Monitor enseña tokens válidos en >95% del tráfico legítimo, activar Enforce

- [ ] **Custom domain**: si lo has comprado, configurarlo en Firebase Hosting antes del lanzamiento. Actualizar dominios en reCAPTCHA Admin (añadir el nuevo · mantener `btal-app.web.app` como fallback).

- [ ] **Final analytics**: si hay Plausible o GA4 configurado (Fase 13), resetear o crear nuevo segmento "Post-launch".

---

## 5 · Rollback plan

Si tras limpiar te das cuenta de que necesitas datos previos:

1. **Restaurar Firestore desde backup**:
   - Firebase Console > Firestore > Recuperación ante desastres > Ver copias de seguridad
   - Seleccionar el backup pre-cleanup que creaste en el paso 1
   - "Restaurar a base de datos nueva" → crea `(default)-restored-YYYYMMDD`
   - Luego promover esta base nueva si quieres reemplazar la actual (manual desde Console)

2. **Restaurar Auth users**:
   - El backup de Auth NO es automático · si guardaste el JSON del export en el paso 1:
     ```powershell
     firebase auth:import users-pre-cleanup-YYYYMMDD.json --project btal-app
     ```

3. **PITR** (Point-In-Time Recovery): para granularidad de minuto en lugar de día. Solo Firestore, no Auth. Útil si la limpieza fue parcial y quieres recuperar exactamente el estado de hace 5 minutos.

---

## Gotchas conocidos

- **TTL no afecta a limpieza manual**: los users anónimos con `expiresAt` en el pasado se borran automáticamente vía TTL · si haces la limpieza manual al mismo tiempo, no choca, todo termina en `0`.

- **Auth users sin doc Firestore**: tras la limpieza, los users existentes en Auth (si quedaron algunos por error) sin doc en Firestore son "zombi". La Cloud Function `onAuthDelete` (cuando llegue en Fase 6) los limpia. Mientras tanto, conviene cleanup completo.

- **Cuenta del owner**: SI tu cuenta de testing principal está en Auth, decidir si:
  - Mantenerla: úsala como cuenta admin después (recomendado · acceso fácil)
  - Borrarla: serás el user #1 cuando vuelvas a registrarte tras launch

- **Firebase Auth tiene rate limit en bulk deletes**: ~1000 operaciones/minuto. Si tienes >5K users (no será el caso) el script lo gestiona con sleep entre batches.

- **Backups consume espacio Firestore**: tras la limpieza el storage de prod bajará pero los backups conservan el volumen anterior · paga storage de backups durante los 7 días de retención (no es problema · son céntimos).
