# Textos fijos de la app — para revisión

Generado automáticamente desde `src/`. Cada entrada: `L<línea>` + el texto.
Edítalos directamente en el fichero indicado (la ruta es un enlace relativo).
Filtrado heurístico: puede colarse algún identificador o faltar algún string en template multilínea.

Ficheros con copy: **113** · cadenas detectadas: **2374**.

---

## Índice

- [src/components/AboutModal.tsx](#src-components-aboutmodal-tsx) — 6
- [src/components/AccountInfoModal.tsx](#src-components-accountinfomodal-tsx) — 8
- [src/components/AccountManageModal.tsx](#src-components-accountmanagemodal-tsx) — 38
- [src/components/AiAffectedItemsStep.tsx](#src-components-aiaffecteditemsstep-tsx) — 14
- [src/components/AiGenerateModal.tsx](#src-components-aigeneratemodal-tsx) — 13
- [src/components/AiGeneratedBadge.tsx](#src-components-aigeneratedbadge-tsx) — 4
- [src/components/AiPromptSummaryModal.tsx](#src-components-aipromptsummarymodal-tsx) — 40
- [src/components/AlimentosListInput.tsx](#src-components-alimentoslistinput-tsx) — 11
- [src/components/AppAvatarButton.tsx](#src-components-appavatarbutton-tsx) — 1
- [src/components/BatidoInfoModal.tsx](#src-components-batidoinfomodal-tsx) — 27
- [src/components/ChangeEmailModal.tsx](#src-components-changeemailmodal-tsx) — 10
- [src/components/ChangeModeModal.tsx](#src-components-changemodemodal-tsx) — 11
- [src/components/ChangePasswordModal.tsx](#src-components-changepasswordmodal-tsx) — 21
- [src/components/ChipsInput.tsx](#src-components-chipsinput-tsx) — 5
- [src/components/CompraCategoriaEditorModal.tsx](#src-components-compracategoriaeditormodal-tsx) — 31
- [src/components/CompraItemEditorModal.tsx](#src-components-compraitemeditormodal-tsx) — 25
- [src/components/ConfirmDiffAlert.tsx](#src-components-confirmdiffalert-tsx) — 5
- [src/components/CreatinaInfoModal.tsx](#src-components-creatinainfomodal-tsx) — 22
- [src/components/DeleteAccountModal.tsx](#src-components-deleteaccountmodal-tsx) — 11
- [src/components/DeleteIndicator.tsx](#src-components-deleteindicator-tsx) — 3
- [src/components/DeleteStatusToast.tsx](#src-components-deletestatustoast-tsx) — 3
- [src/components/DiaEditorModal.tsx](#src-components-diaeditormodal-tsx) — 59
- [src/components/DuplicateMealExtraModal.tsx](#src-components-duplicatemealextramodal-tsx) — 10
- [src/components/DuplicateMealModal.tsx](#src-components-duplicatemealmodal-tsx) — 20
- [src/components/EditFitnessProfileModal.tsx](#src-components-editfitnessprofilemodal-tsx) — 68
- [src/components/EditProfileModal.tsx](#src-components-editprofilemodal-tsx) — 17
- [src/components/EditSupStockModal.tsx](#src-components-editsupstockmodal-tsx) — 19
- [src/components/EnableTotpModal.tsx](#src-components-enabletotpmodal-tsx) — 19
- [src/components/ErrorBoundary.tsx](#src-components-errorboundary-tsx) — 6
- [src/components/ForgotPasswordModal.tsx](#src-components-forgotpasswordmodal-tsx) — 9
- [src/components/GeneratingScreen.tsx](#src-components-generatingscreen-tsx) — 2
- [src/components/GuestBanner.tsx](#src-components-guestbanner-tsx) — 13
- [src/components/IconPicker.tsx](#src-components-iconpicker-tsx) — 18
- [src/components/LegalLink.tsx](#src-components-legallink-tsx) — 1
- [src/components/LinkGuestAccountModal.tsx](#src-components-linkguestaccountmodal-tsx) — 20
- [src/components/MealEditorModal.tsx](#src-components-mealeditormodal-tsx) — 31
- [src/components/MealExtraEditorModal.tsx](#src-components-mealextraeditormodal-tsx) — 41
- [src/components/MealIcon.tsx](#src-components-mealicon-tsx) — 1
- [src/components/MealSheet.tsx](#src-components-mealsheet-tsx) — 18
- [src/components/PlanEditorModal.tsx](#src-components-planeditormodal-tsx) — 34
- [src/components/PreferencesModal.tsx](#src-components-preferencesmodal-tsx) — 12
- [src/components/ProfileSheet.tsx](#src-components-profilesheet-tsx) — 25
- [src/components/ReauthModal.tsx](#src-components-reauthmodal-tsx) — 11
- [src/components/SaveIndicator.tsx](#src-components-saveindicator-tsx) — 3
- [src/components/SaveStatusToast.tsx](#src-components-savestatustoast-tsx) — 3
- [src/components/StepMode.tsx](#src-components-stepmode-tsx) — 4
- [src/components/StreakBadge.tsx](#src-components-streakbadge-tsx) — 17
- [src/components/SupAlertBox.tsx](#src-components-supalertbox-tsx) — 4
- [src/components/SupCardEditor.tsx](#src-components-supcardeditor-tsx) — 13
- [src/components/SupCountersInline.tsx](#src-components-supcountersinline-tsx) — 59
- [src/components/TotpSignInModal.tsx](#src-components-totpsigninmodal-tsx) — 7
- [src/components/TrainSheet.tsx](#src-components-trainsheet-tsx) — 4
- [src/components/VerifyEmailBanner.tsx](#src-components-verifyemailbanner-tsx) — 8
- [src/components/VerifyEmailRow.tsx](#src-components-verifyemailrow-tsx) — 6
- [src/components/graphs/BarChart.tsx](#src-components-graphs-barchart-tsx) — 8
- [src/components/graphs/GraphsModal.tsx](#src-components-graphs-graphsmodal-tsx) — 41
- [src/components/graphs/LineChart.tsx](#src-components-graphs-linechart-tsx) — 8
- [src/components/registro/RegDayPanel.tsx](#src-components-registro-regdaypanel-tsx) — 53
- [src/components/registro/RegistroCalendar.tsx](#src-components-registro-registrocalendar-tsx) — 34
- [src/components/registro/RegistroStatsGrid.tsx](#src-components-registro-registrostatsgrid-tsx) — 32
- [src/config/contact.ts](#src-config-contact-ts) — 2
- [src/hooks/AdblockBanner.tsx](#src-hooks-adblockbanner-tsx) — 4
- [src/hooks/AuthContext.tsx](#src-hooks-authcontext-tsx) — 2
- [src/hooks/OfflineBanner.tsx](#src-hooks-offlinebanner-tsx) — 3
- [src/hooks/PreferencesProvider.tsx](#src-hooks-preferencesprovider-tsx) — 8
- [src/hooks/ProfileProvider.tsx](#src-hooks-profileprovider-tsx) — 11
- [src/hooks/VerifyBannerProvider.tsx](#src-hooks-verifybannerprovider-tsx) — 1
- [src/hooks/auth-context.ts](#src-hooks-auth-context-ts) — 1
- [src/hooks/preferences-context.ts](#src-hooks-preferences-context-ts) — 1
- [src/hooks/profile-context.ts](#src-hooks-profile-context-ts) — 1
- [src/hooks/useAuth.ts](#src-hooks-useauth-ts) — 1
- [src/hooks/usePreferences.ts](#src-hooks-usepreferences-ts) — 1
- [src/hooks/useProfile.ts](#src-hooks-useprofile-ts) — 1
- [src/hooks/useRegistroMes.ts](#src-hooks-useregistromes-ts) — 1
- [src/hooks/useRegistroStats.ts](#src-hooks-useregistrostats-ts) — 2
- [src/hooks/useSaveStatus.ts](#src-hooks-usesavestatus-ts) — 2
- [src/hooks/useVerifyBanner.ts](#src-hooks-useverifybanner-ts) — 1
- [src/main.tsx](#src-main-tsx) — 1
- [src/pages/AuthAction.tsx](#src-pages-authaction-tsx) — 37
- [src/pages/Landing.tsx](#src-pages-landing-tsx) — 32
- [src/pages/LegalPlaceholder.tsx](#src-pages-legalplaceholder-tsx) — 143
- [src/pages/Onboarding.tsx](#src-pages-onboarding-tsx) — 60
- [src/pages/Settings.tsx](#src-pages-settings-tsx) — 42
- [src/pages/app/AppShell.tsx](#src-pages-app-appshell-tsx) — 4
- [src/pages/app/CompraPage.tsx](#src-pages-app-comprapage-tsx) — 57
- [src/pages/app/EntrenoPage.tsx](#src-pages-app-entrenopage-tsx) — 44
- [src/pages/app/HoyPage.tsx](#src-pages-app-hoypage-tsx) — 78
- [src/pages/app/MenuPage.tsx](#src-pages-app-menupage-tsx) — 104
- [src/pages/app/RegistroPage.tsx](#src-pages-app-registropage-tsx) — 1
- [src/pages/legalTypes.ts](#src-pages-legaltypes-ts) — 4
- [src/services/auth.ts](#src-services-auth-ts) — 9
- [src/services/db.ts](#src-services-db-ts) — 76
- [src/services/exportData.ts](#src-services-exportdata-ts) — 6
- [src/services/firebase.ts](#src-services-firebase-ts) — 8
- [src/templates/defaultUser.ts](#src-templates-defaultuser-ts) — 97
- [src/templates/demoUser.ts](#src-templates-demouser-ts) — 202
- [src/templates/exerciseCatalog.ts](#src-templates-exercisecatalog-ts) — 125
- [src/utils/aiAffectedItems.ts](#src-utils-aiaffecteditems-ts) — 21
- [src/utils/confirmDiff.ts](#src-utils-confirmdiff-ts) — 7
- [src/utils/dateKeys.ts](#src-utils-datekeys-ts) — 3
- [src/utils/entrenoDiff.ts](#src-utils-entrenodiff-ts) — 26
- [src/utils/graphsAggregation.ts](#src-utils-graphsaggregation-ts) — 10
- [src/utils/ia.ts](#src-utils-ia-ts) — 5
- [src/utils/numericInput.ts](#src-utils-numericinput-ts) — 9
- [src/utils/registro.ts](#src-utils-registro-ts) — 17
- [src/utils/registroDiff.ts](#src-utils-registrodiff-ts) — 8
- [src/utils/resizeImage.ts](#src-utils-resizeimage-ts) — 1
- [src/utils/supAlerts.ts](#src-utils-supalerts-ts) — 1
- [src/utils/supHistory.ts](#src-utils-suphistory-ts) — 2
- [src/utils/timeParser.ts](#src-utils-timeparser-ts) — 3
- [src/utils/units.ts](#src-utils-units-ts) — 6
- [src/utils/useCountUp.ts](#src-utils-usecountup-ts) — 1
- [src/utils/userDisplay.ts](#src-utils-userdisplay-ts) — 14

---

## src/components/AboutModal.tsx
<a id="src-components-aboutmodal-tsx"></a>

- **L34** `str` — Cerrar
- **L38** `str` — BTal
- **L48** `jsx` — Política de privacidad
- **L52** `jsx` — Términos de uso
- **L56** `jsx` — Aviso médico
- **L61** `jsx` — © BTal ·

## src/components/AccountInfoModal.tsx
<a id="src-components-accountinfomodal-tsx"></a>

- **L32** `str` — Cerrar
- **L36** `jsx` — Información de la cuenta
- **L43** `jsx` — Email
- **L58** `str` — Verificado
- **L65** `jsx` — Nombre
- **L71** `jsx` — Fecha de registro
- **L77** `jsx` — Última conexión
- **L83** `jsx` — Inicio sesión

## src/components/AccountManageModal.tsx
<a id="src-components-accountmanagemodal-tsx"></a>

- **L75** `str` — Esa cuenta de Google ya está vinculada a otra cuenta de BTal.
- **L77** `str` — Google ya está vinculado a esta cuenta.
- **L79** `str` — No hemos podido vincular Google. Inténtalo de nuevo.
- **L86** `str` — google.com
- **L89** `str` — [BTal] unlink google error:
- **L98** `str` — [BTal] unenroll error:
- **L116** `str` — Cerrar
- **L120** `jsx` — Administrar cuenta
- **L131** `jsx` — Perfil
- **L139** `jsx` — Modo de generación
- **L142** `str` — La IA genera mi plan · pulsa para cambiar a manual
- **L143** `str` — Lo relleno yo mismo · pulsa para activar la IA
- **L160** `jsx` — Cuenta
- **L168** `jsx` — Información de la cuenta
- **L184** `jsx` — Cambiar email
- **L194** `jsx` — Cuenta de Google
- **L197** `str` — Vinculada · puedes iniciar sesión con Google
- **L198** `str` — Vincúlala para iniciar sesión también con Google
- **L234** `jsx` — Seguridad
- **L238** `jsx` — Verificación en dos pasos (TOTP)
- **L241** `str` — Activada · te pediremos el código al iniciar sesión
- **L242** `str` — Añade una capa extra de seguridad con tu app authenticator
- **L275** `jsx` — Cambiar contraseña
- **L291** `jsx` — Restablecer contraseña
- **L308** `jsx` — próximamente
- **L319** `jsx` — Eliminar cuenta
- **L385** `str` — ¿Desactivar 2FA?
- **L386** `str` — Tu cuenta volverá a usar solo email y contraseña para iniciar sesión. Podrás reactivarla en cualquier momento.
- **L388** `str` — Cancelar
- **L390** `str` — Desactivar
- **L401** `str` — ¿Desvincular Google?
- **L404** `str` — Tu cuenta seguirá funcionando con email y contraseña. Podrás volver a vincular Google cuando quieras.
- **L405** `str` — Si desvinculas Google y no tienes contraseña configurada, te quedarás sin método de inicio de sesión. Configura una contraseña primero (Restablecer contraseña).
- **L412** `str` — Desvincular
- **L425** `str` — Cerrar sesión en otros dispositivos
- **L427** `str` — Esta función necesita que activemos las Cloud Functions del backend (Fase 6 del roadmap). 
- **L428** `str` — Mientras tanto: si cambias tu contraseña, todas las demás sesiones se cerrarán automáticamente.
- **L430** `str` — Entendido

## src/components/AiAffectedItemsStep.tsx
<a id="src-components-aiaffecteditemsstep-tsx"></a>

- **L28** `str` — Menú
- **L29** `str` — Entreno
- **L30** `str` — Lista de la compra
- **L40** `str` — Por defecto
- **L41** `str` — IA anterior
- **L42** `str` — Tuyo
- **L79** `str` — Solo entrenos
- **L80** `jsx` — Atrás
- **L92** `jsx` — no los modificará
- **L95** `str` — permitir tocar lo mío
- **L112** `str` — Permitir que la IA toque mis cambios
- **L152** `str` — Mantener ${item.label}
- **L179** `jsx` — se reemplazarán
- **L186** `jsx` — se mantendrán

## src/components/AiGenerateModal.tsx
<a id="src-components-aigeneratemodal-tsx"></a>

- **L180** `str` — [BTal] generatePlan request (Fase 6 pendiente)
- **L196** `str` — [BTal] generatePlan error:
- **L231** `str` — Cerrar
- **L236** `str` — Paso X de 3
- **L280** `jsx` — ¿Qué quieres generar?
- **L376** `str` — Generar con IA
- **L385** `str` — Generando con IA
- **L393** `str` — La IA estará disponible cuando activemos Gemini · Fase 6 del roadmap.
- **L428** `str` — [BTal] generatePlan payload (Fase 6 will use this):
- **L437** `str` — Estamos creando tu menú semanal, tu plan de entreno y tu lista de la compra. No cierres la app — esto puede tardar unos segundos.
- **L439** `str` — Estamos creando tu menú semanal y la lista de la compra. No cierres la app — esto puede tardar unos segundos.
- **L441** `str` — Estamos creando tu menú semanal. No cierres la app — esto puede tardar unos segundos.
- **L443** `str` — Estamos creando tu plan de entreno. No cierres la app — esto puede tardar unos segundos.

## src/components/AiGeneratedBadge.tsx
<a id="src-components-aigeneratedbadge-tsx"></a>

- **L17** `str` — Menú
- **L18** `str` — Entreno
- **L19** `str` — Plan
- **L46** `str` — Plan generado por IA

## src/components/AiPromptSummaryModal.tsx
<a id="src-components-aipromptsummarymodal-tsx"></a>

- **L81** `str` — Confirmar y generar
- **L170** `str` — Cerrar
- **L179** `jsx` — Confirma lo que enviaremos a la IA
- **L213** `str` — Datos personales
- **L214** `str` — Nombre
- **L215** `str` — Edad
- **L215** `str` — ${profile.edad} años
- **L216** `str` — Sexo
- **L216** `str` — Hombre
- **L216** `str` — Mujer
- **L217** `str` — Peso
- **L218** `str` — Altura
- **L222** `str` — Estilo de vida
- **L223** `str` — Actividad
- **L225** `str` — Días entreno
- **L226** `str` — ${profile.diasEntreno} / semana
- **L228** `str` — Equipamiento
- **L232** `str` — Objetivo
- **L233** `str` — Quiero
- **L235** `str` — Kcal/día objetivo
- **L238** `str` — ${profile.objetivoKcal} kcal
- **L239** `str` — Calculado automáticamente
- **L243** `str` — Restricciones
- **L246** `str` — Ninguna
- **L256** `str` — Plan de entreno actual
- **L258** `str` — Plan activo
- **L263** `str` — Días del plan
- **L264** `str` — ${activePlan.dias.length} ${activePlan.dias.length === 1 ? 'día' : 'días'}
- **L268** `str` — Predeterminado
- **L269** `str` — ${customPredeterminado.nombre} (la IA respetará este plan)
- **L282** `str` — Tus récords actuales
- **L287** `str` — ${pr.kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg
- **L294** `str` — array.length
- **L304** `str` — Personalización para la IA
- **L306** `str` — Notas
- **L310** `str` — Alergias
- **L317** `str` — Intolerancias
- **L324** `str` — Alimentos prohibidos
- **L331** `str` — Alimentos obligatorios
- **L338** `str` — Ingredientes favoritos

## src/components/AlimentosListInput.tsx
<a id="src-components-alimentoslistinput-tsx"></a>

- **L25** `str` — Alimento
- **L51** `str` — Enter
- **L69** `str` — ${ariaLabelPrefix} ${i + 1} · nombre
- **L77** `str` — Cantidad
- **L78** `str` — ${ariaLabelPrefix} ${i + 1} · cantidad
- **L86** `str` — Quitar ${al.nombre \|\| 'alimento ' + (i + 1)}
- **L101** `str` — Añadir alimento (ej. Avena)
- **L102** `str` — Nuevo ${ariaLabelPrefix.toLowerCase()} · nombre
- **L111** `str` — Cantidad (ej. 60 g)
- **L112** `str` — Nuevo ${ariaLabelPrefix.toLowerCase()} · cantidad
- **L122** `str` — Añadir alimento

## src/components/AppAvatarButton.tsx
<a id="src-components-appavatarbutton-tsx"></a>

- **L47** `str` — Abrir perfil

## src/components/BatidoInfoModal.tsx
<a id="src-components-batidoinfomodal-tsx"></a>

- **L116** `str` — ${p.toFixed(2).replace('.', ',')} €
- **L124** `str` — Producto
- **L127** `str` — Precio bote
- **L131** `str` — Gramos proteína
- **L134** `str` — Incluye creatina
- **L138** `str` — Extras
- **L139** `str` — Kcal
- **L140** `str` — Proteína
- **L141** `str` — Carbos
- **L142** `str` — Grasa
- **L178** `str` — [BTal] toggleSupInDay batido error:
- **L215** `str` — Cerrar
- **L249** `str` — Quitar del ${DAY_LABEL_FULL[day].toLowerCase()}
- **L250** `str` — Añadir al ${DAY_LABEL_FULL[day].toLowerCase()}
- **L255** `jsx` — Receta diaria
- **L371** `jsx` — Extras (texto libre)
- **L374** `str` — ej: 1 plátano + 300 ml leche semi
- **L510** `str` — [BTal] persistConfirmed batido:
- **L518** `str` — Batido actualizado
- **L531** `str` — ¿Quitar el batido del ${DAY_LABEL_FULL[day].toLowerCase()}?
- **L532** `str` — ¿Añadir el batido al ${DAY_LABEL_FULL[day].toLowerCase()}?
- **L536** `str` — Se eliminará del listado de comidas de ese día. Podrás volver a añadirlo cuando quieras.
- **L537** `str` — Se añadirá como comida extra del día con la receta que tengas configurada arriba.
- **L540** `str` — Cancelar
- **L542** `str` — Quitar
- **L542** `str` — Añadir
- **L546** `str` — [BTal] doToggleDay batido unhandled:

## src/components/ChangeEmailModal.tsx
<a id="src-components-changeemailmodal-tsx"></a>

- **L19** `str` — Email no válido.
- **L20** `str` — Este email ya está en uso.
- **L21** `str` — Operación no permitida. Revisa la configuración de Auth.
- **L23** `str` — No hemos podido enviar el email. Inténtalo de nuevo.
- **L83** `str` — Cerrar
- **L87** `jsx` — Cambiar email
- **L99** `str` — 0.82rem
- **L125** `str` — nuevocorreo@ejemplo.com
- **L143** `str` — Enviar verificación
- **L155** `str` — Cambiar tu email es una operación sensible. Confirma tu identidad para continuar.

## src/components/ChangeModeModal.tsx
<a id="src-components-changemodemodal-tsx"></a>

- **L96** `str` — [BTal] persistChange unhandled:
- **L115** `str` — No hemos podido cambiar el modo. Inténtalo de nuevo.
- **L141** `str` — Cerrar
- **L145** `jsx` — Modo de generación
- **L186** `str` — ¿Activar la generación con IA?
- **L188** `str` — A partir de ahora aparecerán botones "Generar con IA" en las pestañas Hoy, Menú y Entreno. 
- **L189** `str` — Podrás generar tu plan en cualquier momento sin perder los datos que ya tengas. 
- **L190** `str` — Recuerda: en plan Free tienes 1 generación al mes (sea total o parcial).
- **L193** `str` — Cancelar
- **L195** `str` — Activar IA
- **L209** `str` — Modo de generación actualizado

## src/components/ChangePasswordModal.tsx
<a id="src-components-changepasswordmodal-tsx"></a>

- **L22** `str` — Contraseña actual incorrecta.
- **L24** `str` — Contraseña nueva débil.
- **L26** `str` — Se ha superado el número máximo de intentos. Por favor, espere unos minutos.
- **L27** `str` — Sin conexión. Comprueba tu red.
- **L29** `str` — No hemos podido cambiar la contraseña. Inténtalo de nuevo.
- **L33** `str` — La contraseña debe tener al menos 8 caracteres.
- **L34** `str` — Debe incluir al menos una letra mayúscula.
- **L35** `str` — Debe incluir al menos un número.
- **L36** `str` — Debe incluir al menos un carácter especial.
- **L88** `str` — Las contraseñas nuevas no coinciden.
- **L92** `str` — La nueva contraseña debe ser distinta de la actual.
- **L127** `str` — Cerrar
- **L131** `jsx` — Cambiar contraseña
- **L144** `str` — Tu contraseña actual
- **L156** `str` — Ocultar contraseña
- **L156** `str` — Mostrar contraseña
- **L170** `str` — Continuar
- **L195** `str` — Contraseña nueva
- **L219** `str` — Confirmar nueva
- **L241** `str` — Guardar nueva contraseña
- **L252** `str` — 0.82rem

## src/components/ChipsInput.tsx
<a id="src-components-chipsinput-tsx"></a>

- **L57** `str` — Enter
- **L60** `str` — Backspace
- **L87** `str` — Añadir
- **L95** `str` — ${chip}-${i}
- **L101** `str` — Quitar ${chip}

## src/components/CompraCategoriaEditorModal.tsx
<a id="src-components-compracategoriaeditormodal-tsx"></a>

- **L49** `str` — Lima
- **L50** `str` — Cian
- **L51** `str` — Azul
- **L52** `str` — Violeta
- **L53** `str` — Coral
- **L54** `str` — Dorado
- **L121** `str` — Nombre
- **L122** `str` — Icono
- **L123** `str` — Color
- **L189** `str` — [BTal] restoreCompraCategoria error:
- **L214** `str` — Cerrar
- **L225** `str` — Editar categoría
- **L225** `str` — Nueva categoría
- **L235** `jsx` — Nombre
- **L240** `str` — Frutas y verduras
- **L248** `jsx` — Icono
- **L253** `str` — Cambiar icono
- **L269** `jsx` — Color de acento
- **L318** `str` — Guardar
- **L318** `str` — Crear
- **L358** `jsx` — Elige un icono
- **L376** `str` — [BTal] persistConfirmed cat:
- **L384** `str` — ¿Eliminar categoría?
- **L385** `str` — Se eliminará "${categoria?.nombre ?? ''}" y los productos que tenga dentro. Tendrás 5 segundos para deshacer.
- **L387** `str` — Cancelar
- **L389** `str` — Eliminar
- **L401** `str` — Categoría actualizada
- **L401** `str` — Categoría creada
- **L412** `str` — Categoría "${undoToast.categoria.nombre}" eliminada
- **L420** `str` — Deshacer
- **L424** `str` — [BTal] handleUndo cat error:

## src/components/CompraItemEditorModal.tsx
<a id="src-components-compraitemeditormodal-tsx"></a>

- **L157** `str` — ${formatPrecio(p)} €
- **L186** `str` — Nombre
- **L187** `str` — Cantidad
- **L190** `str` — Precio
- **L260** `str` — [BTal] restoreCompraItem error:
- **L285** `str` — Cerrar
- **L296** `str` — Editar producto
- **L296** `str` — Añadir producto
- **L303** `jsx` — Nombre
- **L308** `str` — Pechuga de pollo
- **L316** `jsx` — Cantidad
- **L321** `str` — 1 kg, 500 g, 1 docena…
- **L328** `jsx` — Precio (€)
- **L383** `str` — Guardar cambios
- **L383** `str` — Añadir
- **L409** `str` — ¿Quitar de la lista?
- **L410** `str` — Eliminaremos "${item?.nombre ?? ''}" de ${categoria.nombre.toLowerCase()}. Tendrás 5 segundos para deshacer.
- **L412** `str` — Cancelar
- **L414** `str` — Quitar
- **L428** `str` — [BTal] persistConfirmed item:
- **L436** `str` — Producto actualizado
- **L436** `str` — Producto añadido
- **L447** `str` — "${undoToast.item.nombre}" eliminado
- **L455** `str` — Deshacer
- **L459** `str` — [BTal] handleUndo error:

## src/components/ConfirmDiffAlert.tsx
<a id="src-components-confirmdiffalert-tsx"></a>

- **L57** `str` — Sin cambios
- **L57** `str` — ¿Confirmar cambios?
- **L66** `str` — Cerrar
- **L84** `jsx` — Antes:
- **L89** `jsx` — Después:

## src/components/CreatinaInfoModal.tsx
<a id="src-components-creatinainfomodal-tsx"></a>

- **L100** `str` — ${p.toFixed(2).replace('.', ',')} €
- **L106** `str` — Producto
- **L109** `str` — Precio bote
- **L113** `str` — Gramos por dosis
- **L114** `str` — Notas
- **L143** `str` — [BTal] toggleSupInDay creatina error:
- **L179** `str` — Cerrar
- **L220** `str` — Quitar del ${DAY_LABEL_FULL[day].toLowerCase()}
- **L221** `str` — Añadir al ${DAY_LABEL_FULL[day].toLowerCase()}
- **L225** `jsx` — Dosis
- **L284** `jsx` — Notas (texto libre)
- **L287** `str` — ej: con agua / antes del entreno
- **L337** `str` — [BTal] persistConfirmed creatina:
- **L345** `str` — Creatina actualizada
- **L357** `str` — ¿Quitar la creatina del ${DAY_LABEL_FULL[day].toLowerCase()}?
- **L358** `str` — ¿Añadir la creatina al ${DAY_LABEL_FULL[day].toLowerCase()}?
- **L362** `str` — Se eliminará del listado de comidas de ese día. Podrás volver a añadirla cuando quieras.
- **L363** `str` — Se añadirá como dosis suelta del día con los gramos que tengas configurados arriba.
- **L366** `str` — Cancelar
- **L368** `str` — Quitar
- **L368** `str` — Añadir
- **L372** `str` — [BTal] doToggleDay creatina unhandled:

## src/components/DeleteAccountModal.tsx
<a id="src-components-deleteaccountmodal-tsx"></a>

- **L21** `str` — Sin conexión. Comprueba tu red.
- **L22** `str` — La cuenta ya no existe.
- **L24** `str` — No hemos podido eliminar la cuenta. Inténtalo de nuevo.
- **L90** `str` — Cerrar
- **L97** `jsx` — ¿Eliminar tu cuenta?
- **L99** `jsx` — permanente y no se puede deshacer
- **L107** `jsx` — Tu perfil y todos tus datos se borrarán.
- **L108** `jsx` — Si tienes una suscripción activa, debe cancelarse antes (próximamente).
- **L109** `jsx` — No podrás recuperar la cuenta más adelante.
- **L149** `str` — Eliminar cuenta
- **L160** `str` — Eliminar tu cuenta es una operación irreversible. Confirma tu identidad para continuar.

## src/components/DeleteIndicator.tsx
<a id="src-components-deleteindicator-tsx"></a>

- **L28** `str` — Eliminando…
- **L29** `str` — Eliminado correctamente
- **L30** `str` — Error al eliminar

## src/components/DeleteStatusToast.tsx
<a id="src-components-deletestatustoast-tsx"></a>

- **L25** `str` — Eliminando…
- **L26** `str` — Eliminado correctamente
- **L27** `str` — Error al eliminar

## src/components/DiaEditorModal.tsx
<a id="src-components-diaeditormodal-tsx"></a>

- **L59** `jsx` — Promise
- **L207** `str` — Título del día
- **L212** `str` — Tipo principal
- **L214** `str` — Tipo principal (nombre del tipo personalizado)
- **L222** `str` — Al menos un ejercicio (nombre)
- **L310** `str` — Cerrar
- **L332** `str` — ej. "Día A · Empuje"
- **L340** `jsx` — Día de la semana
- **L348** `jsx` — — Sin asignar —
- **L349** `str` — DÍA
- **L353** `str` — LUN/MAR/...
- **L355** `str` — Día
- **L367** `jsx` — Descripción
- **L372** `str` — ej. "Pecho · Tríceps · Hombros"
- **L379** `str` — Sólo min
- **L379** `str` — H + min
- **L384** `jsx` — Duración del entreno
- **L447** `str` — Horas
- **L464** `str` — Minutos
- **L505** `jsx` — (OPCIONAL)
- **L547** `str` — ejercicio seleccionado
- **L548** `str` — ejercicios seleccionados
- **L581** `str` — Guardando…
- **L582** `str` — Guardado
- **L582** `str` — Error
- **L637** `str` — Faltan campos obligatorios
- **L650** `str` — Entendido
- **L653** `str` — ¿Confirmar cambios?
- **L660** `str` — [BTal] persistConfirmed:
- **L669** `str` — ¿Eliminar ejercicio?
- **L674** `str` — ejercicio ${confirmDeleteEj + 1}
- **L679** `str` — Cancelar
- **L681** `str` — Eliminar
- **L696** `str` — ¿Eliminar día?
- **L698** `str` — Día ${diaIdx + 1}
- **L708** `str` — [BTal] onDelete dia error:
- **L719** `str` — Día guardado
- **L754** `jsx` — — Ninguno —
- **L770** `str` — Nombre del tipo
- **L895** `str` — ✏ Personalizado…
- **L901** `str` — Seleccionar ejercicio
- **L903** `jsx` — — Selecciona un ejercicio —
- **L913** `str` — Otro
- **L926** `str` — Personalizado…
- **L928** `str` — estoy escribiendo uno mío desde cero
- **L934** `str` — Escribe el nombre del ejercicio
- **L943** `str` — 30 min
- **L950** `str` — ej. 30 min
- **L958** `str` — Volver a selectores Series × Reps
- **L966** `jsx` — Series
- **L971** `str` — Número de series
- **L983** `jsx` — Reps
- **L988** `str` — Reps mínimas
- **L1002** `jsx` — Hasta
- **L1007** `str` — Reps máximas
- **L1031** `str` — Cambiar a texto libre (ej. "30 min")
- **L1032** `str` — Cambiar a texto libre
- **L1047** `str` — Notas (opcional)
- **L1055** `str` — Quitar ejercicio ${idx + 1}

## src/components/DuplicateMealExtraModal.tsx
<a id="src-components-duplicatemealextramodal-tsx"></a>

- **L104** `str` — No se pudo duplicar la comida. Inténtalo de nuevo.
- **L115** `str` — Comida duplicada
- **L116** `str` — Duplicada en ${added.length} días
- **L125** `str` — [BTal] duplicateMealExtra unhandled:
- **L129** `str` — Comida
- **L132** `str` — Selecciona uno o más días
- **L134** `str` — Duplicar a 1 día
- **L135** `str` — Duplicar a ${selected.size} días
- **L156** `str` — Cerrar
- **L170** `str` — Días destino

## src/components/DuplicateMealModal.tsx
<a id="src-components-duplicatemealmodal-tsx"></a>

- **L27** `str` — Desayuno
- **L28** `str` — Comida
- **L29** `str` — Merienda
- **L30** `str` — Cena
- **L131** `str` — No se pudo duplicar la comida. Inténtalo de nuevo.
- **L148** `str` — [BTal] duplicateMeal unhandled:
- **L154** `str` — Selecciona uno o más días
- **L156** `str` — Duplicar a 1 día
- **L157** `str` — Duplicar a ${selected.size} días
- **L178** `str` — Cerrar
- **L192** `str` — Días destino
- **L234** `str` — 1 comida que ya tienes
- **L235** `str` — ${overwriteCount} comidas que ya tienes
- **L266** `str` — ¿Sobrescribir comidas existentes?
- **L269** `str` — Uno de los días seleccionados ya tiene una comida en este slot. Si continúas, la reemplazaremos por la copia.
- **L270** `str` — ${overwriteCount} de los días seleccionados ya tienen comida en este slot. Si continúas, las reemplazaremos por la copia.
- **L273** `str` — Cancelar
- **L275** `str` — Sobrescribir
- **L291** `str` — Comida duplicada
- **L292** `str` — Duplicada en ${selected.size} días

## src/components/EditFitnessProfileModal.tsx
<a id="src-components-editfitnessprofilemodal-tsx"></a>

- **L263** `jsx` — = 14 && data.edad
- **L264** `jsx` — = 30 && data.peso
- **L265** `jsx` — = 120 && data.altura
- **L268** `jsx` — = 0 && data.diasEntreno
- **L284** `str` — Nombre
- **L285** `str` — Edad
- **L286** `str` — Peso (kg)
- **L287** `str` — Altura (cm)
- **L290** `str` — Sexo
- **L291** `str` — Hombre
- **L291** `str` — Mujer
- **L294** `str` — Actividad
- **L295** `str` — Días entreno
- **L296** `str` — Equipamiento
- **L297** `str` — Objetivo
- **L300** `str` — Restricciones
- **L304** `str` — Notas
- **L318** `str` — No hemos podido guardar los cambios. Inténtalo de nuevo.
- **L348** `str` — Cerrar
- **L352** `jsx` — Editar datos del perfil
- **L359** `jsx` — Datos personales
- **L362** `jsx` — Nombre
- **L374** `jsx` — Edad
- **L388** `jsx` — Sexo
- **L412** `jsx` — Peso (lb)
- **L425** `jsx` — Peso (kg)
- **L444** `jsx` — Altura (ft / in)
- **L470** `jsx` — Altura (cm)
- **L487** `jsx` — Estilo de vida
- **L489** `jsx` — Nivel de actividad
- **L505** `jsx` — Días de entreno por semana
- **L520** `jsx` — Equipamiento disponible
- **L536** `jsx` — Objetivo
- **L538** `jsx` — ¿Qué quieres conseguir?
- **L591** `jsx` — Objetivo de kcal/día
- **L599** `str` — Sugerido: ${sugerido} kcal
- **L599** `str` — Necesitas rellenar tu perfil
- **L613** `str` — Calculado: ${sugerido} kcal · puedes ajustarlo o dejarlo vacío para usar el sugerido.
- **L614** `str` — Rellena edad, peso, altura, sexo, actividad y objetivo para ver el sugerido.
- **L621** `jsx` — Personalización para la IA
- **L627** `str` — Cuéntanos más
- **L628** `str` — Objetivos específicos, lesiones, preferencias…
- **L633** `str` — Ej: quiero ganar masa muscular sin perder definición · tengo dolor en el hombro derecho · prefiero recetas rápidas entre semana · …
- **L643** `str` — Alergias
- **L644** `str` — Las 14 declarables del Reglamento UE + lo que añadas
- **L647** `jsx` — Más comunes
- **L664** `jsx` — Otras alergias
- **L667** `str` — Escribe y pulsa Enter (ej: melocotón)
- **L677** `str` — Añadir otra alergia
- **L682** `str` — Intolerancias
- **L683** `str` — Lactosa, fructosa, FODMAP… o lo que necesites
- **L714** `jsx` — Otras intolerancias
- **L717** `str` — Escribe y pulsa Enter
- **L727** `str` — Añadir otra intolerancia
- **L732** `str` — Alimentos prohibidos
- **L733** `str` — No quiero ver esto en mis comidas
- **L738** `str` — Ej: hígado, coliflor, atún…
- **L741** `str` — Añadir alimento prohibido
- **L746** `str` — Alimentos obligatorios
- **L747** `str` — Quiero que aparezcan sí o sí
- **L752** `str` — Ej: salmón al menos 2 veces, arroz a diario…
- **L755** `str` — Añadir alimento obligatorio
- **L760** `str` — Ingredientes favoritos
- **L761** `str` — La IA los priorizará en el plan
- **L766** `str` — Ej: aguacate, huevos, espinacas…
- **L769** `str` — Añadir ingrediente favorito
- **L800** `str` — [BTal] persistConfirmed fitness:
- **L808** `str` — Datos del perfil guardados

## src/components/EditProfileModal.tsx
<a id="src-components-editprofilemodal-tsx"></a>

- **L26** `str` — Sin conexión. Comprueba tu red.
- **L27** `str` — Tu sesión es vieja. Cierra sesión y vuelve a entrar.
- **L29** `str` — No hemos podido guardar el perfil. Inténtalo de nuevo.
- **L84** `str` — La imagen es demasiado grande. Prueba con otra más simple — todavía no tenemos almacenamiento para fotos en alta resolución.
- **L90** `str` — [BTal] resize image error:
- **L91** `str` — No hemos podido procesar la imagen.
- **L118** `str` — Nombre
- **L122** `str` — Foto
- **L123** `str` — Definida
- **L124** `str` — Cambiada
- **L184** `str` — Cerrar
- **L188** `jsx` — Editar perfil
- **L195** `str` — Foto de perfil
- **L240** `str` — image/*
- **L260** `str` — Tu nombre
- **L283** `str` — Guardar
- **L294** `str` — [BTal] persistConfirmed user profile:

## src/components/EditSupStockModal.tsx
<a id="src-components-editsupstockmodal-tsx"></a>

- **L107** `str` — ${p.toFixed(2).replace('.', ',')} €
- **L120** `str` — Nombre
- **L123** `str` — Precio bote
- **L127** `str` — Stock (g)
- **L174** `str` — PRODUCTO · BATIDO
- **L174** `str` — PRODUCTO · CREATINA
- **L195** `str` — Cerrar
- **L218** `jsx` — Nombre del producto
- **L225** `str` — ej. "Whey Iso 100"
- **L226** `str` — ej. "Creatina Monohidrato"
- **L234** `jsx` — Precio del bote (€)
- **L241** `str` — (no definido)
- **L256** `jsx` — Gramos en el bote
- **L278** `str` — batido posible
- **L279** `str` — batidos posibles
- **L281** `str` — dosis posible
- **L282** `str` — dosis posibles
- **L317** `str` — [BTal] persistConfirmed sup stock:
- **L325** `str` — Producto actualizado

## src/components/EnableTotpModal.tsx
<a id="src-components-enabletotpmodal-tsx"></a>

- **L22** `str` — Código incorrecto. Mira la app authenticator y vuelve a intentarlo.
- **L23** `str` — Código caducado. Pide uno nuevo en tu app.
- **L24** `str` — Se ha agotado el tiempo. Vuelve a empezar.
- **L25** `str` — TOTP no está habilitado. Actívalo en Firebase Console → Authentication → Sign-in method → Verificación en dos pasos.
- **L26** `str` — Necesitas verificar tu email antes de activar 2FA. Mira tu bandeja (y spam) y haz click en el enlace.
- **L27** `str` — Operación bloqueada por configuración del proyecto. Revisa Identity Platform.
- **L28** `str` — Tu sesión es vieja. Cierra sesión y vuelve a entrar.
- **L30** `str` — No hemos podido activar MFA (${code \|\| 'error desconocido'}).
- **L62** `str` — [BTal] startTotpEnrollment error:
- **L79** `str` — Authenticator
- **L113** `str` — Cerrar
- **L119** `jsx` — Activar verificación en dos pasos
- **L120** `jsx` — Generando código QR…
- **L133** `jsx` — 1. Escanea
- **L142** `str` — 0.82rem
- **L148** `jsx` — 2. Verifica
- **L175** `str` — Activar
- **L183** `jsx` — ¡Activado!
- **L201** `str` — Activar la verificación en dos pasos es una operación sensible. Confirma tu identidad para continuar.

## src/components/ErrorBoundary.tsx
<a id="src-components-errorboundary-tsx"></a>

- **L19** `str` — [BTal] ErrorBoundary:
- **L48** `str` — Inter, sans-serif
- **L51** `str` — 1.4rem
- **L58** `str` — 0.92rem
- **L81** `str` — 0.95rem
- **L95** `str` — 1px solid var(--btal-border-2, #2e3530)

## src/components/ForgotPasswordModal.tsx
<a id="src-components-forgotpasswordmodal-tsx"></a>

- **L18** `str` — Email no válido.
- **L19** `str` — No existe una cuenta con este email.
- **L20** `str` — Demasiados intentos. Espera un momento.
- **L21** `str` — Sin conexión. Comprueba tu red.
- **L23** `str` — No hemos podido enviar el email. Inténtalo de nuevo.
- **L70** `str` — Cerrar
- **L74** `jsx` — Restablecer contraseña
- **L106** `str` — tucorreo@ejemplo.com
- **L124** `str` — Enviar email

## src/components/GeneratingScreen.tsx
<a id="src-components-generatingscreen-tsx"></a>

- **L30** `str` — Generando con IA
- **L31** `str` — Estamos creando tu plan personalizado. No cierres la app — esto puede tardar unos segundos.

## src/components/GuestBanner.tsx
<a id="src-components-guestbanner-tsx"></a>

- **L126** `str` — Ocultar detalles del modo prueba
- **L127** `str` — Ver detalles del modo prueba
- **L135** `str` — · caduca hoy
- **L137** `str` — · 1 día restante
- **L138** `str` — · ${guestDaysLeft} días restantes
- **L152** `str` — Ocultar aviso (sigue accesible desde el perfil)
- **L153** `str` — Ocultar (sigue accesible desde el perfil)
- **L167** `str` — 3 días
- **L169** `str` — menos de un día
- **L171** `str` — 1 día
- **L172** `str` — ${guestDaysLeft} días
- **L174** `jsx` — todos tus datos se borrarán permanentemente
- **L205** `str` — Aviso oculto. Sigue accesible en tu perfil (avatar arriba a la derecha → datos de Modo prueba).

## src/components/IconPicker.tsx
<a id="src-components-iconpicker-tsx"></a>

- **L46** `str` — Comida
- **L47** `str` — Bebidas
- **L48** `str` — Fitness
- **L49** `str` — Deportes
- **L50** `str` — Cocina
- **L51** `str` — Casa
- **L52** `str` — Natura
- **L53** `str` — Otros
- **L81** `str` — [IconPicker] Failed to preload Tabler
- **L120** `str` — Resultados (${filtered.length})
- **L129** `str` — Buscar (ej. manzana, fuego, mancuerna)…
- **L132** `str` — Buscar icono
- **L191** `str` — Iconos
- **L196** `jsx` — Cargando iconos…
- **L200** `str` — Sin resultados para "${query}"
- **L201** `str` — Sin iconos en esta categoría
- **L225** `jsx` — 0 && visible.length
- **L226** `jsx` — cargando más…

## src/components/LegalLink.tsx
<a id="src-components-legallink-tsx"></a>

- **L64** `str` — Cerrar

## src/components/LinkGuestAccountModal.tsx
<a id="src-components-linkguestaccountmodal-tsx"></a>

- **L32** `str` — Ese email ya tiene una cuenta. Si es tuya, inicia sesión (perderás los cambios del invitado).
- **L34** `str` — Esa cuenta ya está vinculada a otro usuario.
- **L35** `str` — Email no válido.
- **L36** `str` — Contraseña débil (mínimo 6 caracteres).
- **L37** `str` — Sin conexión. Comprueba tu red.
- **L41** `str` — No hemos podido crear tu cuenta. Inténtalo de nuevo.
- **L46** `str` — La contraseña debe tener al menos 8 caracteres.
- **L47** `str` — Debe incluir al menos una letra mayúscula.
- **L48** `str` — Debe incluir al menos un número.
- **L49** `str` — Debe incluir al menos un carácter especial.
- **L87** `str` — Las contraseñas no coinciden.
- **L146** `str` — Cerrar
- **L150** `jsx` — Crea tu cuenta
- **L153** `jsx` — Todos los cambios que has hecho como invitado se conservarán
- **L163** `str` — tucorreo@ejemplo.com
- **L177** `str` — Contraseña
- **L189** `str` — Ocultar contraseña
- **L189** `str` — Mostrar contraseña
- **L200** `str` — Confirmar contraseña
- **L260** `str` — Cuenta creada · tus cambios se han guardado

## src/components/MealEditorModal.tsx
<a id="src-components-mealeditormodal-tsx"></a>

- **L31** `str` — Desayuno
- **L32** `str` — Comida
- **L33** `str` — Merienda
- **L34** `str` — Cena
- **L138** `str` — Plato
- **L139** `str` — Hora
- **L142** `str` — Alimentos
- **L143** `str` — ${original.alimentos.length} alimentos
- **L144** `str` — ${cleaned.alimentos.length} alimentos
- **L146** `str` — Kcal
- **L147** `str` — Proteína
- **L148** `str` — Carbos
- **L149** `str` — Grasa
- **L162** `str` — No hemos podido guardar. Comprueba tu conexión y vuelve a intentarlo.
- **L213** `str` — Cerrar
- **L225** `str` — Cambiar icono
- **L266** `jsx` — Nombre del plato
- **L270** `str` — ej. "Bowl de avena con plátano"
- **L298** `jsx` — Alimentos
- **L302** `str` — Alimento
- **L306** `jsx` — Macros
- **L315** `str` — proteína (g)
- **L321** `str` — carbos (g)
- **L327** `str` — grasas (g)
- **L335** `jsx` — Guardar
- **L337** `str` —  Esta comida quedará marcada como tuya — la IA no la modificará en futuras regeneraciones.
- **L363** `str` — [BTal] persistConfirmed meal:
- **L374** `str` — ¿Salir sin guardar?
- **L375** `str` — Tienes cambios sin guardar en esta comida. Si sales ahora se perderán.
- **L377** `str` — Seguir editando
- **L379** `str` — Salir sin guardar

## src/components/MealExtraEditorModal.tsx
<a id="src-components-mealextraeditormodal-tsx"></a>

- **L171** `str` — título
- **L184** `str` — Faltan campos obligatorios: 
- **L200** `str` — Nombre del bloque
- **L202** `str` — Plato
- **L203** `str` — Hora
- **L207** `str` — Tipo
- **L212** `str` — Alimentos
- **L214** `str` — ${cleaned.alimentos.length} alimentos
- **L217** `str` — Kcal
- **L218** `str` — Proteína
- **L219** `str` — Carbos
- **L220** `str` — Grasa
- **L228** `str` — Comida normal
- **L234** `str` — ${original.alimentos.length} alimentos
- **L269** `str` — No hemos podido guardar. Comprueba tu conexión y vuelve a intentarlo.
- **L312** `str` — Cerrar
- **L324** `str` — Cambiar icono
- **L336** `str` — NUEVA COMIDA
- **L337** `str` — EDITAR COMIDA
- **L374** `str` — ej. "PRE-ENTRENO"
- **L388** `jsx` — Nombre del plato
- **L392** `str` — ej. "Plátano y café"
- **L400** `str` — Marcar como EXTRA
- **L446** `jsx` — Alimentos
- **L450** `str` — Alimento
- **L454** `jsx` — Macros
- **L463** `str` — proteína (g)
- **L469** `str` — carbos (g)
- **L475** `str` — grasas (g)
- **L484** `jsx` — Guardar
- **L489** `jsx` — título
- **L518** `str` — Crear comida
- **L518** `str` — Guardar
- **L523** `str` — salir sin guardar
- **L525** `str` — Deshacer
- **L554** `str` — [BTal] persistConfirmed meal extra:
- **L562** `str` — ¿Salir sin guardar?
- **L565** `str` — Si sales ahora la nueva comida no se creará.
- **L566** `str` — Tienes cambios sin guardar en esta comida. Si sales ahora se perderán.
- **L569** `str` — Seguir editando
- **L571** `str` — Salir sin guardar

## src/components/MealIcon.tsx
<a id="src-components-mealicon-tsx"></a>

- **L90** `str` — [MealIcon] Failed to load Tabler module

## src/components/MealSheet.tsx
<a id="src-components-mealsheet-tsx"></a>

- **L23** `str` — Desayuno
- **L24** `str` — Comida
- **L25** `str` — Merienda
- **L26** `str` — Cena
- **L103** `str` — esta comida
- **L142** `str` —  · ${comida.hora}
- **L149** `str` — Cerrar
- **L166** `jsx` — Aún no has añadido nada para .
- **L194** `str` — Habilitar
- **L194** `str` — Deshabilitar
- **L202** `jsx` — Ingredientes
- **L205** `str` — ${al.nombre}-${i}
- **L216** `str` — kcal/proteína/carbos/grasas
- **L219** `jsx` — Macros
- **L233** `jsx` — proteína
- **L263** `str` — Eliminar comida
- **L287** `str` — Habilitar comida · volverá a contar en el total
- **L288** `str` — Deshabilitar comida · dejará de contar en el total

## src/components/PlanEditorModal.tsx
<a id="src-components-planeditormodal-tsx"></a>

- **L46** `jsx` — Promise
- **L96** `str` — Día 1
- **L118** `str` — Día ${cur.length + 1}
- **L144** `str` — Nombre del plan
- **L146** `str` — Al menos un día de entrenamiento
- **L150** `str` — Título del día ${i + 1}
- **L181** `str` — Día
- **L242** `str` — Cerrar
- **L247** `str` — Editar plan
- **L247** `str` — Nuevo plan
- **L251** `str` — Edita el nombre y los días del plan. Para cambiar los ejercicios de un día, ciérralo y púlsalo en la lista.
- **L252** `str` — Crea un plan personalizado con tus propios días y ejercicios. Después podrás editarlos uno por uno.
- **L264** `str` — ej. "Plan 5 Días — Push/Pull/Legs"
- **L308** `str` — día seleccionado
- **L308** `str` — días seleccionados
- **L323** `str` — Día ${i + 1} · título obligatorio
- **L337** `jsx` — — Sin asignar —
- **L338** `str` — DÍA
- **L354** `str` — Quitar día ${i + 1}
- **L372** `str` — Guardando…
- **L373** `str` — Guardado
- **L373** `str` — Error
- **L400** `str` — Guardar
- **L400** `str` — Crear plan
- **L407** `str` — Faltan campos obligatorios
- **L420** `str` — Entendido
- **L427** `str` — ¿Eliminar día?
- **L432** `str` — Día ${confirmDeleteDia + 1}
- **L437** `str` — Cancelar
- **L439** `str` — Eliminar
- **L448** `str` — ¿Confirmar cambios?
- **L455** `str` — [BTal] persistConfirmed:
- **L463** `str` — Plan guardado
- **L463** `str` — Plan creado

## src/components/PreferencesModal.tsx
<a id="src-components-preferencesmodal-tsx"></a>

- **L85** `str` — No hemos podido guardar. Inténtalo de nuevo.
- **L118** `str` — Cerrar
- **L122** `jsx` — Preferencias
- **L130** `jsx` — Sistema de unidades
- **L158** `jsx` — Inicio de la semana
- **L188** `jsx` — Estilo del menú inferior
- **L191** `str` — Icono grande con el nombre del menú debajo.
- **L192** `str` — Solo el icono, sin el nombre del menú.
- **L215** `str` — 0.78rem
- **L229** `str` — Guardando…
- **L229** `str` — Guardar
- **L235** `str` — Preferencias guardadas

## src/components/ProfileSheet.tsx
<a id="src-components-profilesheet-tsx"></a>

- **L37** `str` — Bajo peso
- **L38** `str` — Saludable
- **L39** `str` — Sobrepeso
- **L40** `str` — Obesidad
- **L78** `str` — Perfil
- **L124** `str` — Sesión temporal · invitado
- **L130** `str` — Cerrar
- **L142** `str` — Como invitado no tienes datos de perfil guardados. Crea una cuenta para personalizar tu plan.
- **L143** `str` — Aún no has completado tu perfil. Cuéntanos sobre ti para que podamos generar tu plan.
- **L152** `jsx` — Peso
- **L158** `jsx` — Altura
- **L182** `jsx` — Objetivo
- **L188** `jsx` — Equipamiento
- **L192** `jsx` — Actividad
- **L196** `jsx` — Días de entreno
- **L198** `str` — ${p.diasEntreno} / semana
- **L205** `jsx` — Restricciones
- **L219** `str` — Editar datos del perfil
- **L239** `str` — Editar perfil
- **L240** `str` — Ajustes
- **L279** `str` — ¿Cerrar sesión?
- **L282** `str` — Tu sesión de invitado caducará en su plazo habitual (3 días). Si la cierras ahora perderás el acceso desde este dispositivo aunque la cuenta siga viva.
- **L283** `str` — Tendrás que volver a iniciar sesión para acceder a tus datos.
- **L286** `str` — Cancelar
- **L288** `str` — Cerrar sesión

## src/components/ReauthModal.tsx
<a id="src-components-reauthmodal-tsx"></a>

- **L22** `str` — Contraseña incorrecta.
- **L23** `str` — Credenciales no válidas.
- **L24** `str` — Demasiados intentos. Espera un momento.
- **L25** `str` — Sin conexión. Comprueba tu red.
- **L29** `str` — No hemos podido confirmar tu identidad. Inténtalo de nuevo.
- **L37** `str` — google.com
- **L96** `str` — Cerrar
- **L100** `jsx` — Confirma tu identidad
- **L102** `str` — Por seguridad, te pedimos confirmar tu identidad antes de continuar.
- **L112** `str` — Tu contraseña actual
- **L130** `str` — Confirmar

## src/components/SaveIndicator.tsx
<a id="src-components-saveindicator-tsx"></a>

- **L27** `str` — Guardando…
- **L28** `str` — Guardado
- **L29** `str` — Error al guardar

## src/components/SaveStatusToast.tsx
<a id="src-components-savestatustoast-tsx"></a>

- **L39** `str` — Guardando…
- **L40** `str` — Guardado
- **L41** `str` — Error al guardar

## src/components/StepMode.tsx
<a id="src-components-stepmode-tsx"></a>

- **L68** `jsx` — Recomendado
- **L74** `jsx` — 1 generación gratis al mes · ilimitado en Pro
- **L88** `jsx` — Lo relleno yo mismo
- **L94** `jsx` — Sin coste · sin límites de uso

## src/components/StreakBadge.tsx
<a id="src-components-streakbadge-tsx"></a>

- **L12** `str` — Días consecutivos entrenando. Solo cuentan los días con entrenamiento 
- **L13** `str` — registrado · los descansos NO suman y rompen la racha.\n\n
- **L14** `str` — Cuándo se rompe:\n
- **L15** `str` — • Si registras un día como DESCANSO · rompe al instante (incluso hoy)\n
- **L16** `str` — • Si pasa un día completo sin registrar nada · rompe al día siguiente\n\n
- **L17** `str` — Excepción (margen de hoy): si HOY aún no has registrado nada pero ayer 
- **L18** `str` — sí entrenaste, la racha sigue mostrando el valor de ayer hasta que pase 
- **L19** `str` — el día · te da margen para entrenar más tarde.\n\n
- **L20** `str` — Para empezar racha: registra un entrenamiento y verás «1 día». Cada 
- **L21** `str` — entrenamiento consecutivo posterior suma +1.\n\n
- **L22** `str` — Mira tu historial completo y mejores rachas en «Gráficos» → pestaña «Rachas».
- **L55** `str` — Sin racha · pulsa para ver cómo empezar tu racha de entrenos
- **L56** `str` — Racha: ${dias} ${dias === 1 ? 'día' : 'días'} entrenando · pulsa para ver cómo funciona
- **L61** `str` — día
- **L61** `str` — días
- **L66** `str` — Racha actual
- **L69** `str` — Entendido

## src/components/SupAlertBox.tsx
<a id="src-components-supalertbox-tsx"></a>

- **L27** `jsx` — No queda
- **L28** `jsx` — Compra cuanto antes.
- **L44** `jsx` — Queda poca
- **L46** `jsx` — Hace falta comprar.

## src/components/SupCardEditor.tsx
<a id="src-components-supcardeditor-tsx"></a>

- **L125** `str` — Título
- **L126** `str` — Hora
- **L166** `str` — [BTal] handleRemove sup error:
- **L191** `str` — Cerrar
- **L206** `str` — Editar batido
- **L206** `str` — Editar creatina
- **L215** `jsx` — Título
- **L227** `jsx` — Hora
- **L242** `jsx` — Formato HH:mm
- **L287** `str` — [BTal] persistConfirmed sup card:
- **L295** `str` — Mini-card actualizada
- **L305** `str` — Batido quitado del día
- **L306** `str` — Creatina quitada del día

## src/components/SupCountersInline.tsx
<a id="src-components-supcountersinline-tsx"></a>

- **L100** `str` — [BTal] decrementarBatido error:
- **L104** `str` — [BTal] decrementarCreatina error:
- **L112** `str` — [BTal] incrementarBatido error:
- **L116** `str` — [BTal] incrementarCreatina error:
- **L213** `str` — [BTal] reset sup error:
- **L214** `str` — No se pudo reiniciar el contador. Inténtalo de nuevo.
- **L226** `str` — [BTal] undo reset error:
- **L227** `str` — No se pudo deshacer el reinicio.
- **L238** `str` — ¿Reiniciar contador semanal?
- **L240** `str` — Vamos a poner a 0 el contador de "Total esta semana". 
- **L241** `str` — Tendrás 5 segundos para deshacer la acción.
- **L246** `str` — ¿Reiniciar contador mensual?
- **L248** `str` — Vamos a poner a 0 el contador de "Total este mes". 
- **L254** `str` — ¿Reiniciar contador anual?
- **L256** `str` — Vamos a poner a 0 el contador de "Total este año". 
- **L262** `str` — ¿Reiniciar todos los contadores?
- **L264** `str` — Esta acción es IRREVERSIBLE. Va a poner a 0 los 4 
- **L265** `str` — contadores de ${productoLabel}: total, total esta 
- **L266** `str` — semana, total este mes y total este año. 
- **L267** `str` — No se podrá deshacer.
- **L279** `str` — de batidos
- **L279** `str` — de dosis
- **L291** `str` — Restar batido
- **L291** `str` — Restar dosis
- **L297** `str` — key={tomados}
- **L318** `str` — Sumar batido
- **L318** `str` — Sumar dosis
- **L322** `str` — proteína/creatina
- **L336** `str` — año natural
- **L341** `str` — Batidos totales según gr indicados
- **L342** `str` — Total dosis según gr indicados
- **L345** `str` — pos-${stats.posibles ?? 'na'}
- **L353** `str` — Batidos restantes
- **L353** `str` — Dosis restantes
- **L356** `str` — rest-${stats.restantes ?? 'na'}
- **L370** `jsx` — Total esta semana
- **L372** `str` — sem-${tomadosSemana}
- **L384** `str` — Reiniciar contador semanal
- **L391** `jsx` — Total este mes
- **L393** `str` — mes-${tomadosMes}
- **L405** `str` — Reiniciar contador mensual
- **L419** `str` — Información sobre Total este año
- **L420** `str` — ¿Qué significa Total este año?
- **L424** `jsx` — Total este año
- **L426** `str` — anio-${tomadosAnio}
- **L438** `str` — Reiniciar contador anual
- **L462** `str` — Reiniciar todos los contadores
- **L485** `str` — Cancelar
- **L487** `str` — Reiniciar
- **L492** `str` — [BTal] doReset unhandled:
- **L499** `str` — Total este año
- **L506** `str` — Año natural: cuenta del 1 de enero al 31 de diciembre del 
- **L507** `str` — año en curso. Se reinicia automáticamente cada 1 de enero.
- **L509** `str` — Cerrar
- **L512** `str` — Contador reseteado
- **L516** `str` — Contador reiniciado
- **L522** `str` — Deshacer
- **L528** `str` — Contador ${undoSnapshot.kind} reiniciado
- **L540** `str` — [BTal] handleUndo unhandled:

## src/components/TotpSignInModal.tsx
<a id="src-components-totpsigninmodal-tsx"></a>

- **L19** `str` — Código incorrecto. Inténtalo de nuevo.
- **L20** `str` — Código caducado. Pide uno nuevo en tu app.
- **L21** `str` — Se ha agotado el tiempo. Vuelve a iniciar sesión.
- **L23** `str` — No hemos podido verificar el código.
- **L78** `str` — Cerrar
- **L82** `jsx` — Verificación en dos pasos
- **L114** `str` — Verificar

## src/components/TrainSheet.tsx
<a id="src-components-trainsheet-tsx"></a>

- **L71** `str` — Cerrar
- **L78** `str` — Día sin título
- **L87** `str` — tag ${t.cls}
- **L96** `jsx` — Aún no hay ejercicios en este día.

## src/components/VerifyEmailBanner.tsx
<a id="src-components-verifyemailbanner-tsx"></a>

- **L25** `str` — Se ha superado el número máximo de intentos. Por favor, espere unos minutos antes de solicitar un nuevo correo electrónico.
- **L26** `str` — Sin conexión. Comprueba tu red.
- **L28** `str` — No hemos podido enviar el email. Inténtalo de nuevo.
- **L32** `str` — btal_verify_dismissed_${uid}_${place}
- **L113** `jsx` — Email enviado a
- **L158** `jsx` — Verifica tu cuenta de email
- **L169** `str` — Verificar
- **L181** `str` — Cerrar aviso de verificación

## src/components/VerifyEmailRow.tsx
<a id="src-components-verifyemailrow-tsx"></a>

- **L20** `str` — Se ha superado el número máximo de intentos. Por favor, espere unos minutos antes de solicitar un nuevo correo electrónico.
- **L21** `str` — Sin conexión. Comprueba tu red.
- **L23** `str` — No hemos podido enviar el email. Inténtalo de nuevo.
- **L67** `jsx` — Verificar email
- **L86** `str` — Email enviado a ${user.email}. Revisa tu bandeja (y la carpeta de spam).
- **L87** `str` — Confirma que este email es tuyo para activar tu cuenta.

## src/components/graphs/BarChart.tsx
<a id="src-components-graphs-barchart-tsx"></a>

- **L52** `str` — Sin datos para mostrar.
- **L115** `str` — Gráfico de barras · ${data.length} valores
- **L116** `str` — xMidYMid meet
- **L144** `str` — ${i}-${d.label}
- **L156** `str` —  ${unit}
- **L159** `str` — paint-order: stroke
- **L169** `str` — 'JetBrains Mono', monospace
- **L189** `str` — rotate(-35 ${cx} ${H - PAD.bottom + 14})

## src/components/graphs/GraphsModal.tsx
<a id="src-components-graphs-graphsmodal-tsx"></a>

- **L53** `str` — Entrenos
- **L54** `str` — Pesos
- **L56** `str` — Rachas
- **L57** `str` — Supl.
- **L100** `str` — [GraphsModal] load registros failed
- **L185** `str` — Cerrar gráficos
- **L202** `str` — graphs-modal-tab${active ? ' is-active' : ''}
- **L211** `str` — key={tab}
- **L257** `jsx` — Entrenamientos por semana
- **L258** `jsx` — Últimas 12 semanas · solo cuenta días con plan de entreno (los descansos se excluyen).
- **L260** `jsx` — Cargando datos…
- **L266** `str` — Aún no hay entrenamientos registrados.
- **L301** `str` — ${d}/${m}/${y.slice(2)}
- **L314** `jsx` — Historial de rachas
- **L339** `str` — día
- **L339** `str` — días
- **L343** `str` — Aún no tienes rachas registradas.
- **L347** `str` — btal-stagger-${i + 1}
- **L351** `str` — ${s.start}-${s.end}-${i}
- **L353** `str` — graphs-pr-row btal-anim-fade-up ${staggerCls}
- **L361** `str` — ${dmys(s.start)}–${dmys(s.end)}
- **L363** `jsx` — · en curso
- **L415** `jsx` — Personal Records
- **L416** `jsx` — Tu peso máximo histórico por ejercicio (ordenado del más alto al más bajo).
- **L486** `jsx` — Evolución de peso por ejercicio
- **L487** `jsx` — Selecciona un ejercicio para ver cómo ha evolucionado tu carga máxima por sesión (últimas 10 sesiones registradas).
- **L503** `str` — sesión
- **L511** `str` — Solo hay 1 sesión · necesitas al menos 2 puntos para dibujar la evolución.
- **L516** `jsx` — p.value))} kg
- **L568** `jsx` — Suplementación tomada
- **L571** `str` — Tomar
- **L576** `str` — Periodo
- **L579** `str` — Día
- **L580** `str` — Semana
- **L582** `str` — Año
- **L590** `str` — graphs-period-btn${period === opt.p ? ' is-active' : ''}
- **L607** `str` — Aún no has registrado ningún batido.
- **L611** `str` — batido en histórico total
- **L611** `str` — batidos en histórico total
- **L625** `str` — Aún no has registrado dosis de creatina.
- **L629** `str` — dosis en histórico total

## src/components/graphs/LineChart.tsx
<a id="src-components-graphs-linechart-tsx"></a>

- **L6** `str` — 5 may
- **L28** `str` — Sin datos suficientes para el gráfico.
- **L56** `str` — ${x.toFixed(1)},${y.toFixed(1)}
- **L67** `str` — Gráfico de línea · ${data.length} puntos
- **L68** `str` — xMidYMid meet
- **L91** `str` — 'JetBrains Mono', monospace
- **L112** `str` — ${i}-${data[i].label}
- **L116** `str` —  ${unit}

## src/components/registro/RegDayPanel.tsx
<a id="src-components-registro-regdaypanel-tsx"></a>

- **L46** `jsx` — Promise
- **L75** `str` — ${x.toFixed(1)},${y.toFixed(1)}
- **L322** `str` — Selecciona un plan o "Descanso" antes de guardar.
- **L347** `str` — [RegDayPanel] save failed
- **L348** `str` — No se pudo guardar el registro. Reintenta.
- **L361** `str` — [RegDayPanel] delete failed
- **L362** `str` — No se pudo eliminar el registro. Reintenta.
- **L395** `str` — Cerrar
- **L401** `str` — Cerrar panel del día
- **L408** `str` — reg-plan-${fecha}
- **L417** `jsx` — — Selecciona —
- **L426** `str` — estrella + espacio
- **L434** `str` — PLANES POR DEFECTO
- **L443** `str` — PLANES CREADOS
- **L465** `str` — Descanso
- **L472** `jsx` — Guardar registro
- **L480** `jsx` — Registro de pesos
- **L504** `jsx` — 0 ? 'up' : delta
- **L508** `str` — btal-stagger-${exIdx + 1}
- **L512** `str` — reg-ex-row btal-anim-fade-up ${staggerCls}
- **L518** `str` — Personal Record
- **L531** `str` — Información del ejercicio
- **L548** `str` — Eliminar series
- **L551** `jsx` — Series
- **L557** `str` — Eliminar ejercicio del registro
- **L560** `jsx` — Ejercicio
- **L578** `str` — reg-ex-history-delta ${deltaCls}
- **L594** `str` — SerieRegistrada
- **L610** `str` — Serie ${i + 1} kg
- **L627** `str` — reg-notes-${fecha}
- **L629** `jsx` — (opcional)
- **L636** `str` — ¿Cómo te sentiste? ¿Algo a destacar?
- **L665** `jsx` — Eliminar registro
- **L673** `str` — ¿Eliminar registro?
- **L674** `str` — Se borrará el registro de este día (pesos y notas).
- **L676** `str` — Cancelar
- **L677** `str` — Eliminar
- **L684** `str` — ¿Eliminar ejercicio?
- **L687** `str` — Se quitará "${confirmRemoveEx}" del registro de este día.
- **L720** `str` — Eliminar series · ${deleteSeriesAlert.exName}
- **L725** `str` — Selecciona las series que quieres eliminar:
- **L726** `str` — No hay series que eliminar.
- **L732** `str` —  · vacía
- **L735** `str` — Serie ${i + 1}${detail}
- **L765** `str` — title=""
- **L773** `str` — El número de series viene del plan (${infoExSeries ?? '—'}).
- **L774** `str` —  Usa "🗑 Series" para eliminar series concretas en este registro,
- **L775** `str` —  o "🗑 Ejercicio" para excluir este ejercicio del día sin tocar el plan.
- **L778** `str` — Entendido
- **L791** `str` — ¿Descartar cambios?
- **L792** `str` — Tienes modificaciones sin guardar. Si cierras ahora, los kg y notas que hayas escrito se perderán.
- **L795** `str` — Seguir editando
- **L800** `str` — Descartar

## src/components/registro/RegistroCalendar.tsx
<a id="src-components-registro-registrocalendar-tsx"></a>

- **L20** `str` — Enero
- **L20** `str` — Febrero
- **L20** `str` — Marzo
- **L20** `str` — Abril
- **L20** `str` — Mayo
- **L20** `str` — Junio
- **L21** `str` — Julio
- **L21** `str` — Agosto
- **L21** `str` — Septiembre
- **L21** `str` — Octubre
- **L21** `str` — Noviembre
- **L21** `str` — Diciembre
- **L38** `str` — ${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}
- **L250** `str` — Mes anterior
- **L263** `str` — Cambiar mes y año
- **L271** `str` — Mes siguiente
- **L287** `str` — Información sobre el código de colores del calendario
- **L288** `str` — ¿Qué significa cada color?
- **L296** `str` — Ir a hoy
- **L305** `jsx` — Vista:
- **L308** `str` — reg-cal-view-btn${view === 'month' ? ' is-active' : ''}
- **L315** `str` — reg-cal-view-btn${view === 'week' ? ' is-active' : ''}
- **L344** `str` — Año
- **L363** `str` — Cerrar filtro
- **L372** `str` — dow-${i}
- **L378** `str` — ${c.fecha}-${i}
- **L385** `str` — ${c.dayNum} ${MES_LABELS_LARGOS[parseInt(c.fecha.slice(5, 7), 10) - 1]}${c.isDisabled ? ' (no disponible)' : ''}
- **L402** `str` — Código de colores del calendario
- **L404** `str` — AZUL · día con descanso registrado.\n\n
- **L405** `str` — LIMA · día con plan de entreno registrado.\n\n
- **L406** `str` — BORDE CYAN · día de hoy.\n\n
- **L407** `str` — FONDO LIMA · día seleccionado actualmente.\n\n
- **L408** `str` — Sin color · día sin registro · pulsa para añadir uno.
- **L410** `str` — Entendido

## src/components/registro/RegistroStatsGrid.tsx
<a id="src-components-registro-registrostatsgrid-tsx"></a>

- **L36** `str` — Racha actual
- **L38** `str` — Días consecutivos entrenando. Solo cuentan los días con entrenamiento 
- **L39** `str` — registrado · los descansos NO suman y rompen la racha.\n\n
- **L40** `str` — Cuándo se rompe:\n
- **L41** `str` — • Si registras un día como DESCANSO · rompe al instante (incluso hoy)\n
- **L42** `str` — • Si pasa un día completo sin registrar nada · rompe al día siguiente\n\n
- **L43** `str` — Excepción (margen de hoy): si HOY aún no has registrado nada pero ayer 
- **L44** `str` — sí entrenaste, la racha sigue mostrando el valor de ayer hasta que pase 
- **L45** `str` — el día · te da margen para entrenar más tarde.\n\n
- **L46** `str` — Para empezar racha: registra un entrenamiento y verás «1 día». Cada 
- **L47** `str` — entrenamiento consecutivo posterior suma +1.\n\n
- **L48** `str` — Mira tu historial completo y mejores rachas en «Gráficos» → pestaña «Rachas».
- **L51** `str` — Este mes
- **L53** `str` — Días con entrenamiento real (excluyendo descansos) registrados en el mes que estás viendo en el calendar. El segundo número es la referencia: días transcurridos del mes hasta hoy si miras el mes actual, o el total de días si miras un mes pasado.
- **L56** `str` — PR's (Personal Records)
- **L58** `str` — Número de ejercicios distintos en los que has alcanzado tu peso máximo histórico. Cada vez que superas tu récord en un ejercicio (kg más alto que cualquier sesión anterior) sube. Solo se actualiza al alza al guardar · eliminar un registro NO descuenta PR's.
- **L61** `str` — Total registrado
- **L63** `str` — Total de días con registro guardado desde que empezaste a usar la app · suma entrenos y descansos. Cada save de un día nuevo lo aumenta en 1, cada delete lo reduce en 1.
- **L81** `str` — sin racha · ¡empieza hoy!
- **L82** `str` — días consecutivos
- **L84** `str` — ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}
- **L86** `str` — día consecutivo
- **L88** `str` — hasta ayer · regístra hoy para sumar
- **L95** `str` — ejercicio con récord
- **L96** `str` — ejercicios con récord
- **L98** `str` — día registrado
- **L99** `str` — días registrados
- **L112** `str` — Racha actual · ${rachaActual} · pulsa para ver qué mide
- **L133** `str` — Este mes · ${esteMesEntrenados} · pulsa para ver qué mide
- **L154** `str` — PR's · ${prsTotal} · pulsa para ver qué mide
- **L175** `str` — Total · ${totalEntrenos} · pulsa para ver qué mide
- **L194** `str` — Entendido

## src/config/contact.ts
<a id="src-config-contact-ts"></a>

- **L16** `str` — soporte@btal.app
- **L19** `str` — btal-app.web.app

## src/hooks/AdblockBanner.tsx
<a id="src-hooks-adblockbanner-tsx"></a>

- **L41** `str` — Failed to fetch
- **L42** `str` — NetworkError
- **L103** `jsx` — Conexión bloqueada
- **L114** `str` — Ocultar aviso una hora

## src/hooks/AuthContext.tsx
<a id="src-hooks-authcontext-tsx"></a>

- **L41** `str` — [BTal] redirect result error:
- **L56** `str` — [BTal] refreshUser reload error:

## src/hooks/OfflineBanner.tsx
<a id="src-hooks-offlinebanner-tsx"></a>

- **L65** `jsx` — Sin conexión
- **L66** `jsx` — Reconecta para guardar tus cambios.
- **L72** `str` — Conexión restablecida

## src/hooks/PreferencesProvider.tsx
<a id="src-hooks-preferencesprovider-tsx"></a>

- **L146** `str` — [BTal] migrate preferences error:
- **L152** `str` — No hemos podido sincronizar tus preferencias con la nube. 
- **L153** `str` — Siguen funcionando en este dispositivo.
- **L225** `str` — [BTal] save preferences error:
- **L226** `str` — No hemos podido guardar tus preferencias. Comprueba tu conexión.
- **L259** `str` — [BTal] save preferences (registroCal) error:
- **L273** `str` — [BTal] save preferences (navStyle) error:
- **L274** `str` — No hemos podido guardar el estilo del menú. Comprueba tu conexión.

## src/hooks/ProfileProvider.tsx
<a id="src-hooks-profileprovider-tsx"></a>

- **L175** `jsx` — new Promise
- **L181** `jsx` — (p: Promise
- **L181** `jsx` — , ms: number): Promise
- **L184** `str` — timeout tras ${ms}ms
- **L299** `str` — [BTal] touchLastActive error:
- **L303** `str` — [BTal] getUserDocument error:
- **L304** `str` — No hemos podido cargar tu perfil.
- **L322** `str` — No hay usuario autenticado.
- **L1187** `str` — Máximo ${MAX_EXTRAS_POR_DIA} comidas extras por día.
- **L2149** `str` — No se puede eliminar un plan builtIn (1dias..7dias).
- **L2159** `str` — 4dias

## src/hooks/VerifyBannerProvider.tsx
<a id="src-hooks-verifybannerprovider-tsx"></a>

- **L17** `str` — ${uid ?? ''}\|${verified}

## src/hooks/auth-context.ts
<a id="src-hooks-auth-context-ts"></a>

- **L12** `jsx` — Promise

## src/hooks/preferences-context.ts
<a id="src-hooks-preferences-context-ts"></a>

- **L20** `jsx` — Promise

## src/hooks/profile-context.ts
<a id="src-hooks-profile-context-ts"></a>

- **L27** `jsx` — Promise

## src/hooks/useAuth.ts
<a id="src-hooks-useauth-ts"></a>

- **L6** `str` — useAuth must be used within <AuthProvider>

## src/hooks/usePreferences.ts
<a id="src-hooks-usepreferences-ts"></a>

- **L6** `str` — usePreferences must be used within <PreferencesProvider>

## src/hooks/useProfile.ts
<a id="src-hooks-useprofile-ts"></a>

- **L6** `str` — useProfile must be used within <ProfileProvider>

## src/hooks/useRegistroMes.ts
<a id="src-hooks-useregistromes-ts"></a>

- **L57** `str` — [useRegistroMes] subscribe failed

## src/hooks/useRegistroStats.ts
<a id="src-hooks-useregistrostats-ts"></a>

- **L48** `jsx` — Promise
- **L142** `str` — [useRegistroStats] fetch failed

## src/hooks/useSaveStatus.ts
<a id="src-hooks-usesavestatus-ts"></a>

- **L27** `jsx` — Promise
- **L85** `str` — [BTal] save error:

## src/hooks/useVerifyBanner.ts
<a id="src-hooks-useverifybanner-ts"></a>

- **L6** `str` — useVerifyBanner must be used within <VerifyBannerProvider>

## src/main.tsx
<a id="src-main-tsx"></a>

- **L118** `str` — (display-mode: standalone)

## src/pages/AuthAction.tsx
<a id="src-pages-authaction-tsx"></a>

- **L20** `str` — El enlace ha caducado. Solicita uno nuevo.
- **L21** `str` — Enlace no válido o ya usado.
- **L22** `str` — Esta cuenta está deshabilitada.
- **L23** `str` — No existe la cuenta asociada a este enlace.
- **L24** `str` — Contraseña débil. Mínimo 8 caracteres.
- **L26** `str` — Algo ha salido mal. Vuelve a empezar.
- **L30** `str` — La contraseña debe tener al menos 8 caracteres.
- **L31** `str` — Debe incluir al menos una letra mayúscula.
- **L32** `str` — Debe incluir al menos un número.
- **L33** `str` — Debe incluir al menos un carácter especial.
- **L62** `str` — Enlace no válido. Falta el código de acción.
- **L83** `str` — Email verificado correctamente.
- **L91** `str` — Hemos restaurado tu email a ${restored}. Cambia tu contraseña por seguridad.
- **L92** `str` — Cambio de email revertido. Cambia tu contraseña por seguridad.
- **L102** `str` — Email actualizado a ${newEmail}.
- **L103** `str` — Email actualizado correctamente.
- **L111** `str` — Hemos eliminado el segundo factor de autenticación que se añadió. Cambia tu contraseña por seguridad.
- **L137** `str` — Las contraseñas no coinciden.
- **L161** `jsx` — Verificando enlace…
- **L167** `jsx` — Enlace no válido
- **L177** `jsx` — Contraseña actualizada
- **L178** `jsx` — Ya puedes iniciar sesión con tu nueva contraseña.
- **L185** `jsx` — Nueva contraseña
- **L198** `str` — Nueva contraseña
- **L211** `str` — Ocultar contraseña
- **L211** `str` — Mostrar contraseña
- **L222** `str` — Confirmar contraseña
- **L244** `str` — Guardar contraseña
- **L254** `jsx` — Acción no soportada
- **L266** `jsx` — Email verificado
- **L276** `jsx` — Email actualizado
- **L286** `jsx` — Cuenta recuperada
- **L289** `str` — ¿Has olvidado tu contraseña?
- **L299** `jsx` — Segundo factor revocado
- **L309** `jsx` — Acción desconocida
- **L310** `jsx` — No reconocemos este tipo de enlace.
- **L324** `str` — BTal

## src/pages/Landing.tsx
<a id="src-pages-landing-tsx"></a>

- **L34** `str` — Este email ya está registrado.
- **L35** `str` — Email no válido.
- **L36** `str` — Contraseña débil (mínimo 6 caracteres).
- **L37** `str` — Contraseña incorrecta.
- **L38** `str` — No existe una cuenta con este email.
- **L39** `str` — Email o contraseña incorrectos.
- **L40** `str` — Demasiados intentos. Espera un momento.
- **L41** `str` — Sin conexión. Comprueba tu red.
- **L42** `str` — Falta la contraseña.
- **L44** `str` — Algo ha salido mal. Inténtalo de nuevo.
- **L52** `str` — La contraseña debe tener al menos 8 caracteres.
- **L53** `str` — Debe incluir al menos una letra mayúscula.
- **L54** `str` — Debe incluir al menos un número.
- **L55** `str` — Debe incluir al menos un carácter especial.
- **L95** `str` — Las contraseñas no coinciden.
- **L108** `str` — Cuenta creada. En el dashboard podrás verificar tu email.
- **L197** `str` — BTal
- **L222** `str` — tucorreo@ejemplo.com
- **L236** `str` — Contraseña
- **L248** `str` — Ocultar contraseña
- **L248** `str` — Mostrar contraseña
- **L261** `str` — Confirmar contraseña
- **L288** `str` — Entrar
- **L290** `str` — Crear cuenta
- **L351** `str` — Modo prueba
- **L352** `str` — Esta cuenta de invitado caducará en 3 días
- **L354** `str` — A continuación, vas a probar la app con datos de ejemplo ya 
- **L355** `str` — precargados. Esta sesión se mantendrá activa durante 3 días. 
- **L356** `str` — Si pasado ese tiempo no has creado/vinculado una cuenta real, 
- **L357** `str` — todos los datos se borrarán permanentemente.
- **L360** `str` — Cancelar
- **L361** `str` — Entendido, entrar

## src/pages/LegalPlaceholder.tsx
<a id="src-pages-legalplaceholder-tsx"></a>

- **L54** `jsx` — Última actualización:
- **L56** `jsx` — 1. Responsable del tratamiento
- **L58** `jsx` — Pablo Castillo Sogorb
- **L60** `str` — mailto:${CONTACT_EMAIL}
- **L63** `jsx` — 2. Qué datos recopilamos
- **L69** `jsx` — Identificación
- **L69** `jsx` — : email, contraseña (hash, nunca en claro), nombre que elijas y, opcionalmente, foto de perfil.
- **L70** `jsx` — Perfil físico
- **L70** `jsx` — : edad, peso, altura, sexo biológico, nivel de actividad, objetivo, días de entreno, equipamiento, intolerancias/alergias alimentarias y preferencias (proporcionado voluntariamente).
- **L71** `jsx` — Datos generados por tu uso
- **L71** `jsx` — : menús, planes de entreno, lista de la compra, suplementación, registros de ejercicios (peso, repeticiones, fecha).
- **L72** `jsx` — Preferencias técnicas
- **L72** `jsx` — : sistema de unidades, inicio de semana, modo de generación (IA o manual), estilo de la barra de navegación.
- **L73** `jsx` — Datos técnicos
- **L73** `jsx` — : identificador interno (UID), fecha de creación, fecha de última actividad.
- **L76** `jsx` — NO recopilamos
- **L80** `jsx` — 3. Por qué los recopilamos (bases legales)
- **L82** `jsx` — Ejecución del contrato
- **L82** `jsx` — : necesitamos tu email y datos de perfil para prestarte el servicio que has aceptado.
- **L83** `jsx` — Tu consentimiento
- **L83** `jsx` — : datos opcionales (foto de perfil, intolerancias, restricciones) se piden con consentimiento explícito y puedes retirarlo cuando quieras.
- **L84** `jsx` — Obligación legal
- **L84** `jsx` — : conservación de registros de transacciones cuando se active la suscripción de pago, por motivos fiscales y antifraude.
- **L87** `jsx` — 4. Con quién compartimos tus datos
- **L89** `jsx` — Google Firebase
- **L93** `jsx` — NO vendemos ni cedemos tus datos a terceros
- **L102** `jsx` — 5. Cuánto tiempo los conservamos
- **L104** `jsx` — Tus datos se conservan mientras tu cuenta esté activa.
- **L105** `str` — Eliminar mi cuenta
- **L105** `jsx` — Si cancelas la cuenta, todos tus datos se borran de forma
- **L105** `jsx` — inmediata e irreversible
- **L105** `jsx` — de nuestros servidores (botón "Eliminar mi cuenta" en
- **L105** `jsx` — Ajustes → Administrar cuenta
- **L106** `jsx` — Las cuentas en modo prueba (invitado anónimo) se borran automáticamente a los
- **L106** `jsx` — 3 días
- **L106** `jsx` — desde su creación si no las vinculas a un email real.
- **L107** `jsx` — Los backups internos de Google pueden conservar copias durante un máximo de
- **L107** `jsx` — 30 días
- **L107** `jsx` — tras la eliminación, tras lo cual se purgan definitivamente.
- **L110** `jsx` — 6. Tus derechos (GDPR)
- **L111** `jsx` — Sobre tus datos personales tienes los siguientes derechos:
- **L113** `jsx` — Acceso
- **L113** `jsx` — : solicitar copia de los datos que tenemos sobre ti.
- **L114** `jsx` — Portabilidad
- **L114** `jsx` — : descargar tus datos en formato legible. Disponible ya desde
- **L114** `jsx` — Ajustes → Datos → Descargar mis datos
- **L114** `jsx` — (formato JSON).
- **L115** `jsx` — Rectificación
- **L115** `jsx` — : corregir datos inexactos. Editable desde
- **L115** `jsx` — Ajustes → Editar perfil
- **L116** `jsx` — Supresión
- **L116** `jsx` — : borrar tu cuenta y todos los datos asociados.
- **L117** `jsx` — Oposición y limitación
- **L117** `jsx` — : oponerte al tratamiento concreto o pedir que se limite a ciertos usos.
- **L118** `str` — _blank
- **L118** `jsx` — Reclamación ante autoridad
- **L118** `jsx` — : si crees que no estamos respetando tus derechos, puedes reclamar ante la
- **L118** `jsx` — (Agencia Española de Protección de Datos),
- **L118** `jsx` — aepd.es
- **L120** `jsx` — Para ejercer cualquiera de estos derechos, escríbenos a
- **L122** `jsx` — 7. Edad mínima
- **L124** `jsx` — 16 años
- **L128** `jsx` — 8. Cookies y almacenamiento local
- **L130** `jsx` — NO usa cookies de seguimiento
- **L134** `jsx` — Mantener tu sesión iniciada (para no pedirte login en cada visita).
- **L135** `jsx` — Guardar tus preferencias (unidades, inicio de semana, estilo de barra de navegación).
- **L136** `jsx` — Recordar avisos que ya cerraste.
- **L138** `jsx` — Si limpias el almacenamiento del navegador, tendrás que volver a iniciar sesión.
- **L140** `jsx` — 9. Seguridad
- **L152** `jsx` — 10. Cambios en esta política
- **L158** `jsx` — 11. Ley aplicable
- **L165** `jsx` — 12. Contacto
- **L181** `jsx` — 1. Qué es BTal
- **L189** `jsx` — 2. Aceptación de los términos
- **L192** `jsx` — política de privacidad
- **L195** `jsx` — 3. Edad mínima
- **L202** `jsx` — 4. Cuenta y seguridad
- **L204** `jsx` — Una cuenta por persona. No compartas tu contraseña.
- **L205** `jsx` — Eres responsable de mantener la seguridad de tu sesión, especialmente en dispositivos compartidos.
- **L206** `jsx` — Si sospechas que alguien ha accedido a tu cuenta sin autorización, escríbenos a
- **L207** `jsx` — Nos reservamos el derecho de pedir verificación adicional (email, segundo factor) si detectamos actividad sospechosa.
- **L210** `jsx` — 5. Modo prueba (invitado anónimo)
- **L211** `str` — Probar como invitado
- **L211** `jsx` — Puedes probar BTal sin registrarte mediante el botón "Probar como invitado". Tu sesión de invitado:
- **L213** `jsx` — Tiene una duración máxima de
- **L213** `jsx` — desde su creación. Vence aunque sigas usándola.
- **L214** `jsx` — Los cambios que hagas (al plan demo, registros de entreno, etc.) se pierden cuando la sesión vence.
- **L215** `jsx` — Si quieres conservarlos, conviértela en cuenta real desde el banner que aparece en la app (vincular email o cuenta Google).
- **L218** `jsx` — 6. Uso aceptable
- **L219** `jsx` — Estás autorizado a usar BTal de forma personal y razonable.
- **L219** `jsx` — NO está permitido
- **L221** `jsx` — Acceder a datos de otros usuarios sin su consentimiento explícito.
- **L222** `jsx` — Hacer scraping automatizado, suplantar el cliente oficial o saltarse los límites de uso.
- **L223** `jsx` — Subir contenido ilegal, ofensivo o que infrinja derechos de terceros (en notas, perfil, etc.).
- **L224** `jsx` — Usar la app para enviar publicidad no solicitada, spam o malware.
- **L225** `jsx` — Intentar explotar vulnerabilidades del servicio.
- **L232** `jsx` — 7. Limitaciones del servicio
- **L234** `jsx` — BTal es una herramienta de organización.
- **L234** `jsx` — NO sustituye consejo médico, dietético, deportivo ni psicológico profesional.
- **L234** `jsx` — Consulta el
- **L234** `jsx` — aviso médico
- **L234** `jsx` — para más detalle.
- **L235** `jsx` — Cualquier recomendación generada por la inteligencia artificial (cuando esté activa) tiene carácter orientativo y debe revisarse críticamente. Consulta con un profesional antes de seguir cualquier plan.
- **L236** `jsx` — La app puede contener errores. Hacemos lo posible por mantenerla operativa pero no garantizamos disponibilidad ininterrumpida ni ausencia total de bugs.
- **L237** `jsx` — Eres responsable de tu salud y tus decisiones.
- **L240** `jsx` — 8. Planes y pagos (próximamente)
- **L246** `jsx` — El precio y las funcionalidades incluidas se mostrarán claramente antes de aceptar.
- **L247** `jsx` — La suscripción se cobrará a través de Stripe; se aplicarán también sus términos.
- **L248** `jsx` — No hay derecho de desistimiento sobre los recursos digitales ya consumidos (por ejemplo, generaciones de plan con IA ya emitidas), conforme al art. 103 m) del Texto Refundido de la Ley General para la Defensa de Consumidores. Sí podrás cancelar la renovación en cualquier momento.
- **L249** `jsx` — Los detalles concretos se incluirán en estos términos cuando el plan Pro esté activo, y te lo notificaremos antes de su lanzamiento.
- **L252** `jsx` — 9. Eliminación de cuenta
- **L254** `jsx` — Ajustes → Administrar cuenta → Eliminar cuenta
- **L259** `jsx` — 10. Modificaciones del servicio y de los términos
- **L270** `jsx` — 11. Limitación de responsabilidad
- **L279** `jsx` — 12. Propiedad intelectual
- **L283** `jsx` — Ajustes → Datos
- **L286** `jsx` — 13. Ley aplicable y jurisdicción
- **L293** `jsx` — 14. Contacto
- **L310** `jsx` — BTal es una herramienta de organización personal de nutrición, entrenamiento y suplementación.
- **L314** `jsx` — Lee esto antes de empezar
- **L320** `jsx` — Consultar con tu médico de cabecera, especialmente si tienes una condición médica conocida o estás en tratamiento.
- **L321** `jsx` — Consultar con un dietista-nutricionista colegiado para validar el plan nutricional.
- **L322** `jsx` — Consultar con un preparador físico cualificado para validar la carga, intensidad y técnica de los entrenamientos.
- **L323** `jsx` — Detener inmediatamente cualquier actividad que te cause dolor, mareo, falta de aire o malestar, y buscar atención médica si los síntomas persisten.
- **L326** `jsx` — Lo que la app NO hace
- **L328** `jsx` — No diagnostica enfermedades.
- **L329** `jsx` — No prescribe medicación ni suplementos.
- **L330** `jsx` — No sustituye a profesionales sanitarios cualificados.
- **L331** `jsx` — No tiene en cuenta posibles condiciones médicas que tú no hayas declarado.
- **L334** `jsx` — Casos en los que debes consultar antes
- **L336** `jsx` — Embarazo, lactancia o postparto reciente.
- **L337** `jsx` — Enfermedad metabólica diagnosticada (diabetes, hipertensión, problemas cardiovasculares, tiroides, etc.).
- **L338** `jsx` — Trastornos de la conducta alimentaria, actuales o pasados.
- **L339** `jsx` — Lesiones musculoesqueléticas previas o actuales.
- **L340** `jsx` — Cualquier tratamiento médico que pueda interactuar con un cambio de alimentación o actividad física.
- **L341** `jsx` — Menores de edad (consulta médica obligatoria antes de empezar planes de entreno o nutrición específicos).
- **L344** `jsx` — Tu responsabilidad
- **L351** `jsx` — Para emergencias
- **L357** `jsx` — Documentos relacionados
- **L359** `jsx` — Política de privacidad
- **L360** `jsx` — Términos de uso
- **L380** `jsx` — Documento no encontrado.
- **L430** `str` — Volver

## src/pages/Onboarding.tsx
<a id="src-pages-onboarding-tsx"></a>

- **L109** `jsx` — = 14 && data.edad
- **L110** `jsx` — = 30 && data.peso
- **L111** `jsx` — = 120 && data.altura
- **L119** `jsx` — = 0 && data.diasEntreno
- **L199** `str` — [BTal] saveOnboarding error:
- **L200** `str` — No hemos podido guardar tu perfil. Inténtalo de nuevo.
- **L212** `str` — [BTal] signOut error:
- **L245** `jsx` — Paso de 5
- **L251** `jsx` — Cuéntanos sobre ti
- **L257** `jsx` — Nombre
- **L260** `str` — Pablo
- **L270** `jsx` — Edad
- **L283** `jsx` — Sexo
- **L305** `jsx` — Peso (kg)
- **L319** `jsx` — Altura (cm)
- **L347** `jsx` — Leer el aviso completo
- **L356** `jsx` — Tu estilo de vida
- **L361** `jsx` — Nivel de actividad
- **L377** `jsx` — Días de entreno por semana
- **L392** `jsx` — Equipamiento disponible
- **L412** `jsx` — Tu objetivo
- **L417** `jsx` — ¿Qué quieres conseguir?
- **L457** `jsx` — Personaliza tu plan
- **L466** `str` — Cuéntanos más
- **L467** `str` — Objetivos específicos, lesiones, preferencias…
- **L472** `str` — Ej: quiero ganar masa muscular sin perder definición · tengo dolor en el hombro derecho · prefiero recetas rápidas entre semana · …
- **L484** `str` — Alergias
- **L485** `str` — Las 14 declarables del Reglamento UE + lo que añadas
- **L488** `jsx` — Más comunes
- **L507** `jsx` — Otras alergias
- **L510** `str` — Escribe y pulsa Enter (ej: melocotón)
- **L521** `str` — Añadir otra alergia
- **L526** `str` — Intolerancias
- **L527** `str` — Lactosa, fructosa, FODMAP… o lo que necesites
- **L558** `jsx` — Otras intolerancias
- **L561** `str` — Escribe y pulsa Enter
- **L571** `str` — Añadir otra intolerancia
- **L576** `str` — Alimentos prohibidos
- **L577** `str` — No quiero ver esto en mis comidas
- **L582** `str` — Ej: hígado, coliflor, atún…
- **L585** `str` — Añadir alimento prohibido
- **L590** `str` — Alimentos obligatorios
- **L591** `str` — Quiero que aparezcan sí o sí
- **L596** `str` — Ej: salmón al menos 2 veces, arroz a diario…
- **L599** `str` — Añadir alimento obligatorio
- **L604** `str` — Ingredientes favoritos
- **L605** `str` — La IA los priorizará en el plan
- **L610** `str` — Ej: aguacate, huevos, espinacas…
- **L613** `str` — Añadir ingrediente favorito
- **L622** `jsx` — ¿Cómo quieres empezar?
- **L652** `str` — Volver al paso ${step} de 5 — corregir lo que ya rellenaste
- **L678** `str` — Finalizar
- **L699** `str` — ¿Cerrar sesión sin completar?
- **L700** `str` — Si cierras sesión ahora, los datos que has rellenado se perderán. La próxima vez que entres tendrás que empezar de nuevo.
- **L702** `str` — Cancelar
- **L704** `str` — Cerrar sesión
- **L715** `str` — Modificar
- **L729** `str` — Confirmar y generar
- **L739** `str` — Generando tu plan inicial
- **L740** `str` — Estamos guardando tu perfil y preparando tu plan personalizado. No cierres la app.

## src/pages/Settings.tsx
<a id="src-pages-settings-tsx"></a>

- **L35** `str` — ${subjectPrefix} BTal
- **L37** `str` — Hola, equipo de BTal.
- **L39** `str` — — [Escribe aquí tu mensaje] —
- **L41** `str` — — Datos para soporte (no edites) —
- **L42** `str` — Email: ${email ?? '(invitado)'}
- **L43** `str` — UID: ${uid}
- **L44** `str` — Versión: v${APP_VERSION}
- **L45** `str` — Plataforma: ${navigator.userAgent}
- **L46** `str` — Fecha: ${new Date().toISOString()}
- **L90** `str` — [Settings] export GDPR
- **L91** `str` — No hemos podido preparar tus datos. Inténtalo de nuevo.
- **L115** `str` — [Soporte]
- **L116** `str` — [BUG]
- **L130** `str` — Volver
- **L134** `jsx` — Ajustes
- **L149** `str` — Editar perfil
- **L167** `str` — Sin nombre
- **L186** `jsx` — Administrar cuenta
- **L204** `jsx` — Preferencias
- **L216** `jsx` — Datos
- **L225** `jsx` — Descargar mis datos
- **L239** `jsx` — Soporte
- **L244** `str` — _blank
- **L248** `jsx` — Contactar soporte
- **L263** `jsx` — Reportar un bug
- **L277** `jsx` — Acerca de BTal
- **L287** `str` — Administrar cuenta
- **L292** `jsx` — Eliminar cuenta
- **L329** `str` — Descargar mis datos
- **L330** `str` — ¿Qué se va a descargar?
- **L332** `str` — Un archivo JSON con TODOS tus datos de BTal:\n\n
- **L333** `str` — • Datos de tu cuenta (email, nombre, proveedores de login, fechas de creación y último acceso).\n
- **L334** `str` — • Tu perfil físico (peso, altura, edad, objetivo, intolerancias, etc.).\n
- **L335** `str` — • Tus menús de las 7 días, lista de la compra, plan de entreno y suplementación.\n
- **L336** `str` — • Historial completo de registros de pesos.\n
- **L337** `str` — • Tus preferencias guardadas (unidades, inicio de semana, etc.).\n\n
- **L338** `str` — El archivo viaja solo a tu dispositivo · no se envía a ningún servidor. 
- **L339** `str` — Trátalo con cuidado: contiene información personal.
- **L342** `str` — Cancelar
- **L344** `str` — Descargar
- **L348** `str` — [Settings] handleExportConfirmed:
- **L357** `str` — Datos exportados · revisa tus descargas

## src/pages/app/AppShell.tsx
<a id="src-pages-app-appshell-tsx"></a>

- **L75** `str` — BTal
- **L82** `str` — Preparando perfil de invitado…
- **L83** `str` — Preparando tu perfil…
- **L119** `jsx` — MENÚ

## src/pages/app/CompraPage.tsx
<a id="src-pages-app-comprapage-tsx"></a>

- **L139** `str` — Carrito vacío
- **L140** `str` — No hay productos marcados como comprados.
- **L153** `str` — [BTal] resetCompraChecks error:
- **L162** `str` — 🛒 Lista de la compra · BTal\n
- **L171** `str` — \n${cat.nombre.toUpperCase()}
- **L173** `str` —  · ${fmtPrice(item.precio)}
- **L174** `str` —  · ${item.cantidad}
- **L175** `str` —   • ${item.nombre}${cantidad}${precio}
- **L192** `str` — Lista vacía
- **L194** `str` — Todos los productos están marcados como comprados. Desmarca los que aún necesites para compartir la lista.
- **L200** `str` — Lista de la compra
- **L201** `str` — Lista compartida
- **L204** `str` — Lista copiada al portapapeles
- **L206** `str` — No se pudo compartir
- **L211** `str` — AbortError
- **L212** `str` — [BTal] share compra error:
- **L213** `str` — Error al compartir
- **L222** `str` — Lista de 
- **L236** `str` — Buscar producto…
- **L240** `str` — Buscar producto en la lista
- **L247** `str` — Limpiar búsqueda
- **L257** `str` — Reiniciar marcas de comprado
- **L258** `str` — Reiniciar carrito
- **L266** `str` — Compartir lista
- **L295** `str` — + Nueva categoría
- **L298** `str` — estoy filtrando productos
- **L316** `str` — COSTE SUPLEMENTACIÓN
- **L330** `str` — Proteína
- **L340** `str` — Creatina
- **L386** `jsx` — Total semanal
- **L465** `str` — 🔄 Reiniciar carrito
- **L467** `str` — ¿Desmarcar todos los productos comprados? Se desmarcarán 
- **L468** `str` — ${markedCount} producto${markedCount === 1 ? '' : 's'}. 
- **L469** `str` — Quedarán todos como pendientes de comprar.
- **L472** `str` — Cancelar
- **L474** `str` — Reiniciar
- **L489** `str` — 📤 Compartir lista de compra
- **L491** `str` — Vamos a generar un texto con todos los productos pendientes 
- **L492** `str` — de comprar (los NO marcados) agrupados por categoría, con 
- **L493** `str` — precios. En el móvil intentará abrir el menú nativo de 
- **L494** `str` — compartir (WhatsApp, Telegram, email…). Si no, lo copiará 
- **L495** `str` — al portapapeles.
- **L500** `str` — Continuar
- **L503** `str` — [BTal] handleConfirmShare:
- **L517** `str` — Cerrar
- **L523** `str` — Carrito reiniciado
- **L610** `jsx` — sin productos
- **L628** `str` — ${Math.round((boughtCount / totalCount) * 100)}%
- **L639** `str` — Editar categoría ${categoria.nombre}
- **L640** `str` — Editar categoría
- **L662** `str` — [BTal] toggleCompraItem:
- **L666** `str` — Desmarcar comprado
- **L666** `str` — Marcar comprado
- **L690** `str` — Editar ${item.nombre}
- **L691** `str` — Editar
- **L754** `str` — Editar ${displayName}
- **L772** `jsx` — Consumido:

## src/pages/app/EntrenoPage.tsx
<a id="src-pages-app-entrenopage-tsx"></a>

- **L200** `str` — [BTal] setActivePlan error:
- **L201** `str` — Error al cambiar de plan
- **L230** `str` — Error al borrar el plan
- **L249** `str` — [BTal] restorePlanEntreno error:
- **L250** `str` — Error al restaurar el plan
- **L272** `str` — Un plan debe tener al menos 1 día
- **L283** `str` — [BTal] handleDeleteDia error:
- **L284** `str` — Error al borrar el día
- **L293** `str` — Plan de 
- **L304** `str` — Generar con IA
- **L307** `jsx` — Generar con IA
- **L353** `str` — Activar ${p.nombre}
- **L361** `str` — día
- **L361** `str` — días
- **L377** `str` — + Nuevo
- **L382** `str` — Crear plan nuevo
- **L385** `jsx` — Nuevo
- **L391** `str` — selecciona al menos un día
- **L392** `str` — Has seleccionado tu plan creado: X
- **L393** `str` — Plan recomendado: X
- **L395** `str` — Editar datos del perfil
- **L396** `str` — profile.diasEntreno
- **L470** `str` — Plan recomendado
- **L500** `jsx` — Editar datos del perfil
- **L518** `str` — Editar plan
- **L528** `str` — Eliminar plan
- **L542** `jsx` — Este plan no tiene días aún. Pulsa ✏ para añadir.
- **L548** `str` — ${activePlan.id}-${idx}
- **L609** `str` — ¿Eliminar plan?
- **L611** `str` — Se eliminará "${activePlan?.nombre ?? ''}" y todos sus días. 
- **L612** `str` — Tendrás 5 segundos para deshacer.
- **L615** `str` — Cancelar
- **L617** `str` — Eliminar
- **L630** `str` — Generar el plan de entreno con IA
- **L631** `str` — Crearemos un plan adaptado a tus días disponibles, equipamiento y objetivo.
- **L641** `str` — Plan "${undoToast.plan.nombre}" eliminado
- **L647** `str` — Deshacer
- **L651** `str` — [BTal] handleUndoDeletePlan:
- **L727** `str` — Enter
- **L736** `str` — Día sin título
- **L743** `str` — tiempo estimado
- **L746** `str` — ~65 min
- **L765** `str` — Editar día
- **L775** `str` — tag ${t.cls}

## src/pages/app/HoyPage.tsx
<a id="src-pages-app-hoypage-tsx"></a>

- **L51** `str` — ${cap(dow)} · ${day} ${cap(month)} ${year}
- **L58** `str` — Desayuno
- **L59** `str` — Comida
- **L60** `str` — Merienda
- **L61** `str` — Cena
- **L178** `str` — Hola, 
- **L178** `str` — ¡Hola!
- **L203** `str` — vacío
- **L212** `jsx` — Aún sin plan generado
- **L215** `str` — En cuanto activemos el generador de IA crearemos tu plan diario con macros, comidas y entreno a partir de tu perfil.
- **L217** `str` — Crea una cuenta y completa el onboarding para que podamos generar tu plan personalizado.
- **L218** `str` — Completa tu perfil para que podamos generar tu plan personalizado.
- **L233** `str` — Datos de ejemplo · regístrate para personalizar
- **L234** `str` — Cambia a modo IA en Ajustes para generar tu plan
- **L247** `jsx` — Entreno de hoy
- **L252** `str` — Abrir plan de entreno completo
- **L273** `str` — Editar día
- **L274** `str` — Empezar entrenamiento
- **L291** `str` — MealSheet
- **L293** `str` — Ver menú →
- **L296** `jsx` — Comidas de hoy
- **L301** `str` — Abrir menú completo
- **L329** `str` — Ver detalle de ${MEAL_LABEL[meal]}
- **L393** `str` — extra-${extra.id}
- **L400** `str` — Ver detalle de ${titulo}${isExtra ? ' (extra)' : ''}
- **L473** `jsx` — Cargando menú…
- **L482** `str` — Suplementación
- **L484** `str` — Ver batido →
- **L484** `str` — Ver creatina →
- **L500** `str` — Editar
- **L539** `str` — Generar con IA
- **L541** `str` — tal cual
- **L547** `str` — Generar mi plan con IA
- **L548** `str` — Elige qué quieres que genere la IA esta vez.
- **L615** `jsx` — Sin suplementos para hoy
- **L618** `jsx` — Menú
- **L643** `str` — Comidas de hoy · Ver menú →
- **L648** `jsx` — Batido protéico
- **L655** `str` — Ver detalles del batido
- **L663** `str` — BATIDO PROTÉICO
- **L666** `str` — ${sup.batidoConfig.gr_prot}g proteína + ${sup.creatinaConfig.gr_dose}g creatina
- **L667** `str` — ${sup.batidoConfig.gr_prot}g proteína por dosis
- **L674** `str` — [BTal] marcarBatido error:
- **L679** `str` — [BTal] cancelarBatido error:
- **L694** `jsx` — Creatina
- **L701** `str` — Ver detalles de la creatina
- **L710** `str` — ${sup.creatinaConfig.gr_dose}g por dosis
- **L716** `str` — [BTal] marcarCreatina error:
- **L721** `str` — [BTal] cancelarCreatina error:
- **L732** `str` — ?openSup=batido\|creatina
- **L797** `str` — Tomado
- **L797** `str` — Tomada
- **L807** `str` — hoy-sup-card hoy-sup-card--${kind}
- **L810** `str` — ✓ Tomado/a
- **L829** `str` — hoy-sup-cta hoy-sup-cta--taken hoy-sup-cta--${kind} 
- **L844** `str` — Cancelar ${palabraSing} tomado hoy
- **L845** `str` — Cancelar (descontar ${palabraSing})
- **L853** `str` — hoy-sup-cta hoy-sup-cta--${kind}
- **L874** `str` — tom-${tomados}
- **L883** `str` — rest-${restantesNum}
- **L892** `str` — BATIDOS RESTANTES
- **L892** `str` — DOSIS RESTANTES
- **L898** `str` — sem-${semana}
- **L903** `jsx` — total esta semana
- **L947** `str` — Cancelar
- **L951** `str` — ¿Cancelar ${palabraSing} tomado hoy?
- **L954** `str` — Se descontará 1 batido del contador y volverá a aparecer el botón "Tomar".
- **L955** `str` — Se descontará 1 dosis del contador y volverá a aparecer el botón "Tomar".
- **L958** `str` — Atrás
- **L960** `str` — Sí, cancelar
- **L1004** `str` — Sin plan asignado
- **L1004** `str` — Día de descanso
- **L1019** `str` — Atención
- **L1022** `str` — No hay entrenamiento programado para hoy
- **L1049** `str` — Entreno de hoy · ${diaHoy.titulo} · ver detalle
- **L1059** `str` — esto es hoy y dura X
- **L1068** `str` — Entreno
- **L1073** `str` — tag ${t.cls}

## src/pages/app/MenuPage.tsx
<a id="src-pages-app-menupage-tsx"></a>

- **L63** `str` — Desayuno
- **L64** `str` — Comida
- **L65** `str` — Merienda
- **L66** `str` — Cena
- **L229** `str` — ${c.gr_prot} g proteína
- **L231** `str` —  + ${sup.creatinaConfig.gr_dose} g creatina
- **L233** `str` —  · ${c.extras}
- **L250** `str` — ${c.gr_dose} g por dosis
- **L250** `str` —  · ${c.notas}
- **L454** `str` — [BTal] toggle deshabilitada error:
- **L466** `str` — [BTal] restoreMealExtra error:
- **L525** `str` — [BTal] restoreMeal error:
- **L569** `str` — Plan 
- **L580** `str` — Generar con IA
- **L583** `jsx` — Generar con IA
- **L597** `str` — Días de la semana
- **L611** `str` —  · oculto
- **L612** `str` —  · excluido del promedio
- **L638** `str` — + Añadir
- **L642** `jsx` — Comidas ·
- **L647** `str` — Añadir comida nueva
- **L650** `jsx` — Añadir comida
- **L670** `str` — Batido protéico
- **L689** `str` — Creatina
- **L724** `str` — [BTal] toggleDayHidden:
- **L742** `str` — meal-${row.meal}
- **L752** `str` — extra-${row.extra.id}
- **L776** `str` — sup-${row.kind}
- **L800** `jsx` — Cargando menú…
- **L825** `str` — [BTal] toggleDayExcludedFromAvg:
- **L845** `str` — ${selectedDay}-${viewKey}
- **L857** `str` — Generar el menú con IA
- **L858** `str` — ¿Quieres también la lista de la compra?
- **L900** `str` — extra.nombre
- **L943** `str` — ¿Eliminar la comida?
- **L946** `str` — Vamos a vaciar ${MEAL_LABEL[pendingDelete].toLowerCase()} del ${DAY_LABEL_FULL[selectedDay].toLowerCase()}. Tendrás 5 segundos para deshacer.
- **L951** `str` — Cancelar
- **L956** `str` — Eliminar
- **L960** `str` — [BTal] handleConfirmDelete unhandled:
- **L967** `str` — Eliminando… / Eliminado correctamente
- **L972** `str` — Deshacer
- **L980** `str` — ${MEAL_LABEL[undoSnapshot.meal]} del ${DAY_LABEL_FULL[undoSnapshot.day].toLowerCase()} eliminada
- **L992** `str` — [BTal] handleUndoDelete unhandled:
- **L1054** `str` — ¿Deshabilitar la comida?
- **L1055** `str` — ¿Habilitar la comida?
- **L1060** `str` — "${pendingExtraToggle.extra.nombre}" se quedará atenuada en gris y dejará de sumar al total del día y a la media semanal. Puedes volver a habilitarla cuando quieras.
- **L1061** `str` — "${pendingExtraToggle.extra.nombre}" volverá a contar al total del día y a la media semanal.
- **L1071** `str` — Deshabilitar
- **L1071** `str` — Habilitar
- **L1075** `str` — [BTal] handleConfirmExtraToggle unhandled:
- **L1089** `str` — Vamos a eliminar "${pendingExtraDelete.extra.nombre}" del ${DAY_LABEL_FULL[pendingExtraDelete.day].toLowerCase()}. Tendrás 5 segundos para deshacer.
- **L1103** `str` — [BTal] handleConfirmExtraDelete unhandled:
- **L1115** `str` — "${undoExtraSnapshot.extra.nombre}" eliminada
- **L1127** `str` — [BTal] handleUndoExtraDelete unhandled:
- **L1138** `str` — Máximo ${MAX_EXTRAS_POR_DIA} comidas extras por día.
- **L1144** `str` — Resetear día
- **L1151** `str` — ¿Resetear día?
- **L1154** `str` — Vamos a restaurar las 4 comidas del ${DAY_LABEL_FULL[confirmResetDay].toLowerCase()} al menú original. Se perderán los cambios que hayas hecho ese día. Esta acción no se puede deshacer.
- **L1160** `str` — Resetear
- **L1168** `str` — [BTal] resetDayMenu:
- **L1179** `str` — Día reseteado
- **L1187** `str` —  (común) del 
- **L1218** `str` — Lleno
- **L1294** `str` — día oculto
- **L1296** `str` — no cuenta en la media
- **L1298** `str` — sin comidas
- **L1300** `str` — 1 comida
- **L1301** `str` — ${totales.comidasConDatos} comidas
- **L1307** `str` — Opciones del día
- **L1321** `str` — k-${totales.kcal}
- **L1330** `str` — p-${totales.prot}
- **L1339** `str` — c-${totales.carb}
- **L1348** `str` — f-${totales.fat}
- **L1378** `str` — Incluir en media semanal
- **L1379** `str` — Excluir de media semanal
- **L1391** `str` — Mostrar día
- **L1391** `str` — Ocultar día
- **L1402** `jsx` — Resetear día
- **L1433** `str` — MEDIA SEMANAL · Promedio de los 7 días
- **L1438** `str` —  · Promedio de los 7 días
- **L1450** `jsx` — Calorías
- **L1457** `jsx` — Proteína
- **L1464** `jsx` — Carbohidratos
- **L1471** `jsx` — Grasas
- **L1498** `str` — ${(progress / 100) * CIRC} ${CIRC}
- **L1520** `str` — ${progress}%
- **L1524** `jsx` — Progreso del día
- **L1527** `str` —  · ${totales.prot}g prot
- **L1531** `str` — ${progress}% del objetivo (${objetivoKcal.toLocaleString('es-ES')} kcal)
- **L1532** `str` — Define tu objetivo en Editar perfil
- **L1535** `str` — sin comidas todavía
- **L1561** `str` — Abrir detalle de ${MEAL_LABEL[meal].toLowerCase()}
- **L1575** `str` — Editado por ti
- **L1580** `str` — Generado por IA
- **L1595** `jsx` — Aún sin comida · pulsa para añadir
- **L1597** `jsx` — Pulsa para añadir nombre del plato
- **L1671** `str` — ✓ TOMADO
- **L1671** `str` — ✓ TOMADA
- **L1680** `str` — Abrir detalle de ${title.toLowerCase()}
- **L1698** `jsx` — ✓ Añadido
- **L1762** `str` — Comida deshabilitada · 
- **L1763** `str` — Editar ${extra.nombre \|\| 'comida'}
- **L1776** `str` — Comida extra
- **L1790** `jsx` — Pulsa para añadir alimentos

## src/pages/app/RegistroPage.tsx
<a id="src-pages-app-registropage-tsx"></a>

- **L163** `str` — Registro de 

## src/pages/legalTypes.ts
<a id="src-pages-legaltypes-ts"></a>

- **L9** `str` — Política de privacidad
- **L10** `str` — Términos de uso
- **L11** `str` — Aviso médico
- **L15** `str` — Documento legal

## src/services/auth.ts
<a id="src-services-auth-ts"></a>

- **L36** `str` — (display-mode: standalone)
- **L137** `str` — [BTal] clearGuestExpiration error (redirect):
- **L149** `str` — Usuario sin email no puede reauth con password
- **L172** `str` — BTal
- **L181** `str` — Authenticator
- **L200** `str` — google.com
- **L250** `str` — No hay sesión anónima activa — no se puede vincular cuenta.
- **L262** `str` — [BTal] clearGuestExpiration error:
- **L318** `str` — [BTal] syncAuthDisplayName error:

## src/services/db.ts
<a id="src-services-db-ts"></a>

- **L214** `str` — suplementos.batidoConfig
- **L219** `str` — suplementos.batidoConfig.producto_nombre
- **L222** `str` — suplementos.batidoConfig.producto_precio
- **L226** `str` — suplementos.creatinaConfig
- **L230** `str` — suplementos.creatinaConfig.producto_nombre
- **L233** `str` — suplementos.creatinaConfig.producto_precio
- **L237** `str` — suplementos.daysWithBatido
- **L240** `str` — suplementos.daysWithCreatina
- **L243** `str` — suplementos.batidoOverrides
- **L246** `str` — suplementos.creatinaOverrides
- **L250** `str` — suplementos.batidos_tomados_total
- **L253** `str` — suplementos.creatinas_tomadas_total
- **L256** `str` — suplementos.creatinas_tomadas_semana
- **L259** `str` — suplementos.creatinas_tomadas_mes
- **L262** `str` — suplementos.creatina_semana_inicio
- **L265** `str` — suplementos.creatina_mes_inicio
- **L268** `str` — suplementos.last_batido_date
- **L271** `str` — suplementos.last_creatina_date
- **L277** `str` — suplementos.batidoHistory
- **L280** `str` — suplementos.creatinaHistory
- **L284** `str` — suplementos.batidos_tomados_semana
- **L287** `str` — suplementos.batidos_tomados_mes
- **L290** `str` — suplementos.batido_semana_inicio
- **L293** `str` — suplementos.batido_mes_inicio
- **L297** `str` — suplementos.batidos_tomados_anio
- **L300** `str` — suplementos.creatinas_tomadas_anio
- **L303** `str` — suplementos.batido_anio_inicio
- **L306** `str` — suplementos.creatina_anio_inicio
- **L325** `str` — suplementos.batido_stock_gramos
- **L331** `str` — suplementos.creatina_stock_gramos
- **L339** `str` — suplementos.batidos_restantes
- **L342** `str` — suplementos.creatina_dosis_restantes
- **L384** `str` — profile.notas
- **L385** `str` — profile.intolerancias
- **L386** `str` — profile.alergias
- **L387** `str` — profile.alimentosProhibidos
- **L388** `str` — profile.alimentosObligatorios
- **L389** `str` — profile.ingredientesFavoritos
- **L392** `str` — profile.objetivoKcal
- **L405** `str` — menu.${day}.extras
- **L637** `str` — ${num}dias
- **L649** `str` — Día ${old.letra}${old.nombre ? 
- **L650** `str` — Día
- **L698** `jsx` — = 1 && oldActive
- **L699** `str` — ${oldActive}dias
- **L786** `str` — [BTal] Plan builtIn corrupto · ${id} tenía ${dias.length} día(s),
- **L787** `str` —  esperados ${expected}. Restaurando a default.
- **L981** `str` — profile.modo
- **L1023** `str` — profile.${key}
- **L1054** `str` — menu.${day}.${meal}.${key}
- **L1058** `str` — menu.${day}.${meal}.source
- **L1119** `str` — suplementos.${key}
- **L1136** `str` — menu.${day}.${meal}.alimentos
- **L1137** `str` — menu.${day}.${meal}.hora
- **L1138** `str` — menu.${day}.${meal}.kcal
- **L1139** `str` — menu.${day}.${meal}.prot
- **L1140** `str` — menu.${day}.${meal}.carb
- **L1141** `str` — menu.${day}.${meal}.fat
- **L1161** `str` — suplementos.batidoOverrides.${day}
- **L1162** `str` — suplementos.creatinaOverrides.${day}
- **L1317** `str` — compra.items.${catId}
- **L1331** `str` — compra.categorias
- **L1347** `str` — menuFlags.excludedFromAvg
- **L1350** `str` — menuFlags.hidden
- **L1368** `str` — menu.${day}
- **L1385** `str` — entrenos.activePlan
- **L1399** `str` — entrenos.planes.${plan.id}
- **L1413** `str` — entrenos.planes.${planId}
- **L1440** `str` — entrenos.planes.${planId}.dias
- **L1509** `jsx` — (a.fecha
- **L1580** `str` — ${year}-${pad(month0 + 1)}-01
- **L1583** `str` — ${endY}-${pad(endM0 + 1)}-01
- **L1722** `str` — [BTal] pruneOldRegistros (no crítico):
- **L1743** `str` — setRegistroDia: plan vacío · usa deleteRegistroDia para limpiar
- **L1753** `str` — setRegistroDia: user document no existe
- **L1797** `str` — deleteRegistroDia: user document no existe

## src/services/exportData.ts
<a id="src-services-exportdata-ts"></a>

- **L26** `str` — btal_
- **L109** `str` — Export completo de tu cuenta BTal. Incluye perfil, menús, entrenos, 
- **L110** `str` — lista de la compra, suplementos, preferencias e historial de registros. 
- **L111** `str` — Para más información sobre el RGPD: art. 20 (derecho de portabilidad).
- **L132** `str` — application/json;charset=utf-8
- **L151** `str` — btal-export-${uidShort}-${date}.json

## src/services/firebase.ts
<a id="src-services-firebase-ts"></a>

- **L28** `str` — [BTal] Faltan variables en .env: ${missing.join(', ')}. 
- **L29** `str` — Auth y Firestore darán errores hasta que las añadas.
- **L34** `str` — [BTal] Falta VITE_RECAPTCHA_V3_SITE_KEY en .env · App Check no 
- **L35** `str` — se activará. En dev usa `self.FIREBASE_APPCHECK_DEBUG_TOKEN = 
- **L36** `str` — true` antes del primer import de Firebase para que App Check 
- **L37** `str` — imprima un token de debug en consola que puedes añadir desde 
- **L38** `str` — Firebase Console > App Check > Apps > ... > Manage debug tokens.
- **L106** `str` — [BTal] App Check init failed:

## src/templates/defaultUser.ts
<a id="src-templates-defaultuser-ts"></a>

- **L156** `str` — 1 cdta
- **L268** `str` — ${a.nombre} · ${a.cantidad}
- **L400** `str` — 1dias
- **L401** `str` — 2dias
- **L402** `str` — 3dias
- **L403** `str` — 4dias
- **L404** `str` — 5dias
- **L405** `str` — 6dias
- **L406** `str` — 7dias
- **L413** `str` — plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}
- **L421** `str` — ${clamp}dias
- **L469** `str` — 1 docena
- **L469** `str` — 2 unidades
- **L480** `str` — cat_<timestamp>_<random>
- **L519** `str` — cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}
- **L524** `str` — it_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}
- **L542** `str` — + 1 plátano + 300ml leche
- **L563** `str` — con agua / antes del entreno
- **L692** `str` — Batido Protéico
- **L693** `str` — Creatina
- **L845** `str` — PLANID\|DAYINDEX
- **L1156** `str` — Mié
- **L1159** `str` — Sáb
- **L1164** `str` — Lunes
- **L1165** `str` — Martes
- **L1166** `str` — Miércoles
- **L1167** `str` — Jueves
- **L1168** `str` — Viernes
- **L1169** `str` — Sábado
- **L1170** `str` — Domingo
- **L1181** `str` — Proteínas
- **L1182** `str` — Lácteos
- **L1183** `str` — Hidratos
- **L1184** `str` — Frutas y verduras
- **L1185** `str` — Despensa
- **L1186** `str` — Grasas
- **L1187** `str` — Suplementación
- **L1242** `str` — ${n}dias
- **L1243** `str` — Plan ${n} ${n === 1 ? 'Día' : 'Días'}
- **L1244** `str` — ${n} ${n === 1 ? 'día' : 'días'}/semana
- **L1248** `str` — Día ${i + 1}
- **L1403** `str` — Sedentario
- **L1403** `str` — Poca o ninguna actividad física
- **L1404** `str` — Ligero
- **L1404** `str` — 1-3 días/semana de ejercicio ligero
- **L1405** `str` — Moderado
- **L1405** `str` — 3-5 días/semana de ejercicio moderado
- **L1406** `str` — Activo
- **L1406** `str` — 6-7 días/semana de ejercicio intenso
- **L1407** `str` — Muy activo
- **L1407** `str` — Entreno dos veces al día
- **L1411** `str` — Gimnasio
- **L1411** `str` — Acceso a máquinas y peso libre
- **L1412** `str` — En casa
- **L1412** `str` — Mancuernas, gomas o similar
- **L1413** `str` — Sin material
- **L1413** `str` — Solo peso corporal
- **L1417** `str` — Volumen
- **L1417** `str` — Ganar masa muscular
- **L1418** `str` — Definición
- **L1418** `str` — Perder grasa, mantener músculo
- **L1419** `str` — Recomposición
- **L1419** `str` — Ganar músculo y perder grasa
- **L1420** `str` — Mantenimiento
- **L1420** `str` — Conservar el peso y la forma actuales
- **L1424** `str` — Vegano
- **L1425** `str` — Vegetariano
- **L1426** `str` — Sin lactosa
- **L1427** `str` — Sin gluten
- **L1428** `str` — Sin frutos secos
- **L1444** `str` — Todo el plan
- **L1445** `str` — Menú semanal con su lista de la compra y plan de entreno.
- **L1450** `str` — Menú + lista de compra
- **L1451** `str` — Solo nutrición. El plan de entreno lo rellenas tú.
- **L1456** `str` — Solo menú
- **L1457** `str` — Recetas semanales sin generar la lista de la compra.
- **L1462** `str` — Solo entrenos
- **L1463** `str` — Plan de entrenamiento. La nutrición la rellenas tú.
- **L1483** `str` — Gluten
- **L1485** `str` — Huevo
- **L1486** `str` — Pescado
- **L1487** `str` — Crustáceos
- **L1488** `str` — Moluscos
- **L1489** `str` — Frutos secos
- **L1490** `str` — Cacahuetes
- **L1491** `str` — Soja
- **L1492** `str` — Apio
- **L1493** `str` — Mostaza
- **L1494** `str` — Sésamo
- **L1495** `str` — Sulfitos
- **L1496** `str` — Altramuces (lupino)
- **L1503** `str` — Lactosa
- **L1504** `str` — Fructosa
- **L1505** `str` — Sorbitol
- **L1506** `str` — Histamina
- **L1507** `str` — Sacarosa
- **L1508** `str` — Gluten (no celíaca)

## src/templates/demoUser.ts
<a id="src-templates-demouser-ts"></a>

- **L84** `str` — Avena
- **L85** `str` — Leche desnatada
- **L86** `str` — Plátano mediano
- **L87** `str` — Claras de huevo
- **L88** `str` — Bowl de avena con plátano
- **L90** `str` — Pechuga de pollo
- **L91** `str` — Arroz integral
- **L92** `str` — Brócoli al vapor
- **L93** `str` — Pollo con arroz y brócoli
- **L95** `str` — Yogur griego
- **L96** `str` — Frutos secos
- **L97** `str` — Miel
- **L97** `str` — 1 cdta
- **L98** `str` — Yogur con frutos secos
- **L100** `str` — Salmón
- **L101** `str` — Boniato asado
- **L102** `str` — Ensalada mixta
- **L103** `str` — Salmón al horno con boniato
- **L107** `str` — Tortilla francesa
- **L107** `str` — 3 huevos
- **L108** `str` — Tostada integral
- **L109** `str` — Tomate
- **L110** `str` — Tortilla con tostada y tomate
- **L112** `str` — Ternera magra
- **L113** `str` — Pasta integral
- **L114** `str` — Tomate natural
- **L115** `str` — Pasta integral con ternera
- **L117** `str` — Skyr
- **L118** `str` — Arándanos
- **L119** `str` — Almendras
- **L120** `str` — Skyr con arándanos y almendras
- **L122** `str` — Pavo a la plancha
- **L123** `str` — Quinoa
- **L124** `str` — Verduras al horno
- **L125** `str` — Pavo con quinoa y verduras
- **L129** `str` — Tortitas de avena
- **L130** `str` — Claras
- **L131** `str` — Plátano
- **L133** `str` — Tortitas de avena con plátano
- **L136** `str` — Patata cocida
- **L137** `str` — Espinacas salteadas
- **L138** `str` — Salmón con patata y espinacas
- **L140** `str` — Queso fresco batido
- **L141** `str` — Manzana
- **L142** `str` — Crema de cacahuete
- **L143** `str` — Queso batido con manzana
- **L145** `str` — Pollo al curry
- **L146** `str` — Arroz basmati
- **L147** `str` — Pimientos asados
- **L148** `str` — Pollo al curry con arroz basmati
- **L154** `str` — Frutos rojos
- **L156** `str` — Bowl de avena con frutos rojos
- **L159** `str` — Boniato
- **L160** `str` — Brócoli
- **L161** `str` — Pollo con boniato y brócoli
- **L164** `str` — Nueces
- **L166** `str` — Yogur griego con nueces
- **L168** `str` — Atún fresco
- **L170** `str` — Aguacate
- **L171** `str` — Atún con arroz y aguacate
- **L175** `str` — Bowl de avena
- **L177** `str` — Cacao puro
- **L179** `str` — Bowl de avena con cacao
- **L181** `str` — Lentejas (peso seco)
- **L182** `str` — Verduras
- **L183** `str` — Arroz blanco
- **L184** `str` — Lentejas con arroz y verduras
- **L189** `str` — Yogur griego con frutos secos
- **L193** `str` — Espárragos a la plancha
- **L194** `str` — Salmón con quinoa y espárragos
- **L198** `str` — Tostadas integrales
- **L200** `str` — Huevos a la plancha
- **L202** `str` — Tostadas con aguacate y huevo
- **L212** `str` — Skyr con manzana y cacahuete
- **L216** `str` — Espinacas
- **L217** `str` — Pavo con boniato y espinacas
- **L225** `str` — Tortitas de avena con miel
- **L227** `str` — Pollo al horno
- **L230** `str` — Pollo al horno con arroz
- **L235** `str` — Yogur con arándanos y almendras
- **L239** `str` — Espárragos
- **L240** `str` — Salmón con patata y espárragos
- **L253** `str` — Plátano y café solo
- **L256** `str` — Café solo
- **L269** `str` — Media mañana
- **L270** `str` — Manzana + barrita de proteína
- **L273** `str` — Barrita de proteína
- **L287** `str` — Café + tostada de pavo
- **L291** `str` — Pavo en lonchas
- **L304** `str` — Aperitivo
- **L305** `str` — Picoteo casero
- **L307** `str` — Hummus
- **L308** `str` — Crudités (zanahoria, pepino)
- **L309** `str` — Aceitunas
- **L340** `str` — Mi rutina semanal
- **L347** `str` — Día A · Empuje
- **L348** `str` — Pecho · Tríceps · Hombros
- **L358** `str` — Press banca con barra
- **L359** `str` — Press inclinado mancuernas
- **L360** `str` — Aperturas en polea
- **L361** `str` — Press francés barra Z
- **L362** `str` — Extensiones tríceps polea
- **L364** `str` — Calentar bien el pecho con 2 series ligeras antes de la primera pesada del press banca.
- **L368** `str` — Día B · Tirón
- **L369** `str` — Espalda · Bíceps
- **L377** `str` — Fuerza
- **L379** `str` — Dominadas
- **L379** `str` — Lastradas si puedes
- **L380** `str` — Remo con barra
- **L381** `str` — Jalón al pecho
- **L382** `str` — Curl con barra Z
- **L383** `str` — Curl martillo
- **L383** `str` — Alternando
- **L385** `str` — Si las dominadas se hacen demasiado fáciles, añadir lastre o pasar a 5×6 con peso.
- **L389** `str` — Día C · Pierna
- **L390** `str` — Tren inferior
- **L400** `str` — Sentadilla con barra
- **L400** `str` — Bajo paralelo
- **L401** `str` — Peso muerto rumano
- **L402** `str` — Prensa 45°
- **L403** `str` — Curl femoral
- **L404** `str` — Gemelos de pie
- **L404** `str` — Pausa arriba
- **L406** `str` — Día pesado · descansar 3 min entre series principales y cuidar la técnica en sentadilla.
- **L410** `str` — Día D · Hombro + Core
- **L411** `str` — Hombros · Core
- **L419** `str` — Cardio final
- **L421** `str` — Press militar con barra
- **L421** `str` — De pie
- **L422** `str` — Elevaciones laterales
- **L422** `str` — Mancuernas
- **L423** `str` — Pájaro / Reverse fly
- **L424** `str` — Plancha frontal
- **L426** `str` — Acabar con 10-15 min de cinta a ritmo cómodo si queda energía · no es obligatorio.
- **L457** `str` — demo_${catId}_${n}
- **L486** `str` — Salmón fresco
- **L487** `str` — Huevos
- **L487** `str` — 1 docena
- **L488** `str` — Ternera magra picada
- **L491** `str` — Pack 4 ud
- **L493** `str` — Skyr natural
- **L494** `str` — Queso fresco batido 0%
- **L498** `str` — Avena en copos
- **L500** `str` — Pan integral
- **L504** `str` — Plátanos
- **L505** `str` — Manzanas
- **L508** `str` — Tomates
- **L511** `str` — Aceite de oliva virgen extra
- **L513** `str` — Pimienta negra
- **L514** `str` — Vinagre balsámico
- **L515** `str` — Especias variadas (orégano, comino...)
- **L518** `str` — Aguacates
- **L519** `str` — Crema de cacahuete 100%
- **L520** `str` — Frutos secos surtidos
- **L523** `str` — Whey protein
- **L524** `str` — Creatina monohidrato
- **L567** `str` — ${yyyy}-${mm}-${dd}
- **L618** `str` — 300 ml leche semi + 1 plátano
- **L623** `str` — Whey Iso 100
- **L628** `str` — Antes del entreno, con agua
- **L629** `str` — Creatina Monohidrato
- **L639** `str` — Batido post-entreno
- **L645** `str` — Creatina con desayuno
- **L659** `str` — Invitado
- **L673** `str` — Entreno en gimnasio por la tarde. Como fuera del trabajo 1-2 veces por semana · prefiero opciones ligeras.
- **L674** `str` — cebolla cruda
- **L676** `str` — bebidas azucaradas
- **L676** `str` — bollería industrial
- **L677** `str` — 1 fruta al día
- **L677** `str` — verdura en la cena
- **L678** `str` — salmón
- **L678** `str` — pollo a la plancha
- **L735** `str` — press banca con barra
- **L745** `str` — press inclinado mancuernas
- **L755** `str` — aperturas en polea
- **L765** `str` — press francés barra z
- **L775** `str` — extensiones tríceps polea
- **L796** `str` — remo con barra
- **L806** `str` — jalón al pecho
- **L816** `str` — curl con barra z
- **L826** `str` — curl martillo
- **L837** `str` — sentadilla con barra
- **L847** `str` — peso muerto rumano
- **L857** `str` — prensa 45°
- **L867** `str` — curl femoral
- **L877** `str` — gemelos de pie
- **L889** `str` — press militar con barra
- **L899** `str` — elevaciones laterales
- **L909** `str` — pájaro / reverse fly
- **L1024** `str` — plan_demo_custom_pred\|1
- **L1026** `str` — 6º día seguido entrenando · racha 🔥 a tope.
- **L1027** `str` — plan_demo_custom_pred\|3
- **L1030** `str` — plan_demo_custom_pred\|0
- **L1032** `str` — Sin descanso esta semana · sensaciones buenas.
- **L1033** `str` — plan_demo_custom_pred\|2
- **L1035** `str` — Doble PR · sentadilla y peso muerto rumano.
- **L1041** `str` — ¡PR en press banca! Buena energía hoy.
- **L1050** `str` — Sentadilla 105×4 limpia, buena profundidad.
- **L1070** `str` — Día de partido de pádel.
- **L1096** `str` — Comienzo de la fase de fuerza.
- **L1129** `str` — Primera semana del nuevo programa.
- **L1135** `str` — Primer día con el plan custom completo.

## src/templates/exerciseCatalog.ts
<a id="src-templates-exercisecatalog-ts"></a>

- **L26** `str` — BÍCEPS
- **L27** `str` — TRÍCEPS
- **L29** `str` — FULL BODY
- **L38** `str` — TIRÓN
- **L56** `str` — Grupo muscular
- **L60** `str` — Tipo de ejercicio
- **L64** `str` — Tipo de movimiento
- **L68** `str` — Otro
- **L81** `str` — Press banca
- **L82** `str` — Press banca inclinado
- **L83** `str` — Press banca declinado
- **L84** `str` — Press inclinado con mancuernas
- **L85** `str` — Aperturas con mancuernas
- **L86** `str` — Aperturas en polea
- **L87** `str` — Cruces en polea alta
- **L88** `str` — Fondos en paralelas
- **L89** `str` — Flexiones
- **L90** `str` — Press en máquina
- **L93** `str` — Dominadas
- **L94** `str` — Dominadas agarre supino
- **L95** `str` — Remo con barra
- **L96** `str` — Remo con mancuerna
- **L97** `str` — Remo Pendlay
- **L98** `str` — Remo en polea baja
- **L99** `str` — Jalón al pecho
- **L100** `str` — Jalón agarre neutro
- **L101** `str` — Peso muerto
- **L102** `str` — Pull-over en polea
- **L105** `str` — Sentadilla libre
- **L106** `str` — Sentadilla frontal
- **L107** `str` — Sentadilla búlgara
- **L108** `str` — Prensa de piernas
- **L109** `str` — Hip thrust
- **L110** `str` — Peso muerto rumano
- **L111** `str` — Zancadas
- **L112** `str` — Curl femoral tumbado
- **L113** `str` — Extensión de cuádriceps
- **L114** `str` — Elevación de talones
- **L117** `str` — Press militar con barra
- **L118** `str` — Press militar con mancuernas
- **L119** `str` — Press Arnold
- **L120** `str` — Elevaciones laterales
- **L121** `str` — Elevaciones frontales
- **L122** `str` — Pájaros (posterior)
- **L123** `str` — Face pull
- **L124** `str` — Remo al mentón
- **L125** `str` — Encogimientos
- **L126** `str` — Press landmine
- **L129** `str` — Curl con barra
- **L130** `str` — Curl con mancuernas
- **L131** `str` — Curl martillo
- **L132** `str` — Curl inclinado con mancuernas
- **L133** `str` — Curl predicador
- **L134** `str` — Curl en polea
- **L135** `str` — Curl concentrado
- **L136** `str` — Curl 21s
- **L137** `str` — Curl araña
- **L138** `str` — Dominadas supinas
- **L141** `str` — Press francés
- **L142** `str` — Extensión en polea
- **L143** `str` — Fondos en banco
- **L145** `str` — Extensión sobre la cabeza
- **L146** `str` — Patadas de tríceps
- **L147** `str` — Press cerrado
- **L148** `str` — Copa con mancuerna
- **L149** `str` — Extensión en polea agarre inverso
- **L150** `str` — Flexiones diamante
- **L153** `str` — Plancha frontal
- **L154** `str` — Plancha lateral
- **L155** `str` — Crunch abdominal
- **L156** `str` — Elevación de piernas
- **L157** `str` — Rueda abdominal
- **L158** `str` — Russian twist
- **L159** `str` — Toe touches
- **L160** `str` — Bicicleta abdominal
- **L161** `str` — Hollow hold
- **L162** `str` — Dead bug
- **L165** `str` — Burpees
- **L166** `str` — Clean and press
- **L167** `str` — Snatch
- **L168** `str` — Thrusters
- **L169** `str` — Turkish get-up
- **L170** `str` — Kettlebell swing
- **L171** `str` — Man maker
- **L172** `str` — Peso muerto con press
- **L173** `str` — Sentadilla con press
- **L174** `str` — Mountain climbers
- **L177** `str` — Sentadilla trasera
- **L178** `str` — Peso muerto convencional
- **L179** `str` — Peso muerto sumo
- **L181** `str` — Press militar
- **L183** `str` — Cargada de potencia
- **L184** `str` — Arrancada
- **L185** `str` — Zancada trasera
- **L191** `str` — Sentadilla hack
- **L192** `str` — Curl femoral
- **L198** `str` — Aperturas en máquina
- **L201** `str` — Circuito kettlebell
- **L203** `str` — Saltos al cajón
- **L205** `str` — Sentadilla al aire
- **L206** `str` — Remo con banda
- **L207** `str` — Planchas dinámicas
- **L208** `str` — Saltos de tijera
- **L210** `str` — Thrusters con mancuerna
- **L213** `str` — Correr en cinta
- **L214** `str` — Bicicleta estática
- **L215** `str` — Elíptica
- **L216** `str` — Remo en máquina
- **L217** `str` — Saltar a la comba
- **L218** `str` — Escaladora
- **L219** `str` — Sprints
- **L220** `str` — HIIT en bici
- **L221** `str` — Caminata inclinada
- **L222** `str` — Natación
- **L225** `str` — Movilidad de cadera
- **L226** `str` — Movilidad de hombro
- **L227** `str` — Movilidad torácica
- **L228** `str` — Estiramiento de isquios
- **L229** `str` — Estiramiento de flexores de cadera
- **L230** `str` — World’s greatest stretch
- **L231** `str` — Deep squat hold
- **L233** `str` — Thread the needle
- **L234** `str` — 90/90 de cadera
- **L311** `str` — __custom__
- **L321** `str` — Personalizado

## src/utils/aiAffectedItems.ts
<a id="src-utils-aiaffecteditems-ts"></a>

- **L45** `str` — Lunes
- **L46** `str` — Martes
- **L47** `str` — Miércoles
- **L48** `str` — Jueves
- **L49** `str` — Viernes
- **L50** `str` — Sábado
- **L51** `str` — Domingo
- **L55** `str` — Desayuno
- **L56** `str` — Comida
- **L57** `str` — Merienda
- **L58** `str` — Cena
- **L65** `str` — ${first} · …
- **L76** `str` — menu:${day}:${meal}
- **L78** `str` — ${DAY_LABEL[day]} · ${MEAL_LABEL[meal]}
- **L82** `str` — Vacío
- **L101** `str` — entrenos:${activeId}:${idx}
- **L103** `str` — Día ${idx + 1}
- **L106** `str` — ${d.descripcion} · ${d.ejercicios.length} ejercicios
- **L107** `str` — ${d.ejercicios.length} ejercicios
- **L125** `str` — compra:${cat.id}:${it.id}
- **L133** `str` — ${it.precio.toFixed(2)} €

## src/utils/confirmDiff.ts
<a id="src-utils-confirmdiff-ts"></a>

- **L18** `str` — &amp;
- **L21** `str` — &quot;
- **L30** `str` — <span style="color:#8d9491">Sin cambios detectados</span>
- **L30** `jsx` — Sin cambios detectados
- **L38** `str` — <strong>${label}</strong><br>
- **L39** `str` — · Antes: <span style="color:#f0a040">${from}</span><br>
- **L40** `str` — · Después: <span style="color:#7ee87e">${to}</span>

## src/utils/dateKeys.ts
<a id="src-utils-datekeys-ts"></a>

- **L45** `str` — ${yyyy}-${mm}-${dd}
- **L62** `str` — ${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}
- **L70** `str` — ${yyyy}-${mm}

## src/utils/entrenoDiff.ts
<a id="src-utils-entrenodiff-ts"></a>

- **L36** `str` — ${nombre} · ${series}
- **L47** `str` — Día ${diaIdx + 1} · Ej.
- **L57** `str` — ${prefix} ${j + 1} (nuevo)
- **L65** `str` — ${prefix} ${j + 1} (eliminado)
- **L78** `str` — ${prefix} ${j + 1} — Nombre
- **L84** `str` — ${prefix} ${j + 1} — Notas
- **L90** `str` — ${prefix} ${j + 1} — Series
- **L107** `str` — Día ${diaIdx + 1}
- **L111** `str` — ${prefix} (nuevo)
- **L117** `str` — ${prefix} — Día semana
- **L123** `str` — ${prefix} — Descripción
- **L129** `str` — ${prefix} — Tiempo estimado
- **L135** `str` — ${prefix} — Tipo
- **L141** `str` — ${prefix} — Tipo 2
- **L147** `str` — ${prefix} — Tipo 3
- **L157** `str` — ${prefix} — Título
- **L200** `str` — ${prefix} — Comentario
- **L216** `str` — Nombre
- **L218** `str` — Estructura
- **L226** `str` — Días de entrenamiento
- **L228** `str` — ${newP.dias.length} día${newP.dias.length === 1 ? '' : 's'}
- **L231** `str` — Predeterminado
- **L272** `str` — Nº de días
- **L273** `str` — ${oldN} día${oldN === 1 ? '' : 's'}
- **L274** `str` — ${newN} día${newN === 1 ? '' : 's'}
- **L285** `str` — Día ${i + 1} (eliminado)

## src/utils/graphsAggregation.ts
<a id="src-utils-graphsaggregation-ts"></a>

- **L24** `str` — S${weekNum}
- **L25** `str` — S${weekNum}·${String(yearNum).slice(-2)}
- **L194** `str` — ${d} ${MES_SHORT[(m - 1) \|\| 0]}
- **L261** `str` — ${date.getDate()} ${MES_SHORT_ESP[date.getMonth()]}
- **L281** `str` — S${parseInt(w, 10)}
- **L298** `str` — ${yyyy}-${mm}
- **L330** `str` — últimos 14 días
- **L331** `str` — últimas 12 semanas
- **L332** `str` — últimos 12 meses
- **L333** `str` — últimos 3 años

## src/utils/ia.ts
<a id="src-utils-ia-ts"></a>

- **L53** `str` — Crea cuenta para usar la IA · es gratis.
- **L63** `str` — Cambia a modo IA en Ajustes para generar tu plan.
- **L85** `str` — Generación extra disponible · adelantada por tu pago de 4,99€.
- **L103** `str` — Disponible el ${formatFecha(unlocksAt)}. 
- **L104** `str` — Adelanta por 4,99€ o pasa a Pro para regenerar ya.

## src/utils/numericInput.ts
<a id="src-utils-numericinput-ts"></a>

- **L14** `str` — Backspace
- **L15** `str` — Delete
- **L17** `str` — Escape
- **L18** `str` — Enter
- **L19** `str` — Home
- **L21** `str` — ArrowLeft
- **L22** `str` — ArrowRight
- **L23** `str` — ArrowUp
- **L24** `str` — ArrowDown

## src/utils/registro.ts
<a id="src-utils-registro-ts"></a>

- **L65** `str` — ${DAY_LABEL_SHORT[dowKey]} — 
- **L66** `str` —  · ${day.titulo}
- **L67** `str` — ${dowPrefix}Día ${dayIdx + 1}${titulo}
- **L69** `str` — ${parts.join(' · ')} (${badges})
- **L95** `str` — PLANID\|DAYINDEX
- **L177** `str` — ${planId}\|${i}
- **L203** `str` — Domingo
- **L203** `str` — Lunes
- **L203** `str` — Martes
- **L203** `str` — Miércoles
- **L203** `str` — Jueves
- **L203** `str` — Viernes
- **L203** `str` — Sábado
- **L205** `str` — ${dows[dt.getDay()]} ${d} de ${meses[m - 1]} de ${y}
- **L218** `str` — Mié
- **L218** `str` — Sáb
- **L219** `str` — ${dowsShort[dt.getDay()]} ${d} ${mesesShort[m - 1]}

## src/utils/registroDiff.ts
<a id="src-utils-registrodiff-ts"></a>

- **L32** `str` — S${i + 1}: ${txt}
- **L35** `str` — ${ej.sets.length} series vacías
- **L53** `str` — Plan del día
- **L62** `str` — Notas del día
- **L96** `str` — + ${name.toUpperCase()} (nuevo)
- **L105** `str` — − ${name.toUpperCase()} (eliminado)
- **L119** `str` — ${name.toUpperCase()} · nº series
- **L130** `str` — ${name.toUpperCase()} · serie ${i + 1}

## src/utils/resizeImage.ts
<a id="src-utils-resizeimage-ts"></a>

- **L19** `str` — Canvas 2D context no disponible

## src/utils/supAlerts.ts
<a id="src-utils-supalerts-ts"></a>

- **L25** `str` — proteína

## src/utils/supHistory.ts
<a id="src-utils-suphistory-ts"></a>

- **L49** `jsx` — (a.fecha
- **L66** `jsx` — = startInc && e.fecha

## src/utils/timeParser.ts
<a id="src-utils-timeparser-ts"></a>

- **L63** `str` — ${mins}m
- **L64** `str` — ${horas}h
- **L65** `str` — ${horas}h ${mins}m

## src/utils/units.ts
<a id="src-utils-units-ts"></a>

- **L87** `str` — ${Math.round(kgToLb(kg))} lb
- **L90** `str` — ${kg.toFixed(1)} kg
- **L98** `str` — ${feet}'${inches}"
- **L100** `str` — ${Math.round(cm)} cm
- **L110** `str` — miércoles
- **L110** `str` — sábado

## src/utils/useCountUp.ts
<a id="src-utils-usecountup-ts"></a>

- **L43** `str` — (prefers-reduced-motion: reduce)

## src/utils/userDisplay.ts
<a id="src-utils-userdisplay-ts"></a>

- **L71** `str` — Email y contraseña
- **L72** `str` — google.com
- **L72** `str` — Google
- **L73** `str` — Anónimo
- **L74** `str` — apple.com
- **L74** `str` — Apple
- **L75** `str` — facebook.com
- **L75** `str` — Facebook
- **L76** `str` — github.com
- **L76** `str` — GitHub
- **L77** `str` — microsoft.com
- **L77** `str` — Microsoft
- **L78** `str` — twitter.com
- **L78** `str` — X (Twitter)

