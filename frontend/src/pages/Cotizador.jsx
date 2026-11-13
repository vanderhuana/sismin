import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Calculator, 
  Printer, 
  RotateCcw, 
  User, 
  Search, 
  FileText, 
  CheckCircle2, 
  Coins, 
  AlertCircle, 
  Loader2, 
  Tag, 
  Scale, 
  SlidersHorizontal,
  ArrowRight
} from 'lucide-react';
import { providerService, calculoService, handleApiError } from '../services/api';
import { calcularPagoPreview, formatBs, formatKg } from '../utils/calculations';

const TIPOS_MINERAL = [
  {
    value: 'PLATA',
    label: 'Plata (Ag)',
    symbol: 'Ag',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    activeClass: 'border-slate-500 bg-slate-50 ring-2 ring-slate-400',
    desc: 'Mineral simple de plata (Ley en DM)'
  },
  {
    value: 'PLOMO',
    label: 'Plomo (Pb)',
    symbol: 'Pb',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
    activeClass: 'border-zinc-500 bg-zinc-50 ring-2 ring-zinc-400',
    desc: 'Mineral simple de plomo (Ley en %)'
  },
  {
    value: 'COMPLEJO',
    label: 'Complejo (Ag + Pb)',
    symbol: 'Ag+Pb',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    activeClass: 'border-amber-500 bg-amber-50 ring-2 ring-amber-400',
    desc: 'Mineral mixto: Ag (DM) + Pb (%)'
  },
  {
    value: 'PIRITA',
    label: 'Pirita (Py)',
    symbol: 'Py',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    activeClass: 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-400',
    desc: 'Mineral simple de pirita (Ley en DM)'
  },
  {
    value: 'OXIDO',
    label: 'Óxido (Ox)',
    symbol: 'Ox',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    activeClass: 'border-orange-500 bg-orange-50 ring-2 ring-orange-400',
    desc: 'Mineral simple de óxido (Ley en DM)'
  }
];

