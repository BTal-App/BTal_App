import { useHistory, useParams } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { MealIcon } from '../components/MealIcon';
import './LegalPlaceholder.css';

// Documentos legales de BTal · servidos en `/legal/:slug`. Texto en
// español, redactado para usuarios reales no abogados, alineado con
// GDPR (Reglamento UE 2016/679) y la LOPDGDD española.
//
// Edición: el texto vive aquí en JSX. Cuando cambies algo material
// (no una errata), actualiza la `LEGAL_VERSION` correspondiente y
// notifica a los users existentes por email antes de que entre en
// vigor (el roadmap llamaría a esto en la Fase 6 con Cloud Functions).

const LEGAL_VERSION = {
  privacidad: '2026-05-12',
  terminos: '2026-05-12',
  'aviso-medico': '2026-05-12',
} as const;

const TITLES: Record<string, string> = {
  privacidad: 'Política de privacidad',
  terminos: 'Términos de uso',
  'aviso-medico': 'Aviso médico',
};

// ─────────────────────────────────────────────────────────────────
// Política de privacidad (14-0)

function PrivacyPolicy() {
  return (
    <>
      <p className="legal-version">Última actualización: {LEGAL_VERSION.privacidad}</p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        El responsable del tratamiento de tus datos personales es <strong>Pablo Castillo Sogorb</strong>,
        persona física con residencia en España. Para cualquier cuestión relacionada con esta política,
        puedes contactarnos en <a href="mailto:soporte@btal.app">soporte@btal.app</a>.
      </p>

      <h2>2. Qué datos recopilamos</h2>
      <p>
        Cuando creas una cuenta o usas BTal, almacenamos en nuestros servidores
        (Google Firebase, infraestructura en la Unión Europea) los siguientes datos:
      </p>
      <ul>
        <li><strong>Identificación</strong>: email, contraseña (hash, nunca en claro), nombre que elijas y, opcionalmente, foto de perfil.</li>
        <li><strong>Perfil físico</strong>: edad, peso, altura, sexo biológico, nivel de actividad, objetivo, días de entreno, equipamiento, intolerancias/alergias alimentarias y preferencias (proporcionado voluntariamente).</li>
        <li><strong>Datos generados por tu uso</strong>: menús, planes de entreno, lista de la compra, suplementación, registros de ejercicios (peso, repeticiones, fecha).</li>
        <li><strong>Preferencias técnicas</strong>: sistema de unidades, inicio de semana, modo de generación (IA o manual), estilo de la barra de navegación.</li>
        <li><strong>Datos técnicos</strong>: identificador interno (UID), fecha de creación, fecha de última actividad.</li>
      </ul>
      <p>
        <strong>NO recopilamos</strong>: geolocalización, contactos, micrófono, cámara,
        ni hacemos seguimiento entre apps de terceros.
      </p>

      <h2>3. Por qué los recopilamos (bases legales)</h2>
      <ul>
        <li><strong>Ejecución del contrato</strong>: necesitamos tu email y datos de perfil para prestarte el servicio que has aceptado.</li>
        <li><strong>Tu consentimiento</strong>: datos opcionales (foto de perfil, intolerancias, restricciones) se piden con consentimiento explícito y puedes retirarlo cuando quieras.</li>
        <li><strong>Obligación legal</strong>: conservación de registros de transacciones cuando se active la suscripción de pago, por motivos fiscales y antifraude.</li>
      </ul>

      <h2>4. Con quién compartimos tus datos</h2>
      <p>
        Tus datos se almacenan exclusivamente en infraestructura de <strong>Google Firebase</strong>
        (Authentication y Firestore), bajo las cláusulas de protección de datos de la UE.
      </p>
      <p>
        <strong>NO vendemos ni cedemos tus datos a terceros</strong> para marketing, publicidad ni análisis externos.
      </p>
      <p>
        Si en el futuro integramos servicios adicionales (por ejemplo Stripe para procesar pagos, Sentry para
        captura de errores, Google Gemini para generación con IA), te lo notificaremos por email y se actualizará
        esta política antes de la activación. Cualquier dato enviado a esos servicios viajará cifrado y solo con
        el mínimo necesario para la función concreta.
      </p>

      <h2>5. Cuánto tiempo los conservamos</h2>
      <ul>
        <li>Tus datos se conservan mientras tu cuenta esté activa.</li>
        <li>Si cancelas la cuenta, todos tus datos se borran de forma <strong>inmediata e irreversible</strong> de nuestros servidores (botón "Eliminar mi cuenta" en <em>Ajustes → Administrar cuenta</em>).</li>
        <li>Las cuentas en modo prueba (invitado anónimo) se borran automáticamente a los <strong>3 días</strong> desde su creación si no las vinculas a un email real.</li>
        <li>Los backups internos de Google pueden conservar copias durante un máximo de <strong>30 días</strong> tras la eliminación, tras lo cual se purgan definitivamente.</li>
      </ul>

      <h2>6. Tus derechos (GDPR)</h2>
      <p>Sobre tus datos personales tienes los siguientes derechos:</p>
      <ul>
        <li><strong>Acceso</strong>: solicitar copia de los datos que tenemos sobre ti.</li>
        <li><strong>Portabilidad</strong>: descargar tus datos en formato legible. Disponible ya desde <em>Ajustes → Datos → Descargar mis datos</em> (formato JSON).</li>
        <li><strong>Rectificación</strong>: corregir datos inexactos. Editable desde <em>Ajustes → Editar perfil</em>.</li>
        <li><strong>Supresión</strong>: borrar tu cuenta y todos los datos asociados.</li>
        <li><strong>Oposición y limitación</strong>: oponerte al tratamiento concreto o pedir que se limite a ciertos usos.</li>
        <li><strong>Reclamación ante autoridad</strong>: si crees que no estamos respetando tus derechos, puedes reclamar ante la <strong>AEPD</strong> (Agencia Española de Protección de Datos), <a href="https://www.aepd.es" target="_blank" rel="noreferrer">aepd.es</a>.</li>
      </ul>
      <p>Para ejercer cualquiera de estos derechos, escríbenos a <a href="mailto:soporte@btal.app">soporte@btal.app</a>.</p>

      <h2>7. Edad mínima</h2>
      <p>
        BTal está disponible para mayores de <strong>16 años</strong>. Si tienes menos, no puedes crear cuenta ni usar la app.
        Si descubrimos que un usuario menor de 16 años ha creado cuenta, la eliminaremos.
      </p>

      <h2>8. Cookies y almacenamiento local</h2>
      <p>
        BTal <strong>NO usa cookies de seguimiento</strong> publicitario ni de terceros. Solo usamos
        almacenamiento local del navegador (localStorage e IndexedDB) para:
      </p>
      <ul>
        <li>Mantener tu sesión iniciada (para no pedirte login en cada visita).</li>
        <li>Guardar tus preferencias (unidades, inicio de semana, estilo de barra de navegación).</li>
        <li>Recordar avisos que ya cerraste.</li>
      </ul>
      <p>Si limpias el almacenamiento del navegador, tendrás que volver a iniciar sesión.</p>

      <h2>9. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS),
        reglas de acceso estrictas en la base de datos (cada usuario solo puede leer/escribir sus propios datos),
        hash seguro de contraseñas (gestionado por Firebase Authentication; nunca tenemos acceso a tu contraseña en claro),
        cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options, Permissions-Policy).
      </p>
      <p>
        Si descubres una vulnerabilidad de seguridad, escríbenos a <a href="mailto:soporte@btal.app">soporte@btal.app</a> antes
        de divulgarla públicamente. Agradeceremos la comunicación responsable.
      </p>

      <h2>10. Cambios en esta política</h2>
      <p>
        Si cambiamos algo material te avisaremos por email y dentro de la app antes de que entre en vigor.
        La fecha de última actualización está indicada al inicio del documento ({LEGAL_VERSION.privacidad}).
      </p>

      <h2>11. Ley aplicable</h2>
      <p>
        Esta política se rige por la legislación española y la normativa europea de protección de datos
        (GDPR, Reglamento UE 2016/679, y LOPDGDD 3/2018). Cualquier disputa se someterá a los tribunales
        del lugar de residencia del responsable.
      </p>

      <h2>12. Contacto</h2>
      <p>
        Cualquier pregunta o solicitud sobre tus datos, escríbenos a <a href="mailto:soporte@btal.app">soporte@btal.app</a>.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Términos de uso (14-1)

