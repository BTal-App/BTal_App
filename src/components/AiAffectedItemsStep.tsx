import { useMemo } from 'react';
import { IonToggle } from '@ionic/react';
import { MealIcon } from './MealIcon';
import {
  affectedStats,
  isProtected,
  type AffectedItem,
  type AffectedSection,
} from '../utils/aiAffectedItems';
import './AiAffectedItemsStep.css';

interface Props {
  // Lista de items que la IA va a tocar — calculada por getAffectedItems.
  items: AffectedItem[];
  // IDs que el user ha marcado para EXCLUIR (proteger de la sobrescritura).
  // Auto-incluye los items con source='user' al inicio cuando
  // allowUserItems=false.
  excludedIds: Set<string>;
  onToggleExclude: (id: string) => void;
  // Toggle "permitir que la IA toque también lo mío" · default OFF.
  // Cuando se activa, los items con source='user' dejan de auto-protegerse
  // (pero el user puede excluirlos manualmente con el checkbox).
  allowUserItems: boolean;
  onToggleAllowUserItems: (next: boolean) => void;
}

const SECTION_LABEL: Record<AffectedSection, string> = {
  menu: 'Menú',
  entrenos: 'Entreno',
  compra: 'Lista de la compra',
};

const SECTION_ICON: Record<AffectedSection, string> = {
  menu: 'tb:tools-kitchen-2',
  entrenos: 'tb:barbell',
  compra: 'tb:shopping-cart',
};

const SOURCE_LABEL: Record<AffectedItem['source'], string> = {
  default: 'Por defecto',
  ai: 'IA anterior',
  user: 'Tuyo',
};

// Paso 2 del wizard de Generar IA · lista de items afectables agrupados
// por sección con checkbox para excluir, badge de origen y stats finales.
export function AiAffectedItemsStep({
  items,
  excludedIds,
  onToggleExclude,
  allowUserItems,
  onToggleAllowUserItems,
}: Props) {
  // Agrupamos por sección · orden estable: menú → entreno → compra
  const grouped = useMemo(() => {
    const out: Record<AffectedSection, AffectedItem[]> = {
      menu: [],
      entrenos: [],
      compra: [],
    };
    for (const it of items) {
      out[it.section].push(it);
    }
    return out;
  }, [items]);

  const stats = affectedStats(items, excludedIds, allowUserItems);
  const userCount = items.filter((it) => it.source === 'user').length;

  // Empty state · si el scope no tiene items que mostrar (caso típico:
  // el user pidió 'entrenos_only' pero declaró 0 días de entreno → no hay
  // plan activo). Mostramos un mensaje claro en vez de cabeceras vacías.
  if (items.length === 0) {
    return (
      <div className="ai-items-step ai-items-empty">
        <MealIcon value="tb:alert-circle" size={18} />
        <p>
          No hay nada que la IA pueda generar con esta combinación. Si elegiste
          "Solo entrenos", revisa que tu perfil tenga al menos 1 día de entreno
          a la semana. Pulsa <strong>Atrás</strong> para cambiar de scope o
          actualiza tu perfil desde Ajustes.
        </p>
      </div>
    );
  }

  return (
    <div className="ai-items-step">
      <p className="settings-modal-text">
        Estos son los <strong>{stats.total}</strong> elementos que la IA puede
        tocar al generar. Marca los que quieras conservar tal cual están — la
        IA <strong>no los modificará</strong>.
      </p>

      {/* Toggle "permitir tocar lo mío" · solo aparece si hay items 'user' */}
      {userCount > 0 && (
        <div className="ai-items-allow-row">
          <div className="ai-items-allow-info">
            <span className="ai-items-allow-title">
              <MealIcon value="tb:lock" size={16} />
              Permitir que la IA modifique mis cambios
            </span>
            <span className="ai-items-allow-sub">
              Por defecto la IA <strong>nunca modifica lo que has creado o
              editado tú</strong>. Activa esta opción si quieres que también
              pueda modificar tus cambios manuales (los marcados como "Tuyo").
            </span>
          </div>
          <IonToggle
            checked={allowUserItems}
            onIonChange={(e) => onToggleAllowUserItems(e.detail.checked)}
            aria-label="Permitir que la IA modifique mis cambios"
          />
        </div>
      )}

      {/* Lista por sección */}
      {(Object.keys(grouped) as AffectedSection[]).map((section) => {
        const sectionItems = grouped[section];
        if (sectionItems.length === 0) return null;
        return (
          <div key={section} className="ai-items-section">
            <div className="ai-items-section-head">
              <MealIcon value={SECTION_ICON[section]} size={18} />
              <span className="ai-items-section-title">
                {SECTION_LABEL[section]}
              </span>
              <span className="ai-items-section-count">
                {sectionItems.length}
              </span>
            </div>
            <div className="ai-items-list">
              {sectionItems.map((item) => {
                const protectedByUser =
                  item.source === 'user' && !allowUserItems;
                const excluded = isProtected(item, excludedIds, allowUserItems);
                return (
                  <label
                    key={item.id}
                    className={
                      'ai-item'
                      + (excluded ? ' protected' : '')
                      + (protectedByUser ? ' auto-protected' : '')
                    }
                  >
                    <input
                      type="checkbox"
                      className="ai-item-checkbox"
                      checked={excluded}
                      disabled={protectedByUser}
                      onChange={() => onToggleExclude(item.id)}
                      aria-label={`Mantener ${item.label}`}
                    />
                    <div className="ai-item-info">
                      <div className="ai-item-label-row">
                        <span className="ai-item-label">{item.label}</span>
                        <span className={'ai-item-source ai-item-source--' + item.source}>
                          {SOURCE_LABEL[item.source]}
                        </span>
                      </div>
                      {item.sublabel && (
                        <span className="ai-item-sublabel">{item.sublabel}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Stats finales · siempre visibles */}
      <div className="ai-items-stats">
        <div className="ai-items-stat ai-items-stat--overwrite">
          <MealIcon value="tb:alert-circle" size={18} />
          <div>
            <span className="ai-items-stat-num">{stats.willOverwrite}</span>
            <span className="ai-items-stat-label">se reemplazarán</span>
          </div>
        </div>
        <div className="ai-items-stat ai-items-stat--keep">
          <MealIcon value="tb:lock" size={18} />
          <div>
            <span className="ai-items-stat-num">{stats.willKeep}</span>
            <span className="ai-items-stat-label">se mantendrán</span>
          </div>
        </div>
      </div>
    </div>
  );
}
