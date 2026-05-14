import { test, expect } from '@playwright/test';

// Tests del flujo PRE-auth · landing, signin/signup, recuperar password,
// modo invitado warning. Sin interactuar con Firebase real (no rellenamos
// inputs reales con credenciales).

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // El splash inicial vive en index.html con clase `.fade-out` aplicada
    // tras un setTimeout. Esperamos a que React monte (Landing tiene un
    // form con campo email visible).
    await expect(page.getByPlaceholder(/tucorreo@ejemplo/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('renderiza con el modo sign-in por defecto', async ({ page }) => {
    // Email + password mínimo visibles.
    await expect(page.getByPlaceholder(/tucorreo@ejemplo/i)).toBeVisible();
    await expect(page.getByPlaceholder(/^Contraseña$/i)).toBeVisible();
    // Hay un único campo de password en signin (no aparece "Confirmar").
    await expect(page.getByPlaceholder(/Confirmar contraseña/i)).toHaveCount(0);
    // CTAs principales · email + Google + invitado.
    await expect(
      page.getByRole('button', { name: /Continuar con Google/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Probar como invitado/i }),
    ).toBeVisible();
  });

  test('switch a sign-up muestra campo confirmar contraseña + hint', async ({
    page,
  }) => {
    // Botón para cambiar de modo · texto cambia entre "Crear cuenta nueva"
    // y "Ya tengo cuenta" según el modo activo.
    // Switcher signin→signup · solo aparece este botón con texto
    // "Crear cuenta" en modo signin (el submit dice "Entrar"). En
    // signup el switcher pasa a "Iniciar sesión".
    await page.getByRole('button', { name: /^Crear cuenta$/i }).click();

    // Aparece el segundo input "Confirmar contraseña".
    await expect(page.getByPlaceholder(/Confirmar contraseña/i)).toBeVisible();
    // Y el hint de fortaleza de contraseña.
    await expect(
      page.getByText(/Mínimo 8 caracteres.*mayúscula.*número.*especial/i),
    ).toBeVisible();
  });

  test('signup con contraseña débil muestra error', async ({ page }) => {
    // Switcher signin→signup · solo aparece este botón con texto
    // "Crear cuenta" en modo signin (el submit dice "Entrar"). En
    // signup el switcher pasa a "Iniciar sesión".
    await page.getByRole('button', { name: /^Crear cuenta$/i }).click();
    await page.getByPlaceholder(/tucorreo@ejemplo/i).fill('test@example.com');
    // Probamos una contraseña que pasa el `minLength={8}` del navegador
    // (8 chars exactos) pero falla la validación JS por no tener mayúscula
    // ni número ni carácter especial. Si usáramos <8 chars la validación
    // native del navegador bloquearía el submit antes y el JS no correría.
    await page.getByPlaceholder(/^Contraseña$/i).fill('abcdefgh');
    await page.getByPlaceholder(/Confirmar contraseña/i).fill('abcdefgh');
    await page.getByRole('button', { name: /^Crear cuenta$/i }).click();

    // Validación cliente · debe aparecer mensaje sin llegar a Firebase.
    // El primer fallo en orden es "letra mayúscula" (las 8 chars ya
    // pasan, pero no hay ninguna mayúscula).
    await expect(page.getByText(/letra mayúscula/i)).toBeVisible();
  });

  test('signup con contraseñas que no coinciden muestra error', async ({
    page,
  }) => {
    // Switcher signin→signup · solo aparece este botón con texto
    // "Crear cuenta" en modo signin (el submit dice "Entrar"). En
    // signup el switcher pasa a "Iniciar sesión".
    await page.getByRole('button', { name: /^Crear cuenta$/i }).click();
    await page.getByPlaceholder(/tucorreo@ejemplo/i).fill('test@example.com');
    // Cumple requisitos pero las dos no coinciden.
    await page.getByPlaceholder(/^Contraseña$/i).fill('Abcdef1!');
    await page.getByPlaceholder(/Confirmar contraseña/i).fill('Abcdef1@');
    await page.getByRole('button', { name: /^Crear cuenta$/i }).click();

    await expect(page.getByText(/no coinciden/i)).toBeVisible();
  });

  test('botón "Probar como invitado" abre el aviso de TTL 3 días', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /Probar como invitado/i }).click();

    // El IonAlert tiene el texto de aviso · evitamos confirmar para no
    // crear realmente un user anónimo en Firebase (la rule de Firestore
    // crearía un doc con expiresAt 3 días, perdura hasta que TTL barra).
    await expect(page.getByText(/3 días/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe('Legal pages', () => {
  test('política de privacidad renderiza con todas las secciones', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    await expect(
      page.getByRole('heading', { name: /Política de privacidad/i }),
    ).toBeVisible();
    // Spot-check de varias secciones numeradas · si una falta es señal
    // de que el doc se cortó en algún momento.
    await expect(
      page.getByRole('heading', { name: /Qué datos recopilamos/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Tus derechos.*GDPR/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Edad mínima/i }),
    ).toBeVisible();
  });

  test('términos de uso renderiza', async ({ page }) => {
    await page.goto('/legal/terminos');
    await expect(
      page.getByRole('heading', { name: /Términos de uso/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Modo prueba/i }),
    ).toBeVisible();
  });

  test('aviso médico renderiza', async ({ page }) => {
    await page.goto('/legal/aviso-medico');
    await expect(
      page.getByRole('heading', { name: /Aviso médico/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Para emergencias/i }),
    ).toBeVisible();
  });

  test('slug desconocido muestra mensaje de "no encontrado"', async ({
    page,
  }) => {
    await page.goto('/legal/no-existe');
    await expect(page.getByText(/Documento no encontrado/i)).toBeVisible();
  });
});

test.describe('Routing fallback', () => {
  test('ruta inexistente redirige a Landing', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');
    // Acaba en landing · email field visible.
    await expect(page.getByPlaceholder(/tucorreo@ejemplo/i)).toBeVisible({
      timeout: 10_000,
    });
    // La URL debería haberse normalizado al raíz (Redirect to="/").
    await expect(page).toHaveURL(/\/$/);
  });
});
