// Datos de contacto y URLs públicas de BTal centralizados.
//
// Cuando se complete Fase 14 (custom domain + SMTP):
//   - CONTACT_EMAIL ya apunta a `soporte@btal.app` · solo hay que registrar
//     el dominio `btal.app` y configurar el SMTP (Brevo/Mailgun/SendGrid).
//   - PUBLIC_HOSTNAME / PUBLIC_URL apuntan hoy al hosting de Firebase
//     (`btal-app.web.app`). Si se mueve a dominio propio, cambiar SOLO aquí
//     y todas las referencias del proyecto (documentos legales, banner
//     anti-adblock, mailto subjects de Settings) se actualizan a la vez.
//
// Usado por:
//   - `pages/LegalPlaceholder.tsx` (7 mailto + 1 URL)
//   - `pages/Settings.tsx` (1 mailto en feedback subject)
//   - `hooks/AdblockBanner.tsx` (1 URL para instrucciones whitelist)

export const CONTACT_EMAIL = 'soporte@btal.app';

// Hostname sin protocolo · para mostrar en texto ("btal-app.web.app").
export const PUBLIC_HOSTNAME = 'btal-app.web.app';

// URL completa · para href de anchors. Si añades subpath en el futuro
// (ej. /landing) hazlo aquí, no en consumidores.
export const PUBLIC_URL = `https://${PUBLIC_HOSTNAME}`;
