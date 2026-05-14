// Tipos y constantes compartidas para los documentos legales. Se separan
// de LegalPlaceholder.tsx para que la regla `react-refresh/only-export-
// components` no se queje (un fichero con componentes no debe exportar
// también funciones o constantes ajenas al render).

export type LegalSlug = 'privacidad' | 'terminos' | 'aviso-medico';

export const LEGAL_TITLES: Record<string, string> = {
  privacidad: 'Política de privacidad',
  terminos: 'Términos de uso',
  'aviso-medico': 'Aviso médico',
};

export function getLegalTitle(slug: string): string {
  return LEGAL_TITLES[slug] ?? 'Documento legal';
}
