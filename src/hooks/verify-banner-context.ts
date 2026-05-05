import { createContext } from 'react';

export interface VerifyBannerState {
  // En esta sesión ya se ha enviado el email de verificación con éxito.
  // Compartido entre Dashboard y Settings (no se persiste — al recargar
  // arrancamos en false y el usuario puede reenviar).
  sent: boolean;

  markSent: () => void;
  // Reset cuando el email queda verificado o el user cambia.
  reset: () => void;
}

export const VerifyBannerContext = createContext<VerifyBannerState | null>(null);
