import { useContext } from 'react';
import { VerifyBannerContext, type VerifyBannerState } from './verify-banner-context';

export function useVerifyBanner(): VerifyBannerState {
  const ctx = useContext(VerifyBannerContext);
  if (!ctx) throw new Error('useVerifyBanner must be used within <VerifyBannerProvider>');
  return ctx;
}
