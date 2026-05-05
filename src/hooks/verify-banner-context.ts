import { createContext } from 'react';

export interface VerifyBannerState {
  // El usuario ha cerrado el banner — se persiste en localStorage por uid.
  dismissed: boolean;
  // En esta sesión ya se ha enviado el email de verificación con éxito.
  // No se persiste; al recargar arrancamos en false (el user puede reenviar).
  sent: boolean;

  dismiss: () => void;
  markSent: () => void;
  // Reset cuando el email queda verificado o el user cambia.
  reset: () => void;
}

export const VerifyBannerContext = createContext<VerifyBannerState | null>(null);
