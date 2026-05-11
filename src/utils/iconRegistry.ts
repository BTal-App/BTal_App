// ─────────────────────────────────────────────────────────────────────
// Icon Registry · catálogo curado de iconos Tabler disponibles para el
// IconPicker (reemplazo del antiguo EmojiPicker).
//
// Único archivo a tocar al ampliar la oferta de iconos · `IconPicker.tsx`
// y `MealIcon.tsx` consumen este registry sin conocer detalles internos.
//
// FORMATO DEL ID (importante)
// ───────────────────────────
// Cada icono se referencia con un id estable `"tb:<slug>"` (ej. `"tb:apple"`).
// Es el formato que se persiste en Firestore (`Comida.emoji`,
// `CategoriaCompra.emoji`, etc.). NO usamos el `importName` (`IconApple`)
// directamente porque acoplaría los docs a la API exacta del paquete.
//
// CÓMO AÑADIR UN ICONO NUEVO
// ──────────────────────────
// 1. Buscarlo en https://tabler.io/icons (verificar que existe en la
//    versión instalada · `node_modules/@tabler/icons-react/dist/esm/icons/IconXxxx.mjs`).
// 2. Añadir entrada al final del bloque de su categoría · `id` con
//    prefijo `"tb:"` + slug en kebab-case · `importName` exacto del
//    export del paquete (PascalCase con prefijo `Icon`).
// 3. Sincronizar el barrel `iconBarrel.ts` añadiendo el `importName` al
//    re-export NAMED (orden alfabético).
// ─────────────────────────────────────────────────────────────────────

export type IconCategory =
  | 'comida'
  | 'bebidas'
  | 'fitness'
  | 'deportes'
  | 'cocina'
  | 'casa'
  | 'naturaleza'
  | 'otros';

export interface IconEntry {
  /** Id estable persistido en Firestore · formato `"tb:<slug>"`. */
  id: string;
  /** Nombre exacto del export en `@tabler/icons-react` (ej. `"IconApple"`). */
  importName: string;
  /** Tab al que pertenece dentro del IconPicker. */
  category: IconCategory;
  /** Keywords en español para la búsqueda libre del picker · normalize NFD. */
  tags_es: string[];
}

// ─────────────────────────────────────────────────────────────────────
// CATÁLOGO PRINCIPAL · ~280 iconos curados.
// El orden DENTRO de cada categoría se respeta en el render del picker
// (sin query) → ordena por relevancia visual / frecuencia esperada.
// ─────────────────────────────────────────────────────────────────────

