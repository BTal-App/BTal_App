# scripts/

Scripts auxiliares que NO se ejecutan en build/CI/runtime. Cada uno
documenta su propósito y dependencias en su cabecera.

## Inventario

### `cleanup-prelaunch.mjs`

Limpia TODOS los users de Auth + colección `/users` de Firestore antes
del lanzamiento público. **Irreversible** salvo restauración desde backup.

**Cuándo ejecutar**: el día antes del lanzamiento.
**Doc completa**: [`docs/launch-cleanup.md`](../docs/launch-cleanup.md).

**Preparación** (solo la primera vez · NO commiteamos `firebase-admin`
como dependencia regular porque solo lo usa este script y pesa ~50 MB):

```powershell
cd "e:\Descargas\BTAL APP\btal"
npm install --save-dev --no-save firebase-admin
# `--no-save` evita modificar package.json · la dependencia queda en
# node_modules pero no se persiste · si ejecutas `npm ci` luego, se borra
```

**Auth con Google Cloud** (también solo la primera vez):

```powershell
gcloud auth application-default login
# se abre browser · inicias sesión con la cuenta que tiene permisos
# Firebase Admin sobre el proyecto btal-app
```

**Ejecución**:

```powershell
node scripts/cleanup-prelaunch.mjs
```

El script pide confirmación tipeando `BORRAR TODO` antes de actuar.

### `generate-splash.ps1`

Genera los splash screens de la PWA para iOS desde una imagen fuente.
Producido al añadir el Service Worker + iconos PWA en Sprint 1 (12-may).
Ya ejecutado · no es necesario re-correr salvo regenerar splash.
