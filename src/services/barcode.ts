// Escáner de código de barras (Fase 6B-B.2) · solo en app NATIVA (Capacitor).
// En web no está disponible (el botón se oculta). Usa el plugin ML Kit con
// import dinámico para no cargarlo en el bundle web.

import { Capacitor } from '@capacitor/core';

// ¿Se puede escanear? Solo en plataforma nativa.
export function barcodeAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

type BarcodeError = 'denied' | 'unavailable' | 'cancelled' | 'failed';

// Abre el escáner y devuelve el código (EAN/UPC) o null si no se leyó nada.
// Lanza un Error con `.code: BarcodeError` en fallos esperables (permiso, etc.).
export async function scanBarcode(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    throw Object.assign(new Error('unavailable'), { code: 'unavailable' as BarcodeError });
  }
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

  // Permiso de cámara.
  const perm = await BarcodeScanner.requestPermissions();
  if (perm.camera !== 'granted' && perm.camera !== 'limited') {
    throw Object.assign(new Error('denied'), { code: 'denied' as BarcodeError });
  }

  // Android · asegura el módulo del Google code scanner (puede no estar la 1ª vez).
  if (Capacitor.getPlatform() === 'android') {
    try {
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
    } catch {
      // Si la comprobación/instalación falla, intentamos escanear igualmente.
    }
  }

  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.UpcA,
        BarcodeFormat.UpcE,
      ],
    });
    return barcodes[0]?.rawValue ?? null;
  } catch (e) {
    // El usuario canceló o el escáner falló.
    const msg = String((e as Error)?.message ?? '');
    if (/cancel/i.test(msg)) {
      throw Object.assign(new Error('cancelled'), { code: 'cancelled' as BarcodeError });
    }
    throw Object.assign(new Error('failed'), { code: 'failed' as BarcodeError });
  }
}
