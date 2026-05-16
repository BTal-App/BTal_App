import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { Redirect, Route } from 'react-router-dom';
import {
  IonContent,
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import {
  barbellOutline,
  calendarNumberOutline,
  cartOutline,
  listOutline,
  restaurantOutline,
} from 'ionicons/icons';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../hooks/useProfile';
import HoyPage from './HoyPage';
import MenuPage from './MenuPage';
import CompraPage from './CompraPage';
import EntrenoPage from './EntrenoPage';
import RegistroPage from './RegistroPage';
import './AppShell.css';

// Shell de la app autenticada — replica el layout del mockup v2:
// 5 tabs con bottom bar nativo Ionic. Cada tab vive en su propia
// sub-ruta para que IonTabs gestione bien el routing y la navegación
// con back gesture iOS funcione fuera de la caja.
//
// Guards:
//  - Sin sesión → /
//  - Sesión real sin onboarding completo → /onboarding
//  - Invitado → se queda dentro del shell (verá empty states)
const AppShell: React.FC = () => {
  const history = useHistory();
  const { user, loading, isAuthed } = useAuth();
  const { profile: userDoc, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (!loading && !isAuthed) history.replace('/');
  }, [loading, isAuthed, history]);

  useEffect(() => {
    if (loading || profileLoading || !user) return;
    // Invitado nunca pasa por onboarding — el flujo es solo para cuentas reales.
    if (user.isAnonymous) return;
    if (!userDoc?.profile?.completed) {
      history.replace('/onboarding');
    }
  }, [loading, profileLoading, user, userDoc, history]);

  // Splash de marca mientras carga auth O el perfil. Cubrir también
  // `profileLoading` evita que el invitado (o cualquier cold start) vea
  // el shell con tabs vacías durante los ~2-4 s de auth→AppCheck→seed→
  // read · enseña el mismo logo+spinner que el splash de Landing para
  // que el paso Landing → /app sea una transición continua, sin salto.
  // Seguro de gatear aquí: `profileLoading` solo se activa en la carga
  // inicial / cambio de uid y tras completar onboarding (load()); las
  // mutaciones in-app son optimistas (setProfile) y NO lo tocan, así
  // que esto nunca tapa la app mientras el usuario edita.
  if (loading || !user || profileLoading) {
    return (
      <IonPage>
        <IonContent fullscreen>
          <div className="app-shell-loading">
            <div className="app-shell-loading-logo-wrap">
              <img
                src="/logo.png"
                alt="BTal"
                className="app-shell-loading-logo"
              />
            </div>
            <IonSpinner name="dots" className="app-shell-loading-spinner" />
            <p className="app-shell-loading-msg">Preparando tu plan…</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonTabs>
      <IonRouterOutlet>
        {/* Default: /app → /app/hoy */}
        <Route exact path="/app">
          <Redirect to="/app/hoy" />
        </Route>
        <Route exact path="/app/hoy" component={HoyPage} />
        <Route exact path="/app/menu" component={MenuPage} />
        <Route exact path="/app/compra" component={CompraPage} />
        <Route exact path="/app/entreno" component={EntrenoPage} />
        <Route exact path="/app/registro" component={RegistroPage} />
      </IonRouterOutlet>

      {/* Labels en mayúsculas literales (no via text-transform CSS) porque
          ion-label vive en shadow DOM en Ionic 8 y el text-transform
          desde fuera no la atraviesa de forma fiable. */}
      {/* Las 5 tabs usan Ionicons outline para que compartan metrics
          (font-size 1.4rem en variables.css → `ion-tab-button ion-icon`).
          Mismo lenguaje visual + sizing uniforme → iconos y labels a
          la misma altura entre tabs. */}
      <IonTabBar slot="bottom">
        <IonTabButton tab="hoy" href="/app/hoy">
          <IonIcon icon={calendarNumberOutline} />
          <IonLabel>HOY</IonLabel>
        </IonTabButton>
        <IonTabButton tab="menu" href="/app/menu">
          <IonIcon icon={restaurantOutline} />
          <IonLabel>MENÚ</IonLabel>
        </IonTabButton>
        <IonTabButton tab="compra" href="/app/compra">
          <IonIcon icon={cartOutline} />
          <IonLabel>COMPRA</IonLabel>
        </IonTabButton>
        <IonTabButton tab="entreno" href="/app/entreno">
          <IonIcon icon={barbellOutline} />
          <IonLabel>ENTRENO</IonLabel>
        </IonTabButton>
        <IonTabButton tab="registro" href="/app/registro">
          <IonIcon icon={listOutline} />
          <IonLabel>REGISTRO</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default AppShell;
