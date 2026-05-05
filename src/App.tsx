import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import { AuthProvider } from './hooks/AuthContext';
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
      <IonApp>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/">
              <Landing />
            </Route>
            <Route exact path="/app">
              <Dashboard />
            </Route>
            <Route>
              <Redirect to="/" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </IonApp>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;