export const ICON_REGISTRY: IconEntry[] = [
  // ── Comida (frutas, verduras, proteínas, lácteos, comidas preparadas, postres) ──
  { id: 'tb:apple',           importName: 'IconApple',           category: 'comida',  tags_es: ['manzana', 'fruta', 'rojo'] },
  { id: 'tb:banana',          importName: 'IconBanana',          category: 'comida',  tags_es: ['platano', 'banana', 'fruta', 'amarillo'] },
  { id: 'tb:cherry',          importName: 'IconCherry',          category: 'comida',  tags_es: ['cereza', 'fruta', 'rojo'] },
  { id: 'tb:lemon',           importName: 'IconLemon',           category: 'comida',  tags_es: ['limon', 'citrico', 'fruta', 'amarillo'] },
  { id: 'tb:lemon-2',         importName: 'IconLemon2',          category: 'comida',  tags_es: ['naranja', 'mandarina', 'citrico', 'fruta'] },
  { id: 'tb:avocado',         importName: 'IconAvocado',         category: 'comida',  tags_es: ['aguacate', 'fruta', 'grasa', 'verde'] },
  { id: 'tb:grape',           importName: 'IconGrape',           category: 'comida',  tags_es: ['uva', 'fruta', 'vino'] },
  { id: 'tb:melon',           importName: 'IconMelon',           category: 'comida',  tags_es: ['melon', 'sandia', 'fruta', 'verano'] },
  { id: 'tb:carrot',          importName: 'IconCarrot',          category: 'comida',  tags_es: ['zanahoria', 'verdura', 'naranja'] },
  { id: 'tb:pepper',          importName: 'IconPepper',          category: 'comida',  tags_es: ['pimiento', 'pimienta', 'verdura', 'especia'] },
  { id: 'tb:mushroom',        importName: 'IconMushroom',        category: 'comida',  tags_es: ['champinon', 'seta', 'hongo'] },
  { id: 'tb:salad',           importName: 'IconSalad',           category: 'comida',  tags_es: ['ensalada', 'lechuga', 'verdura', 'verde', 'brocoli'] },
  { id: 'tb:leaf',            importName: 'IconLeaf',            category: 'comida',  tags_es: ['hoja', 'natural', 'verde', 'organico', 'menta'] },
  { id: 'tb:leaf-2',          importName: 'IconLeaf2',           category: 'comida',  tags_es: ['hoja', 'planta', 'natural'] },
  { id: 'tb:leaf-maple',      importName: 'IconLeafMaple',       category: 'comida',  tags_es: ['hoja', 'arce', 'otono'] },
  { id: 'tb:nut',             importName: 'IconNut',             category: 'comida',  tags_es: ['nuez', 'fruto seco', 'almendra', 'cacahuete'] },
  { id: 'tb:wheat',           importName: 'IconWheat',           category: 'comida',  tags_es: ['trigo', 'cereal', 'espiga', 'hidratos'] },
  { id: 'tb:bread',           importName: 'IconBread',           category: 'comida',  tags_es: ['pan', 'tostada', 'hidratos', 'cereal'] },
  { id: 'tb:baguette',        importName: 'IconBaguette',        category: 'comida',  tags_es: ['baguette', 'pan', 'frances', 'barra'] },
  { id: 'tb:meat',            importName: 'IconMeat',            category: 'comida',  tags_es: ['carne', 'filete', 'pollo', 'proteina', 'ternera'] },
  { id: 'tb:fish',            importName: 'IconFish',            category: 'comida',  tags_es: ['pescado', 'salmon', 'atun', 'proteina'] },
  { id: 'tb:fish-bone',       importName: 'IconFishBone',        category: 'comida',  tags_es: ['espina', 'pescado', 'esqueleto'] },
  { id: 'tb:sausage',         importName: 'IconSausage',         category: 'comida',  tags_es: ['salchicha', 'embutido', 'chorizo'] },
  { id: 'tb:egg',             importName: 'IconEgg',             category: 'comida',  tags_es: ['huevo', 'desayuno', 'proteina'] },
  { id: 'tb:eggs',            importName: 'IconEggs',            category: 'comida',  tags_es: ['huevos', 'docena', 'proteina'] },
  { id: 'tb:egg-fried',       importName: 'IconEggFried',        category: 'comida',  tags_es: ['huevo frito', 'desayuno', 'plato'] },
  { id: 'tb:egg-cracked',     importName: 'IconEggCracked',      category: 'comida',  tags_es: ['huevo', 'roto', 'cascara'] },
  { id: 'tb:cheese',          importName: 'IconCheese',          category: 'comida',  tags_es: ['queso', 'lacteo'] },
  { id: 'tb:bowl',            importName: 'IconBowl',            category: 'comida',  tags_es: ['cuenco', 'plato', 'sopa', 'comida'] },
  { id: 'tb:bowl-chopsticks', importName: 'IconBowlChopsticks',  category: 'comida',  tags_es: ['ramen', 'asiatico', 'palillos', 'sopa', 'fideos'] },
  { id: 'tb:bowl-spoon',      importName: 'IconBowlSpoon',       category: 'comida',  tags_es: ['cuenco', 'sopa', 'cuchara', 'cereales'] },
  { id: 'tb:soup',            importName: 'IconSoup',            category: 'comida',  tags_es: ['sopa', 'caldo', 'estofado', 'plato'] },
  { id: 'tb:burger',          importName: 'IconBurger',          category: 'comida',  tags_es: ['hamburguesa', 'comida rapida'] },
  { id: 'tb:pizza',           importName: 'IconPizza',           category: 'comida',  tags_es: ['pizza', 'comida rapida', 'italiana'] },
  { id: 'tb:cake',            importName: 'IconCake',            category: 'comida',  tags_es: ['tarta', 'pastel', 'postre', 'dulce', 'cumpleanos'] },
  { id: 'tb:cake-roll',       importName: 'IconCakeRoll',        category: 'comida',  tags_es: ['brazo gitano', 'rollo', 'postre', 'dulce'] },
  { id: 'tb:cookie',          importName: 'IconCookie',          category: 'comida',  tags_es: ['galleta', 'dulce', 'postre'] },
  { id: 'tb:cookie-man',      importName: 'IconCookieMan',       category: 'comida',  tags_es: ['galleta', 'jenjibre', 'navidad'] },
  { id: 'tb:candy',           importName: 'IconCandy',           category: 'comida',  tags_es: ['caramelo', 'dulce', 'azucar'] },
  { id: 'tb:chocolate',       importName: 'IconChocolate',       category: 'comida',  tags_es: ['chocolate', 'dulce', 'cacao'] },
  { id: 'tb:ice-cream',       importName: 'IconIceCream',        category: 'comida',  tags_es: ['helado', 'frio', 'postre'] },
  { id: 'tb:ice-cream-2',     importName: 'IconIceCream2',       category: 'comida',  tags_es: ['helado', 'tarrina', 'postre'] },

  // ── Bebidas (café, té, agua, lácteos, alcohol) ──
  { id: 'tb:coffee',          importName: 'IconCoffee',          category: 'bebidas', tags_es: ['cafe', 'desayuno', 'taza'] },
  { id: 'tb:cup',             importName: 'IconCup',             category: 'bebidas', tags_es: ['taza', 'te', 'bebida', 'infusion'] },
  { id: 'tb:cup-off',         importName: 'IconCupOff',          category: 'bebidas', tags_es: ['taza', 'sin', 'descafeinado'] },
  { id: 'tb:milk',            importName: 'IconMilk',            category: 'bebidas', tags_es: ['leche', 'lacteo', 'vaso'] },
  { id: 'tb:milkshake',       importName: 'IconMilkshake',       category: 'bebidas', tags_es: ['batido', 'milkshake', 'bebida', 'lacteo'] },
  { id: 'tb:baby-bottle',     importName: 'IconBabyBottle',      category: 'bebidas', tags_es: ['biberon', 'leche', 'bebe'] },
  { id: 'tb:droplet',         importName: 'IconDroplet',         category: 'bebidas', tags_es: ['agua', 'gota', 'bebida', 'liquido', 'h2o'] },
  { id: 'tb:bottle',          importName: 'IconBottle',          category: 'bebidas', tags_es: ['botella', 'agua', 'bebida'] },
  { id: 'tb:beer',            importName: 'IconBeer',            category: 'bebidas', tags_es: ['cerveza', 'bebida', 'alcohol', 'lupulo'] },

  // ── Fitness (entrenamiento, cardio, gym) ──
  { id: 'tb:barbell',         importName: 'IconBarbell',         category: 'fitness', tags_es: ['barra', 'pesa', 'gimnasio', 'musculo', 'ejercicio'] },
  { id: 'tb:dumbbell',        importName: 'IconDumbbell',        category: 'fitness', tags_es: ['mancuerna', 'pesa', 'gimnasio'] },
  { id: 'tb:weight',          importName: 'IconWeight',          category: 'fitness', tags_es: ['peso', 'pesa', 'kettlebell'] },
  { id: 'tb:treadmill',       importName: 'IconTreadmill',       category: 'fitness', tags_es: ['cinta', 'correr', 'cardio'] },
  { id: 'tb:flame',           importName: 'IconFlame',           category: 'fitness', tags_es: ['fuego', 'calorias', 'cardio', 'quemar'] },
  { id: 'tb:bolt',            importName: 'IconBolt',            category: 'fitness', tags_es: ['rayo', 'energia', 'electrico'] },
  { id: 'tb:run',             importName: 'IconRun',             category: 'fitness', tags_es: ['correr', 'cardio', 'running'] },
  { id: 'tb:walk',            importName: 'IconWalk',            category: 'fitness', tags_es: ['caminar', 'andar', 'pasos'] },
  { id: 'tb:bike',            importName: 'IconBike',            category: 'fitness', tags_es: ['bicicleta', 'ciclismo', 'cardio'] },
  { id: 'tb:swimming',        importName: 'IconSwimming',        category: 'fitness', tags_es: ['nadar', 'natacion', 'piscina'] },
  { id: 'tb:stretching',      importName: 'IconStretching',      category: 'fitness', tags_es: ['estiramiento', 'movilidad', 'calentamiento'] },
  { id: 'tb:stretching-2',    importName: 'IconStretching2',     category: 'fitness', tags_es: ['estiramiento', 'flexibilidad'] },
  { id: 'tb:yoga',            importName: 'IconYoga',            category: 'fitness', tags_es: ['yoga', 'meditacion', 'relax', 'flexibilidad'] },
  { id: 'tb:heartbeat',       importName: 'IconHeartbeat',       category: 'fitness', tags_es: ['corazon', 'pulso', 'cardio', 'ritmo'] },
  { id: 'tb:activity',        importName: 'IconActivity',        category: 'fitness', tags_es: ['actividad', 'pulso', 'frecuencia'] },
  { id: 'tb:activity-heartbeat', importName: 'IconActivityHeartbeat', category: 'fitness', tags_es: ['actividad', 'corazon', 'pulso'] },
  { id: 'tb:trophy',          importName: 'IconTrophy',          category: 'fitness', tags_es: ['trofeo', 'logro', 'premio', 'pr'] },
  { id: 'tb:medal',           importName: 'IconMedal',           category: 'fitness', tags_es: ['medalla', 'premio', 'logro'] },
  { id: 'tb:target',          importName: 'IconTarget',          category: 'fitness', tags_es: ['diana', 'objetivo', 'meta'] },
  { id: 'tb:podium',          importName: 'IconPodium',          category: 'fitness', tags_es: ['podium', 'ganador', 'primero'] },
  { id: 'tb:ripple',          importName: 'IconRipple',          category: 'fitness', tags_es: ['ondas', 'agua', 'natacion'] },

  // ── Deportes (balones, raquetas, juegos) ──
  { id: 'tb:ball-football',         importName: 'IconBallFootball',         category: 'deportes', tags_es: ['futbol', 'balon', 'soccer'] },
  { id: 'tb:ball-american-football', importName: 'IconBallAmericanFootball', category: 'deportes', tags_es: ['futbol americano', 'rugby', 'pelota'] },
  { id: 'tb:ball-basketball',       importName: 'IconBallBasketball',       category: 'deportes', tags_es: ['basket', 'baloncesto', 'pelota'] },
  { id: 'tb:ball-tennis',           importName: 'IconBallTennis',           category: 'deportes', tags_es: ['tenis', 'pelota', 'raqueta'] },
  { id: 'tb:ball-volleyball',       importName: 'IconBallVolleyball',       category: 'deportes', tags_es: ['voley', 'voleibol', 'pelota'] },
  { id: 'tb:ball-baseball',         importName: 'IconBallBaseball',         category: 'deportes', tags_es: ['beisbol', 'baseball', 'pelota'] },
  { id: 'tb:ball-bowling',          importName: 'IconBallBowling',          category: 'deportes', tags_es: ['bolos', 'bola', 'bowling'] },
  { id: 'tb:bowling',               importName: 'IconBowling',              category: 'deportes', tags_es: ['bolos', 'pista', 'strike'] },
  { id: 'tb:golf',                  importName: 'IconGolf',                 category: 'deportes', tags_es: ['golf', 'banderin', 'campo'] },
  { id: 'tb:bow',                   importName: 'IconBow',                  category: 'deportes', tags_es: ['arco', 'flecha', 'tiro', 'arqueria'] },
  { id: 'tb:cricket',               importName: 'IconCricket',              category: 'deportes', tags_es: ['cricket', 'bate', 'pelota'] },
  { id: 'tb:rugby',                 importName: 'IconRugby',                category: 'deportes', tags_es: ['rugby', 'oval', 'placaje'] },
  { id: 'tb:fish-hook',             importName: 'IconFishHook',             category: 'deportes', tags_es: ['anzuelo', 'pesca', 'fishing'] },
  { id: 'tb:ski-jumping',           importName: 'IconSkiJumping',           category: 'deportes', tags_es: ['esqui', 'salto', 'invierno'] },
  { id: 'tb:skateboard',            importName: 'IconSkateboard',           category: 'deportes', tags_es: ['monopatin', 'skate', 'tabla'] },
  { id: 'tb:roller-skating',        importName: 'IconRollerSkating',        category: 'deportes', tags_es: ['patines', 'patinaje', 'roller'] },
  { id: 'tb:horse-toy',             importName: 'IconHorseToy',             category: 'deportes', tags_es: ['caballo', 'hipica', 'equitacion'] },

  // ── Cocina · utensilios, gorro chef, herramientas ──
  { id: 'tb:chef-hat',        importName: 'IconChefHat',         category: 'cocina',  tags_es: ['chef', 'cocinero', 'gorro', 'cocina'] },
  { id: 'tb:tools-kitchen',   importName: 'IconToolsKitchen',    category: 'cocina',  tags_es: ['utensilios', 'cuchillo', 'cuchara', 'cocina'] },
  { id: 'tb:tools-kitchen-2', importName: 'IconToolsKitchen2',   category: 'cocina',  tags_es: ['plato', 'tenedor', 'cuchillo', 'cubiertos', 'comida'] },
  { id: 'tb:tools-kitchen-3', importName: 'IconToolsKitchen3',   category: 'cocina',  tags_es: ['utensilios', 'rodillo', 'cocina'] },
  { id: 'tb:blender',         importName: 'IconBlender',         category: 'cocina',  tags_es: ['batidora', 'licuadora', 'electrodomestico'] },
  { id: 'tb:whisk',           importName: 'IconWhisk',           category: 'cocina',  tags_es: ['varilla', 'batir', 'cocina'] },
  { id: 'tb:ladle',           importName: 'IconLadle',           category: 'cocina',  tags_es: ['cucharon', 'cazo', 'sopa'] },
  { id: 'tb:scale',           importName: 'IconScale',           category: 'cocina',  tags_es: ['balanza', 'peso', 'bascula', 'medir'] },
  { id: 'tb:microwave',       importName: 'IconMicrowave',       category: 'cocina',  tags_es: ['microondas', 'electrodomestico', 'calentar'] },
  { id: 'tb:fridge',          importName: 'IconFridge',          category: 'cocina',  tags_es: ['nevera', 'frigorifico', 'frio'] },
  { id: 'tb:flask',           importName: 'IconFlask',           category: 'cocina',  tags_es: ['frasco', 'bote', 'suplemento', 'laboratorio'] },
  { id: 'tb:flask-2',         importName: 'IconFlask2',          category: 'cocina',  tags_es: ['matraz', 'laboratorio', 'quimica'] },
  { id: 'tb:clock',           importName: 'IconClock',           category: 'cocina',  tags_es: ['reloj', 'tiempo', 'hora'] },
  { id: 'tb:hourglass',       importName: 'IconHourglass',       category: 'cocina',  tags_es: ['reloj de arena', 'tiempo', 'temporizador'] },
  { id: 'tb:bucket',          importName: 'IconBucket',          category: 'cocina',  tags_es: ['cubo', 'balde', 'limpieza'] },

  // ── Casa · hogar, mobiliario, compra ──
  { id: 'tb:home',            importName: 'IconHome',            category: 'casa',    tags_es: ['casa', 'hogar', 'inicio'] },
  { id: 'tb:home-2',          importName: 'IconHome2',           category: 'casa',    tags_es: ['casa', 'hogar', 'edificio'] },
  { id: 'tb:building-store',  importName: 'IconBuildingStore',   category: 'casa',    tags_es: ['tienda', 'supermercado', 'comercio'] },
  { id: 'tb:building-hospital', importName: 'IconBuildingHospital', category: 'casa', tags_es: ['hospital', 'clinica', 'salud'] },
  { id: 'tb:sofa',            importName: 'IconSofa',            category: 'casa',    tags_es: ['sofa', 'salon', 'mueble'] },
  { id: 'tb:armchair',        importName: 'IconArmchair',        category: 'casa',    tags_es: ['sillon', 'butaca', 'mueble'] },
  { id: 'tb:lamp',            importName: 'IconLamp',            category: 'casa',    tags_es: ['lampara', 'luz', 'mesa'] },
  { id: 'tb:candle',          importName: 'IconCandle',          category: 'casa',    tags_es: ['vela', 'fuego', 'aroma'] },
  { id: 'tb:door',            importName: 'IconDoor',            category: 'casa',    tags_es: ['puerta', 'entrada', 'cerrada'] },
  { id: 'tb:door-enter',      importName: 'IconDoorEnter',       category: 'casa',    tags_es: ['puerta', 'entrar'] },
  { id: 'tb:door-exit',       importName: 'IconDoorExit',        category: 'casa',    tags_es: ['puerta', 'salir', 'salida'] },
  { id: 'tb:window',          importName: 'IconWindow',          category: 'casa',    tags_es: ['ventana', 'cristal'] },
  { id: 'tb:bath',            importName: 'IconBath',            category: 'casa',    tags_es: ['banera', 'bano', 'ducha'] },
  { id: 'tb:wash-machine',    importName: 'IconWashMachine',     category: 'casa',    tags_es: ['lavadora', 'lavar', 'ropa'] },
  { id: 'tb:bed',             importName: 'IconBed',             category: 'casa',    tags_es: ['cama', 'descanso', 'dormir', 'sueno'] },
  { id: 'tb:plug',            importName: 'IconPlug',            category: 'casa',    tags_es: ['enchufe', 'electricidad'] },
  { id: 'tb:hammer',          importName: 'IconHammer',          category: 'casa',    tags_es: ['martillo', 'herramienta', 'reparar'] },
  { id: 'tb:shopping-cart',   importName: 'IconShoppingCart',    category: 'casa',    tags_es: ['carrito', 'compra', 'supermercado'] },
  { id: 'tb:shopping-bag',    importName: 'IconShoppingBag',     category: 'casa',    tags_es: ['bolsa', 'compra'] },
  { id: 'tb:basket',          importName: 'IconBasket',          category: 'casa',    tags_es: ['cesta', 'compra'] },
  { id: 'tb:receipt',         importName: 'IconReceipt',         category: 'casa',    tags_es: ['recibo', 'ticket', 'compra', 'factura'] },
  { id: 'tb:wallet',          importName: 'IconWallet',          category: 'casa',    tags_es: ['cartera', 'dinero', 'gasto'] },
  { id: 'tb:cash',            importName: 'IconCash',            category: 'casa',    tags_es: ['dinero', 'efectivo', 'gasto'] },
  { id: 'tb:credit-card',     importName: 'IconCreditCard',      category: 'casa',    tags_es: ['tarjeta', 'credito', 'pago'] },
  { id: 'tb:gift',            importName: 'IconGift',            category: 'casa',    tags_es: ['regalo', 'caja', 'sorpresa'] },
  { id: 'tb:car',             importName: 'IconCar',             category: 'casa',    tags_es: ['coche', 'auto', 'transporte'] },
  { id: 'tb:backpack',        importName: 'IconBackpack',        category: 'casa',    tags_es: ['mochila', 'bolso', 'colegio'] },
  { id: 'tb:shirt',           importName: 'IconShirt',           category: 'casa',    tags_es: ['camisa', 'ropa'] },
  { id: 'tb:shirt-sport',     importName: 'IconShirtSport',      category: 'casa',    tags_es: ['camiseta', 'deporte', 'ropa'] },
  { id: 'tb:shoe',            importName: 'IconShoe',            category: 'casa',    tags_es: ['zapato', 'calzado'] },
  { id: 'tb:briefcase',       importName: 'IconBriefcase',       category: 'casa',    tags_es: ['maletin', 'trabajo', 'oficina'] },
  { id: 'tb:luggage',         importName: 'IconLuggage',         category: 'casa',    tags_es: ['maleta', 'viaje', 'equipaje'] },

  // ── Naturaleza · animales, plantas, tiempo ──
  { id: 'tb:plant',           importName: 'IconPlant',           category: 'naturaleza', tags_es: ['planta', 'vegetal', 'verde', 'hierba'] },
  { id: 'tb:plant-2',         importName: 'IconPlant2',          category: 'naturaleza', tags_es: ['planta', 'maceta', 'hierba', 'verde'] },
  { id: 'tb:tree',            importName: 'IconTree',            category: 'naturaleza', tags_es: ['arbol', 'natural', 'verde'] },
  { id: 'tb:trees',           importName: 'IconTrees',           category: 'naturaleza', tags_es: ['arboles', 'bosque', 'parque'] },
  { id: 'tb:flower',          importName: 'IconFlower',          category: 'naturaleza', tags_es: ['flor', 'planta', 'jardin'] },
  { id: 'tb:cactus',          importName: 'IconCactus',          category: 'naturaleza', tags_es: ['cactus', 'desierto', 'planta'] },
  { id: 'tb:seedling',        importName: 'IconSeedling',        category: 'naturaleza', tags_es: ['brote', 'semilla', 'cultivo', 'planta nueva'] },
  { id: 'tb:mountain',        importName: 'IconMountain',        category: 'naturaleza', tags_es: ['montana', 'pico', 'cumbre'] },
  { id: 'tb:beach',           importName: 'IconBeach',           category: 'naturaleza', tags_es: ['playa', 'sombrilla', 'verano', 'mar'] },
  { id: 'tb:bubble',          importName: 'IconBubble',          category: 'naturaleza', tags_es: ['burbuja', 'agua', 'jabon'] },
  { id: 'tb:sun',             importName: 'IconSun',             category: 'naturaleza', tags_es: ['sol', 'dia', 'mediodia'] },
  { id: 'tb:sun-high',        importName: 'IconSunHigh',         category: 'naturaleza', tags_es: ['sol', 'mediodia', 'calor'] },
  { id: 'tb:sun-low',         importName: 'IconSunLow',          category: 'naturaleza', tags_es: ['sol', 'tarde', 'atardecer'] },
  { id: 'tb:sunrise',         importName: 'IconSunrise',         category: 'naturaleza', tags_es: ['amanecer', 'desayuno', 'manana'] },
  { id: 'tb:sunset',          importName: 'IconSunset',          category: 'naturaleza', tags_es: ['atardecer', 'tarde', 'puesta'] },
  { id: 'tb:moon',            importName: 'IconMoon',            category: 'naturaleza', tags_es: ['luna', 'noche', 'cena'] },
  { id: 'tb:moon-stars',      importName: 'IconMoonStars',       category: 'naturaleza', tags_es: ['luna', 'estrellas', 'noche'] },
  { id: 'tb:cloud',           importName: 'IconCloud',           category: 'naturaleza', tags_es: ['nube', 'tiempo', 'cielo'] },
  { id: 'tb:cloud-rain',      importName: 'IconCloudRain',       category: 'naturaleza', tags_es: ['lluvia', 'nube', 'tiempo'] },
  { id: 'tb:cloud-snow',      importName: 'IconCloudSnow',       category: 'naturaleza', tags_es: ['nieve', 'nube', 'frio'] },
  { id: 'tb:cloud-storm',     importName: 'IconCloudStorm',      category: 'naturaleza', tags_es: ['tormenta', 'rayo', 'nube'] },
  { id: 'tb:rainbow',         importName: 'IconRainbow',         category: 'naturaleza', tags_es: ['arcoiris', 'colores', 'tiempo'] },
  { id: 'tb:wind',            importName: 'IconWind',            category: 'naturaleza', tags_es: ['viento', 'aire', 'soplar'] },
  { id: 'tb:snowflake',       importName: 'IconSnowflake',       category: 'naturaleza', tags_es: ['copo', 'nieve', 'frio'] },
  { id: 'tb:snowman',         importName: 'IconSnowman',         category: 'naturaleza', tags_es: ['muneco nieve', 'invierno', 'navidad'] },
  { id: 'tb:umbrella',        importName: 'IconUmbrella',        category: 'naturaleza', tags_es: ['paraguas', 'lluvia', 'sombrilla'] },
  { id: 'tb:paw',             importName: 'IconPaw',             category: 'naturaleza', tags_es: ['huella', 'pata', 'animal', 'mascota'] },
  { id: 'tb:dog',             importName: 'IconDog',             category: 'naturaleza', tags_es: ['perro', 'mascota', 'animal'] },
  { id: 'tb:cat',             importName: 'IconCat',             category: 'naturaleza', tags_es: ['gato', 'mascota', 'animal'] },
  { id: 'tb:butterfly',       importName: 'IconButterfly',       category: 'naturaleza', tags_es: ['mariposa', 'insecto', 'jardin'] },
  { id: 'tb:spider',          importName: 'IconSpider',          category: 'naturaleza', tags_es: ['arana', 'insecto', 'tela'] },
  { id: 'tb:horse',           importName: 'IconHorse',           category: 'naturaleza', tags_es: ['caballo', 'animal', 'granja'] },
  { id: 'tb:mouse',           importName: 'IconMouse',           category: 'naturaleza', tags_es: ['raton', 'roedor', 'animal'] },
  { id: 'tb:deer',            importName: 'IconDeer',            category: 'naturaleza', tags_es: ['ciervo', 'venado', 'animal'] },
  { id: 'tb:bat',             importName: 'IconBat',             category: 'naturaleza', tags_es: ['murcielago', 'animal', 'noche'] },
  { id: 'tb:planet',          importName: 'IconPlanet',          category: 'naturaleza', tags_es: ['planeta', 'espacio', 'universo'] },

  // ── Otros · emociones, transporte, símbolos, suplementos, métricas, util ──
  // Emociones
  { id: 'tb:mood-happy',      importName: 'IconMoodHappy',       category: 'otros',   tags_es: ['feliz', 'alegre', 'cara'] },
  { id: 'tb:mood-sad',        importName: 'IconMoodSad',         category: 'otros',   tags_es: ['triste', 'cara'] },
  { id: 'tb:mood-neutral',    importName: 'IconMoodNeutral',     category: 'otros',   tags_es: ['neutral', 'normal', 'cara'] },
  { id: 'tb:mood-angry',      importName: 'IconMoodAngry',       category: 'otros',   tags_es: ['enojado', 'enfadado', 'cara'] },
  { id: 'tb:mood-crazy-happy', importName: 'IconMoodCrazyHappy', category: 'otros',   tags_es: ['muy feliz', 'super contento', 'cara'] },
  { id: 'tb:mood-confuzed',   importName: 'IconMoodConfuzed',    category: 'otros',   tags_es: ['confundido', 'cara'] },
  { id: 'tb:mood-smile',      importName: 'IconMoodSmile',       category: 'otros',   tags_es: ['sonrisa', 'cara'] },
  { id: 'tb:mood-tongue',     importName: 'IconMoodTongue',      category: 'otros',   tags_es: ['lengua', 'broma', 'cara'] },
  { id: 'tb:mood-empty',      importName: 'IconMoodEmpty',       category: 'otros',   tags_es: ['cara', 'vacio'] },
  { id: 'tb:mood-cry',        importName: 'IconMoodCry',         category: 'otros',   tags_es: ['llorar', 'triste', 'cara'] },
  { id: 'tb:mood-wink',       importName: 'IconMoodWink',        category: 'otros',   tags_es: ['guino', 'cara'] },
  { id: 'tb:mood-surprised',  importName: 'IconMoodSurprised',   category: 'otros',   tags_es: ['sorprendido', 'cara'] },
  // Transporte
  { id: 'tb:bus',             importName: 'IconBus',             category: 'otros',   tags_es: ['bus', 'autobus', 'transporte'] },
  { id: 'tb:train',           importName: 'IconTrain',           category: 'otros',   tags_es: ['tren', 'transporte'] },
  { id: 'tb:plane',           importName: 'IconPlane',           category: 'otros',   tags_es: ['avion', 'volar', 'viaje'] },
  { id: 'tb:plane-arrival',   importName: 'IconPlaneArrival',    category: 'otros',   tags_es: ['avion', 'llegar', 'viaje'] },
  { id: 'tb:helicopter',      importName: 'IconHelicopter',      category: 'otros',   tags_es: ['helicoptero', 'volar'] },
  { id: 'tb:scooter',         importName: 'IconScooter',         category: 'otros',   tags_es: ['scooter', 'patinete', 'transporte'] },
  { id: 'tb:car-suv',         importName: 'IconCarSuv',          category: 'otros',   tags_es: ['suv', 'coche', 'todoterreno'] },
  { id: 'tb:ship',            importName: 'IconShip',            category: 'otros',   tags_es: ['barco', 'transporte', 'mar'] },
  { id: 'tb:sailboat',        importName: 'IconSailboat',        category: 'otros',   tags_es: ['velero', 'barco', 'mar'] },
  { id: 'tb:motorbike',       importName: 'IconMotorbike',       category: 'otros',   tags_es: ['moto', 'motocicleta', 'transporte'] },
  { id: 'tb:rocket',          importName: 'IconRocket',          category: 'otros',   tags_es: ['cohete', 'espacio', 'launch'] },
  { id: 'tb:anchor',          importName: 'IconAnchor',          category: 'otros',   tags_es: ['ancla', 'barco', 'mar'] },
  // Salud / suplementos
  { id: 'tb:pill',            importName: 'IconPill',            category: 'otros',   tags_es: ['pastilla', 'medicina', 'suplemento', 'vitamina'] },
  { id: 'tb:pills',           importName: 'IconPills',           category: 'otros',   tags_es: ['pastillas', 'medicinas', 'suplementos'] },
  { id: 'tb:vaccine',         importName: 'IconVaccine',         category: 'otros',   tags_es: ['vacuna', 'medicina', 'inyeccion'] },
  { id: 'tb:first-aid-kit',   importName: 'IconFirstAidKit',     category: 'otros',   tags_es: ['botiquin', 'medicina', 'salud', 'cruz'] },
  { id: 'tb:massage',         importName: 'IconMassage',         category: 'otros',   tags_es: ['masaje', 'spa', 'relax'] },
  // Tiempo / calendario
  { id: 'tb:calendar',        importName: 'IconCalendar',        category: 'otros',   tags_es: ['calendario', 'fecha'] },
  { id: 'tb:calendar-month',  importName: 'IconCalendarMonth',   category: 'otros',   tags_es: ['calendario', 'mes', 'hoy'] },
  { id: 'tb:calendar-stats',  importName: 'IconCalendarStats',   category: 'otros',   tags_es: ['calendario', 'estadisticas', 'progreso'] },
  { id: 'tb:calendar-event',  importName: 'IconCalendarEvent',   category: 'otros',   tags_es: ['calendario', 'evento', 'cita'] },
  { id: 'tb:calendar-time',   importName: 'IconCalendarTime',    category: 'otros',   tags_es: ['calendario', 'tiempo', 'hora'] },
  { id: 'tb:checkup-list',    importName: 'IconCheckupList',     category: 'otros',   tags_es: ['lista', 'checklist', 'registro', 'pendientes'] },
  // Notas / libros
  { id: 'tb:book',            importName: 'IconBook',            category: 'otros',   tags_es: ['libro', 'leer'] },
  { id: 'tb:book-2',          importName: 'IconBook2',           category: 'otros',   tags_es: ['libro', 'estudio', 'leer'] },
  { id: 'tb:notebook',        importName: 'IconNotebook',        category: 'otros',   tags_es: ['cuaderno', 'libreta', 'notas'] },
  { id: 'tb:notes',           importName: 'IconNotes',           category: 'otros',   tags_es: ['notas', 'apuntes', 'anotacion'] },
  { id: 'tb:file-text',       importName: 'IconFileText',        category: 'otros',   tags_es: ['archivo', 'documento', 'texto'] },
  { id: 'tb:bookmark',        importName: 'IconBookmark',        category: 'otros',   tags_es: ['marcador', 'favorito', 'guardar'] },
  { id: 'tb:clipboard',       importName: 'IconClipboard',       category: 'otros',   tags_es: ['portapapeles', 'lista'] },
  { id: 'tb:clipboard-list',  importName: 'IconClipboardList',   category: 'otros',   tags_es: ['lista', 'tareas', 'pendientes'] },
  { id: 'tb:list',            importName: 'IconList',            category: 'otros',   tags_es: ['lista', 'items'] },
  { id: 'tb:list-check',      importName: 'IconListCheck',       category: 'otros',   tags_es: ['lista', 'completado', 'check'] },
  { id: 'tb:list-numbers',    importName: 'IconListNumbers',     category: 'otros',   tags_es: ['lista', 'numerada', 'orden'] },
  // Símbolos / útiles
  { id: 'tb:sparkles',        importName: 'IconSparkles',        category: 'otros',   tags_es: ['ia', 'destellos', 'magia', 'generar'] },
  { id: 'tb:dots',            importName: 'IconDots',            category: 'otros',   tags_es: ['puntos', 'mas', 'opciones'] },
  { id: 'tb:settings',        importName: 'IconSettings',        category: 'otros',   tags_es: ['ajustes', 'configuracion', 'tuerca'] },
  { id: 'tb:adjustments',     importName: 'IconAdjustments',     category: 'otros',   tags_es: ['ajustes', 'controles', 'sliders'] },
  { id: 'tb:star',            importName: 'IconStar',            category: 'otros',   tags_es: ['estrella', 'favorito', 'destacado'] },
  { id: 'tb:star-filled',     importName: 'IconStarFilled',      category: 'otros',   tags_es: ['estrella', 'favorito', 'destacado'] },
  { id: 'tb:star-half-filled', importName: 'IconStarHalfFilled', category: 'otros',   tags_es: ['estrella', 'media', 'rating'] },
  { id: 'tb:stars',           importName: 'IconStars',           category: 'otros',   tags_es: ['estrellas', 'rating'] },
  { id: 'tb:heart',           importName: 'IconHeart',           category: 'otros',   tags_es: ['corazon', 'amor', 'favorito'] },
  { id: 'tb:heart-handshake', importName: 'IconHeartHandshake',  category: 'otros',   tags_es: ['amistad', 'corazon', 'manos'] },
  { id: 'tb:flag',            importName: 'IconFlag',            category: 'otros',   tags_es: ['bandera', 'marca', 'meta'] },
  { id: 'tb:flag-2',          importName: 'IconFlag2',           category: 'otros',   tags_es: ['bandera', 'marca'] },
  { id: 'tb:bell',            importName: 'IconBell',            category: 'otros',   tags_es: ['campana', 'alarma', 'notificacion'] },
  { id: 'tb:music',           importName: 'IconMusic',           category: 'otros',   tags_es: ['musica', 'nota', 'audio'] },
  { id: 'tb:message',         importName: 'IconMessage',         category: 'otros',   tags_es: ['mensaje', 'chat', 'comentario'] },
  { id: 'tb:message-circle',  importName: 'IconMessageCircle',   category: 'otros',   tags_es: ['mensaje', 'chat', 'burbuja'] },
  { id: 'tb:compass',         importName: 'IconCompass',         category: 'otros',   tags_es: ['brujula', 'direccion', 'norte'] },
  { id: 'tb:map-pin',         importName: 'IconMapPin',          category: 'otros',   tags_es: ['ubicacion', 'mapa', 'lugar'] },
  { id: 'tb:location',        importName: 'IconLocation',        category: 'otros',   tags_es: ['ubicacion', 'mapa', 'gps'] },
  { id: 'tb:navigation',      importName: 'IconNavigation',      category: 'otros',   tags_es: ['navegar', 'gps', 'direccion'] },
  { id: 'tb:user',            importName: 'IconUser',            category: 'otros',   tags_es: ['usuario', 'perfil', 'persona'] },
  { id: 'tb:users',           importName: 'IconUsers',           category: 'otros',   tags_es: ['usuarios', 'grupo', 'personas'] },
  { id: 'tb:user-circle',     importName: 'IconUserCircle',      category: 'otros',   tags_es: ['usuario', 'avatar', 'perfil'] },
  { id: 'tb:school',          importName: 'IconSchool',          category: 'otros',   tags_es: ['escuela', 'gorro', 'graduacion'] },
  { id: 'tb:license',         importName: 'IconLicense',         category: 'otros',   tags_es: ['licencia', 'certificado', 'documento'] },
  { id: 'tb:award',           importName: 'IconAward',           category: 'otros',   tags_es: ['premio', 'logro', 'medalla'] },
  { id: 'tb:palette',         importName: 'IconPalette',         category: 'otros',   tags_es: ['paleta', 'colores', 'arte'] },
  { id: 'tb:flare',           importName: 'IconFlare',           category: 'otros',   tags_es: ['brillo', 'destello', 'luz'] },
  { id: 'tb:balloon',         importName: 'IconBalloon',         category: 'otros',   tags_es: ['globo', 'fiesta', 'cumpleanos'] },
  { id: 'tb:atom',            importName: 'IconAtom',            category: 'otros',   tags_es: ['atomo', 'ciencia', 'fisica'] },
  // Métricas / charts
  { id: 'tb:chart-bar',       importName: 'IconChartBar',        category: 'otros',   tags_es: ['grafico', 'barras', 'estadisticas'] },
  { id: 'tb:chart-line',      importName: 'IconChartLine',       category: 'otros',   tags_es: ['grafico', 'linea', 'estadisticas'] },
  { id: 'tb:chart-area',      importName: 'IconChartArea',       category: 'otros',   tags_es: ['grafico', 'area', 'estadisticas'] },
  { id: 'tb:chart-pie',       importName: 'IconChartPie',        category: 'otros',   tags_es: ['grafico', 'circular', 'pie', 'porcentaje'] },
  { id: 'tb:chart-circles',   importName: 'IconChartCircles',    category: 'otros',   tags_es: ['grafico', 'circulos', 'estadisticas'] },
  { id: 'tb:chart-donut',     importName: 'IconChartDonut',      category: 'otros',   tags_es: ['grafico', 'donut', 'circular'] },
  { id: 'tb:trending-up',     importName: 'IconTrendingUp',      category: 'otros',   tags_es: ['subida', 'progreso', 'tendencia'] },
  // Iconos NO mostrados en el picker (utilitarios para código fijo)
  // Estos se usan vía `<MealIcon value="tb:...">` desde código y por
  // tanto deben estar en el registry para que MealIcon los resuelva.
  { id: 'tb:alert-circle',    importName: 'IconAlertCircle',     category: 'otros',   tags_es: ['alerta', 'aviso', 'circulo'] },
  { id: 'tb:alert-triangle',  importName: 'IconAlertTriangle',   category: 'otros',   tags_es: ['advertencia', 'warning', 'triangulo'] },
  { id: 'tb:circle-check',    importName: 'IconCircleCheck',     category: 'otros',   tags_es: ['check', 'tomado', 'circulo'] },
  { id: 'tb:circle-check-filled', importName: 'IconCircleCheckFilled', category: 'otros', tags_es: ['check', 'circulo', 'lleno'] },
  { id: 'tb:info-circle',     importName: 'IconInfoCircle',      category: 'otros',   tags_es: ['info', 'informacion', 'circulo'] },
  { id: 'tb:pencil',          importName: 'IconPencil',          category: 'otros',   tags_es: ['lapiz', 'editar', 'modificar'] },
  // ── Iconos de control/UX (no mostrados en picker · solo para
  //    `<MealIcon>` desde código) · ver Task C de la migración total.
  { id: 'tb:x',               importName: 'IconX',               category: 'otros',   tags_es: ['cerrar', 'x', 'cancel'] },
  { id: 'tb:check',           importName: 'IconCheck',           category: 'otros',   tags_es: ['check', 'tic', 'confirmar'] },
  { id: 'tb:plus',            importName: 'IconPlus',            category: 'otros',   tags_es: ['mas', 'anadir', 'sumar'] },
  { id: 'tb:minus',           importName: 'IconMinus',           category: 'otros',   tags_es: ['menos', 'quitar', 'restar'] },
  { id: 'tb:circle-plus',     importName: 'IconCirclePlus',      category: 'otros',   tags_es: ['anadir', 'circulo', 'plus'] },
  { id: 'tb:circle-minus',    importName: 'IconCircleMinus',     category: 'otros',   tags_es: ['quitar', 'circulo', 'minus'] },
  { id: 'tb:circle-x',        importName: 'IconCircleX',         category: 'otros',   tags_es: ['cancelar', 'circulo', 'x'] },
  { id: 'tb:chevron-right',   importName: 'IconChevronRight',    category: 'otros',   tags_es: ['flecha', 'derecha', 'siguiente'] },
  { id: 'tb:chevron-left',    importName: 'IconChevronLeft',     category: 'otros',   tags_es: ['flecha', 'izquierda', 'anterior'] },
  { id: 'tb:chevron-up',      importName: 'IconChevronUp',       category: 'otros',   tags_es: ['flecha', 'arriba'] },
  { id: 'tb:chevron-down',    importName: 'IconChevronDown',     category: 'otros',   tags_es: ['flecha', 'abajo'] },
  { id: 'tb:arrow-right',     importName: 'IconArrowRight',      category: 'otros',   tags_es: ['flecha', 'derecha'] },
  { id: 'tb:arrow-left',      importName: 'IconArrowLeft',       category: 'otros',   tags_es: ['flecha', 'izquierda', 'volver'] },
  { id: 'tb:eye',             importName: 'IconEye',             category: 'otros',   tags_es: ['ojo', 'ver', 'mostrar'] },
  { id: 'tb:eye-off',         importName: 'IconEyeOff',          category: 'otros',   tags_es: ['ojo', 'ocultar', 'no ver'] },
  { id: 'tb:mail',            importName: 'IconMail',            category: 'otros',   tags_es: ['email', 'correo', 'sobre'] },
  { id: 'tb:lock',            importName: 'IconLock',            category: 'otros',   tags_es: ['candado', 'cerrado', 'seguridad'] },
  { id: 'tb:lock-open',       importName: 'IconLockOpen',        category: 'otros',   tags_es: ['candado', 'abierto', 'desbloqueado'] },
  { id: 'tb:key',             importName: 'IconKey',             category: 'otros',   tags_es: ['llave', 'acceso', 'clave'] },
  { id: 'tb:device-floppy',   importName: 'IconDeviceFloppy',    category: 'otros',   tags_es: ['guardar', 'disquete', 'save'] },
  { id: 'tb:refresh',         importName: 'IconRefresh',         category: 'otros',   tags_es: ['actualizar', 'recargar', 'reset'] },
  { id: 'tb:copy',            importName: 'IconCopy',            category: 'otros',   tags_es: ['copiar', 'duplicar'] },
  { id: 'tb:edit',            importName: 'IconEdit',            category: 'otros',   tags_es: ['editar', 'modificar', 'lapiz'] },
  { id: 'tb:camera',          importName: 'IconCamera',          category: 'otros',   tags_es: ['camara', 'foto'] },
  { id: 'tb:photo',           importName: 'IconPhoto',           category: 'otros',   tags_es: ['foto', 'imagen', 'galeria'] },
  { id: 'tb:trash',           importName: 'IconTrash',           category: 'otros',   tags_es: ['eliminar', 'borrar', 'papelera'] },
  { id: 'tb:logout',          importName: 'IconLogout',          category: 'otros',   tags_es: ['salir', 'cerrar sesion', 'logout'] },
  { id: 'tb:login',           importName: 'IconLogin',           category: 'otros',   tags_es: ['entrar', 'iniciar sesion', 'login'] },
  { id: 'tb:shield-check',    importName: 'IconShieldCheck',     category: 'otros',   tags_es: ['escudo', 'seguro', 'verificado'] },
  { id: 'tb:shield-half-filled', importName: 'IconShieldHalfFilled', category: 'otros', tags_es: ['escudo', 'parcial', 'seguridad'] },
  { id: 'tb:help-circle',     importName: 'IconHelpCircle',      category: 'otros',   tags_es: ['ayuda', 'pregunta', 'soporte'] },
  { id: 'tb:help',            importName: 'IconHelp',            category: 'otros',   tags_es: ['ayuda', 'pregunta'] },
  { id: 'tb:share',           importName: 'IconShare',           category: 'otros',   tags_es: ['compartir', 'enviar'] },
  { id: 'tb:share-2',         importName: 'IconShare2',          category: 'otros',   tags_es: ['compartir', 'red'] },
  { id: 'tb:search',          importName: 'IconSearch',          category: 'otros',   tags_es: ['buscar', 'lupa', 'busqueda'] },
];

