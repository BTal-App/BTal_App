import { useEffect, useMemo, useRef, useState } from 'react';
import { IonModal, IonContent, IonButton } from '@ionic/react';
import { MealIcon } from './MealIcon';
import { useProfile } from '../hooks/useProfile';
import { searchFood, type FoodSearchResult } from '../services/functions';
import { barcodeAvailable, scanBarcode } from '../services/barcode';
import type { Alimento } from '../templates/defaultUser';
import './FoodSearchModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Devuelve el alimento elegido (con sus macros por 100 g) al editor.
  onSelect: (alimento: Alimento) => void;
}

// Buscador de alimentos (Fase 6B-B). Busca por nombre en OpenFoodFacts
// (cache-first en el server) y, al elegir un producto + cantidad, devuelve un
// Alimento con macros reales por 100 g para que la comida recalcule su total.
export function FoodSearchModal({ isOpen, onClose, onSelect }: Props) {
  const { profile: userDoc } = useProfile();
  const supermercados = userDoc?.profile?.supermercados ?? [];

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  // Producto elegido (paso de cantidad). null = en la lista.
  const [picked, setPicked] = useState<FoodSearchResult | null>(null);
  const [gramos, setGramos] = useState('100');
  // Filtro por marca(s) · chips sobre los resultados (multi-select).
  const [brandFilter, setBrandFilter] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  const reqId = useRef(0);

  const reset = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setError('');
    setPicked(null);
    setGramos('100');
    setBrandFilter([]);
    setScanning(false);
    setLoading(false);
  };

  // Escanea un código de barras (solo nativo) → busca el producto por EAN.
  const handleScan = async () => {
    setError('');
    setScanning(true);
    try {
      const code = await scanBarcode();
      if (!code) return;
      const res = await searchFood({ barcode: code, supermercados });
      if (res.length > 0) setPicked(res[0]);
      else setError('Producto no encontrado en Open Food Facts.');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'denied') setError('Necesitas dar permiso de cámara para escanear.');
      else if (code !== 'cancelled') setError('No se pudo escanear. Inténtalo de nuevo.');
    } finally {
      setScanning(false);
    }
  };

  const toggleBrand = (b: string) =>
    setBrandFilter((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));

  // Marcas presentes en los resultados (por frecuencia) + lista filtrada.
  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of results) {
      if (r.brand) counts.set(r.brand, (counts.get(r.brand) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);
  }, [results]);

  const visible =
    brandFilter.length > 0
      ? results.filter((r) => r.brand && brandFilter.includes(r.brand))
      : results;

  // Búsqueda con debounce 400 ms · ignora respuestas obsoletas (reqId).
  // Todo el setState va DENTRO del timeout (no síncrono en el cuerpo del effect).
  useEffect(() => {
    if (!isOpen || picked) return;
    const q = query.trim();
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        setSearched(false);
        setError('');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await searchFood({ query: q, supermercados });
        if (id !== reqId.current) return;
        setResults(res);
        setSearched(true);
      } catch {
        if (id !== reqId.current) return;
        setError('No se pudo buscar ahora mismo. Inténtalo de nuevo.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, isOpen, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const g = Math.max(1, Math.min(2000, Math.round(Number(gramos) || 0)));
  const factor = g / 100;
  const preview = picked
    ? {
        kcal: Math.round(picked.kcalPer100 * factor),
        prot: Math.round(picked.protPer100 * factor),
        carb: Math.round(picked.carbPer100 * factor),
        fat: Math.round(picked.fatPer100 * factor),
      }
    : null;

  const confirm = () => {
    if (!picked) return;
    onSelect({
      nombre: picked.nombre,
      cantidad: `${g} g`,
      source: 'off',
      brand: picked.brand,
      kcalPer100: picked.kcalPer100,
      protPer100: picked.protPer100,
      carbPer100: picked.carbPer100,
      fatPer100: picked.fatPer100,
    });
    onClose();
  };

  return (
    <IonModal
      isOpen={isOpen}
      onWillPresent={reset}
      onDidDismiss={onClose}
      className="settings-modal food-search-modal"
    >
      <IonContent>
        <div className="settings-modal-bg">
          <div className="settings-modal-card food-search-card">
            <button
              type="button"
              className="settings-modal-close settings-modal-close--fixed"
              onClick={(e) => {
                e.currentTarget.blur();
                onClose();
              }}
              aria-label="Cerrar"
            >
              <MealIcon value="tb:x" size={22} />
            </button>

            <h2 className="settings-modal-title">Buscar alimento</h2>

            {!picked && (
              <>
                <div className="food-search-input-row">
                  <div className="food-search-input">
                    <MealIcon value="tb:search" size={18} />
                    <input
                      type="text"
                      value={query}
                      placeholder="ej. yogur griego, arroz, atún…"
                      aria-label="Buscar alimento"
                      maxLength={60}
                      autoFocus
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setBrandFilter([]);
                      }}
                    />
                  </div>
                  {barcodeAvailable() && (
                    <button
                      type="button"
                      className="food-search-scan"
                      onClick={handleScan}
                      disabled={scanning}
                      aria-label="Escanear código de barras"
                    >
                      <MealIcon value="tb:camera" size={22} />
                    </button>
                  )}
                </div>

                {scanning && <p className="food-search-status">Escaneando…</p>}
                {loading && <p className="food-search-status">Buscando…</p>}
                {error && <p className="food-search-status food-search-error">{error}</p>}
                {!loading && !error && searched && results.length === 0 && (
                  <p className="food-search-status">Sin resultados. Prueba otro nombre.</p>
                )}

                {/* Filtro por marca · chips de las marcas presentes (multi). */}
                {brands.length > 1 && (
                  <div className="food-search-brands">
                    {brands.map((b) => {
                      const active = brandFilter.includes(b);
                      return (
                        <button
                          key={b}
                          type="button"
                          className={'food-search-brand-chip' + (active ? ' active' : '')}
                          onClick={() => toggleBrand(b)}
                        >
                          {b}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!loading && results.length > 0 && visible.length === 0 && (
                  <p className="food-search-status">Ningún resultado de esa marca.</p>
                )}

                <div className="food-search-results">
                  {visible.map((r, i) => (
                    <button
                      key={`${r.code ?? r.nombre}-${i}`}
                      type="button"
                      className="food-search-result"
                      onClick={() => setPicked(r)}
                    >
                      <span className="food-search-result-main">
                        <span className="food-search-result-name">{r.nombre}</span>
                        {r.brand && <span className="food-search-result-brand">{r.brand}</span>}
                      </span>
                      <span className="food-search-result-kcal">{Math.round(r.kcalPer100)} kcal/100g</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {picked && preview && (
              <div className="food-search-pick">
                <div className="food-search-pick-name">
                  {picked.nombre}
                  {picked.brand && <span className="food-search-result-brand">{picked.brand}</span>}
                </div>

                <label className="onboarding-field">
                  <span>Cantidad (gramos)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={2000}
                    value={gramos}
                    onChange={(e) => setGramos(e.target.value)}
                  />
                </label>

                <div className="food-search-macros">
                  <span className="food-search-macro food-search-macro--kcal">{preview.kcal} kcal</span>
                  <span className="food-search-macro food-search-macro--prot">{preview.prot} g P</span>
                  <span className="food-search-macro food-search-macro--carb">{preview.carb} g C</span>
                  <span className="food-search-macro food-search-macro--fat">{preview.fat} g G</span>
                </div>

                <div className="food-search-pick-actions">
                  <button type="button" className="food-search-back" onClick={() => setPicked(null)}>
                    <MealIcon value="tb:arrow-left" size={16} /> Volver
                  </button>
                  <IonButton
                    expand="block"
                    className="settings-modal-primary food-search-add"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      confirm();
                    }}
                  >
                    <MealIcon value="tb:plus" size={18} slot="start" />
                    Añadir a la comida
                  </IonButton>
                </div>
              </div>
            )}

            <p className="food-search-attrib">Datos de Open Food Facts</p>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}
