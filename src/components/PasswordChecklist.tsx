import { MealIcon } from './MealIcon';
import { PWD_RULES } from '../utils/passwordRules';
import './PasswordChecklist.css';

// Checklist en vivo de los requisitos de la contraseña nueva.
// Cada regla: ROJO (circle-x) por defecto / sin cumplir, y pasa a
// VERDE (circle-check) en cuanto `value` la cumple, con transición de
// color. Reutilizable en todos los formularios de contraseña nueva.
//
// `value` = la contraseña que se está escribiendo (campo principal,
// no el de confirmar).
export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="pwd-checklist">
      {PWD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.label} className={ok ? 'is-ok' : 'is-pending'}>
            <MealIcon
              value={ok ? 'tb:circle-check' : 'tb:circle-x'}
              size={15}
            />
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