const Cotizador = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [nombreManual, setNombreManual] = useState('');
  const [modoManual, setModoManual] = useState(false);
  const [selectedTipoMineral, setSelectedTipoMineral] = useState('PLATA');

  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const { register, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      lote: 'COT-001',
      kilosBruto: '',
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: '',
      anticipos: '',
      ley: '',
      valorEscala: '',
      leyPlata: '',
      valorEscalaPlata: '',
      leyPlomo: '',
      valorEscalaPlomo: ''
    }
  });

  const formValues = watch();

  // Cargar lista de proveedores activos (solo lectura)
  useEffect(() => {
    const fetchProveedores = async () => {
      try {
        setLoadingProveedores(true);
        const data = await providerService.getActiveProviders();
        setProveedores(data || []);
      } catch (err) {
        console.error('Error al cargar proveedores:', err);
      } finally {
        setLoadingProveedores(false);
      }
    };
    fetchProveedores();
  }, []);

  // Filtrar proveedores registrados
  const proveedoresFiltrados = useMemo(() => {
    if (!busquedaProveedor.trim()) return proveedores;
    const q = busquedaProveedor.toLowerCase().trim();
    return proveedores.filter(
      (p) =>
        p.nombreCompleto.toLowerCase().includes(q) ||
        (p.ci && p.ci.toLowerCase().includes(q))
    );
  }, [proveedores, busquedaProveedor]);

  // Cálculo en tiempo real en memoria
  const calculoEnVivo = useMemo(() => {
    return calcularPagoPreview({
      kilosBruto: formValues.kilosBruto,
      humedadPorcentaje: formValues.humedadPorcentaje,
      tipoMineral: selectedTipoMineral,
      ley: formValues.ley,
      valorEscala: formValues.valorEscala,
      leyPlata: formValues.leyPlata,
      valorEscalaPlata: formValues.valorEscalaPlata,
      leyPlomo: formValues.leyPlomo,
      valorEscalaPlomo: formValues.valorEscalaPlomo,
      regaliasPorcentaje: formValues.regaliasPorcentaje,
      anticipos: formValues.anticipos,
      transporte: formValues.transporte
    });
  }, [formValues, selectedTipoMineral]);

  // Selección de proveedor registrado
  const handleSelectProveedor = (prov) => {
    setProveedorSeleccionado(prov);
    setModoManual(false);
    setBusquedaProveedor('');
    setError(null);
  };

  const handleClearProveedor = () => {
    setProveedorSeleccionado(null);
    setNombreManual('');
    setBusquedaProveedor('');
  };

  // Limpiar y reiniciar formulario
  const handleLimpiar = () => {
    reset({
      lote: `COT-${Math.floor(100 + Math.random() * 900)}`,
      kilosBruto: '',
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: '',
      anticipos: '',
      ley: '',
      valorEscala: '',
      leyPlata: '',
      valorEscalaPlata: '',
      leyPlomo: '',
      valorEscalaPlomo: ''
    });
    setProveedorSeleccionado(null);
    setNombreManual('');
    setModoManual(false);
    setSelectedTipoMineral('PLATA');
    setError(null);
    setSuccess(null);
  };

  // Generar comprobante oficial en PDF al vuelo (sin guardar nada en BD)
  const handleGenerarPdf = async () => {
    try {
      setGenerandoPdf(true);
      setError(null);

      const kilosBrutoNum = Math.trunc(Number(formValues.kilosBruto) || 0);
      if (kilosBrutoNum <= 0) {
        setError('Debes ingresar los Kilos Bruto para poder emitir el comprobante.');
        setGenerandoPdf(false);
        return;
      }

      const nombreFinal = proveedorSeleccionado
        ? proveedorSeleccionado.nombreCompleto
        : (nombreManual.trim() || 'PROVEEDOR GENERAL');

      const payload = {
        proveedorNombre: nombreFinal,
        proveedorId: proveedorSeleccionado ? proveedorSeleccionado.id : undefined,
        lote: formValues.lote?.trim() || 'COTIZACION',
        tipoMineral: selectedTipoMineral,
        kilosBruto: kilosBrutoNum,
        humedadPorcentaje: Number(formValues.humedadPorcentaje) || 0,
        ley: formValues.ley ? Number(formValues.ley) : undefined,
        valorEscala: formValues.valorEscala ? Number(formValues.valorEscala) : undefined,
        leyPlata: formValues.leyPlata ? Number(formValues.leyPlata) : undefined,
        valorEscalaPlata: formValues.valorEscalaPlata ? Number(formValues.valorEscalaPlata) : undefined,
        leyPlomo: formValues.leyPlomo ? Number(formValues.leyPlomo) : undefined,
        valorEscalaPlomo: formValues.valorEscalaPlomo ? Number(formValues.valorEscalaPlomo) : undefined,
        regaliasPorcentaje: Number(formValues.regaliasPorcentaje) || 10,
        anticipos: Math.trunc(Number(formValues.anticipos) || 0),
        transporte: Math.trunc(Number(formValues.transporte) || 0)
      };

      const response = await calculoService.generateSimulacionPdf(payload);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      // Intentar abrir en pestaña nueva con visor de impresión
      const newTab = window.open(url, '_blank');
      if (!newTab || newTab.closed || typeof newTab.closed === 'undefined') {
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprobante-${payload.lote}.pdf`;
        link.click();
      }

      setSuccess(`✅ Comprobante generado con éxito para el lote ${payload.lote}`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setGenerandoPdf(false);
    }
  };

  const mineralActual = TIPOS_MINERAL.find((m) => m.value === selectedTipoMineral) || TIPOS_MINERAL[0];

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-xs">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cotizador</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Liquidación y proformas en tiempo real · Emisión de comprobantes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLimpiar}
            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
            title="Reiniciar todos los campos"
          >
            <RotateCcw className="h-3.5 w-3.5 text-gray-600" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 shadow-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Atención</p>
            <p className="mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-xs sm:text-sm text-green-800 shadow-xs">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      {/* CUERPO PRINCIPAL: 2 COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: FORMULARIO DE ENTRADA (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-white px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                <span>Datos de la Cotización</span>
              </h2>
            </div>

            <div className="p-5 space-y-5">
              {/* 1. SELECCIÓN DE PROVEEDOR */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <User className="h-3.5 w-3.5 text-primary-600" />
                    <span>Proveedor o Cliente</span>
                  </label>
                  <div className="flex items-center gap-2 text-xs">
                    {proveedorSeleccionado || modoManual ? (
                      <button
                        type="button"
                        onClick={handleClearProveedor}
                        className="text-primary-600 hover:text-primary-800 font-medium inline-flex items-center gap-1"
                      >
                        <RotateCcw className="h-3 w-3" /> Cambiar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModoManual(!modoManual)}
                        className="text-xs text-gray-500 hover:text-primary-600 underline"
                      >
                        {modoManual ? 'Buscar en BD' : 'Ingresar nombre manual'}
                      </button>
                    )}
                  </div>
                </div>

                {proveedorSeleccionado ? (
                  <div className="flex items-center justify-between rounded-lg border-2 border-emerald-500 bg-emerald-50/50 p-3 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs">
                        {proveedorSeleccionado.nombreCompleto.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{proveedorSeleccionado.nombreCompleto}</p>
                        <p className="text-xs text-gray-600 font-mono">
                          CI: {proveedorSeleccionado.ci || '—'} · {proveedorSeleccionado.tipo === 'EMPRESA' ? 'Empresa' : 'Persona Natural'}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Registrado
                    </span>
                  </div>
                ) : modoManual ? (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={nombreManual}
                      onChange={(e) => setNombreManual(e.target.value)}
                      className="input pl-9 text-sm"
                      placeholder="Escribe el nombre del cliente o proforma..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={busquedaProveedor}
                        onChange={(e) => setBusquedaProveedor(e.target.value)}
                        className="input pl-9 text-sm"
                        placeholder="Buscar proveedor activo en la base de datos..."
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100 shadow-inner">
                      {loadingProveedores ? (
                        <div className="p-3 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
                          <span>Cargando lista de proveedores...</span>
                        </div>
                      ) : proveedoresFiltrados.length === 0 ? (
                        <div className="p-3 text-center text-xs text-gray-500">
                          <p>No se encontraron proveedores que coincidan.</p>
                          <button
                            type="button"
                            onClick={() => setModoManual(true)}
                            className="mt-1 text-primary-600 font-semibold underline"
                          >
                            Usar nombre manual
                          </button>
                        </div>
                      ) : (
                        proveedoresFiltrados.slice(0, 5).map((p) => (
                          <button
                            type="button"
                            key={p.id}
                            onClick={() => handleSelectProveedor(p)}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-50/70 flex items-center justify-between transition-colors group"
                          >
                            <div>
                              <p className="text-xs font-semibold text-gray-900 group-hover:text-emerald-800">
                                {p.nombreCompleto}
                              </p>
                              <p className="text-[11px] text-gray-500 font-mono">
                                CI: {p.ci || '—'} · {p.tipo === 'EMPRESA' ? 'Empresa' : 'Persona'}
                              </p>
                            </div>
                            <span className="text-xs font-medium text-gray-400 group-hover:text-emerald-600">
                              Seleccionar →
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. TIPO DE MINERAL */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Tipo de Mineral *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  {TIPOS_MINERAL.map((m) => {
                    const isSelected = selectedTipoMineral === m.value;
                    return (
                      <button
                        type="button"
                        key={m.value}
                        onClick={() => setSelectedTipoMineral(m.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${m.activeClass} shadow-xs`
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-gray-900">{m.label}</span>
                          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${m.badgeClass}`}>
                            {m.symbol}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{m.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. LOTE Y PESO EN BÁSCULA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-primary-600" />
                    <span>Lote o Referencia</span>
                  </label>
                  <input
                    type="text"
                    {...register('lote')}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono font-bold uppercase text-sm"
                    placeholder="Ej: COT-001"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Scale className="h-3.5 w-3.5 text-primary-600" />
                      <span>Kilos Bruto *</span>
                    </span>
                    {formValues.kilosBruto && !isNaN(Number(formValues.kilosBruto)) && (
                      <span className="text-[11px] font-mono font-bold text-primary-700">
                        {formatKg(formValues.kilosBruto)}
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    {...register('kilosBruto', { required: true })}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono font-bold text-base"
                    placeholder="Ej: 1500"
                  />
                </div>
              </div>

              {/* 4. ENSAYOS Y LEYES SEGÚN MINERAL */}
              {selectedTipoMineral !== 'COMPLEJO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Ley ({selectedTipoMineral === 'PLOMO' ? '%' : 'DM'}) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      {...register('ley')}
                      onFocus={(e) => e.target.select()}
                      className="input font-mono"
                      placeholder="Ej: 95"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Valor Escala *
                    </label>
                    <input
                      type="number"
                      step="1"
                      {...register('valorEscala')}
                      onFocus={(e) => e.target.select()}
                      className="input font-mono"
                      placeholder="Ej: 140"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-xl border border-amber-200">
                  <p className="text-xs font-bold text-amber-900 uppercase">Ensayos Mineral Complejo (Ag + Pb)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-700 font-medium">Ley Plata (DM) *</label>
                      <input
                        type="number"
                        step="1"
                        {...register('leyPlata')}
                        onFocus={(e) => e.target.select()}
                        className="input font-mono"
                        placeholder="Ej: 95"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-700 font-medium">Valor Escala Plata *</label>
                      <input
                        type="number"
                        step="1"
                        {...register('valorEscalaPlata')}
                        onFocus={(e) => e.target.select()}
                        className="input font-mono"
                        placeholder="Ej: 140"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-700 font-medium">Ley Plomo (%) *</label>
                      <input
                        type="number"
                        step="1"
                        {...register('leyPlomo')}
                        onFocus={(e) => e.target.select()}
                        className="input font-mono"
                        placeholder="Ej: 20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-700 font-medium">Valor Escala Plomo *</label>
                      <input
                        type="number"
                        step="1"
                        {...register('valorEscalaPlomo')}
                        onFocus={(e) => e.target.select()}
                        className="input font-mono"
                        placeholder="Ej: 2"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. PARÁMETROS: HUMEDAD, REGALÍAS, TRANSPORTE Y ANTICIPOS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Humedad %</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    {...register('humedadPorcentaje')}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Regalías %</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    {...register('regaliasPorcentaje')}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Transporte (Bs)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    {...register('transporte')}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">Anticipos (Bs)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    {...register('anticipos')}
                    onFocus={(e) => e.target.select()}
                    className="input font-mono"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: PANEL DE LIQUIDACIÓN EN VIVO Y PDF (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card shadow-sm border border-emerald-200 overflow-hidden bg-gradient-to-b from-white to-emerald-50/20">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-300" />
                <h3 className="font-bold text-sm">Resumen de Liquidación</h3>
              </div>
              <span className="text-[11px] bg-emerald-700/70 border border-emerald-500/60 px-2 py-0.5 rounded-full font-mono">
                Cálculo en Vivo
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Tarjeta de encabezado del lote cotizado */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Referencia</span>
                  <span className="font-mono font-bold text-sm text-gray-800 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded">
                    {formValues.lote || 'COTIZACION'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Mineral</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${mineralActual.badgeClass}`}>
                    {mineralActual.label}
                  </span>
                </div>
              </div>

              {/* Nombre de proveedor */}
              <div className="text-xs text-gray-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="font-medium text-gray-500">Proveedor:</span>
                <strong className="text-gray-900 font-semibold truncate ml-2">
                  {proveedorSeleccionado
                    ? proveedorSeleccionado.nombreCompleto
                    : (nombreManual.trim() || 'PROVEEDOR GENERAL')}
                </strong>
              </div>

              {/* Desglose de Pesaje */}
              <div className="space-y-1.5 text-xs text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Kilos Bruto:</span>
                  <span className="font-mono font-bold text-gray-900 text-sm">
                    {formatKg(formValues.kilosBruto || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>(-) Humedad ({formValues.humedadPorcentaje || 0}%):</span>
                  <span className="font-mono text-red-600">
                    - {Math.trunc(((Number(formValues.kilosBruto) || 0) * (Number(formValues.humedadPorcentaje) || 0)) / 100).toLocaleString('es-BO')} kg
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 font-bold text-gray-900">
                  <span>Kilos Neto:</span>
                  <span className="font-mono text-emerald-700 text-sm">
                    {formatKg(calculoEnVivo.kilosNeto || 0)}
                  </span>
                </div>
              </div>

              {/* Desglose Contable */}
              <dl className="space-y-2 text-xs text-gray-700 bg-white p-3.5 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center font-medium">
                  <dt className="text-gray-600">Valor Escala Total</dt>
                  <dd className="font-mono font-semibold text-gray-900">{calculoEnVivo.valorEscalaTotal}</dd>
                </div>
                <div className="flex justify-between items-center border-t border-gray-100 pt-1.5 font-bold text-gray-900">
                  <dt>VALOR BRUTO</dt>
                  <dd className="font-mono text-sm text-primary-700">{formatBs(calculoEnVivo.valorBruto)}</dd>
                </div>
                <div className="flex justify-between items-center text-red-600">
                  <dt>(-) Regalías ({formValues.regaliasPorcentaje || 10}%)</dt>
                  <dd className="font-mono">- {formatBs(calculoEnVivo.regaliasMonto)}</dd>
                </div>
                {Number(formValues.anticipos) > 0 && (
                  <div className="flex justify-between items-center text-red-600">
                    <dt>(-) Anticipos</dt>
                    <dd className="font-mono">- {formatBs(formValues.anticipos)}</dd>
                  </div>
                )}
                {Number(formValues.transporte) > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <dt>(+) Transporte</dt>
                    <dd className="font-mono">+ {formatBs(formValues.transporte)}</dd>
                  </div>
                )}
              </dl>

              {/* Recuadro de Saldo Final */}
              <div className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-emerald-100 font-semibold uppercase tracking-wider">
                  <span>Saldo Final Liquidado</span>
                  <Coins className="h-4 w-4 text-emerald-200" />
                </div>
                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                  {formatBs(calculoEnVivo.saldoFinal)}
                </div>
                <p className="text-[11px] text-emerald-100 opacity-90 truncate">
                  Total neto a cancelar estimado
                </p>
              </div>

              {/* Botón de Impresión / Descarga de PDF */}
              <button
                type="button"
                onClick={handleGenerarPdf}
                disabled={generandoPdf || (Number(formValues.kilosBruto) || 0) <= 0}
                className="w-full btn btn-primary btn-md shadow-md py-3 text-sm font-bold flex items-center justify-center gap-2 rounded-xl transition-all disabled:opacity-50"
              >
                {generandoPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Generando Comprobante Oficial en PDF...</span>
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    <span>Imprimir / Descargar Comprobante (PDF)</span>
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-gray-500">
                Abre el comprobante idéntico al oficial en formato ligero listo para imprimir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cotizador;

