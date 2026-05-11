import { IonContent, IonModal, IonSpinner } from '@ionic/react';
import { MealIcon } from './MealIcon';
import './GeneratingScreen.css';

interface Props {
  isOpen: boolean;
  // Mensaje principal · varía según contexto:
  //   - Onboarding: "Estamos generando tu plan inicial…"
  //   - Botón IA tab: "Estamos generando tu menú…" / "tu plan de entreno…"
  title?: string;
  // Sub-mensaje opcional (línea más pequeña debajo).
  subtitle?: string;
}

// Pantalla a tamaño completo con spinner + mensaje · se muestra mientras
// la generación con IA está en curso. Bloquea la interacción del user
// (no se puede cerrar arrastrando ni con backdrop) para evitar que
// dispare otra generación duplicada antes de que la primera termine.
//
// Apariencia: backdrop opaco oscuro, card central con icono ✨ animado,
// spinner debajo, título + subtítulo informativo, una pista pequeña al
// final ("La IA puede tardar unos segundos").
//
// Reusable desde:
//   - AiGenerateModal (botones Generar IA de Hoy/Menú/Entreno)
//   - Onboarding (al finalizar con modo='ai')
//   - Cualquier futuro disparador de generación
export function GeneratingScreen({
  isOpen,
  title = 'Generando con IA',
  subtitle = 'Estamos creando tu plan personalizado. No cierres la app — esto puede tardar unos segundos.',
}: Props) {
  return (
    <IonModal
      isOpen={isOpen}
      backdropDismiss={false}
      keyboardClose={false}
      className="generating-screen"
    >
      <IonContent>
        <div className="generating-screen-content">
          <div className="generating-screen-icon">
            <MealIcon value="tb:sparkles" size={32} />
          </div>
          <IonSpinner name="crescent" className="generating-screen-spinner" />
          <h2 className="generating-screen-title">{title}</h2>
          <p className="generating-screen-subtitle">{subtitle}</p>
          <div className="generating-screen-tip">
            <MealIcon value="tb:sparkles" size={14} className="generating-screen-tip-icon" />
            Procesando tu perfil · alergias, objetivos y preferencias
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