function TermsOfService() {
  return (
    <>
      <p className="legal-version">Última actualización: {LEGAL_VERSION.terminos}</p>

      <h2>1. Qué es BTal</h2>
      <p>
        BTal es una aplicación web y móvil que te ayuda a organizar tu plan de nutrición, entrenamientos,
        suplementación y lista de la compra. Está disponible como aplicación web (PWA) en{' '}
        <a href="https://btal-app.web.app" target="_blank" rel="noreferrer">btal-app.web.app</a> y, próximamente,
        como aplicación nativa para iOS y Android.
      </p>

      <h2>2. Aceptación de los términos</h2>
      <p>
        Al crear una cuenta, iniciar el modo prueba o utilizar BTal de cualquier otra forma, aceptas estos
        términos y la <a href="/legal/privacidad">política de privacidad</a>. Si no estás de acuerdo, no uses la app.
      </p>

      <h2>3. Edad mínima</h2>
      <p>
        Tienes que tener al menos <strong>16 años</strong> para usar BTal. Si eres menor de edad pero tienes
        16 años o más, garantizas que cuentas con el consentimiento de tu padre, madre o tutor legal cuando
        este sea necesario en tu país de residencia.
      </p>

      <h2>4. Cuenta y seguridad</h2>
      <ul>
        <li>Una cuenta por persona. No compartas tu contraseña.</li>
        <li>Eres responsable de mantener la seguridad de tu sesión, especialmente en dispositivos compartidos.</li>
        <li>Si sospechas que alguien ha accedido a tu cuenta sin autorización, escríbenos a <a href="mailto:soporte@btal.app">soporte@btal.app</a>.</li>
        <li>Nos reservamos el derecho de pedir verificación adicional (email, segundo factor) si detectamos actividad sospechosa.</li>
      </ul>

      <h2>5. Modo prueba (invitado anónimo)</h2>
      <p>Puedes probar BTal sin registrarte mediante el botón "Probar como invitado". Tu sesión de invitado:</p>
      <ul>
        <li>Tiene una duración máxima de <strong>3 días</strong> desde su creación. Vence aunque sigas usándola.</li>
        <li>Los cambios que hagas (al plan demo, registros de entreno, etc.) se pierden cuando la sesión vence.</li>
        <li>Si quieres conservarlos, conviértela en cuenta real desde el banner que aparece en la app (vincular email o cuenta Google).</li>
      </ul>

      <h2>6. Uso aceptable</h2>
      <p>Estás autorizado a usar BTal de forma personal y razonable. <strong>NO está permitido</strong>:</p>
      <ul>
        <li>Acceder a datos de otros usuarios sin su consentimiento explícito.</li>
        <li>Hacer scraping automatizado, suplantar el cliente oficial o saltarse los límites de uso.</li>
        <li>Subir contenido ilegal, ofensivo o que infrinja derechos de terceros (en notas, perfil, etc.).</li>
        <li>Usar la app para enviar publicidad no solicitada, spam o malware.</li>
        <li>Intentar explotar vulnerabilidades del servicio.</li>
      </ul>
      <p>
        Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estas reglas, con o sin aviso
        previo según la gravedad.
      </p>

      <h2>7. Limitaciones del servicio</h2>
      <ul>
        <li>BTal es una herramienta de organización. <strong>NO sustituye consejo médico, dietético, deportivo ni psicológico profesional.</strong> Consulta el <a href="/legal/aviso-medico">aviso médico</a> para más detalle.</li>
        <li>Cualquier recomendación generada por la inteligencia artificial (cuando esté activa) tiene carácter orientativo y debe revisarse críticamente. Consulta con un profesional antes de seguir cualquier plan.</li>
        <li>La app puede contener errores. Hacemos lo posible por mantenerla operativa pero no garantizamos disponibilidad ininterrumpida ni ausencia total de bugs.</li>
        <li>Eres responsable de tu salud y tus decisiones.</li>
      </ul>

      <h2>8. Planes y pagos (próximamente)</h2>
      <p>
        Actualmente BTal es <strong>gratuito</strong> en todas sus funcionalidades. Cuando introduzcamos el plan Pro
        mediante suscripción de pago:
      </p>
      <ul>
        <li>El precio y las funcionalidades incluidas se mostrarán claramente antes de aceptar.</li>
        <li>La suscripción se cobrará a través de Stripe; se aplicarán también sus términos.</li>
        <li>No hay derecho de desistimiento sobre los recursos digitales ya consumidos (por ejemplo, generaciones de plan con IA ya emitidas), conforme al art. 103 m) del Texto Refundido de la Ley General para la Defensa de Consumidores. Sí podrás cancelar la renovación en cualquier momento.</li>
        <li>Los detalles concretos se incluirán en estos términos cuando el plan Pro esté activo, y te lo notificaremos antes de su lanzamiento.</li>
      </ul>

      <h2>9. Eliminación de cuenta</h2>
      <p>
        Puedes eliminar tu cuenta en cualquier momento desde <em>Ajustes → Administrar cuenta → Eliminar cuenta</em>.
        El proceso requiere una confirmación de texto y borra todos tus datos de forma inmediata e irreversible.
        Conservamos copias en backups internos de Google hasta un máximo de 30 días, tras lo cual se purgan definitivamente.
      </p>

      <h2>10. Modificaciones del servicio y de los términos</h2>
      <p>
        Nos reservamos el derecho de modificar, suspender o terminar el servicio o cualquiera de sus
        funcionalidades en cualquier momento. Te avisaremos por email con razonable antelación si los cambios
        son materiales.
      </p>
      <p>
        Estos términos también pueden modificarse. Te notificaremos antes de aplicar cambios importantes.
        Si no estás de acuerdo con los nuevos términos, puedes cerrar tu cuenta.
      </p>

      <h2>11. Limitación de responsabilidad</h2>
      <p>
        En la medida máxima permitida por la ley, BTal y su responsable no serán responsables por daños indirectos,
        incidentales, especiales o consecuenciales derivados del uso o imposibilidad de uso del servicio, incluyendo
        (sin limitación) pérdida de datos, lucro cesante, daños personales asociados a un mal uso de las
        recomendaciones generadas por la app, o cualquier consecuencia derivada de seguir un plan sin consultar
        previamente con un profesional cualificado.
      </p>

      <h2>12. Propiedad intelectual</h2>
      <p>
        BTal, su código, diseño, contenido editorial e iconografía son propiedad de su responsable.
        Los datos que tú creas (tu perfil, tus planes editados, tus registros) son tuyos y puedes descargarlos
        en cualquier momento (<em>Ajustes → Datos</em>).
      </p>

      <h2>13. Ley aplicable y jurisdicción</h2>
      <p>
        Estos términos se rigen por la legislación española. Cualquier disputa relacionada con el uso del servicio
        se someterá a los tribunales del lugar de residencia del responsable, sin perjuicio de los derechos
        imperativos del consumidor.
      </p>

      <h2>14. Contacto</h2>
      <p>
        Para cualquier duda sobre estos términos, escríbenos a <a href="mailto:soporte@btal.app">soporte@btal.app</a>.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Aviso médico (14-2 · texto extendido del checkbox del onboarding)

function MedicalDisclaimer() {
  return (
    <>
      <p className="legal-version">Última actualización: {LEGAL_VERSION['aviso-medico']}</p>

      <p>
        <strong>BTal es una herramienta de organización personal de nutrición, entrenamiento y suplementación.</strong>{' '}
        No es un servicio sanitario ni un consejo médico, dietético o deportivo profesional.
      </p>

      <h2>Lee esto antes de empezar</h2>
      <p>
        Antes de seguir cualquier plan de alimentación, rutina de entrenamiento o régimen de suplementación
        que generes o edites con BTal, te recomendamos encarecidamente:
      </p>
      <ul>
        <li>Consultar con tu médico de cabecera, especialmente si tienes una condición médica conocida o estás en tratamiento.</li>
        <li>Consultar con un dietista-nutricionista colegiado para validar el plan nutricional.</li>
        <li>Consultar con un preparador físico cualificado para validar la carga, intensidad y técnica de los entrenamientos.</li>
        <li>Detener inmediatamente cualquier actividad que te cause dolor, mareo, falta de aire o malestar, y buscar atención médica si los síntomas persisten.</li>
      </ul>

      <h2>Lo que la app NO hace</h2>
      <ul>
        <li>No diagnostica enfermedades.</li>
        <li>No prescribe medicación ni suplementos.</li>
        <li>No sustituye a profesionales sanitarios cualificados.</li>
        <li>No tiene en cuenta posibles condiciones médicas que tú no hayas declarado.</li>
      </ul>

      <h2>Casos en los que debes consultar antes</h2>
      <ul>
        <li>Embarazo, lactancia o postparto reciente.</li>
        <li>Enfermedad metabólica diagnosticada (diabetes, hipertensión, problemas cardiovasculares, tiroides, etc.).</li>
        <li>Trastornos de la conducta alimentaria, actuales o pasados.</li>
        <li>Lesiones musculoesqueléticas previas o actuales.</li>
        <li>Cualquier tratamiento médico que pueda interactuar con un cambio de alimentación o actividad física.</li>
        <li>Menores de edad (consulta médica obligatoria antes de empezar planes de entreno o nutrición específicos).</li>
      </ul>

      <h2>Tu responsabilidad</h2>
      <p>
        Al usar BTal aceptas que las decisiones que tomes sobre tu alimentación, entrenamiento y salud son
        responsabilidad tuya. La aceptación de este aviso queda registrada en tu cuenta el día que lo confirmaste
        durante el alta.
      </p>

      <h2>Para emergencias</h2>
      <p>
        Si crees que estás teniendo una emergencia médica, llama inmediatamente al número de emergencias
        de tu país (<strong>112</strong> en España y resto de la Unión Europea) o acude al servicio de urgencias más cercano.
      </p>

      <h2>Documentos relacionados</h2>
      <p>
        Consulta también nuestra <a href="/legal/privacidad">Política de privacidad</a> y los{' '}
        <a href="/legal/terminos">Términos de uso</a>.
      </p>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Router por slug

function renderBody(slug: string) {
  switch (slug) {
    case 'privacidad':
      return <PrivacyPolicy />;
    case 'terminos':
      return <TermsOfService />;
    case 'aviso-medico':
      return <MedicalDisclaimer />;
    default:
      return (
        <>
          <p>Documento no encontrado.</p>
          <p className="legal-note">
            Si crees que es un error, escribe a{' '}
            <a href="mailto:soporte@btal.app">soporte@btal.app</a>.
          </p>
        </>
      );
  }
}

const LegalPlaceholder: React.FC = () => {
  const history = useHistory();
  const { slug = '' } = useParams<{ slug: string }>();
  const title = TITLES[slug] ?? 'Documento legal';

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="legal-wrap">
          <div className="legal-header">
            <button
              type="button"
              className="settings-back"
              onClick={(e) => {
                e.currentTarget.blur();
                if (history.length > 1) history.goBack();
                else history.replace('/');
              }}
              aria-label="Volver"
            >
              <MealIcon value="tb:arrow-left" size={22} />
            </button>
            <h1 className="legal-title">{title}</h1>
          </div>

          <div className="legal-body">
            {renderBody(slug)}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LegalPlaceholder;