// ─────────────────────────────────────────────────────────────────────
// LOOKUPS Y BÚSQUEDA
// ─────────────────────────────────────────────────────────────────────

// Map id → entry · O(1) lookup en MealIcon y IconPicker.
const REGISTRY_BY_ID = new Map<string, IconEntry>(
  ICON_REGISTRY.map((e) => [e.id, e]),
);

export function getIconEntry(id: string): IconEntry | null {
  return REGISTRY_BY_ID.get(id) ?? null;
}

export function getIconsByCategory(cat: IconCategory): IconEntry[] {
  return ICON_REGISTRY.filter((e) => e.category === cat);
}

// Quita diacríticos (NFD) y pasa a lowercase · "plátano" → "platano".
// Misma normalización que el antiguo EmojiPicker para mantener UX.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Busca iconos por keywords ES · tokens AND. "fuego cardio" → IconFlame
 * (que tiene 'fuego' Y 'cardio' en sus tags). El haystack incluye id +
 * tags_es para que también funcione búsqueda por id directo.
 */
export function searchIcons(query: string): IconEntry[] {
  const q = normalize(query.trim());
  if (!q) return ICON_REGISTRY;
  const tokens = q.split(/\s+/).filter(Boolean);
  return ICON_REGISTRY.filter((e) => {
    const haystack = normalize(`${e.id} ${e.tags_es.join(' ')}`);
    return tokens.every((t) => haystack.includes(t));
  });
}
