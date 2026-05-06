import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import AuthAction from './pages/AuthAction';
import Settings from './pages/Settings';
import LegalPlaceholder from './pages/LegalPlaceholder';
import { AuthProvider } from './hooks/AuthContext';
import { VerifyBannerProvider } from './hooks/VerifyBannerProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

/* Ionic core CSS — obligatorio */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Ionic utility classes */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Tema BTal */
import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <VerifyBannerProvider>
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/">
              <Landing />
            </Route>
            <Route exact path="/app">
              <Dashboard />
            </Route>
            <Route exact path="/settings">
              <Settings />
            </Route>
            <Route exact path="/auth/action">
              <AuthAction />
            </Route>
            <Route exact path="/legal/privacidad">
              <LegalPlaceholder />
            </Route>
            <Route exact path="/legal/terminos">
              <LegalPlaceholder />
            </Route>
            <Route exact path="/legal/aviso-medico">
              <LegalPlaceholder />
            </Route>
            <Route>
              <Redirect to="/" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
      </VerifyBannerProvider>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
