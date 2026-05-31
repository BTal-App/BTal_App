import { useEffect, useState } from 'react';
import './AiCountdown.css';

interface Props {
  // ms epoch del momento de desbloqueo.
  unlocksAt: number;
  // Se llama una vez cuando la cuenta atrás llega a 0 · el caller refresca
  // su estado para pasar el chip de "bloqueado" a "LISTA" sin esperar al
  // tick lento de la página.
  onExpire?: () => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Cuenta atrás EN VIVO (tick de 1 s) hasta `unlocksAt`, en formato
// d/h/m/s con la unidad pegada al número. Componente aislado: solo él se
// re-renderiza cada segundo (NO la HoyPage entera). Los segundos llevan
// una micro-animación "pop" en cada cambio (key que fuerza el re-montaje).
export function AiCountdown({ unlocksAt, onExpire }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = unlocksAt - now;
  const expired = diff <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
  }, [expired, onExpire]);

  if (expired) return null;

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  // Mostramos desde la primera unidad no nula · las de la derecha se padean
  // a 2 dígitos para que el ancho no salte (efecto contador estable).
  const hasD = days > 0;
  const hasH = hasD || hours > 0;
  const hasM = hasH || mins > 0;

  return (
    <span className="ai-countdown">
      {hasD && (
        <span className="ai-countdown-seg">
          {days}<span className="ai-countdown-unit">d</span>
        </span>
      )}
      {hasH && (
        <span className="ai-countdown-seg">
          {hasD ? pad2(hours) : hours}<span className="ai-countdown-unit">h</span>
        </span>
      )}
      {hasM && (
        <span className="ai-countdown-seg">
          {hasH ? pad2(mins) : mins}<span className="ai-countdown-unit">m</span>
        </span>
      )}
      {/* key={secs} re-monta el segmento cada segundo → re-dispara el pop */}
      <span key={secs} className="ai-countdown-seg ai-countdown-seg--sec">
        {hasM ? pad2(secs) : secs}<span className="ai-countdown-unit">s</span>
      </span>
    </span>
  );
}
