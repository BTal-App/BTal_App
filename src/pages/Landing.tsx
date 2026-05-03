import { IonContent, IonPage } from '@ionic/react';

const Landing: React.FC = () => (
  <IonPage>
    <IonContent fullscreen>
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          textAlign: 'center',
          gap: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(3rem, 14vw, 5rem)',
            fontWeight: 900,
            letterSpacing: '-.04em',
            margin: 0,
            background: 'linear-gradient(135deg, var(--ancen-lime), var(--ancen-cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Ancen
        </h1>
        <p style={{ color: 'var(--ancen-t-2)', fontSize: '.95rem', margin: 0, maxWidth: 320 }}>
          Tu plan de nutrición y entreno, en un solo sitio.
        </p>
        <p style={{ color: 'var(--ancen-t-3)', fontSize: '.78rem', marginTop: '2rem', fontFamily: 'JetBrains Mono, monospace' }}>
          v0.1 · scaffold listo
        </p>
      </div>
    </IonContent>
  </IonPage>
);

export default Landing;
