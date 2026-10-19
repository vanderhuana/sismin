import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  internacionService,
  calculoService,
  anticipoService,
  handleApiError
} from '../services/api';
import { calcularPagoPreview, formatBs, formatKg } from '../utils/calculations';
import Modal from '../components/ui/Modal';
import {
  Calculator,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  FileDown,
  Banknote,
  ChevronDown,
  ChevronUp,
  Coins,
  AlertTriangle,
  Receipt
} from 'lucide-react';

const mineralLabel = { PLATA: 'Plata', PLOMO: 'Plomo', COMPLEJO: 'Complejo' };

const CalculatePay = () => {
  const location = useLocation();
  const preselectHandled = useRef(false);
  const [pendientes, setPendientes] = useState([]);
  const [calculos, setCalculos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingPendientes, setLoadingPendientes] = useState(true);
  const [loadingCalculos, setLoadingCalculos] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRegaliasDetalle, setShowRegaliasDetalle] = useState(false);

  // Historial de anticipos en báscula del lote
  const [anticiposHistorial, setAnticiposHistorial] = useState([]);
  const [loadingAnticiposHistorial, setLoadingAnticiposHistorial] = useState(false);
  const [showAnticiposDesglose, setShowAnticiposDesglose] = useState(false);

  // Anticipos de cuenta general del proveedor (independientes)
  const [anticiposCuentaProveedor, setAnticiposCuentaProveedor] = useState([]);
  const [loadingAnticiposCuenta, setLoadingAnticiposCuenta] = useState(false);
  const [descuentosPactados, setDescuentosPactados] = useState({});
  const [modalAnticiposProveedorOpen, setModalAnticiposProveedorOpen] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: 0,
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

  // Total descontado de cuenta del proveedor según lo tranzado
  const totalDescuentoProveedor = useMemo(() => {
    return Object.values(descuentosPactados).reduce(
      (sum, val) => sum + (Math.trunc(Number(val) || 0)),
      0
    );
  }, [descuentosPactados]);

  // Total deuda activa en cuenta del proveedor
  const totalDeudaProveedor = useMemo(() => {
    return anticiposCuentaProveedor.reduce(
      (sum, a) => sum + (Math.trunc(Number(a.saldoPendiente) || 0)),
      0
    );
  }, [anticiposCuentaProveedor]);

  // Total de anticipo a descontar (Báscula + Proveedor)
  const montoAnticipoBascula = useMemo(() => {
    if (formValues.anticipos !== undefined && formValues.anticipos !== '') {
      return Math.trunc(Number(formValues.anticipos) || 0);
    }
    return Math.trunc(Number(selected?.anticipo) || 0);
  }, [formValues.anticipos, selected]);

  const totalAnticiposAplicados = montoAnticipoBascula + totalDescuentoProveedor;

  const preview = useMemo(() => {
    if (!selected) return null;
    try {
      return calcularPagoPreview({
        kilosBruto: selected.kilosBruto,
        humedadPorcentaje: formValues.humedadPorcentaje,
        tipoMineral: selected.tipoMineral,
        ley: formValues.ley,
        valorEscala: formValues.valorEscala,
        leyPlata: formValues.leyPlata,
        valorEscalaPlata: formValues.valorEscalaPlata,
        leyPlomo: formValues.leyPlomo,
        valorEscalaPlomo: formValues.valorEscalaPlomo,
        regaliasPorcentaje: formValues.regaliasPorcentaje,
        anticipos: totalAnticiposAplicados,
        transporte: formValues.transporte
      });
    } catch {
      return null;
    }
  }, [selected, formValues, totalAnticiposAplicados]);

  const loadData = async () => {
    try {
      setLoadingPendientes(true);
      setLoadingCalculos(true);
      const [pend, calc] = await Promise.all([
        internacionService.getPendingInternaciones(),
        calculoService.getCalculos({ estadoPago: 'PENDIENTE', limit: 20 })
      ]);
      setPendientes(pend);
      setCalculos(calc.calculos);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoadingPendientes(false);
      setLoadingCalculos(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectInternacion = async (item) => {
    setSelected(item);
    const totalAnticipo = Math.trunc(Number(item.anticipo) || 0);
    reset({
      humedadPorcentaje: 3,
      regaliasPorcentaje: 10,
      transporte: 0,
      anticipos: totalAnticipo,
      ley: '',
      valorEscala: '',
      leyPlata: '',
      valorEscalaPlata: '',
      leyPlomo: '',
      valorEscalaPlomo: ''
    });
    setShowRegaliasDetalle(false);
    setShowAnticiposDesglose(false);
    setError(null);

    // 1. Cargar historial de anticipos en báscula del lote
    try {
      setLoadingAnticiposHistorial(true);
      const res = await anticipoService.getAnticiposByInternacion(item.id);
      setAnticiposHistorial(res.anticipos || []);
    } catch {
      setAnticiposHistorial([]);
    } finally {
      setLoadingAnticiposHistorial(false);
    }

    // 2. Consultar si el proveedor tiene anticipos pendientes en cuenta
    try {
      setLoadingAnticiposCuenta(true);
      const resProv = await anticipoService.getPendientesByProveedor(item.proveedorId);
      const lista = resProv.anticipos || [];
      setAnticiposCuentaProveedor(lista);

      const pactadosInicial = {};
      lista.forEach((a) => {
        pactadosInicial[a.id] = Math.trunc(Number(a.saldoPendiente) || 0);
      });
      setDescuentosPactados(pactadosInicial);

      // Si el proveedor tiene anticipos en cuenta, abrir la ventana de aviso
      if (lista.length > 0) {
        setModalAnticiposProveedorOpen(true);
      }
    } catch {
      setAnticiposCuentaProveedor([]);
      setDescuentosPactados({});
    } finally {
      setLoadingAnticiposCuenta(false);
    }
  };

  // Preseleccionar internación si viene desde el módulo Internar Mineral
  useEffect(() => {
    const internacionId = location.state?.internacionId;
    if (!internacionId || preselectHandled.current || pendientes.length === 0) return;

    const item = pendientes.find((p) => p.id === internacionId);
    if (item) {
      selectInternacion(item);
      preselectHandled.current = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pendientes, location.state, reset]);

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Cambiar el descuento pactado de un anticipo en cuenta
  const handleCambiarDescuentoPactado = (anticipoId, monto) => {
    const item = anticiposCuentaProveedor.find((a) => a.id === anticipoId);
    const saldoMax = Math.trunc(Number(item?.saldoPendiente) || 0);
    const num = Math.min(Math.max(0, Math.trunc(Number(monto) || 0)), saldoMax);

    setDescuentosPactados((prev) => ({
      ...prev,
      [anticipoId]: num
    }));
  };

  const onSubmit = async (data) => {
    if (!selected) return;

    try {
      setSubmitting(true);
      setError(null);

      const anticiposDescontar = Object.entries(descuentosPactados)
        .map(([id, monto]) => ({
          anticipoId: parseInt(id, 10),
          montoADescontar: Math.trunc(Number(monto) || 0)
        }))
        .filter((x) => x.montoADescontar > 0);

      const payload = {
        internacionId: selected.id,
        tipoMineral: selected.tipoMineral,
        humedadPorcentaje: Math.trunc(parseFloat(data.humedadPorcentaje)),
        regaliasPorcentaje: Math.trunc(parseFloat(data.regaliasPorcentaje)),
        transporte: Math.trunc(parseFloat(data.transporte || 0)),
        anticipoBascula: montoAnticipoBascula,
        anticipoProveedor: totalDescuentoProveedor,
        anticipos: totalAnticiposAplicados,
        anticiposDescontar
      };

      if (selected.tipoMineral === 'COMPLEJO') {
        payload.leyPlata = Math.trunc(parseFloat(data.leyPlata));
        payload.valorEscalaPlata = Math.trunc(parseFloat(data.valorEscalaPlata));
        payload.leyPlomo = Math.trunc(parseFloat(data.leyPlomo));
        payload.valorEscalaPlomo = Math.trunc(parseFloat(data.valorEscalaPlomo));
      } else {
        payload.ley = Math.trunc(parseFloat(data.ley));
        payload.valorEscala = Math.trunc(parseFloat(data.valorEscala));
      }

      const result = await calculoService.createCalculo(payload);
      showSuccess(`Cálculo guardado — Saldo: ${formatBs(result.calculo.saldoFinal)}`);
      setSelected(null);
      reset();
      setAnticiposCuentaProveedor([]);
      setDescuentosPactados({});
      loadData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = async (calculo) => {
    if (!window.confirm(`¿Marcar como pagado ${calculo.internacion.lote}?`)) return;
    try {
      await calculoService.markAsPaid(calculo.id);
      showSuccess('Pago registrado');
      loadData();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleDownloadReceipt = async (calculo) => {
    try {
      const response = await calculoService.generateReceipt(calculo.id);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `comprobante-${calculo.internacion.lote}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const isComplejo = selected?.tipoMineral === 'COMPLEJO';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Calcular Pago</h1>
        <p className="mt-1 text-gray-600">
          Ingresa la ley del laboratorio y calcula el pago al proveedor
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lotes pendientes */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <h2 className="card-title text-lg">Pendientes de ley</h2>
            </div>
            <p className="text-sm text-gray-500">Selecciona para calcular</p>
          </div>

          {loadingPendientes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : pendientes.length === 0 ? (
            <p className="card-content py-8 text-center text-sm text-gray-500">
              No hay internaciones pendientes de ley
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {pendientes.map((item) => (
                <li
                  key={item.id}
                  onClick={() => selectInternacion(item)}
                  className={`cursor-pointer p-4 transition-colors ${
                    selected?.id === item.id
                      ? 'bg-primary-50 border-l-4 border-primary-600'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-gray-900">{item.lote}</span>
                    <span className="badge badge-warning text-xs">{mineralLabel[item.tipoMineral]}</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate mt-1">
                    {item.proveedor?.nombreCompleto}
                  </p>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>{formatKg(item.kilosBruto)}</span>
                    {Number(item.anticipo) > 0 && (
                      <span className="text-amber-800 font-semibold">
                        Anticipo: {formatBs(item.anticipo)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Formulario de cálculo */}
        <div className="card lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Calculator className="h-16 w-16 mb-4 text-gray-300" />
              <p className="text-base font-medium text-gray-600">Selecciona un lote para calcular el pago</p>
              <p className="text-sm text-gray-400">Los datos se cargarán automáticamente</p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="card-title text-lg">
                      Calcular lote: <span className="font-mono text-primary-600">{selected.lote}</span>
                    </h2>
                    <p className="text-sm text-gray-500">
                      Proveedor: <strong className="text-gray-800">{selected.proveedor?.nombreCompleto}</strong> (CI: {selected.proveedor?.ci})
                    </p>
                  </div>
                  <span className="badge badge-info">{mineralLabel[selected.tipoMineral]} - {formatKg(selected.kilosBruto)}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="card-content space-y-4">
                {selected.tipoMineral !== 'COMPLEJO' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Ley ({selected.tipoMineral === 'PLATA' ? 'DM' : '%'}) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        {...register('ley', { required: 'Requerido', min: 1 })}
                        className={`input ${errors.ley ? 'input-error' : ''}`}
                        placeholder="Ej: 95"
                      />
                      {errors.ley && (
                        <p className="mt-1 text-sm text-red-600">{errors.ley.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Valor escala *
                      </label>
                      <input
                        type="number"
                        step="1"
                        {...register('valorEscala', { required: 'Requerido', min: 1 })}
                        className={`input ${errors.valorEscala ? 'input-error' : ''}`}
                        placeholder="Ej: 140"
                      />
                      {errors.valorEscala && (
                        <p className="mt-1 text-sm text-red-600">{errors.valorEscala.message}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-gray-700">Plata</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Ley plata (DM) *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('leyPlata', { required: 'Requerido', min: 1 })}
                          className={`input ${errors.leyPlata ? 'input-error' : ''}`}
                          placeholder="Ej: 95"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Valor escala plata *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('valorEscalaPlata', { required: 'Requerido', min: 1 })}
                          className={`input ${errors.valorEscalaPlata ? 'input-error' : ''}`}
                          placeholder="Ej: 140"
                        />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Plomo</p>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Ley plomo (DM) *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('leyPlomo', { required: 'Requerido', min: 1 })}
                          className={`input ${errors.leyPlomo ? 'input-error' : ''}`}
                          placeholder="Ej: 20"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-gray-600">Valor escala plomo *</label>
                        <input
                          type="number"
                          step="1"
                          {...register('valorEscalaPlomo', { required: 'Requerido', min: 1 })}
                          className={`input ${errors.valorEscalaPlomo ? 'input-error' : ''}`}
                          placeholder="Ej: 2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Humedad % *</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      {...register('humedadPorcentaje', { required: true, min: 0, max: 100 })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Regalías %</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register('regaliasPorcentaje')}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Transporte (Bs)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      {...register('transporte')}
                      className="input"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Control de Anticipos a Descontar ('La Tranza') */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Coins className="h-4 w-4 text-emerald-600" />
                        <span>Anticipos a Descontar en Liquidación</span>
                      </h4>
                      <p className="text-xs text-gray-600">
                        Anticipo en báscula registrado al pesar:{' '}
                        <span className="font-bold text-emerald-800">{formatBs(selected.anticipo)}</span>
                      </p>
                    </div>

                    {/* Botones de acción rápida */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setValue('anticipos', Math.trunc(Number(selected.anticipo) || 0), { shouldDirty: true })}
                        className="btn btn-secondary btn-sm text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                        title="Descontar el total de anticipos entregados"
                      >
                        Descontar Todo ({formatBs(selected.anticipo)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setValue('anticipos', 0, { shouldDirty: true })}
                        className="btn btn-secondary btn-sm text-xs text-gray-700 hover:bg-gray-100"
                        title="No descontar anticipo en este cálculo"
                      >
                        No Descontar (Bs 0)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Monto de báscula a descontar hoy (Bs) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        {...register('anticipos', { min: 0 })}
                        className="input bg-white text-base font-semibold text-emerald-900 border-emerald-300 focus:border-emerald-500"
                        placeholder="0"
                      />
                    </div>
                    <div className="text-xs">
                      {Number(formValues.anticipos || 0) < Number(selected.anticipo) ? (
                        <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
                          ⚠️ <strong>Saldo pendiente de cobro:</strong> Quedarán{' '}
                          <span className="font-bold text-amber-900">
                            {formatBs(Number(selected.anticipo) - Number(formValues.anticipos || 0))}
                          </span>{' '}
                          de anticipo de báscula sin descontar.
                        </div>
                      ) : Number(formValues.anticipos || 0) === Number(selected.anticipo) ? (
                        <div className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded p-2.5">
                          ✅ Se descontará el 100% del anticipo de báscula.
                        </div>
                      ) : (
                        <div className="text-blue-700 font-medium bg-blue-50 border border-blue-200 rounded p-2.5">
                          ℹ️ Se descontará un monto superior al anticipo inicial registrado.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AVISO / BOTÓN DE ANTICIPOS EN CUENTA DEL PROVEEDOR */}
                  {anticiposCuentaProveedor.length > 0 && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span>Este proveedor tiene anticipos pendientes en cuenta general</span>
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Deuda total: <strong>{formatBs(totalDeudaProveedor)}</strong> • Acordado a descontar hoy:{' '}
                          <strong className="text-emerald-800">{formatBs(totalDescuentoProveedor)}</strong>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setModalAnticiposProveedorOpen(true)}
                        className="btn btn-primary btn-sm bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 shadow-sm inline-flex items-center gap-1.5"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Ver / Tranzar Descuentos ({anticiposCuentaProveedor.length})</span>
                      </button>
                    </div>
                  )}

                  {/* Pestaña para ver el historial de fechas de cada entrega en báscula */}
                  {anticiposHistorial.length > 0 && (
                    <div className="border-t border-emerald-200/80 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAnticiposDesglose(!showAnticiposDesglose)}
                        className="text-xs text-emerald-800 hover:text-emerald-900 font-medium flex items-center gap-1"
                      >
                        <span>📋 Ver historial de fechas en báscula ({anticiposHistorial.length} entrega{anticiposHistorial.length !== 1 ? 's' : ''})</span>
                        {showAnticiposDesglose ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {showAnticiposDesglose && (
                        <div className="mt-2 overflow-x-auto rounded border border-gray-200 bg-white">
                          <table className="table text-xs">
                            <thead className="table-header">
                              <tr className="table-header-row bg-gray-50">
                                <th className="table-header-cell">Fecha</th>
                                <th className="table-header-cell">Motivo</th>
                                <th className="table-header-cell">Entregado por</th>
                                <th className="table-header-cell text-right">Monto</th>
                              </tr>
                            </thead>
                            <tbody className="table-body">
                              {anticiposHistorial.map((a) => (
                                <tr key={a.id} className="table-row">
                                  <td className="table-cell font-mono text-gray-600">
                                    {new Date(a.fecha).toLocaleDateString('es-BO')}
                                  </td>
                                  <td className="table-cell">{a.glosa || a.observacion || 'Adelanto en efectivo'}</td>
                                  <td className="table-cell text-gray-500">{a.usuario?.nombre || 'Balanza'}</td>
                                  <td className="table-cell text-right font-mono font-bold text-emerald-700">
                                    {formatBs(a.monto)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* VISTA PREVIA DEL CÁLCULO — CON BLOQUE COLAPSABLE EXACTO DE REGALÍAS */}
                {preview && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">Vista previa del cálculo</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Kilos neto</dt>
                        <dd className="font-medium">{formatKg(preview.kilosNeto)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Valor escala {isComplejo ? 'total' : ''}</dt>
                        <dd className="font-medium">{preview.valorEscalaTotal}</dd>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-2">
                        <dt className="text-gray-600">Valor bruto</dt>
                        <dd className="font-semibold">{formatBs(preview.valorBruto)}</dd>
                      </div>

                      {/* Pestaña colapsable de Regalías */}
                      <div className="rounded-md border border-gray-200 bg-white overflow-hidden my-1">
                        <button
                          type="button"
                          onClick={() => setShowRegaliasDetalle((prev) => !prev)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-gray-800">🏷️ Detalle de Regalías ({formValues.regaliasPorcentaje || 0}%)</span>
                            <span className="text-[11px] text-gray-500">
                              {showRegaliasDetalle ? '· Clic para ocultar' : '· Clic para ver resultado'}
                            </span>
                          </span>
                          {showRegaliasDetalle ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        {showRegaliasDetalle && (
                          <div className="flex justify-between border-t border-gray-100 px-3 py-2 text-xs bg-red-50/50 text-red-700">
                            <dt className="font-medium">(-) Regalías calculadas ({formValues.regaliasPorcentaje}%)</dt>
                            <dd className="font-semibold">- {formatBs(preview.regaliasMonto)}</dd>
                          </div>
                        )}
                      </div>

                      {/* Descuento por Anticipo de Báscula */}
                      <div className={`flex justify-between ${montoAnticipoBascula > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                        <dt>(-) Anticipo Báscula descontado</dt>
                        <dd className="font-medium">
                          {montoAnticipoBascula > 0 ? `- ${formatBs(montoAnticipoBascula)}` : formatBs(0)}
                        </dd>
                      </div>

                      {/* Descuento por Anticipos en Cuenta si existen */}
                      {totalDescuentoProveedor > 0 && (
                        <div className="flex justify-between text-red-700">
                          <dt>(-) Anticipos Cuenta Proveedor descontados</dt>
                          <dd className="font-medium">- {formatBs(totalDescuentoProveedor)}</dd>
                        </div>
                      )}

                      {Number(formValues.transporte) > 0 && (
                        <div className="flex justify-between text-green-700">
                          <dt>(+) Transporte</dt>
                          <dd>+ {formatBs(formValues.transporte)}</dd>
                        </div>
                      )}

                      <div className="flex justify-between border-t-2 border-gray-300 pt-2 text-base">
                        <dt className="font-bold text-gray-900">Saldo final</dt>
                        <dd className="font-bold text-primary-700">{formatBs(preview.saldoFinal)}</dd>
                      </div>
                    </dl>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setAnticiposCuentaProveedor([]);
                      setDescuentosPactados({});
                    }}
                    className="btn btn-secondary btn-md"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting} className="btn btn-primary btn-md">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Calculator className="mr-2 h-4 w-4" />
                        Guardar cálculo
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>

      {/* VENTANA EMERGENTE DE TRANZA DE ANTICIPOS DE CUENTA */}
      {modalAnticiposProveedorOpen && selected && (
        <Modal
          open={modalAnticiposProveedorOpen}
          onClose={() => setModalAnticiposProveedorOpen(false)}
          title={`Anticipos en Cuenta — ${selected.proveedor?.nombreCompleto}`}
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Anticipos Pendientes de Oficina / Caja</span>
              </p>
              <p>
                Este proveedor tiene <strong>{anticiposCuentaProveedor.length} anticipo(s)</strong> en cuenta con un saldo pendiente de{' '}
                <strong className="text-amber-950 font-mono text-sm">{formatBs(totalDeudaProveedor)}</strong>.
                Indica cuánto deseas descontar en esta liquidación. El saldo no descontado se mantendrá guardado para sus siguientes lotes.
              </p>
            </div>

            <div className="space-y-2.5 max-h-[350px] overflow-y-auto">
              {anticiposCuentaProveedor.map((ant) => {
                const saldo = Math.trunc(Number(ant.saldoPendiente) || 0);
                const pactado = descuentosPactados[ant.id] !== undefined ? descuentosPactados[ant.id] : saldo;
                const quedara = Math.max(0, saldo - pactado);

                return (
                  <div key={ant.id} className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-gray-900 mr-2">{ant.codigoVale}</span>
                        <span className="text-gray-500 font-mono">
                          {new Date(ant.fecha).toLocaleDateString('es-BO')}
                        </span>
                      </div>
                      <span className="badge bg-amber-100 text-amber-900 font-mono font-bold text-xs">
                        Saldo: {formatBs(saldo)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                      {ant.glosa}
                    </p>

                    <div className="grid grid-cols-2 gap-3 items-center pt-1 border-t border-gray-100 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-700 mb-1">
                          Descontar en este lote (Bs):
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={saldo}
                          value={pactado}
                          onChange={(e) => handleCambiarDescuentoPactado(ant.id, e.target.value)}
                          className="input input-sm text-xs font-mono font-bold w-full bg-white border-amber-300"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 pt-4">
                        <button
                          type="button"
                          onClick={() => handleCambiarDescuentoPactado(ant.id, saldo)}
                          className="btn btn-secondary btn-sm text-[11px] px-2 py-1"
                        >
                          Todo ({formatBs(saldo)})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCambiarDescuentoPactado(ant.id, 0)}
                          className="btn btn-secondary btn-sm text-[11px] px-2 py-1"
                        >
                          Bs 0
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded text-slate-700 font-mono">
                      <span>Saldo que quedará para el futuro:</span>
                      <strong className={quedara > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                        {formatBs(quedara)} {quedara === 0 && '✅ (Cobrado al 100%)'}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen Total */}
            <div className="rounded-lg bg-gray-900 text-white p-3 flex items-center justify-between text-xs font-mono">
              <div>
                <span className="text-gray-400 block text-[10px]">TOTAL A DESCONTAR HOY:</span>
                <span className="text-emerald-400 font-bold text-sm">{formatBs(totalDescuentoProveedor)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400 block text-[10px]">SALDO PENDIENTE RESTANTE:</span>
                <span className="text-amber-400 font-bold text-sm">
                  {formatBs(Math.max(0, totalDeudaProveedor - totalDescuentoProveedor))}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setModalAnticiposProveedorOpen(false)}
                className="btn btn-primary btn-sm text-xs px-4"
              >
                Aceptar y Aplicar al Cálculo
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cálculos pendientes de pago */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-green-600" />
            <h2 className="card-title text-lg">Cálculos pendientes de pago</h2>
          </div>
        </div>
        {loadingCalculos ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          </div>
        ) : calculos.length === 0 ? (
          <p className="card-content py-8 text-center text-sm text-gray-500">
            No hay cálculos pendientes de pago
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr className="table-header-row">
                  <th className="table-header-cell">Lote</th>
                  <th className="table-header-cell">Proveedor</th>
                  <th className="table-header-cell">Mineral</th>
                  <th className="table-header-cell">Valor bruto</th>
                  <th className="table-header-cell">Saldo final</th>
                  <th className="table-header-cell">Acciones</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {calculos.map((calculo) => (
                  <tr key={calculo.id} className="table-row">
                    <td className="table-cell font-medium">{calculo.internacion.lote}</td>
                    <td className="table-cell">{calculo.internacion.proveedor.nombreCompleto}</td>
                    <td className="table-cell">{mineralLabel[calculo.tipoMineral]}</td>
                    <td className="table-cell">{formatBs(calculo.valorBruto)}</td>
                    <td className="table-cell font-semibold text-primary-600">
                      {formatBs(calculo.saldoFinal)}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkPaid(calculo)}
                          className="btn btn-primary btn-sm"
                        >
                          Marcar pagado
                        </button>
                        <button
                          onClick={() => handleDownloadReceipt(calculo)}
                          className="btn btn-secondary btn-sm"
                          title="Descargar comprobante"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatePay;
