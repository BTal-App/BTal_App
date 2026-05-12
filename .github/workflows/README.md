# GitHub Actions · BTal

Dos workflows configurados en este directorio:

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | PRs contra `main` + pushes a `main` | Lint · Test · Build (sin desplegar) |
| `deploy.yml` | Solo push a `main` | Lint · Test · Build · Deploy a Firebase Hosting |

---

## Setup inicial (acción manual del owner · una sola vez)

### 1.A · Secrets de configuración de la app (VITE_FIREBASE_*)

⚠️ **OBLIGATORIO** o el deploy publicará el bundle con `auth/invalid-api-key` y la app se queda en el splash.

Vite embebe las variables `VITE_*` en el bundle **en tiempo de build**. Tu `.env` local nunca llega a GitHub (está en `.gitignore`), así que hay que recrear cada una como secret:

| Secret name | De dónde sale |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → tu Web App → SDK setup |
| `VITE_FIREBASE_AUTH_DOMAIN` | mismo sitio (suele ser `btal-app.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | mismo sitio (`btal-app`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | mismo sitio |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | mismo sitio |
| `VITE_FIREBASE_APP_ID` | mismo sitio |

**Atajo · copia desde tu `.env` local**:
1. Abre tu `.env` con bloc de notas.
2. Por cada línea `VITE_FIREBASE_<X>=<valor>`:
   - GitHub → Settings → Secrets and variables → Actions → **"New repository secret"**
   - Name: `VITE_FIREBASE_<X>` (exacto, mayúsculas)
   - Value: pega solo el valor (sin el `=` ni comillas)
   - Add secret
3. Repite para las 6 variables.

⚠️ La `VITE_FIREBASE_API_KEY` parece "secret" pero realmente NO lo es · va al bundle público de todas formas y Firebase lo identifica solo como proyecto. La seguridad real depende de `firestore.rules` + App Check (Fase 6). Aún así la guardamos en secrets para no tener el `.env` en el repo.

### 1.B · Secret para el deploy

El workflow `deploy.yml` necesita un secret `FIREBASE_SERVICE_ACCOUNT_BTAL_APP` con el JSON de una service account de Firebase.

**Forma recomendada · automatizada por Firebase CLI:**

```bash
# Desde la raíz del repo, en local, con firebase-tools instalado
firebase init hosting:github
```

El asistente:
- Detecta el repo de GitHub (`BTal-App/BTal_App`)
- Crea una service account en Google Cloud
- Le da el rol `Firebase Hosting Admin`
- Genera el JSON
- Lo sube como secret a GitHub con el nombre adecuado
- Genera plantillas de workflow (ignorar · ya tenemos los nuestros)

**Forma manual** (si la anterior falla):

1. Google Cloud Console → IAM → Service Accounts → "Create service account"
2. Nombre: `github-action-deploy`. Rol: `Firebase Hosting Admin`
3. Una vez creada: → "Keys" → "Add key" → "JSON" → descargar el `.json`
4. GitHub → Settings → Secrets and variables → Actions → "New repository secret"
5. Nombre: `FIREBASE_SERVICE_ACCOUNT_BTAL_APP` · Value: contenido completo del JSON descargado
6. Eliminar el archivo `.json` del disco local · ya no se necesita

### 2 · Branch protection (item 12-5 del roadmap)

Para garantizar que NADA llega a `main` sin CI verde:

GitHub → repo → Settings → Branches → "Add rule" para `main`:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Search for status check: "Lint · Test · Build" (el nombre del job en `ci.yml`)
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

Esto impide pushes directos a `main` y obliga a todo a pasar por PR + CI.

---

## Cómo trabajar con esto día a día

**Flujo normal** (con branch protection activo):

```bash
git checkout -b feat/mi-cambio
# trabajo
git commit -am "feat: lo que sea"
git push -u origin feat/mi-cambio
# Abrir PR en GitHub
# CI corre automático → debe quedar verde
# Merge → deploy.yml se dispara → producción actualizada en 3-5 min
```

**Hotfix urgente** (saltándose el PR, solo si branch protection lo permite):

```bash
git checkout main
git pull
# Hacer el fix
git commit -am "fix: cosa urgente"
git push origin main
# deploy.yml se dispara · lint + test + build siguen siendo los gates
# antes de que el código llegue a producción
```

---

## Si el deploy falla

Mirar:
1. La pestaña "Actions" del repo · ver qué step rompió.
2. Si rompió en `Lint` o `Test`: el código tiene un problema funcional · fix + push.
3. Si rompió en `Build`: probablemente TypeScript o Vite · reproducir local con `npm run build`.
4. Si rompió en `Deploy to Firebase Hosting`: el secret puede haber caducado (las service accounts pueden tener fecha de expiración configurable) o el rol cambiado. Regenerar siguiendo el setup inicial.

Si producción está rota y necesitas vuelta atrás INMEDIATA, ver `docs/incident-response.md` §1.3 (`firebase hosting:rollback`).

---

## Costes

GitHub Actions free tier: **2000 minutos/mes** para repos privados, ilimitado para públicos. BTal usa ~3-5 min por CI run + ~5-7 min por deploy → cabe holgadamente.
