/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/ui/LoginScreen';
import { ModalPedidoIA } from './components/caja/ModalPedidoIA';
import { KitchenMonitor } from './components/cocina/KitchenMonitor';
import { LogoSaborYork } from './components/ui/LogoSaborYork';
import { ModalAdminUsuarios } from './firebase/ModalAdminUsuarios';
import { AdminProductosCategorias } from './components/admin/AdminProductosCategorias';
import { ModuloPedidos } from './components/admin/ModuloPedidos';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase/config';
import { Pedido, Insumo, VentaDiaria, EgresoCaja } from './types';
import { 
  ChefHat, 
  LogOut, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ClipboardList, 
  Wallet, 
  Package, 
  Layers, 
  UserCheck, 
  Receipt, 
  Flame, 
  MapPin, 
  Settings, 
  ShieldAlert,
  ArrowRightLeft,
  CircleAlert,
  Loader2,
  Lock,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
  Filter,
  Calendar,
  Coins,
  User,
  Check,
  Info,
  PlusCircle,
  MinusCircle,
  BarChart2,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Percent,
  Award
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

function POSDashboard() {
  const { user, userProfile, logout } = useAuth();
  
  // Modificaciones de vistas para Admin (Simulación de roles para Pruebas del local)
  const [activeRoleView, setActiveRoleView] = useState<string>('');
  
  // Tab activa dentro de la vista de Administrador ('comandas' | 'carta' | 'pedidos')
  const [adminSectionTab, setAdminSectionTab] = useState<'comandas' | 'carta' | 'pedidos'>('comandas');
  
  // Estados para datos locales vinculados a Firestore
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [inventario, setInventario] = useState<Insumo[]>([]);
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [appCategorias, setAppCategorias] = useState<any[]>([]);
  const [appProductos, setAppProductos] = useState<any[]>([]);
  const [isModalIAOpen, setIsModalIAOpen] = useState(false);
  const [isModalUsersOpen, setIsModalUsersOpen] = useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [detailPedidoLectura, setDetailPedidoLectura] = useState<Pedido | null>(null);
  const [orderDescripcion, setOrderDescripcion] = useState<string>('');
  const [accordionEnColaOpen, setAccordionEnColaOpen] = useState(true);
  const [accordionCompletadosOpen, setAccordionCompletadosOpen] = useState(false);

  // --- CALCULATE SALES TOTALS FOR KITCHEN TRACKER REFERENCE ---
  const isUserAdmin = userProfile?.rol === 'admin' || activeRoleView === 'admin';
  const relevantStatsOrders = pedidos.filter(p => {
    if (p.estado === 'cancelado') return false;
    if (!isUserAdmin) {
      return p.meseroUid === userProfile?.uid;
    }
    return true;
  });
  const totalGeneralVendido = relevantStatsOrders.reduce((acc, curr) => acc + curr.total, 0);
  const totalCobrado = relevantStatsOrders.filter(p => p.pagado).reduce((acc, curr) => acc + curr.total, 0);
  const totalPendienteCobro = relevantStatsOrders.filter(p => !p.pagado).reduce((acc, curr) => acc + curr.total, 0);

  // Filtros de rango de fechas para el historial de comprobantes
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('');
  const [filtroFechaFin, setFiltroFechaFin] = useState('');

  // Modales de control de caja
  const [isArqueoModalOpen, setIsArqueoModalOpen] = useState(false);
  const [isEgresoModalOpen, setIsEgresoModalOpen] = useState(false);
  const [egresoModalType, setEgresoModalType] = useState<'gasto' | 'entrega' | 'pago_empleado' | 'otros'>('gasto');

  // Campos adicionales para el modal de egresos
  const [egresoDestinatario, setEgresoDestinatario] = useState('');

  // Registro de denominaciones (Guardado en localStorage para persistencia)
  const [denominaciones, setDenominaciones] = useState<{ [key: string]: number }>(() => {
    try {
      const saved = localStorage.getItem('sabor_york_caja_denominaciones');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn("Error cargando denominaciones", e);
    }
    return {
      'B_100k': 0, 'B_50k': 0, 'B_20k': 0, 'B_10k': 0, 'B_5k': 0, 'B_2k': 0,
      'M_1k': 0, 'M_500': 0, 'M_200': 0, 'M_100': 0, 'M_50': 0, 'Bono': 0
    };
  });

  // Denominaciones a retirar en un envío / entrega de dinero
  const [deliveryDenominaciones, setDeliveryDenominaciones] = useState<{ [key: string]: number }>({
    'B_100k': 0, 'B_50k': 0, 'B_20k': 0, 'B_10k': 0, 'B_5k': 0, 'B_2k': 0,
    'M_1k': 0, 'M_500': 0, 'M_200': 0, 'M_100': 0, 'M_50': 0, 'Bono': 0
  });

  // Sincronizar denominaciones en localStorage
  useEffect(() => {
    localStorage.setItem('sabor_york_caja_denominaciones', JSON.stringify(denominaciones));
  }, [denominaciones]);

  // Conversión robusta de createdAt a string YYYY-MM-DD
  const getPedidoDateStr = (p: Pedido) => {
    if (!p.createdAt) return '';
    let dateObj: Date;
    if (p.createdAt.toDate && typeof p.createdAt.toDate === 'function') {
      dateObj = p.createdAt.toDate();
    } else if (p.createdAt.seconds) {
      dateObj = new Date(p.createdAt.seconds * 1000);
    } else {
      dateObj = new Date(p.createdAt);
    }
    const tzoffset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - tzoffset).toISOString().split('T')[0];
  };

  // Pedidos pagados filtrados por el rango de fechas
  const filteredPedidosPagados = pedidos.filter(p => {
    if (!p.pagado) return false;
    const pDateStr = getPedidoDateStr(p);
    const matchInicio = filtroFechaInicio ? pDateStr >= filtroFechaInicio : true;
    const matchFin = filtroFechaFin ? pDateStr <= filtroFechaFin : true;
    return matchInicio && matchFin;
  });

  // Sincronizar la descripción en el formulario del modal al cambiar de pedido seleccionado o recibir actualizaciones
  useEffect(() => {
    if (selectedPedidoId) {
      const activePed = pedidos.find(p => p.id === selectedPedidoId);
      if (activePed) {
        setOrderDescripcion(activePed.descripcion || '');
      }
    } else {
      setOrderDescripcion('');
    }
  }, [selectedPedidoId, pedidos]);

  // Analytics and Sales Graphs
  const [showSalesAnalyticsModal, setShowSalesAnalyticsModal] = useState(false);
  const [customCogsPercent, setCustomCogsPercent] = useState(40);
  const [activeTabMetric, setActiveTabMetric] = useState<'bruto' | 'neto' | 'beneficio'>('bruto');
  const [hoveredDatePoint, setHoveredDatePoint] = useState<any | null>(null);

  // Estados para creación manual de insumos
  const [nuevoInsumoNombre, setNuevoInsumoNombre] = useState('');
  const [nuevoInsumoStock, setNuevoInsumoStock] = useState(20);
  const [nuevoInsumoUnidad, setNuevoInsumoUnidad] = useState('unidades');
  const [nuevoInsumoStockMinimo, setNuevoInsumoStockMinimo] = useState(5);

  // Cierre de caja
  const [montoApertura, setMontoApertura] = useState(150000);
  const [egresoConcepto, setEgresoConcepto] = useState('');
  const [egresoMonto, setEgresoMonto] = useState(0);

  // Inicializar rol predeterminado o simulación
  useEffect(() => {
    if (userProfile) {
      setActiveRoleView(userProfile.rol);
    }
  }, [userProfile]);

  // Listener para Pedidos (Mundial - Admin y Cajero)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Pedido[] = [];
      snapshot.forEach((d) => {
        prods.push({ id: d.id, ...d.data() as Omit<Pedido, 'id'> });
      });
      setPedidos(prods);
    }, (err) => {
      console.error(err);
    });
    return () => unsubscribe();
  }, [user]);

  // Listener para Inventario
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'inventario'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Insumo[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() as Omit<Insumo, 'id'> });
      });
      setInventario(items);
    }, (err) => {
      console.error(err);
    });
    return () => unsubscribe();
  }, [user]);

  // Listener para Ventas Diarias
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'ventasDiarias'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: VentaDiaria[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() as Omit<VentaDiaria, 'id'> });
      });
      setVentas(items);
    }, (err) => {
      console.error(err);
    });
    return () => unsubscribe();
  }, [user]);

  // Listener para contar Categorías y Productos (para indicar visualmente si hay registros)
  useEffect(() => {
    if (!user) return;

    const getLocalCats = () => {
      try {
        const saved = localStorage.getItem('sabor_york_categorias');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    };

    const getLocalProds = () => {
      try {
        const saved = localStorage.getItem('sabor_york_productos');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    };

    // Suscripción de Categorías
    const qCat = query(collection(db, 'categorias'));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (list.length > 0) {
        setAppCategorias(list);
      } else {
        setAppCategorias(getLocalCats());
      }
    }, (err) => {
      console.warn("Snapshot de categoría en Dashboard ocupó local", err);
      setAppCategorias(getLocalCats());
    });

    // Suscripción de Productos
    const qProd = query(collection(db, 'productos'));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (list.length > 0) {
        setAppProductos(list);
      } else {
        setAppProductos(getLocalProds());
      }
    }, (err) => {
      console.warn("Snapshot de producto en Dashboard ocupó local", err);
      setAppProductos(getLocalProds());
    });

    return () => {
      unsubCat();
      unsubProd();
    };
  }, [user]);

  // Crear insumo en base de datos
  const handleCrearInsumo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoInsumoNombre) return;

    try {
      await addDoc(collection(db, 'inventario'), {
        nombre: nuevoInsumoNombre,
        stock: Number(nuevoInsumoStock),
        unidad: nuevoInsumoUnidad,
        stockMinimo: Number(nuevoInsumoStockMinimo),
        updatedAt: serverTimestamp()
      });
      setNuevoInsumoNombre('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inventario');
    }
  };

  // Actualizar stock de insumos
  const handleModifyStock = async (itemId: string, delta: number) => {
    const docRef = doc(db, 'inventario', itemId);
    const item = inventario.find(i => i.id === itemId);
    if (!item) return;

    try {
      await updateDoc(docRef, {
        stock: Math.max(0, item.stock + delta),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventario/${itemId}`);
    }
  };

  // Checkout Caja - Cobrar Pedido
  const handleCobrarPedido = async (pedidoId: string, metodo: 'efectivo' | 'transferencia' | 'nequi' | 'pse' | 'datafono') => {
    const docRef = doc(db, 'pedidos', pedidoId);
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;

    try {
      await updateDoc(docRef, {
        pagado: true,
        metodoPago: metodo,
        estado: 'entregado',
        updatedAt: serverTimestamp()
      });

      // 1. Registrar o incrementar saldo en la venta diaria de hoy (fecha de comanda o local actual)
      const hoyString = new Date().toISOString().split('T')[0];
      const ventaHoyRef = doc(db, 'ventasDiarias', hoyString);
      
      const existingVenta = ventas.find(v => v.fecha === hoyString);
      const prevEfectivo = existingVenta ? (existingVenta.ventasEfectivo || 0) : 0;
      const prevTransferencia = existingVenta ? (existingVenta.ventasTransferencia || 0) : 0;
      const prevNequi = existingVenta ? (existingVenta.ventasNequi || 0) : 0;
      const prevPse = existingVenta ? (existingVenta.ventasPse || 0) : 0;
      const prevDatafono = existingVenta ? (existingVenta.ventasDatafono || 0) : 0;
      const prevTotal = existingVenta ? (existingVenta.totalVentas || 0) : 0;

      await setDoc(ventaHoyRef, {
        fecha: hoyString,
        montoApertura: montoApertura,
        ventasEfectivo: metodo === 'efectivo' ? prevEfectivo + ped.total : prevEfectivo,
        ventasTransferencia: metodo === 'transferencia' ? prevTransferencia + ped.total : prevTransferencia,
        ventasNequi: metodo === 'nequi' ? prevNequi + ped.total : prevNequi,
        ventasPse: metodo === 'pse' ? prevPse + ped.total : prevPse,
        ventasDatafono: metodo === 'datafono' ? prevDatafono + ped.total : prevDatafono,
        totalVentas: prevTotal + ped.total,
        egresos: existingVenta ? (existingVenta.egresos || []) : [],
        estado: 'abierto',
        createdAt: existingVenta && existingVenta.createdAt ? existingVenta.createdAt : serverTimestamp()
      }, { merge: true });

      // 2. DESCONTAR INVENTARIO AUTOMÁTICAMENTE SEGÚN RECETA
      if (ped.productos && ped.productos.length > 0) {
        let localInventarioUpdated = [...inventario];
        let alertMessages: string[] = [];

        for (const itemInOrder of ped.productos) {
          // Buscar el producto en el catálogo (appProductos)
          const matchedProduct = appProductos.find(
            (p) => p.id === itemInOrder.id || p.nombre.toLowerCase() === itemInOrder.nombre.toLowerCase()
          );

          if (matchedProduct && matchedProduct.receta && matchedProduct.receta.length > 0) {
            for (const ing of matchedProduct.receta) {
              const deductionAmount = ing.cantidad * itemInOrder.cantidad;
              
              const insumoDocRef = doc(db, 'inventario', ing.insumoId);
              const activeInsumo = inventario.find(i => i.id === ing.insumoId);
              
              if (activeInsumo) {
                const newStock = Math.max(0, Number((activeInsumo.stock - deductionAmount).toFixed(3)));
                
                try {
                  await updateDoc(insumoDocRef, {
                    stock: newStock,
                    updatedAt: serverTimestamp()
                  });
                } catch (e) {
                  console.warn("No se pudo descontar en Firestore, se aplicará localmente", e);
                }

                // Actualizar lista local para control sandbox y sincronizar
                localInventarioUpdated = localInventarioUpdated.map(invItem => 
                  invItem.id === ing.insumoId ? { ...invItem, stock: newStock } : invItem
                );

                // Comprobar stock mínimo
                if (newStock <= activeInsumo.stockMinimo) {
                  alertMessages.push(`⚠️ ¡ALERTA DE STOCK MÍNIMO! El insumo "${activeInsumo.nombre}" ha quedado por debajo o igual al mínimo. Stock actual: ${newStock} ${activeInsumo.unidad}.`);
                }
              }
            }
          }
        }

        // Si hay alertas de stock mínimo, las unimos y notificamos
        if (alertMessages.length > 0) {
          alert(alertMessages.join('\n'));
        }

        // Sincronizar en localStorage para mantener sandbox mode al día
        localStorage.setItem('sabor_york_local_inventario', JSON.stringify(localInventarioUpdated));
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pedidos/${pedidoId}`);
    }
  };

  // Abrir caja de hoy manualmente
  const handleAbrirCajaHoy = async () => {
    const hoyString = new Date().toISOString().split('T')[0];
    const ventaHoyRef = doc(db, 'ventasDiarias', hoyString);
    try {
      await setDoc(ventaHoyRef, {
        fecha: hoyString,
        montoApertura: Number(montoApertura),
        ventasEfectivo: 0,
        ventasTransferencia: 0,
        ventasNequi: 0,
        ventasPse: 0,
        ventasDatafono: 0,
        totalVentas: 0,
        egresos: [],
        estado: 'abierto',
        createdAt: serverTimestamp()
      }, { merge: true });
      alert(`¡Caja de hoy abierta con éxito con un fondo base de $${Number(montoApertura).toLocaleString()} COP!`);
    } catch (err) {
      console.error(err);
      alert("No se pudo iniciar la caja de hoy en Firestore.");
    }
  };

  // Agregar egreso de caja categorizado y con retiro de denominaciones
  const handleAddEgresoCustom = async (
    tipo: 'gasto' | 'entrega' | 'pago_empleado' | 'otros',
    conceptoStr: string,
    montoNum: number,
    destinatarioStr?: string,
    deductDenominations?: boolean
  ) => {
    if (montoNum <= 0 || !conceptoStr) {
      alert("Por favor ingresa un concepto y un monto válido.");
      return;
    }

    const hoyString = new Date().toISOString().split('T')[0];
    const docRef = doc(db, 'ventasDiarias', hoyString);
    const v = ventas.find(vent => vent.id === hoyString);
    
    if (!v) {
      alert("No hay una caja abierta para hoy. Primero abre la caja.");
      return;
    }

    let prefijo = '[GASTO]';
    if (tipo === 'entrega') prefijo = '[ENTREGA EFECTIVO]';
    if (tipo === 'pago_empleado') prefijo = '[PAGO EMPLEADO]';
    if (tipo === 'otros') prefijo = '[OTROS EGRESOS]';

    const fullConcepto = `${prefijo} ${conceptoStr}${destinatarioStr ? ` - Recibe: ${destinatarioStr}` : ''}`;

    const nuevoEgreso: EgresoCaja = {
      id: `egreso_${Date.now()}`,
      concepto: fullConcepto,
      monto: Number(montoNum),
      hora: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      autorizadoPor: userProfile?.nombre || 'Administrador'
    };

    try {
      await updateDoc(docRef, {
        egresos: [...(v.egresos || []), nuevoEgreso]
      });

      // Si es una entrega de dinero y se autorizó descontar denominaciones
      if (tipo === 'entrega' && deductDenominations) {
        setDenominaciones(prev => {
          const next = { ...prev };
          Object.keys(deliveryDenominaciones).forEach(k => {
            next[k] = Math.max(0, (next[k] || 0) - (deliveryDenominaciones[k] || 0));
          });
          return next;
        });
        // Reiniciar conteo de retiro
        setDeliveryDenominaciones({
          'B_100k': 0, 'B_50k': 0, 'B_20k': 0, 'B_10k': 0, 'B_5k': 0, 'B_2k': 0,
          'M_1k': 0, 'M_500': 0, 'M_200': 0, 'M_100': 0, 'M_50': 0, 'Bono': 0
        });
      }

      setIsEgresoModalOpen(false);
      setEgresoConcepto('');
      setEgresoMonto(0);
      setEgresoDestinatario('');
      alert("Egreso y movimiento de caja registrado correctamente.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ventasDiarias/${hoyString}`);
    }
  };

  // Agregar egreso de caja (Compatibilidad simplificada)
  const handleAddEgreso = async (ventaId: string) => {
    if (!egresoConcepto || egresoMonto <= 0) return;
    const docRef = doc(db, 'ventasDiarias', ventaId);
    const v = ventas.find(vent => vent.id === ventaId);
    if (!v) return;

    const nuevoEgreso: EgresoCaja = {
      id: `egreso_${Date.now()}`,
      concepto: `[GASTO] ${egresoConcepto}`,
      monto: Number(egresoMonto),
      hora: new Date().toLocaleTimeString(),
      autorizadoPor: userProfile?.nombre || 'Administrador'
    };

    try {
      await updateDoc(docRef, {
        egresos: [...(v.egresos || []), nuevoEgreso]
      });
      setEgresoConcepto('');
      setEgresoMonto(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `ventasDiarias/${ventaId}`);
    }
  };

  // Eliminar Pedido (Acceso exclusivo a Admin)
  const handleEliminarPedido = async (pedidoId: string) => {
    if (userProfile?.rol !== 'admin') {
      alert("Acceso denegado: Solo el Administrador puede realizar modificaciones o eliminar registros históricos.");
      return;
    }
    const ped = pedidos.find(p => p.id === pedidoId);
    if (ped && ped.pagado && ped.estado === 'entregado') {
      alert("Imposible de borrar: Esta comanda ya fue PANTALLA ENTREGADA y PAGADA con éxito. No se permiten eliminar o anular pedidos finalizados.");
      return;
    }
    if (!confirm("¿Realmente deseas anular esta comanda por completo? Esta acción es irreversible.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'pedidos', pedidoId));
      if (selectedPedidoId === pedidoId) {
        setSelectedPedidoId(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `pedidos/${pedidoId}`);
    }
  };

  // Guardar la descripción de un pedido en la base de datos (Sólo admin si no está locked)
  const handleSavePedidoDescripcion = async (pedidoId: string, nuevaDescripcion: string) => {
    if (userProfile?.rol !== 'admin') {
      alert("Acceso denegado: Solo el Administrador puede agregar o modificar la descripción.");
      return;
    }
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;
    if (ped.pagado && ped.estado === 'entregado') {
      alert("No se puede modificar una comanda que ya fue entregada y pagada.");
      return;
    }
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        descripcion: nuevaDescripcion,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pedidos/${pedidoId}`);
    }
  };

  // Actualizar el estado de preparación de un pedido (Sólo admin si no está locked)
  const handleUpdatePedidoEstado = async (pedidoId: string, nuevoEstado: 'pendiente' | 'en_proceso' | 'terminado' | 'entregado' | 'cancelado') => {
    if (userProfile?.rol !== 'admin') {
      alert("Acceso denegado: Solo el Administrador puede realizar modificaciones o cambiar el estado de preparación.");
      return;
    }
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;
    if (ped.pagado && ped.estado === 'entregado') {
      alert("No se puede modificar una comanda que ya fue entregada y pagada.");
      return;
    }
    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        estado: nuevoEstado,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pedidos/${pedidoId}`);
    }
  };

  // Eliminar un item específico de un pedido (Sólo admin si no está locked)
  const handleEliminarItemDelPedido = async (pedidoId: string, itemIdx: number) => {
    if (userProfile?.rol !== 'admin') {
      alert("Acceso denegado: Solo el Administrador puede realizar cambios en los ítems de las comandas.");
      return;
    }
    const ped = pedidos.find(p => p.id === pedidoId);
    if (!ped) return;
    if (ped.pagado && ped.estado === 'entregado') {
      alert("Imposible modificar: Esta comanda ya fue cobrada y entregada.");
      return;
    }

    const nuevosProductos = ped.productos.filter((_, idx) => idx !== itemIdx);

    if (nuevosProductos.length === 0) {
      if (confirm("Al eliminar todos los productos seleccionados de la lista, la comanda quedará vacía y se procederá a su anulación automática. ¿Deseas anular la comanda?")) {
        try {
          await deleteDoc(doc(db, 'pedidos', pedidoId));
          setSelectedPedidoId(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `pedidos/${pedidoId}`);
        }
      }
      return;
    }

    const nuevoTotal = nuevosProductos.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);

    try {
      await updateDoc(doc(db, 'pedidos', pedidoId), {
        productos: nuevosProductos,
        total: nuevoTotal,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pedidos/${pedidoId}`);
    }
  };

  // Inyectar datos de prueba en Inventario para simular stock inicial
  const handleSeedMockData = async () => {
    try {
      const itemsMock = [
        { nombre: "Pan Brioche de Hamburguesa", stock: 65, unidad: "unidades", stockMinimo: 10 },
        { nombre: "Carne Premium 150g", stock: 48, unidad: "unidades", stockMinimo: 15 },
        { nombre: "Papa Amarilla en Bastón", stock: 15, unidad: "kg", stockMinimo: 5 },
        { nombre: "Salchicha Americana", stock: 80, unidad: "unidades", stockMinimo: 20 },
        { nombre: "Queso Cheddar lonjas", stock: 120, unidad: "unidades", stockMinimo: 30 },
        { nombre: "Pepsi Cola Gaseosa 350ml", stock: 90, unidad: "unidades", stockMinimo: 12 }
      ];

      for (const item of itemsMock) {
        await addDoc(collection(db, 'inventario'), {
          ...item,
          updatedAt: serverTimestamp()
        });
      }
      alert("Insumos iniciales sembrados con éxito.");
    } catch (err) {
      console.error(err);
    }
  };

  // --- CALCULATIONS FOR THE SALES ANALYTICS MODAL ---
  const {
    totalGrossSales,
    salesByDateList,
    topProductsList,
    totalDiscounts,
    totalRefunds,
    paymentMethodsSummary
  } = React.useMemo(() => {
    let gross = 0;
    const dateMap: { [date: string]: any } = {};
    const prodMap: { [name: string]: { name: string, qty: number, revenue: number } } = {};
    let discounts = 0;
    let refunds = 0;
    const methods = {
      efectivo: 0,
      nequi: 0,
      pse: 0,
      datafono: 0,
      transferencia: 0
    };

    filteredPedidosPagados.forEach(p => {
      gross += p.total;
      
      // Payment method breakdown
      const m = (p.metodoPago || 'efectivo').toLowerCase();
      if (m === 'efectivo') methods.efectivo += p.total;
      else if (m === 'nequi') methods.nequi += p.total;
      else if (m === 'pse') methods.pse += p.total;
      else if (m === 'datafono') methods.datafono += p.total;
      else if (m === 'transferencia') methods.transferencia += p.total;
      else methods.efectivo += p.total; // fallback

      // Products breakdown
      p.productos?.forEach(item => {
        if (!prodMap[item.nombre]) {
          prodMap[item.nombre] = { name: item.nombre, qty: 0, revenue: 0 };
        }
        prodMap[item.nombre].qty += item.cantidad;
        prodMap[item.nombre].revenue += item.cantidad * item.precio;
      });

      // Date breakdown
      const dStr = getPedidoDateStr(p);
      if (!dateMap[dStr]) {
        dateMap[dStr] = {
          dateStr: dStr,
          total: 0,
          count: 0,
          efectivo: 0,
          nequi: 0,
          pse: 0,
          datafono: 0,
          transferencia: 0
        };
      }
      dateMap[dStr].total += p.total;
      dateMap[dStr].count += 1;
      if (m === 'efectivo') dateMap[dStr].efectivo += p.total;
      else if (m === 'nequi') dateMap[dStr].nequi += p.total;
      else if (m === 'pse') dateMap[dStr].pse += p.total;
      else if (m === 'datafono') dateMap[dStr].datafono += p.total;
      else if (m === 'transferencia') dateMap[dStr].transferencia += p.total;
    });

    const sortedDates = Object.values(dateMap).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    const sortedProds = Object.values(prodMap).sort((a, b) => b.qty - a.qty);

    return {
      totalGrossSales: gross,
      salesByDateList: sortedDates,
      topProductsList: sortedProds,
      totalDiscounts: discounts,
      totalRefunds: refunds,
      paymentMethodsSummary: methods
    };
  }, [filteredPedidosPagados]);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col font-sans">
      
      {/* Barra de Navegación POS */}
      <header className="bg-neutral-950 border-b border-neutral-850 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 relative z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="transform hover:rotate-3 transition-transform duration-300">
            <LogoSaborYork className="w-16 h-16" showText={false} theme="dark" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-serif font-black tracking-widest text-white uppercase leading-none">
              EL BUEN SABOR <span className="text-amber-500 font-sans tracking-normal font-bold">DEL YORK</span>
              <span className="text-amber-500 text-[10px] font-mono bg-amber-500/10 border border-amber-500/20 rounded-md px-1.5 py-0.5 ml-2 uppercase tracking-normal">POS</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-neutral-400 mt-1 font-sans">
              Sesión activa: <span className="text-white font-medium">{userProfile?.nombre}</span> · Rol: <span className="text-amber-400 capitalize font-bold">{activeRoleView}</span>
            </p>
          </div>
        </div>

        {/* Tableros de Simulación Exclusivo para Desarrolladores/Administradores o Personal Multi-Rol */}
        <div className="flex flex-wrap items-center gap-2">
          {userProfile?.rol === 'admin' ? (
            <div className="flex items-center gap-1.5 bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-xl p-1.5 text-xs">
              <span className="font-bold text-[10px] text-amber-500 tracking-wider uppercase ml-1.5 mr-1">Simular Vista:</span>
              <button 
                onClick={() => setActiveRoleView('admin')} 
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${activeRoleView === 'admin' ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
              >
                Admin
              </button>
              <button 
                onClick={() => setActiveRoleView('mesero')} 
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${activeRoleView === 'mesero' ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
              >
                Mesero
              </button>
              <button 
                onClick={() => setActiveRoleView('caja')} 
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${activeRoleView === 'caja' ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
              >
                Caja
              </button>
              <button 
                onClick={() => setActiveRoleView('cocina')} 
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${activeRoleView === 'cocina' ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
              >
                Kitchen
              </button>
              <button 
                onClick={() => setActiveRoleView('inventario')} 
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${activeRoleView === 'inventario' ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
              >
                Insumos
              </button>
            </div>
          ) : userProfile?.roles && userProfile.roles.length > 1 ? (
            <div className="flex items-center gap-1.5 bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-xl p-1.5 text-xs">
              <span className="font-bold text-[10px] text-amber-500 tracking-wider uppercase ml-1.5 mr-1">Cambiar Módulo:</span>
              {userProfile.roles.map((r) => {
                let label = r;
                if (r === 'admin') label = 'Admin';
                if (r === 'mesero') label = 'Mesero';
                if (r === 'caja') label = 'Caja/Venta';
                if (r === 'cocina') label = 'Kitchen';
                if (r === 'inventario') label = 'Insumos';
                if (r === 'pendiente') label = 'Pendiente';

                return (
                  <button 
                    key={r}
                    onClick={() => setActiveRoleView(r)} 
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all capitalize cursor-pointer ${activeRoleView === r ? 'bg-amber-500 text-neutral-950 shadow' : 'hover:bg-neutral-800 bg-neutral-950 text-neutral-405'}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-neutral-400 font-medium">
              Viendo Módulo: <span className="text-white capitalize font-bold">{activeRoleView}</span>
            </div>
          )}
          
          {userProfile?.rol === 'admin' && (
            <button
              onClick={() => setIsModalUsersOpen(true)}
              className="p-2 bg-neutral-850 hover:bg-neutral-800 text-amber-500 hover:text-amber-400 border border-neutral-800 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
              title="Gestionar Roles Personal"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={logout}
            className="p-2 bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 rounded-xl flex items-center justify-center cursor-pointer transition-colors"
            title="Cerrar Sesión Corporativa"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* RENDERIZADOR DIVERGENTE DE RBAC */}
      <main className="flex-1 p-6 space-y-8">
        
        {/* ========================================================== */}
        {/* VISTA 1: ROL ADMINISTRADOR (VISTA TOTAL)                   */}
        {/* ========================================================== */}
        {activeRoleView === 'admin' && (
          <div className="space-y-8">
            {/* Bento de estadísticas sutiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block font-semibold uppercase">Total Pedidos</span>
                  <span className="text-xl font-bold font-mono">{pedidos.length}</span>
                </div>
              </div>
              
              <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 rounded-xl flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block font-semibold uppercase font-sans">Venta Hoy</span>
                  <span className="text-xl font-bold font-mono">
                    ${pedidos.filter(p => p.pagado).reduce((acc, current) => acc + current.total, 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-sky-500/10 border border-sky-500/30 text-sky-500 rounded-xl flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block font-semibold uppercase">Insumos Registrados</span>
                  <span className="text-xl font-bold font-mono">{inventario.length}</span>
                </div>
              </div>
              
              <div className="bg-neutral-950 border border-neutral-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/30 text-orange-500 rounded-xl flex items-center justify-center">
                  <Flame className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block font-semibold uppercase">En Cocina</span>
                  <span className="text-xl font-bold font-mono">{pedidos.filter(p => ['pendiente', 'en_proceso'].includes(p.estado)).length}</span>
                </div>
              </div>
            </div>

            {/* Accesos rápidos */}
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsModalIAOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-black rounded-2xl flex items-center gap-2 cursor-pointer hover:from-amber-400 hover:to-orange-400 shadow-lg active:scale-95 transition-all text-sm"
              >
                <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
                Tomar Pedido por IA
              </button>

              <button
                onClick={() => setIsModalUsersOpen(true)}
                className="px-5 py-3 border border-neutral-800 bg-neutral-950 hover:bg-neutral-850 hover:text-white text-sm text-neutral-300 rounded-2xl font-bold flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <UserCheck className="w-4 h-4 text-amber-500" />
                Gestionar Roles Personal
              </button>

              {inventario.length === 0 && (
                <button
                  onClick={handleSeedMockData}
                  className="px-4 py-2 border border-neutral-850 bg-neutral-950 hover:bg-neutral-850 text-xs text-neutral-300 rounded-xl font-semibold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sembrar Insumos de Prueba
                </button>
              )}
            </div>

            {/* Control Principal de Secciones Administrativas */}
            <div className="flex flex-wrap border-b border-neutral-800 pb-2 gap-4">
              <button
                type="button"
                onClick={() => setAdminSectionTab('comandas')}
                className={`pb-2.5 px-4 font-black transition-all text-xs uppercase tracking-wider border-b-2 cursor-pointer flex items-center gap-2 ${
                  adminSectionTab === 'comandas' 
                    ? 'border-amber-500 text-amber-500 font-extrabold' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <span>📝 1. Control de Pedidos & Inventario</span>
                {adminSectionTab !== 'comandas' && pedidos.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-400">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    {pedidos.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAdminSectionTab('carta')}
                className={`pb-2.5 px-4 font-black transition-all text-xs uppercase tracking-wider border-b-2 cursor-pointer flex items-center gap-2 ${
                  adminSectionTab === 'carta' 
                    ? 'border-amber-500 text-amber-500 font-extrabold' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <span>🍔 2. Administrador de Menú (Categorías y Productos)</span>
                {adminSectionTab !== 'carta' && appCategorias.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-400">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    {appCategorias.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setAdminSectionTab('pedidos')}
                className={`pb-2.5 px-4 font-black transition-all text-xs uppercase tracking-wider border-b-2 cursor-pointer flex items-center gap-2 ${
                  adminSectionTab === 'pedidos' 
                    ? 'border-amber-500 text-amber-500 font-extrabold' 
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <span>🛒 3. Registro de Pedidos (Comandas)</span>
                {adminSectionTab !== 'pedidos' && appProductos.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 border border-neutral-800 text-neutral-400">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                    {appProductos.length}
                  </span>
                )}
              </button>
            </div>

            {/* Renderizado Condicional de la sección activa */}
            {adminSectionTab === 'comandas' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Pedidos activos (Caja / Administración) */}
              <div className="lg:col-span-8 space-y-8">
                {/* 1. COMANDAS ACTIVAS EN CURSO */}
                <div className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6">
                  <h3 className="text-lg font-black text-white mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">📝 COMANDAS EN CURSO (ACTIVAS)</span>
                    <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold px-2 py-0.5 rounded font-mono">
                      {pedidos.filter(p => !p.pagado).length} Activas
                    </span>
                  </h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-neutral-300">
                      <thead className="bg-neutral-900 text-neutral-400 uppercase tracking-widest text-[9px] border-b border-neutral-800">
                        <tr>
                          <th className="px-4 py-3">Mesa</th>
                          <th className="px-4 py-3">Detalle</th>
                          <th className="px-4 py-3">Precio Total</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Pago</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 pointer-events-auto">
                        {pedidos.filter(p => !p.pagado).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-neutral-600 font-mono">
                              No hay comandas activas pendientes de pago en este momento.
                            </td>
                          </tr>
                        ) : (
                          pedidos.filter(p => !p.pagado).map((ped) => {
                            return (
                              <tr 
                                key={ped.id} 
                                onClick={() => setSelectedPedidoId(ped.id!)}
                                className="hover:bg-neutral-900/60 transition-all cursor-pointer group active:bg-neutral-900/80 border-b border-neutral-900/50"
                                title="Toca para ver el detalle y controlar la comanda"
                              >
                                <td className="px-4 py-3">
                                  <span className="bg-neutral-900 border border-neutral-800 rounded font-black text-white text-[11px] px-2 py-1 font-mono flex items-center gap-1.5 w-fit">
                                    <Eye className="w-3 h-3 text-neutral-500 group-hover:text-amber-500 transition-colors" />
                                    Mesa {ped.mesa}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-0.5">
                                    {ped.productos?.map((p, idx) => (
                                      <div key={idx} className="text-neutral-300">
                                        <span className="text-amber-500 font-mono font-bold mr-1">{p.cantidad}x</span> 
                                        <span className="font-semibold">{p.nombre}</span>
                                        {p.notas && <span className="text-red-400 text-[10px] ml-1.5 italic font-sans">(Sin: {p.notas})</span>}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-white text-sm">
                                  ${ped.total.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    ped.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    ped.estado === 'en_proceso' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    ped.estado === 'terminado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    'bg-neutral-800 text-neutral-400'
                                  }`}>
                                    {ped.estado}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="flex gap-1.5 justify-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCobrarPedido(ped.id!, 'efectivo');
                                      }}
                                      className="px-2 py-1 bg-emerald-700/20 hover:bg-emerald-750 text-emerald-400 text-[10px] rounded border border-emerald-700/40 font-bold active:scale-95 transition-all cursor-pointer"
                                    >
                                      Efectivo
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCobrarPedido(ped.id!, 'transferencia');
                                      }}
                                      className="px-2 py-1 bg-sky-700/20 hover:bg-sky-750 text-sky-400 text-[10px] rounded border border-sky-700/40 font-bold active:scale-95 transition-all cursor-pointer"
                                    >
                                      Transfer.
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEliminarPedido(ped.id!);
                                    }}
                                    className="p-1.5 hover:bg-red-950/40 text-neutral-500 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                    title="Anular Comanda"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. REGISTRO DE PEDIDOS FACTURADOS (HISTORIAL) */}
                <div className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6">
                  <h3 className="text-lg font-black text-white mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">🧾 HISTORIAL DE PEDIDOS FACTURADOS (COMANDAS COBRADAS)</span>
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded font-mono">
                      {pedidos.filter(p => p.pagado).length} Facturados
                    </span>
                  </h3>

                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs text-neutral-300">
                      <thead className="bg-neutral-900 text-neutral-400 uppercase tracking-widest text-[9px] border-b border-neutral-800">
                        <tr>
                          <th className="px-4 py-3">Mesa</th>
                          <th className="px-4 py-3">Detalle</th>
                          <th className="px-4 py-3">Precio Total</th>
                          <th className="px-4 py-3 text-center">Estado</th>
                          <th className="px-4 py-3 text-center">Medio de Pago</th>
                          <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 pointer-events-auto">
                        {pedidos.filter(p => p.pagado).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-neutral-600 font-mono">
                              No hay comandas facturadas en esta jornada todavía.
                            </td>
                          </tr>
                        ) : (
                          pedidos.filter(p => p.pagado).map((ped) => {
                            return (
                              <tr 
                                key={ped.id} 
                                onClick={() => setSelectedPedidoId(ped.id!)}
                                className="hover:bg-neutral-900/40 transition-all cursor-pointer group active:bg-neutral-900/60 border-b border-neutral-900/30"
                                title="Ver detalles del comprobante facturado"
                              >
                                <td className="px-4 py-3">
                                  <span className="bg-neutral-900 border border-neutral-850 rounded font-bold text-neutral-300 text-[11px] px-2 py-1 font-mono flex items-center gap-1.5 w-fit">
                                    <Eye className="w-3 h-3 text-neutral-500 group-hover:text-amber-500 transition-colors" />
                                    Mesa {ped.mesa}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-0.5">
                                    {ped.productos?.map((p, idx) => (
                                      <div key={idx} className="text-neutral-400">
                                        <span className="text-emerald-500 font-mono font-bold mr-1">{p.cantidad}x</span> 
                                        <span>{p.nombre}</span>
                                        {p.notas && <span className="text-neutral-500 text-[10px] ml-1.5 italic font-sans">(Sin: {p.notas})</span>}
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-sm">
                                  ${ped.total.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-neutral-500 border border-neutral-850 uppercase font-mono">
                                    Finalizado
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] rounded font-black uppercase font-mono">
                                    ✓ {ped.metodoPago}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end p-1.5 text-neutral-600" title="Imposible anular: Comprobante cerrado y archivado en histórico.">
                                    <Lock className="w-3.5 h-3.5 text-neutral-500" />
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Inventario sutil (Lateral) */}
              <div className="lg:col-span-4 bg-neutral-950 border border-neutral-850 rounded-3xl p-6 flex flex-col h-full justify-between">
                <div>
                  <h3 className="text-lg font-black text-white mb-4 flex items-center gap-1.5">
                    <Package className="w-5 h-5 text-amber-500" />
                    <span>CONTROL DE INVENTARIO</span>
                  </h3>

                  {/* Formulario Insumo */}
                  <form onSubmit={handleCrearInsumo} className="space-y-3 mb-6 bg-neutral-900/60 p-4 rounded-2xl border border-neutral-850">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Agregar Nuevo Insumo</span>
                    <input
                      type="text"
                      value={nuevoInsumoNombre}
                      onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                      placeholder="Ej: Carne de Cerdo"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-all font-sans"
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1 text-xs">
                        <span className="text-[9px] text-neutral-500 uppercase font-bold block">Stock Inicial</span>
                        <input
                          type="number"
                          value={nuevoInsumoStock}
                          onChange={(e) => setNuevoInsumoStock(Number(e.target.value))}
                          className="w-full bg-transparent text-white focus:outline-none"
                        />
                      </div>
                      <div className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1 text-xs">
                        <span className="text-[9px] text-neutral-500 uppercase font-bold block">Unidad</span>
                        <input
                          type="text"
                          value={nuevoInsumoUnidad}
                          onChange={(e) => setNuevoInsumoUnidad(e.target.value)}
                          className="w-full bg-transparent text-white focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                    >
                      Añadir a Almacén
                    </button>
                  </form>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {inventario.map((item) => {
                      const isLowStock = item.stock <= item.stockMinimo;
                      return (
                        <div key={item.id} className="flex justify-between items-center p-2.5 bg-neutral-900 border border-neutral-850 rounded-xl text-xs">
                          <div>
                            <span className="font-bold text-neutral-200 block leading-tight">{item.nombre}</span>
                            <span className="text-[10px] text-neutral-500 font-mono">Min: {item.stockMinimo} {item.unidad}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-md font-mono font-bold leading-none ${
                              isLowStock ? 'bg-red-500/10 text-red-500 font-extrabold border border-red-500/20' : 'bg-neutral-950 text-neutral-400'
                            }`}>
                              {item.stock} {item.unidad.slice(0, 3)}
                            </span>
                            
                            <div className="flex gap-0.5">
                              <button 
                                onClick={() => handleModifyStock(item.id!, -5)}
                                className="w-5 h-5 bg-neutral-950 text-neutral-400 hover:text-white rounded border border-neutral-800 font-black text-xs cursor-pointer active:scale-95 flex items-center justify-center"
                              >
                                -
                              </button>
                              <button 
                                onClick={() => handleModifyStock(item.id!, 5)}
                                className="w-5 h-5 bg-neutral-950 text-neutral-400 hover:text-white rounded border border-neutral-800 font-black text-xs cursor-pointer active:scale-95 flex items-center justify-center"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-850/60 text-center">
                  <span className="text-[10px] text-neutral-500 font-mono block">EL BUEN SABOR DEL YORK POS © 2026</span>
                </div>
              </div>

            </div>
            ) : adminSectionTab === 'carta' ? (
              <AdminProductosCategorias onNotify={(msg, type) => {
                // Notificación simple o modal si fuera necesario, para mayor robustez print a consola
                console.log(`[Admin Menu] ${type}: ${msg}`);
              }} />
            ) : (
              <ModuloPedidos 
                onNotify={(msg, type) => {
                  console.log(`[Modulo Pedidos] ${type}: ${msg}`);
                }}
                userProfile={userProfile || undefined}
              />
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* VISTA 2: ROL MESERO / PEDIDOS / COMANDAS MANUAL             */}
        {/* ========================================================== */}
        {activeRoleView === 'mesero' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Banner superior de bienvenida y acciones rápidas para el Mesero */}
            <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center">
                  <ChefHat className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Módulo de Atención & Mesero</h2>
                  <p className="text-neutral-400 text-xs mt-0.5">
                    Toma los pedidos de los clientes mediante el menú interactivo o asístete con la IA del local.
                  </p>
                </div>
              </div>
              
              <button
                onClick={() => setIsModalIAOpen(true)}
                className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-xs rounded-2xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-xl shrink-0"
              >
                <Plus className="w-4 h-4 text-neutral-950 stroke-[3]" />
                Registrar Pedido por IA (Asistente Sabor York)
              </button>
            </div>

            {/* MÓDULO INTERACTIVO DE PEDIDOS DIRECTO */}
            <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-3xl">
              <ModuloPedidos 
                onNotify={(msg, type) => {
                  console.log(`[Mesero Pedidos] ${type}: ${msg}`);
                }}
                userProfile={userProfile || undefined}
              />
            </div>

            {/* Monitor abreviado de seguimiento de cocina */}
            <div className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                Seguimiento de Comandas en Cocina (Tiempo Real)
              </h3>

              {(() => {
                const uPedidos = pedidos.filter(p => {
                  if (p.estado === 'cancelado') return false;
                  if (!isUserAdmin) {
                    return p.meseroUid === userProfile?.uid;
                  }
                  return true;
                });

                const pedidosEnCola = uPedidos.filter(p => ['pendiente', 'en_proceso'].includes(p.estado));
                const pedidosTerminados = uPedidos.filter(p => ['terminado', 'entregado'].includes(p.estado));

                return (
                  <div className="space-y-4">
                    
                    {/* ACORDEÓN 1: COMANDAS EN COLA / EN PREPARACIÓN */}
                    <div className="border border-neutral-850 bg-neutral-900/10 rounded-2xl overflow-hidden transition-all duration-300">
                      <button
                        onClick={() => setAccordionEnColaOpen(!accordionEnColaOpen)}
                        className="w-full flex justify-between items-center p-4 bg-neutral-900 hover:bg-neutral-850/80 transition-colors text-left font-bold text-xs cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span className="text-white uppercase tracking-wider">Comandas en Cola o Parrilla</span>
                          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] text-amber-500 font-mono font-extrabold">
                            {pedidosEnCola.length}
                          </span>
                        </div>
                        <div className="text-neutral-400">
                          {accordionEnColaOpen ? (
                            <ChevronUp className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {accordionEnColaOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-1 space-y-2.5 max-h-[360px] overflow-y-auto">
                              {pedidosEnCola.length === 0 ? (
                                <p className="text-center py-6 text-neutral-600 text-xs font-mono">No hay comandas activas en cola.</p>
                              ) : (
                                pedidosEnCola.map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() => setDetailPedidoLectura(p)}
                                    title="Toca para ver el detalle de la comanda con imágenes y especificaciones"
                                    className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-neutral-950/70 hover:bg-neutral-850/50 border border-neutral-850/80 hover:border-neutral-700/60 rounded-xl text-xs cursor-pointer transition-all active:scale-[0.99] gap-3"
                                  >
                                    <div className="flex-1 w-full space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-white text-sm group-hover:text-amber-400 transition-colors">Mesa {p.mesa}</span>
                                        <span className="text-[10px] text-neutral-500 font-mono">ID: {p.id?.slice(-5).toUpperCase()}</span>
                                      </div>
                                      <div className="text-neutral-400 text-[11px] leading-relaxed break-words">
                                        {p.productos.map(item => `${item.cantidad}x ${item.nombre}`).join(', ')}
                                      </div>
                                      <div className="text-[11px] font-mono flex items-center gap-1.5 mt-2">
                                        <span className="text-neutral-500 font-bold uppercase tracking-wider text-[9px]">Total Comanda:</span>
                                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-xs font-mono shadow-sm">
                                          ${p.total.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                                        p.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                        'bg-orange-500/10 text-orange-500 border border-orange-500/20 animate-pulse'
                                      }`}>
                                        {p.estado === 'pendiente' ? 'En cola' : 'En Parrilla'}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ACORDEÓN 2: COMANDAS TERMINADAS / ENTREGADAS (COMPLETADAS) */}
                    <div className="border border-neutral-850 bg-neutral-900/10 rounded-2xl overflow-hidden transition-all duration-300">
                      <button
                        onClick={() => setAccordionCompletadosOpen(!accordionCompletadosOpen)}
                        className="w-full flex justify-between items-center p-4 bg-neutral-900 hover:bg-neutral-850/80 transition-colors text-left font-bold text-xs cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-white uppercase tracking-wider">Historial de Comandas Entregadas / Listas</span>
                          <span className="ml-1.5 px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] text-emerald-400 font-mono font-extrabold">
                            {pedidosTerminados.length}
                          </span>
                        </div>
                        <div className="text-neutral-400">
                          {accordionCompletadosOpen ? (
                            <ChevronUp className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {accordionCompletadosOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-1 space-y-2.5 max-h-[360px] overflow-y-auto">
                              {pedidosTerminados.length === 0 ? (
                                <p className="text-center py-6 text-neutral-600 text-xs font-mono">No hay comandas completadas o entregadas en esta jornada.</p>
                              ) : (
                                pedidosTerminados.map((p) => (
                                  <div
                                    key={p.id}
                                    onClick={() => setDetailPedidoLectura(p)}
                                    title="Toca para ver el detalle de la comanda con imágenes y especificaciones"
                                    className="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-neutral-950/40 hover:bg-neutral-850/30 border border-neutral-850/60 hover:border-neutral-700/50 rounded-xl text-xs cursor-pointer transition-all active:scale-[0.99] gap-3"
                                  >
                                    <div className="flex-1 w-full space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-extrabold text-neutral-300 text-sm group-hover:text-amber-400 transition-colors">Mesa {p.mesa}</span>
                                        <span className="text-[10px] text-neutral-500 font-mono">ID: {p.id?.slice(-5).toUpperCase()}</span>
                                      </div>
                                      <div className="text-neutral-400 text-[11px] leading-relaxed break-words">
                                        {p.productos.map(item => `${item.cantidad}x ${item.nombre}`).join(', ')}
                                      </div>
                                      <div className="text-[11px] font-mono flex items-center gap-1.5 mt-2">
                                        <span className="text-neutral-500 font-bold uppercase tracking-wider text-[9px]">Total Comanda:</span>
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs font-mono shadow-sm">
                                          ${p.total.toLocaleString()}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 self-end sm:sm:self-center shrink-0">
                                      <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] uppercase ${
                                        p.state === 'terminado' || p.estado === 'terminado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                        'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                      }`}>
                                        {p.estado === 'terminado' ? 'Listo' : 'Entregado'}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                );
              })()}

              {/* RESUMEN DE COMPROBACIÓN DE VENTAS DE LA JORNADA / SESIÓN */}
              <div className="mt-6 pt-5 border-t border-neutral-850/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 shrink-0">
                    <Receipt className="w-4.5 h-4.5 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider block">
                      {isUserAdmin ? 'Resumen de Ventas Generado (Administrador)' : 'Mi Registro de Ventas de Hoy'}
                    </span>
                    <span className="text-[11px] text-neutral-500 leading-normal">
                      {isUserAdmin 
                        ? 'Consolidado acumulado de todos los meseros en tiempo real' 
                        : `Comandas generadas por tu usuario (${userProfile?.nombre || 'Mi Usuario'})`
                      }
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                  <div className="bg-neutral-900 border border-neutral-850 px-3.5 py-2 rounded-2xl flex-1 md:flex-initial text-right">
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block leading-none mb-1">COBRADO / FACTURADO</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">${totalCobrado.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-neutral-900 border border-neutral-850 px-3.5 py-2 rounded-2xl flex-1 md:flex-initial text-right">
                    <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block leading-none mb-1">CUENTAS EN MESA</span>
                    <span className="text-sm font-black text-amber-500 font-mono">${totalPendienteCobro.toLocaleString()}</span>
                  </div>

                  <div className="bg-neutral-900/40 border border-neutral-850 px-3.5 py-2 rounded-2xl flex-1 md:flex-initial text-right bg-gradient-to-br from-amber-500/5 to-transparent">
                    <span className="text-[9px] text-amber-500 font-black uppercase tracking-wider block leading-none mb-1">TOTAL VENDIDO</span>
                    <span className="text-base font-black text-white font-mono">${totalGeneralVendido.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VISTA 3: ROL CAJERO / COBROS / CUADRES                     */}
        {/* ========================================================== */}
        {activeRoleView === 'caja' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Cola de pedidos por cobrar */}
              <div className="lg:col-span-8 bg-neutral-950 border border-neutral-850 rounded-3xl p-6">
                <h2 className="text-lg font-black text-white mb-4 flex justify-between items-center">
                  <span>MÓDULO DE COBROS Y CONTROL DE CAJA</span>
                  <span className="text-xs text-neutral-500">Filtrado por: No Pagados</span>
                </h2>

                <div className="space-y-4">
                  {pedidos.filter(p => !p.pagado).length === 0 ? (
                    <div className="text-center py-12 text-neutral-500 text-xs">
                      No hay pedidos pendientes por cobrar. Todas las mesas están al día.
                    </div>
                  ) : (
                    pedidos.filter(p => !p.pagado).map((p) => (
                      <div key={p.id} className="bg-neutral-900 border border-neutral-850 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-neutral-950 outline outline-1 outline-neutral-800 text-white font-extrabold text-xs px-2.5 py-1 rounded-md">
                              Mesa {p.mesa}
                            </span>
                            <span className="text-neutral-500 text-xs font-mono">ID: {p.id?.slice(-5).toUpperCase()}</span>
                          </div>
                          
                          <div className="text-xs text-neutral-300 mt-2 space-y-1">
                            {p.productos.map((prod, i) => (
                              <div key={i}>
                                <span className="font-bold mr-1 text-amber-500">{prod.cantidad}x</span>
                                <span className="font-semibold">{prod.nombre}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-2 shrink-0">
                          <span className="text-xl font-black text-white font-mono">${p.total.toLocaleString()}</span>
                          
                          <div className="flex flex-wrap gap-2 justify-end max-w-sm sm:max-w-md">
                            <button
                              onClick={() => handleCobrarPedido(p.id!, 'efectivo')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                            >
                              $ Efectivo
                            </button>
                            <button
                              onClick={() => handleCobrarPedido(p.id!, 'nequi')}
                              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-neutral-950 text-[11px] font-extrabold rounded-lg cursor-pointer flex items-center gap-1 transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                            >
                              📱 Nequi
                            </button>
                            <button
                              onClick={() => handleCobrarPedido(p.id!, 'pse')}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                            >
                              🏦 PSE
                            </button>
                            <button
                              onClick={() => handleCobrarPedido(p.id!, 'datafono')}
                              className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 active:scale-95 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                            >
                              💳 Datáfono
                            </button>
                            <button
                              onClick={() => handleCobrarPedido(p.id!, 'transferencia')}
                              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-[11px] font-bold rounded-lg cursor-pointer flex items-center gap-1 transition-all"
                            >
                              ⇄ Transferencia
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* FILTROS APLICADOS AL HISTORIAL DE CAJA */}
              <div className="lg:col-span-8 bg-neutral-950 border border-neutral-850 rounded-3xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span>Filtros del Historial de Ventas / Caja</span>
                  </h3>
                  {(filtroFechaInicio || filtroFechaFin) && (
                    <button
                      onClick={() => {
                        setFiltroFechaInicio('');
                        setFiltroFechaFin('');
                      }}
                      className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold px-2 py-1 rounded border border-red-500/20 transition-all cursor-pointer"
                    >
                      Limpiar Filtros ×
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Fecha de Inicio</label>
                    <input
                      type="date"
                      value={filtroFechaInicio}
                      onChange={(e) => setFiltroFechaInicio(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">Fecha de Fin</label>
                    <input
                      type="date"
                      value={filtroFechaFin}
                      onChange={(e) => setFiltroFechaFin(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Resumen dinámico de filtros */}
                <div className="bg-neutral-900/40 border border-neutral-850 p-4 rounded-xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-neutral-400 font-mono">
                        Comprobantes en rango: <strong className="text-white">{filteredPedidosPagados.length}</strong>
                      </span>
                    </div>
                    <div className="font-mono text-neutral-400">
                      Suma Recaudada: <strong className="text-emerald-400">${filteredPedidosPagados.reduce((sum, p) => sum + p.total, 0).toLocaleString()} COP</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSalesAnalyticsModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-neutral-950 font-black uppercase tracking-wider rounded-xl shadow-lg hover:shadow-emerald-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 text-[11px] cursor-pointer shrink-0"
                  >
                    <BarChart2 className="w-4 h-4" />
                    Ver Gráfica y Resumen Analítico
                  </button>
                </div>
              </div>

              {/* HISTORIAL RECIENTE DE COBROS */}
              <div className="lg:col-span-8 bg-neutral-950 border border-neutral-850 rounded-3xl p-6">
                <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wider flex justify-between items-center">
                  <span>🧾 Historial de Comprobantes Emitidos</span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                    {filteredPedidosPagados.length} Comprobantes
                  </span>
                </h2>

                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {filteredPedidosPagados.length === 0 ? (
                    <div className="text-center py-8 text-neutral-600 text-xs font-mono">
                      Ningún comprobante emitido coincide con el rango de fechas seleccionado.
                    </div>
                  ) : (
                    filteredPedidosPagados.map((p) => (
                      <div key={p.id} className="bg-neutral-900/60 border border-neutral-850 rounded-xl p-3 flex justify-between items-center gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold px-1.5 py-0.5 rounded text-[10px] font-mono">
                              Mesa {p.mesa}
                            </span>
                            <span className="text-neutral-500 text-[10px] font-mono">ID: {p.id?.slice(-5).toUpperCase()}</span>
                            <span className="text-neutral-600 text-[10px] font-mono">({getPedidoDateStr(p)})</span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-1">
                            {p.productos.map(prod => `${prod.cantidad}x ${prod.nombre}`).join(', ')}
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className="font-bold text-white block">${p.total.toLocaleString()}</span>
                            <span className="text-[9px] text-emerald-400 font-bold font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded mt-0.5 block w-fit ml-auto">
                              {p.metodoPago}
                            </span>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400">
                            <Lock className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Centro de Operaciones y Control de Caja (Caja Operations Hub) */}
              <div className="lg:col-span-4 bg-neutral-950 border border-neutral-850 rounded-3xl p-6 space-y-6">
                <div className="border-b border-neutral-850 pb-4">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-emerald-500 animate-pulse" />
                    Centro de Operaciones de Caja
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">Control de arqueos, egresos y remisiones</p>
                </div>

                {(() => {
                  const hoyString = new Date().toISOString().split('T')[0];
                  const vToday = ventas.find(v => v.fecha === hoyString);
                  
                  // Total físico calculado
                  const totalArqueoFisico = 
                    (denominaciones['B_100k'] || 0) * 100000 +
                    (denominaciones['B_50k'] || 0) * 50000 +
                    (denominaciones['B_20k'] || 0) * 20000 +
                    (denominaciones['B_10k'] || 0) * 10000 +
                    (denominaciones['B_5k'] || 0) * 5000 +
                    (denominaciones['B_2k'] || 0) * 2000 +
                    (denominaciones['M_1k'] || 0) * 1000 +
                    (denominaciones['M_500'] || 0) * 500 +
                    (denominaciones['M_200'] || 0) * 200 +
                    (denominaciones['M_100'] || 0) * 100 +
                    (denominaciones['M_50'] || 0) * 50 +
                    (denominaciones['Bono'] || 0);

                  if (!vToday) {
                    return (
                      <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl text-xs space-y-3">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-[11px] leading-relaxed">
                          ⚠️ No se ha abierto la caja de hoy. Por favor especifica el monto base de apertura para iniciar operaciones.
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Fondo de Apertura (Base)</label>
                          <input
                            type="number"
                            value={montoApertura || ''}
                            onChange={(e) => setMontoApertura(Number(e.target.value))}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                            placeholder="Ej. 150000"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAbrirCajaHoy}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer text-center"
                        >
                          Abrir Caja de Hoy
                        </button>
                      </div>
                    );
                  }

                  // Cálculos de flujo de caja
                  const totalEgresosHoy = vToday.egresos?.reduce((acc, e) => acc + e.monto, 0) || 0;

                  // Obtener las fechas de registros de caja cerrados para no mezclarlas
                  const closedDates = new Set(ventas.filter(v => v.estado === 'cerrado').map(v => v.fecha));

                  // Calcular dinámicamente desde pedidos pagados que no pertenezcan a una caja ya cerrada para asegurar la acumulación en la caja abierta
                  const pedidosDeLaFecha = pedidos.filter(p => {
                    if (!p.pagado) return false;
                    const pDateStr = getPedidoDateStr(p);
                    if (closedDates.has(pDateStr)) return false;
                    return true;
                  });
                  
                  const ventasEfectivoCalc = pedidosDeLaFecha
                    .filter(p => p.metodoPago?.toLowerCase() === 'efectivo')
                    .reduce((sum, p) => sum + p.total, 0);

                  const ventasNequiCalc = pedidosDeLaFecha
                    .filter(p => p.metodoPago?.toLowerCase() === 'nequi')
                    .reduce((sum, p) => sum + p.total, 0);

                  const ventasPseCalc = pedidosDeLaFecha
                    .filter(p => p.metodoPago?.toLowerCase() === 'pse')
                    .reduce((sum, p) => sum + p.total, 0);

                  const ventasDatafonoCalc = pedidosDeLaFecha
                    .filter(p => p.metodoPago?.toLowerCase() === 'datafono')
                    .reduce((sum, p) => sum + p.total, 0);

                  const ventasTransferenciaCalc = pedidosDeLaFecha
                    .filter(p => p.metodoPago?.toLowerCase() === 'transferencia')
                    .reduce((sum, p) => sum + p.total, 0);

                  const ventasEfectivoMostrada = Math.max(vToday.ventasEfectivo || 0, ventasEfectivoCalc);
                  const ventasNequiMostrada = Math.max(vToday.ventasNequi || 0, ventasNequiCalc);
                  const ventasPseMostrada = Math.max(vToday.ventasPse || 0, ventasPseCalc);
                  const ventasDatafonoMostrada = Math.max(vToday.ventasDatafono || 0, ventasDatafonoCalc);
                  const ventasTransferenciaMostrada = Math.max(vToday.ventasTransferencia || 0, ventasTransferenciaCalc);

                  const efectivoTeoricoHoy = vToday.montoApertura + ventasEfectivoMostrada - totalEgresosHoy;
                  const discrepanciaHoy = totalArqueoFisico - efectivoTeoricoHoy;

                  return (
                    <div className="space-y-4">
                      {/* Estado general */}
                      <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-850">
                          <span className="font-extrabold text-white text-xs font-mono">{vToday.fecha}</span>
                          <span className="bg-emerald-500/10 text-emerald-400 font-extrabold text-[9px] uppercase px-2 py-0.5 rounded border border-emerald-500/20">
                            Caja Abierta
                          </span>
                        </div>

                        {/* Comparación de Arqueo */}
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Monto Base Apertura:</span>
                            <span className="text-neutral-300">${vToday.montoApertura.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Ventas en Efectivo (+):</span>
                            <span className="text-emerald-400">+${ventasEfectivoMostrada.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Ventas por Nequi (+):</span>
                            <span className="text-cyan-400 font-extrabold drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]">+${ventasNequiMostrada.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Ventas por PSE (+):</span>
                            <span className="text-blue-400">+${ventasPseMostrada.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Ventas por Datáfono (+):</span>
                            <span className="text-pink-400">+${ventasDatafonoMostrada.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Ventas Transferencia (+):</span>
                            <span className="text-sky-400">+${ventasTransferenciaMostrada.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono">
                            <span className="text-neutral-500">Egresos Aplicados (-):</span>
                            <span className="text-red-400">-${totalEgresosHoy.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono font-bold border-t border-dashed border-neutral-800 pt-1.5">
                            <span className="text-neutral-300">Efectivo Teórico en Caja:</span>
                            <span className="text-amber-500">${efectivoTeoricoHoy.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between font-mono font-bold">
                            <span className="text-neutral-300">Efectivo Físico Arqueado:</span>
                            <span className="text-emerald-400">${totalArqueoFisico.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Discrepancia */}
                        <div className="border-t border-neutral-850 pt-2.5 mt-2">
                          {discrepanciaHoy === 0 ? (
                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-1.5 rounded-lg">
                              <span>✓ CAJA CUADRADA</span>
                              <span className="font-mono">Sin diferencias</span>
                            </div>
                          ) : discrepanciaHoy > 0 ? (
                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5 rounded-lg">
                              <span>⚠️ SOBRANTE DE CAJA</span>
                              <span className="font-mono">+${discrepanciaHoy.toLocaleString()}</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-[11px] font-bold text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 rounded-lg">
                              <span>⚠️ FALTANTE DE CAJA</span>
                              <span className="font-mono">-${Math.abs(discrepanciaHoy).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botón de Arqueo de Denominaciones */}
                      <button
                        type="button"
                        onClick={() => setIsArqueoModalOpen(true)}
                        className="w-full py-2.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        <Coins className="w-4 h-4 text-emerald-400" />
                        ARQUEAR DENOMINACIONES DE CAJA
                      </button>

                      {/* Botones de Egresos Categorizados */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest block">Registrar Salidas de Dinero</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEgresoModalType('gasto');
                              setIsEgresoModalOpen(true);
                            }}
                            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 rounded-xl text-left hover:border-red-500/20 transition-all cursor-pointer"
                          >
                            <span className="text-[10px] text-red-400 font-bold block">🔴 Gastos</span>
                            <span className="text-[9px] text-neutral-500 block">Facturas e Insumos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEgresoModalType('entrega');
                              setIsEgresoModalOpen(true);
                            }}
                            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 rounded-xl text-left hover:border-emerald-500/20 transition-all cursor-pointer"
                          >
                            <span className="text-[10px] text-emerald-400 font-bold block">💸 Entregas / Envíos</span>
                            <span className="text-[9px] text-neutral-500 block">Retiro parcial o total</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEgresoModalType('pago_empleado');
                              setIsEgresoModalOpen(true);
                            }}
                            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 rounded-xl text-left hover:border-sky-500/20 transition-all cursor-pointer"
                          >
                            <span className="text-[10px] text-sky-400 font-bold block">👤 Pago de Empleados</span>
                            <span className="text-[9px] text-neutral-500 block">Nómina y adelantos</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEgresoModalType('otros');
                              setIsEgresoModalOpen(true);
                            }}
                            className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 rounded-xl text-left hover:border-neutral-700 transition-all cursor-pointer"
                          >
                            <span className="text-[10px] text-neutral-400 font-bold block">📦 Otros Egresos</span>
                            <span className="text-[9px] text-neutral-500 block">Imprevistos de caja</span>
                          </button>
                        </div>
                      </div>

                      {/* Historial de egresos */}
                      <div className="space-y-2 pt-2 border-t border-neutral-850">
                        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Egresos de Hoy:</span>
                        {(!vToday.egresos || vToday.egresos.length === 0) ? (
                          <div className="text-center py-4 text-neutral-600 text-[11px] font-mono">
                            Ningún egreso aplicado hoy.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {vToday.egresos.map((e, index) => {
                              // Determinar el color del egreso según categoría
                              let colorClass = "bg-neutral-900 text-neutral-400 border-neutral-800";
                              if (e.concepto.includes('[GASTO]')) {
                                colorClass = "bg-red-500/5 text-red-400 border-red-500/10";
                              } else if (e.concepto.includes('[ENTREGA EFECTIVO]')) {
                                colorClass = "bg-emerald-500/5 text-emerald-400 border-emerald-500/10";
                              } else if (e.concepto.includes('[PAGO EMPLEADO]')) {
                                colorClass = "bg-sky-500/5 text-sky-400 border-sky-500/10";
                              }

                              return (
                                <div key={index} className={`p-2.5 rounded-xl border text-[11px] font-mono space-y-1 ${colorClass}`}>
                                  <div className="flex justify-between items-start gap-2">
                                    <span className="font-bold leading-tight break-words">{e.concepto}</span>
                                    <span className="font-extrabold shrink-0">-${e.monto.toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[9px] text-neutral-500">
                                    <span>Hora: {e.hora}</span>
                                    <span>Por: {e.autorizadoPor}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Historial rápido de días previos */}
                {ventas.filter(v => v.fecha !== new Date().toISOString().split('T')[0]).length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-neutral-850">
                    <span className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider block">Historial de Cierres Previos</span>
                    <div className="space-y-2 max-h-24 overflow-y-auto pr-1">
                      {ventas.filter(v => v.fecha !== new Date().toISOString().split('T')[0]).map((v, idx) => (
                        <div key={idx} className="bg-neutral-900/50 border border-neutral-850 p-2 rounded-xl text-[10px] font-mono flex justify-between items-center">
                          <span className="text-neutral-400 font-bold">{v.fecha}</span>
                          <div className="text-right">
                            <span className="text-neutral-300 block">Base: ${v.montoApertura.toLocaleString()}</span>
                            <span className="text-emerald-500 block">Ventas: ${(v.totalVentas || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VISTA 4: ROL COCINA (KitchenMonitor Incorporado)            */}
        {/* ========================================================== */}
        {activeRoleView === 'cocina' && (
          <div className="pointer-events-auto">
            <KitchenMonitor />
          </div>
        )}

        {/* ========================================================== */}
        {/* VISTA 5: ROL ALMACÉN / INVENTARIO                          */}
        {/* ========================================================== */}
        {activeRoleView === 'inventario' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-neutral-950 border border-neutral-850 p-6 rounded-3xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                    <Package className="w-5 h-5 text-amber-500" />
                    MÓDULO DE INVENTARIO & INSUMOS FISICOS
                  </h2>
                  <p className="text-neutral-400 text-xs">
                    Registro de stock en despensa, alertas de stock mínimo para evitar paros de parrilla.
                  </p>
                </div>
                
                {inventario.length === 0 && (
                  <button
                    onClick={handleSeedMockData}
                    className="px-4 py-2 bg-neutral-850 hover:bg-neutral-800 text-xs font-semibold rounded-xl"
                  >
                    Cargar Catalogo de Hamburguesería
                  </button>
                )}
              </div>

              {/* Registro Form Insumo */}
              <form onSubmit={handleCrearInsumo} className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1">Nombre del Componente</label>
                  <input
                    type="text"
                    required
                    value={nuevoInsumoNombre}
                    onChange={(e) => setNuevoInsumoNombre(e.target.value)}
                    placeholder="Ej. Salchicha de Ternera"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block mb-1">Cantidad / Unidad</label>
                  <div className="flex gap-1 bg-neutral-950 border border-neutral-800 rounded-xl p-1">
                    <input
                      type="number"
                      value={nuevoInsumoStock}
                      onChange={(e) => setNuevoInsumoStock(Number(e.target.value))}
                      className="w-1/2 bg-transparent text-white text-xs text-center focus:outline-none"
                    />
                    <input
                      type="text"
                      value={nuevoInsumoUnidad}
                      onChange={(e) => setNuevoInsumoUnidad(e.target.value)}
                      placeholder="un"
                      className="w-1/2 bg-transparent text-white text-xs text-center focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer"
                >
                  Guardar Insumo
                </button>
              </form>

              {/* Tabla de Componentes */}
              <div className="border border-neutral-850 rounded-2xl overflow-hidden bg-neutral-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-900 text-neutral-400 uppercase tracking-widest text-[9px] border-b border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Insumo</th>
                      <th className="px-4 py-3 text-center">Unidad</th>
                      <th className="px-4 py-3 text-center">Stock Mínimo Alerta</th>
                      <th className="px-4 py-3 text-center">Stock Actual</th>
                      <th className="px-4 py-3 text-right">Ajuste Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900">
                    {inventario.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-neutral-600">No hay existencias guardadas en base de datos.</td>
                      </tr>
                    ) : (
                      inventario.map((item) => {
                        const isLow = item.stock <= item.stockMinimo;
                        return (
                          <tr key={item.id} className="hover:bg-neutral-900/40">
                            <td className="px-4 py-3 font-bold text-white">{item.nombre}</td>
                            <td className="px-4 py-3 text-center text-neutral-400">{item.unidad}</td>
                            <td className="px-4 py-3 text-center text-neutral-400 font-mono">{item.stockMinimo}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2.5 py-1 rounded-full font-mono font-bold leading-none ${
                                isLow ? 'bg-red-500/15 text-red-500 border border-red-500/20' : 'bg-neutral-900 text-neutral-300'
                              }`}>
                                {item.stock} {item.unidad.slice(0, 3)} {isLow && '⚠️ BAJO'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => handleModifyStock(item.id!, -10)}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded font-black text-xs text-neutral-400 hover:text-white"
                                >
                                  -10
                                </button>
                                <button
                                  onClick={() => handleModifyStock(item.id!, -1)}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded font-black text-xs text-neutral-400 hover:text-white"
                                >
                                  -1
                                </button>
                                <button
                                  onClick={() => handleModifyStock(item.id!, 1)}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded font-black text-xs text-neutral-400 hover:text-white"
                                >
                                  +1
                                </button>
                                <button
                                  onClick={() => handleModifyStock(item.id!, 10)}
                                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded font-black text-xs text-neutral-400 hover:text-white"
                                >
                                  +10
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* MODAL DE PARSEO DE COMANDAS INTELIGENTE IA */}
      <ModalPedidoIA 
        isOpen={isModalIAOpen}
        onClose={() => setIsModalIAOpen(false)}
      />

      {/* MODAL DE GESTIÓN DE ROLES DE USUARIOS */}
      <ModalAdminUsuarios
        isOpen={isModalUsersOpen}
        onClose={() => setIsModalUsersOpen(false)}
      />

      {/* MODAL DETALLADO DE COMANDA EN MODO LECTURA */}
      <AnimatePresence>
        {detailPedidoLectura && (() => {
          const ped = detailPedidoLectura;
          
          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 pointer-events-auto"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
              >
                
                {/* Header */}
                <div className="p-6 border-b border-neutral-850 bg-neutral-950/40 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-500">
                      <ChefHat className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        DETALLE DEL PEDIDO
                      </h3>
                      <p className="text-[11px] text-neutral-500 font-mono mt-0.5">ID del Registro: {ped.id}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDetailPedidoLectura(null)}
                    className="p-1.5 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-full transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Contenido (Scrollable) */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  
                  {/* Banner de Estado de Comanda */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-neutral-950 rounded-2xl border border-neutral-850 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Ubicación / Mesa</span>
                      <span className="text-lg font-extrabold text-amber-500 flex items-center gap-1.5">
                        Mesa {ped.mesa}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Estado de Comanda</span>
                      <span className={`inline-flex px-3 py-1 rounded-full font-black text-xs uppercase ${
                        ped.estado === 'pendiente' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        ped.estado === 'en_proceso' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 animate-pulse' :
                        ped.estado === 'terminado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        ped.estado === 'entregado' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {ped.estado === 'pendiente' ? 'En cola' : ped.estado === 'en_proceso' ? 'En Parrilla' : ped.estado === 'terminado' ? '¡Listo para Entrega!' : ped.estado === 'entregado' ? 'Entregado' : 'Cancelado'}
                      </span>
                    </div>
                  </div>

                  {/* Metadatos Rápidos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-850/60 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold uppercase block leading-none mb-1">Mesero Responsable</span>
                        <span className="text-xs font-semibold text-neutral-300">{ped.meseroName || 'Asistente Sabor York'}</span>
                      </div>
                    </div>

                    <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-850/60 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 font-bold uppercase block leading-none mb-1">Estado de Pago</span>
                        <span className={`text-xs font-bold ${ped.pagado ? 'text-emerald-400' : 'text-amber-500'}`}>
                          {ped.pagado ? '✓ COBRADO' : '⚠️ COBRO PENDIENTE'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Productos Solicitados con Imágenes y Especificaciones */}
                  <div className="space-y-3">
                    <span className="text-[10px] text-neutral-400 font-black uppercase tracking-wider block">Platos en el Pedido</span>
                    <div className="space-y-3">
                      {ped.productos?.map((prod, idx) => {
                        // Buscar el producto en el catálogo para obtener la imagen y descripción
                        const catalogItem = appProductos.find(p => p.id === prod.id || p.nombre === prod.nombre);
                        const tieneImagen = catalogItem && catalogItem.imagen;
                        
                        return (
                          <div key={idx} className="bg-neutral-950/60 p-4 rounded-2xl border border-neutral-850/80 flex flex-col sm:flex-row gap-4 items-start sm:items-center text-xs">
                            {/* Imagen del Producto */}
                            {tieneImagen ? (
                              <img 
                                src={catalogItem.imagen} 
                                alt={prod.nombre} 
                                className="w-16 h-16 object-cover rounded-xl border border-neutral-800 shrink-0 shadow-lg"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-16 h-16 bg-neutral-900 border border-neutral-850 rounded-xl flex items-center justify-center text-neutral-600 shrink-0 shadow-inner">
                                <ChefHat className="w-7 h-7 stroke-[1.5]" />
                              </div>
                            )}

                            {/* Nombre, Cantidades, Precios y Notas */}
                            <div className="flex-1 space-y-1">
                              <div className="flex justify-between items-baseline gap-2">
                                <span className="font-bold text-white text-sm">{prod.nombre}</span>
                                <span className="font-mono text-neutral-300 font-bold bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-[11px]">
                                  ${(prod.precio * prod.cantidad).toLocaleString()}
                                </span>
                              </div>
                              
                              <div className="text-neutral-400 text-[11px] flex items-center gap-1.5 font-mono">
                                <span className="text-amber-500 font-bold">{prod.cantidad} unidad(es)</span>
                                <span className="text-neutral-600">•</span>
                                <span>${prod.precio.toLocaleString()} c/u</span>
                              </div>

                              {/* Especificaciones / Notas de Alergia / Modificaciones unitarias */}
                              {prod.notas && (
                                <div className="mt-2 p-2 bg-red-400/10 border border-red-500/20 rounded-lg text-red-400 text-[11px] leading-tight font-medium flex items-start gap-1.5">
                                  <span className="text-red-500 shrink-0 font-bold">Nota:</span>
                                  <span>{prod.notas}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notas globales de preparación en cocina */}
                  {ped.descripcion && (
                    <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-2">
                      <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                        Instrucciones o Notas de Cocina
                      </span>
                      <div className="bg-neutral-900/60 border border-neutral-850 rounded-xl p-3 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
                        {ped.descripcion}
                      </div>
                    </div>
                  )}

                </div>

                {/* Footer del Modal (Sólo Lectura) */}
                <div className="p-6 border-t border-neutral-850 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                  <div className="flex items-baseline gap-2 self-start sm:self-center">
                    <span className="text-xs text-neutral-500 font-bold uppercase">VALOR TOTAL:</span>
                    <span className="font-mono text-xl font-black text-amber-500">${ped.total.toLocaleString()} COP</span>
                  </div>
                  
                  <button
                    onClick={() => setDetailPedidoLectura(null)}
                    className="w-full sm:w-auto px-6 py-2.5 bg-neutral-850 hover:bg-neutral-800 text-white font-bold rounded-xl text-xs active:scale-95 transition-all cursor-pointer text-center"
                  >
                    Cerrar Detalle
                  </button>
                </div>

              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL DE GESTIÓN Y DETALLE DE COMANDA HISTÓRICA */}
      {selectedPedidoId && (() => {
        const ped = pedidos.find(p => p.id === selectedPedidoId);
        if (!ped) return null;
        
        const isLocked = ped.pagado && ped.estado === 'entregado';
        const isAdmin = userProfile?.rol === 'admin';

        return (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-opacity">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl relative transition-transform transform scale-100">
              
              {/* Header */}
              <div className="p-6 border-b border-neutral-800 bg-neutral-950/40 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-500" />
                    DETALLES DE COMANDA HISTÓRICA
                  </h3>
                  <p className="text-[11px] text-neutral-500 font-mono mt-0.5">ID del Registro: {ped.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedPedidoId(null)}
                  className="p-1.5 hover:bg-neutral-850 text-neutral-400 hover:text-white rounded-full transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                
                {/* Alerta de bloqueo */}
                {isLocked && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <div>
                      <span className="font-bold block">Historial No Modificable</span>
                      Esta comanda ya ha sido **entregada** y **pagada**. Por seguridad y consistencia de contabilidad, no se permite su edición o eliminación.
                    </div>
                  </div>
                )}

                {/* Restricción de lectura para no administradores */}
                {!isAdmin && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-500 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <span className="font-bold block">Vista de Sólo Lectura (Acceso Limitado)</span>
                      Únicamente los **Administradores** pueden actualizar estados o borrar registros de este panel. Como {userProfile?.rol || 'colaborador'}, sólo puedes auditar los detalles.
                    </div>
                  </div>
                )}

                {/* Información Básica */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-850">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Ubicación / Mesa</span>
                    <span className="text-sm font-extrabold text-white">Mesa {ped.mesa}</span>
                  </div>
                  <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-850">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase block">Registrado por</span>
                    <span className="text-xs font-semibold text-neutral-300">{ped.meseroName || 'Asistente Sabor York'}</span>
                  </div>
                </div>

                {/* Lista de productos con opción de eliminar individuales */}
                <div className="space-y-2">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Productos Solicitados</span>
                  <div className="space-y-2">
                    {ped.productos?.map((prod, idx) => (
                      <div key={idx} className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-850 flex justify-between items-center text-xs">
                        <div className="space-y-0.5 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-amber-500 font-mono font-bold">{prod.cantidad}x</span>
                            <span className="font-bold text-white text-sm">{prod.nombre}</span>
                          </div>
                          {prod.notas && (
                            <span className="text-red-400 text-[11px] italic block leading-tight">
                              Sin ingredientes: {prod.notas}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-neutral-300 font-bold bg-neutral-900 border border-neutral-800 px-2 py-1 rounded">
                            ${(prod.precio * prod.cantidad).toLocaleString()}
                          </span>
                          {/* Botón para eliminar item individual de la comanda */}
                          {isAdmin && !isLocked && (
                            <button
                              onClick={() => {
                                handleEliminarItemDelPedido(ped.id!, idx);
                              }}
                              className="p-1.5 bg-neutral-900 border border-neutral-800 hover:bg-red-950/40 hover:border-red-900/40 text-neutral-500 hover:text-red-500 rounded-xl transition-all cursor-pointer active:scale-95"
                              title="Eliminar este de la comanda"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center bg-neutral-950 p-4 rounded-2xl border border-neutral-850">
                  <span className="text-xs font-bold text-neutral-400 uppercase">Monto Neto a Cobrar</span>
                  <span className="font-mono text-xl font-black text-amber-500">${ped.total.toLocaleString()}</span>
                </div>

                {/* Métodos de Pago */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-950 p-3 rounded-2xl border border-neutral-850">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Estado Contable</span>
                    <span className={`font-bold ${ped.pagado ? 'text-emerald-400' : 'text-amber-500'}`}>
                      {ped.pagado ? '✓ COBRADO EXITOSO' : '⚠️ COBRO PENDIENTE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold block">Medio de Pago</span>
                    <span className="text-neutral-300 capitalize font-mono">{ped.metodoPago || 'No definido'}</span>
                  </div>
                </div>

                {/* Visualización de Descripción en Modo de Sólo Lectura o una vez entregado/locked */}
                {((!isAdmin || isLocked) && ped.descripcion) && (
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-2">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                      Descripción del Pedido
                    </span>
                    <div className="bg-neutral-900/60 border border-neutral-900 rounded-xl p-3 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
                      {ped.descripcion}
                    </div>
                  </div>
                )}

                {/* Gestión de Estados */}
                {isAdmin && !isLocked && (
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-4">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                      PANEL DE CONTROL DE ESTADOS (ADMINISTRATOR)
                    </span>

                    {/* Recuadro de Descripción */}
                    <div className="space-y-1">
                      <label className="text-[11px] text-neutral-400 font-extrabold uppercase tracking-wider block flex items-center gap-1.5 text-neutral-300">
                        <span>Descripción</span>
                        <span className="text-[9px] text-amber-500 font-mono font-normal normal-case">(Autoguardado en la nube)</span>
                      </label>
                      <textarea
                        value={orderDescripcion}
                        onChange={(e) => {
                          setOrderDescripcion(e.target.value);
                          handleSavePedidoDescripcion(ped.id!, e.target.value);
                        }}
                        rows={2}
                        placeholder="Escribe aquí observaciones, comentarios de cocina, especificaciones del cliente..."
                        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs rounded-xl p-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-neutral-600 resize-none font-sans"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Dropdown de Estado */}
                      <div className="flex-1">
                        <label className="text-[10px] text-neutral-500 font-bold block mb-1">Cambiar Estado de Preparación</label>
                        <select
                          value={ped.estado}
                          onChange={(e) => {
                            handleUpdatePedidoEstado(ped.id!, e.target.value as any);
                          }}
                          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-all cursor-pointer font-semibold"
                        >
                          <option value="pendiente">Pendiente (En Cola)</option>
                          <option value="en_proceso">En Proceso (En Cocina)</option>
                          <option value="terminado">Terminado (Listo)</option>
                          <option value="entregado">Entregado</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </div>

                      {/* Transición directa rápida a "Entregado" */}
                      {ped.estado !== 'entregado' && (
                        <div className="flex flex-col justify-end">
                          <button
                            onClick={() => {
                              handleUpdatePedidoEstado(ped.id!, 'entregado');
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs py-1.5 px-3 rounded-xl active:scale-95 transition-all text-center cursor-pointer flex items-center justify-center gap-1 min-h-[34px]"
                          >
                            Entregar Directamente
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Botón de eliminación final (Anular) de comanda */}
              {isAdmin && !isLocked && (
                <div className="p-4 border-t border-neutral-800 bg-neutral-950/40 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      handleEliminarPedido(ped.id!);
                    }}
                    className="px-4 py-2 bg-red-650/20 hover:bg-red-600 text-red-500 font-bold text-xs rounded-xl border border-red-700/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Anular Comanda Completa
                  </button>
                </div>
              )}

            </div>
          </div>
        );
      })()}

      {/* ========================================================== */}
      {/* MODAL 1: ARQUEO FÍSICO POR DENOMINACIONES DE COLOMBIA      */}
      {/* ========================================================== */}
      <AnimatePresence>
        {isArqueoModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-850 flex justify-between items-center bg-neutral-950">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Coins className="w-5 h-5 text-emerald-400" />
                    Arqueo de Denominaciones Físicas
                  </h3>
                  <p className="text-neutral-500 text-[10px] uppercase tracking-widest mt-0.5">Sabor York - Cuadre Diario Efectivo</p>
                </div>
                <button
                  onClick={() => setIsArqueoModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Contenido / Denominaciones */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Billetes */}
                <div className="space-y-3">
                  <h4 className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest border-b border-neutral-850 pb-1">💵 Billetes de Circulación Nacional</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'B_100k', label: '$100.000 COP', val: 100000 },
                      { key: 'B_50k', label: '$50.000 COP', val: 50000 },
                      { key: 'B_20k', label: '$20.000 COP', val: 20000 },
                      { key: 'B_10k', label: '$10.000 COP', val: 10000 },
                      { key: 'B_5k', label: '$5.000 COP', val: 5000 },
                      { key: 'B_2k', label: '$2.000 COP', val: 2000 },
                    ].map((den) => (
                      <div key={den.key} className="flex items-center justify-between bg-neutral-950 p-3 rounded-2xl border border-neutral-850">
                        <div className="text-left">
                          <span className="font-extrabold text-white text-xs block">{den.label}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">Subtotal: ${( (denominaciones[den.key] || 0) * den.val ).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDenominaciones(p => ({ ...p, [den.key]: Math.max(0, (p[den.key] || 0) - 1) }))}
                            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 font-black text-xs hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={denominaciones[den.key] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDenominaciones(p => ({ ...p, [den.key]: val }));
                            }}
                            className="w-12 bg-neutral-900 border border-neutral-800 rounded-lg py-1 text-center text-xs text-white font-mono"
                            placeholder="0"
                          />
                          <button
                            type="button"
                            onClick={() => setDenominaciones(p => ({ ...p, [den.key]: (p[den.key] || 0) + 1 }))}
                            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 font-black text-xs hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monedas */}
                <div className="space-y-3">
                  <h4 className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest border-b border-neutral-850 pb-1">🪙 Monedas Metálicas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { key: 'M_1k', label: '$1.000 COP', val: 1000 },
                      { key: 'M_500', label: '$500 COP', val: 500 },
                      { key: 'M_200', label: '$200 COP', val: 200 },
                      { key: 'M_100', label: '$100 COP', val: 100 },
                      { key: 'M_50', label: '$50 COP', val: 50 },
                    ].map((den) => (
                      <div key={den.key} className="flex items-center justify-between bg-neutral-950 p-3 rounded-2xl border border-neutral-850">
                        <div className="text-left">
                          <span className="font-extrabold text-white text-xs block">{den.label}</span>
                          <span className="text-[10px] text-neutral-500 font-mono">Subtotal: ${( (denominaciones[den.key] || 0) * den.val ).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDenominaciones(p => ({ ...p, [den.key]: Math.max(0, (p[den.key] || 0) - 1) }))}
                            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 font-black text-xs hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={denominaciones[den.key] || ''}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setDenominaciones(p => ({ ...p, [den.key]: val }));
                            }}
                            className="w-12 bg-neutral-900 border border-neutral-800 rounded-lg py-1 text-center text-xs text-white font-mono"
                            placeholder="0"
                          />
                          <button
                            type="button"
                            onClick={() => setDenominaciones(p => ({ ...p, [den.key]: (p[den.key] || 0) + 1 }))}
                            className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 font-black text-xs hover:text-white flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vales y Bonos */}
                <div className="space-y-3">
                  <h4 className="text-[10px] text-sky-400 font-extrabold uppercase tracking-widest border-b border-neutral-850 pb-1">📄 Vales, Bonos y Garantías</h4>
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-400">Total en Vales / Documentos de Soporte</span>
                      <input
                        type="number"
                        value={denominaciones['Bono'] || ''}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setDenominaciones(p => ({ ...p, Bono: val }));
                        }}
                        className="w-32 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-1.5 text-right text-xs text-white font-mono"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer de Resumen y Acciones */}
              <div className="p-6 bg-neutral-950 border-t border-neutral-850 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-neutral-900/60 p-4 rounded-2xl border border-neutral-850">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">Total Arqueado Físicamente</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      ${(() => {
                        const total = 
                          (denominaciones['B_100k'] || 0) * 100000 +
                          (denominaciones['B_50k'] || 0) * 50000 +
                          (denominaciones['B_20k'] || 0) * 20000 +
                          (denominaciones['B_10k'] || 0) * 10000 +
                          (denominaciones['B_5k'] || 0) * 5000 +
                          (denominaciones['B_2k'] || 0) * 2000 +
                          (denominaciones['M_1k'] || 0) * 1000 +
                          (denominaciones['M_500'] || 0) * 500 +
                          (denominaciones['M_200'] || 0) * 200 +
                          (denominaciones['M_100'] || 0) * 100 +
                          (denominaciones['M_50'] || 0) * 50 +
                          (denominaciones['Bono'] || 0);
                        return total.toLocaleString();
                      })()} COP
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDenominaciones({
                        'B_100k': 0, 'B_50k': 0, 'B_20k': 0, 'B_10k': 0, 'B_5k': 0, 'B_2k': 0,
                        'M_1k': 0, 'M_500': 0, 'M_200': 0, 'M_100': 0, 'M_50': 0, 'Bono': 0
                      })}
                      className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                    >
                      Poner a Cero
                    </button>
                    <button
                      onClick={() => setIsArqueoModalOpen(false)}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl active:scale-95 transition-all cursor-pointer shadow-md"
                    >
                      Guardar Conteo
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================== */}
      {/* MODAL 2: EGRESOS Y RETIROS DE DINERO CATEGORIZADOS         */}
      {/* ========================================================== */}
      <AnimatePresence>
        {isEgresoModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-neutral-850 flex justify-between items-center bg-neutral-950">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {egresoModalType === 'gasto' && '🔴 REGISTRAR GASTO DE OPERACIÓN'}
                    {egresoModalType === 'entrega' && '💸 REMISIÓN / ENTREGA DE EFECTIVO'}
                    {egresoModalType === 'pago_empleado' && '👤 PAGO DE NÓMINA / ADELANTO'}
                    {egresoModalType === 'otros' && '📦 OTROS EGRESOS DE CAJA'}
                  </h3>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Sabor York - Gestión de Flujos de Efectivo</p>
                </div>
                <button
                  onClick={() => setIsEgresoModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Formulario */}
              <div className="p-6 space-y-4">
                {/* Concepto */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase block">Concepto del Egreso</label>
                  <input
                    type="text"
                    value={egresoConcepto}
                    onChange={(e) => setEgresoConcepto(e.target.value)}
                    placeholder={
                      egresoModalType === 'gasto' ? 'Ej: Compra de tomate, cilantro y servilletas' :
                      egresoModalType === 'entrega' ? 'Ej: Retiro parcial de ventas de la tarde' :
                      egresoModalType === 'pago_empleado' ? 'Ej: Adelanto semanal de nómina' :
                      'Ej: Reparación de bombilla o tubería de cocina'
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                  />
                </div>

                {/* Destinatario (Para Entregas y Nóminas) */}
                {(egresoModalType === 'entrega' || egresoModalType === 'pago_empleado') && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">
                      {egresoModalType === 'entrega' ? 'Quién Recibe / Remitente' : 'Empleado Beneficiario'}
                    </label>
                    <input
                      type="text"
                      value={egresoDestinatario}
                      onChange={(e) => setEgresoDestinatario(e.target.value)}
                      placeholder="Ej. Supervisor Carlos Andres / Juan Parrillero"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>
                )}

                {/* Monto de Salida */}
                {egresoModalType !== 'entrega' ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase block">Monto a Retirar (Pesos COP)</label>
                    <input
                      type="number"
                      value={egresoMonto || ''}
                      onChange={(e) => setEgresoMonto(Number(e.target.value))}
                      placeholder="Ej. 15000"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                ) : (
                  <div className="space-y-3 bg-neutral-950 p-4 rounded-2xl border border-neutral-850">
                    <div className="flex justify-between items-center pb-2 border-b border-neutral-850">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block">Billetes / Monedas a Retirar</span>
                      <span className="text-xs font-black text-emerald-400 font-mono">
                        Total calculado: ${(() => {
                          const deliveryTotal = 
                            (deliveryDenominaciones['B_100k'] || 0) * 100000 +
                            (deliveryDenominaciones['B_50k'] || 0) * 50000 +
                            (deliveryDenominaciones['B_20k'] || 0) * 20000 +
                            (deliveryDenominaciones['B_10k'] || 0) * 10000 +
                            (deliveryDenominaciones['B_5k'] || 0) * 5000 +
                            (deliveryDenominaciones['B_2k'] || 0) * 2000 +
                            (deliveryDenominaciones['M_1k'] || 0) * 1000 +
                            (deliveryDenominaciones['M_500'] || 0) * 500 +
                            (deliveryDenominaciones['M_200'] || 0) * 200 +
                            (deliveryDenominaciones['M_100'] || 0) * 100 +
                            (deliveryDenominaciones['M_50'] || 0) * 50 +
                            (deliveryDenominaciones['Bono'] || 0);
                          return deliveryTotal.toLocaleString();
                        })()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                      {[
                        { key: 'B_100k', label: 'Billete $100k', stock: denominaciones['B_100k'] || 0 },
                        { key: 'B_50k', label: 'Billete $50k', stock: denominaciones['B_50k'] || 0 },
                        { key: 'B_20k', label: 'Billete $20k', stock: denominaciones['B_20k'] || 0 },
                        { key: 'B_10k', label: 'Billete $10k', stock: denominaciones['B_10k'] || 0 },
                        { key: 'B_5k', label: 'Billete $5k', stock: denominaciones['B_5k'] || 0 },
                        { key: 'B_2k', label: 'Billete $2k', stock: denominaciones['B_2k'] || 0 },
                        { key: 'M_1k', label: 'Moneda $1k', stock: denominaciones['M_1k'] || 0 },
                        { key: 'M_500', label: 'Moneda $500', stock: denominaciones['M_500'] || 0 },
                        { key: 'M_200', label: 'Moneda $200', stock: denominaciones['M_200'] || 0 },
                        { key: 'M_100', label: 'Moneda $100', stock: denominaciones['M_100'] || 0 },
                        { key: 'M_50', label: 'Moneda $50', stock: denominaciones['M_50'] || 0 },
                      ].map((item) => (
                        <div key={item.key} className="flex justify-between items-center text-[11px] bg-neutral-900 p-2 rounded-xl border border-neutral-850">
                          <div>
                            <span className="text-white font-bold block">{item.label}</span>
                            <span className="text-[9px] text-neutral-500 font-mono">Stock en Caja: {item.stock}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setDeliveryDenominaciones(p => ({ ...p, [item.key]: Math.max(0, (p[item.key] || 0) - 1) }))}
                              className="w-5 h-5 bg-neutral-950 text-neutral-400 font-bold rounded flex items-center justify-center cursor-pointer active:scale-95 text-[10px]"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-white font-bold font-mono text-[11px]">{deliveryDenominaciones[item.key] || 0}</span>
                            <button
                              type="button"
                              onClick={() => setDeliveryDenominaciones(p => ({ ...p, [item.key]: Math.min(item.stock, (p[item.key] || 0) + 1) }))}
                              className="w-5 h-5 bg-neutral-950 text-neutral-400 font-bold rounded flex items-center justify-center cursor-pointer active:scale-95 text-[10px]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="p-6 bg-neutral-950 border-t border-neutral-850 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEgresoModalOpen(false)}
                  className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-neutral-400 hover:text-white font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (egresoModalType === 'entrega') {
                      // Sumamos las denominaciones seleccionadas para entrega de dinero
                      const deliveryTotal = 
                        (deliveryDenominaciones['B_100k'] || 0) * 100000 +
                        (deliveryDenominaciones['B_50k'] || 0) * 50000 +
                        (deliveryDenominaciones['B_20k'] || 0) * 20000 +
                        (deliveryDenominaciones['B_10k'] || 0) * 10000 +
                        (deliveryDenominaciones['B_5k'] || 0) * 5000 +
                        (deliveryDenominaciones['B_2k'] || 0) * 2000 +
                        (deliveryDenominaciones['M_1k'] || 0) * 1000 +
                        (deliveryDenominaciones['M_500'] || 0) * 500 +
                        (deliveryDenominaciones['M_200'] || 0) * 200 +
                        (deliveryDenominaciones['M_100'] || 0) * 100 +
                        (deliveryDenominaciones['M_50'] || 0) * 50 +
                        (deliveryDenominaciones['Bono'] || 0);

                      handleAddEgresoCustom('entrega', egresoConcepto, deliveryTotal, egresoDestinatario, true);
                    } else {
                      handleAddEgresoCustom(egresoModalType, egresoConcepto, egresoMonto, egresoDestinatario);
                    }
                  }}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  Confirmar Salida
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* --- MODAL DE RESUMEN ANALÍTICO DE VENTAS --- */}
        {showSalesAnalyticsModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-neutral-950 border border-neutral-800 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col my-8 max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-950 px-6 py-4 border-b border-neutral-850 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                      Resumen Analítico de Ventas
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      Rango: <span className="text-white">{filtroFechaInicio || 'Inicio de los tiempos'}</span> al <span className="text-white">{filtroFechaFin || 'Hoy'}</span> — {filteredPedidosPagados.length} Comprobantes Emitidos
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowSalesAnalyticsModal(false);
                    setHoveredDatePoint(null);
                  }}
                  className="p-2 hover:bg-neutral-900 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="overflow-y-auto p-6 space-y-6">

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Ventas Brutas */}
                  <div className="bg-neutral-900/50 border border-neutral-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Ventas Brutas</span>
                      <Coins className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-black text-white font-mono">${totalGrossSales.toLocaleString()}</span>
                      <div className="text-[9px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                        <span>↑ 100% Bruto</span>
                      </div>
                    </div>
                  </div>

                  {/* Reembolsos */}
                  <div className="bg-neutral-900/50 border border-neutral-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Reembolsos</span>
                      <MinusCircle className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-black text-neutral-400 font-mono">$0</span>
                      <div className="text-[9px] text-neutral-500 font-mono mt-1">
                        <span>0% Retornos</span>
                      </div>
                    </div>
                  </div>

                  {/* Descuentos */}
                  <div className="bg-neutral-900/50 border border-neutral-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Descuentos</span>
                      <Percent className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-black text-neutral-400 font-mono">$0</span>
                      <div className="text-[9px] text-neutral-500 font-mono mt-1">
                        <span>0% Descuentos</span>
                      </div>
                    </div>
                  </div>

                  {/* Ventas Netas */}
                  <div className="bg-neutral-900/50 border border-neutral-850 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Ventas Netas</span>
                      <DollarSign className="w-4 h-4 text-sky-400" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-black text-white font-mono">${totalGrossSales.toLocaleString()}</span>
                      <div className="text-[9px] text-sky-400 font-mono mt-1">
                        <span>100% Netas</span>
                      </div>
                    </div>
                  </div>

                  {/* Beneficio Bruto Estimado */}
                  <div className="bg-gradient-to-br from-emerald-950/20 to-neutral-900 border border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Margen Estimado</span>
                      <Award className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="mt-2">
                      <span className="text-lg font-black text-emerald-400 font-mono">
                        ${(totalGrossSales * (1 - customCogsPercent / 100)).toLocaleString()}
                      </span>
                      <div className="text-[9px] text-neutral-400 font-mono mt-1">
                        <span>{100 - customCogsPercent}% Utilidad Est.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COGS Percentage Control */}
                <div className="bg-neutral-900/30 border border-neutral-850 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Settings className="w-3.5 h-3.5 text-neutral-400" />
                      Porcentaje de Costo de Insumos (COGS)
                    </h4>
                    <p className="text-[10px] text-neutral-400">
                      Modifica el costo promedio de preparación de los productos para estimar la ganancia neta. Los restaurantes típicamente operan entre el 35% y el 45% de costo.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 font-mono text-xs">
                    <span className="text-neutral-400 font-bold">Costo: {customCogsPercent}%</span>
                    <input
                      type="range"
                      min="10"
                      max="80"
                      step="5"
                      value={customCogsPercent}
                      onChange={(e) => setCustomCogsPercent(Number(e.target.value))}
                      className="w-32 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-emerald-400 font-bold">Ganancia: {100 - customCogsPercent}%</span>
                  </div>
                </div>

                {/* Graph & Tooltip Container */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* The Chart (SVG Line Chart with glowing area fill) */}
                  <div className="lg:col-span-8 bg-neutral-900/30 border border-neutral-850 rounded-2xl p-5 space-y-4 flex flex-col">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-emerald-400" />
                        Gráfico de Facturación Diaria
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono">
                        Eje X: Fechas | Eje Y: Ventas Totales
                      </span>
                    </div>

                    {salesByDateList.length === 0 ? (
                      <div className="flex-1 min-h-[220px] flex flex-col items-center justify-center text-center text-neutral-600 font-mono text-xs">
                        No hay datos en el rango seleccionado para trazar la gráfica.
                      </div>
                    ) : (
                      <div className="relative flex-1">
                        {/* SVG Chart */}
                        <svg viewBox="0 0 600 240" className="w-full h-auto overflow-visible select-none">
                          <defs>
                            {/* Area Gradient */}
                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>

                          {/* Grid Lines */}
                          {(() => {
                            const maxVal = Math.max(...salesByDateList.map(d => d.total), 10000) * 1.15;
                            return [0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                              const y = 30 + 165 - ratio * 165;
                              const value = ratio * maxVal;
                              return (
                                <g key={idx} className="opacity-45">
                                  <line
                                    x1="60"
                                    y1={y}
                                    x2="560"
                                    y2={y}
                                    stroke="#262626"
                                    strokeDasharray="4 4"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x="52"
                                    y={y + 3}
                                    fill="#737373"
                                    fontSize="8"
                                    fontFamily="monospace"
                                    textAnchor="end"
                                  >
                                    ${Math.round(value / 1000)}k
                                  </text>
                                </g>
                              );
                            });
                          })()}

                          {/* Area Fill */}
                          {(() => {
                            const maxVal = Math.max(...salesByDateList.map(d => d.total), 10000) * 1.15;
                            const coords = salesByDateList.map((d, i) => {
                              const x = salesByDateList.length <= 1 
                                ? 60 + 500 / 2
                                : 60 + (i / (salesByDateList.length - 1)) * 500;
                              const y = 30 + 165 - (d.total / maxVal) * 165;
                              return { x, y };
                            });

                            if (coords.length === 0) return null;
                            
                            let lineP = coords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ');
                            let fillP = '';
                            if (coords.length === 1) {
                              fillP = `M ${coords[0].x - 30} ${coords[0].y} L ${coords[0].x + 30} ${coords[0].y} L ${coords[0].x + 30} 195 L ${coords[0].x - 30} 195 Z`;
                            } else {
                              fillP = `M ${coords[0].x} 195 ${coords.map(c => `L ${c.x} ${c.y}`).join(' ')} L ${coords[coords.length - 1].x} 195 Z`;
                            }

                            return (
                              <>
                                <path d={fillP} fill="url(#chartGradient)" className="transition-all duration-300" />
                                <path d={lineP} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-300" />
                              </>
                            );
                          })()}

                          {/* Interactive Node Circles */}
                          {salesByDateList.map((d, i) => {
                            const maxVal = Math.max(...salesByDateList.map(item => item.total), 10000) * 1.15;
                            const x = salesByDateList.length <= 1 
                              ? 60 + 500 / 2
                              : 60 + (i / (salesByDateList.length - 1)) * 500;
                            const y = 30 + 165 - (d.total / maxVal) * 165;

                            const isHovered = hoveredDatePoint?.dateStr === d.dateStr;

                            return (
                              <g key={i} className="cursor-pointer">
                                {/* Invisible larger interactive touch target */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="16"
                                  fill="transparent"
                                  onMouseEnter={() => setHoveredDatePoint(d)}
                                />
                                {/* Pulsing stroke ring for hovered state */}
                                {isHovered && (
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="8"
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2"
                                    className="animate-ping"
                                  />
                                )}
                                {/* Core visible circle point */}
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={isHovered ? "5" : "3.5"}
                                  fill={isHovered ? "#34d399" : "#10b981"}
                                  stroke="#0a0a0a"
                                  strokeWidth="1.5"
                                  className="transition-all duration-150"
                                />
                                {/* X-axis Date Labels (Render every 1st, middle, and last to avoid text clutter) */}
                                {(i === 0 || i === salesByDateList.length - 1 || (salesByDateList.length > 5 && i === Math.floor(salesByDateList.length / 2))) && (
                                  <text
                                    x={x}
                                    y="215"
                                    fill="#737373"
                                    fontSize="8"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {d.dateStr.substring(5)}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>

                        {/* Interactive Tooltip HUD directly linked to hover state */}
                        {hoveredDatePoint && (
                          <div className="absolute top-2 right-2 bg-neutral-950/95 border border-emerald-500/20 px-3 py-2.5 rounded-xl space-y-1 shadow-xl max-w-[210px] z-10 transition-all">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black uppercase text-emerald-400 font-mono tracking-wider">{hoveredDatePoint.dateStr}</span>
                              <span className="text-[8px] bg-neutral-900 px-1 py-0.5 rounded text-neutral-400 font-mono">
                                {hoveredDatePoint.count} peds
                              </span>
                            </div>
                            <div className="text-xs font-black text-white font-mono flex justify-between gap-4">
                              <span>Total Ventas:</span>
                              <span>${hoveredDatePoint.total.toLocaleString()}</span>
                            </div>
                            <hr className="border-neutral-850 my-1" />
                            <div className="space-y-0.5 text-[9px] text-neutral-400 font-mono">
                              {hoveredDatePoint.efectivo > 0 && (
                                <div className="flex justify-between">
                                  <span>💵 Efectivo:</span>
                                  <span className="text-neutral-300">${hoveredDatePoint.efectivo.toLocaleString()}</span>
                                </div>
                              )}
                              {hoveredDatePoint.nequi > 0 && (
                                <div className="flex justify-between">
                                  <span>📱 Nequi:</span>
                                  <span className="text-cyan-400 font-extrabold drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]">${hoveredDatePoint.nequi.toLocaleString()}</span>
                                </div>
                              )}
                              {hoveredDatePoint.pse > 0 && (
                                <div className="flex justify-between">
                                  <span>🏦 PSE:</span>
                                  <span className="text-blue-400">${hoveredDatePoint.pse.toLocaleString()}</span>
                                </div>
                              )}
                              {hoveredDatePoint.datafono > 0 && (
                                <div className="flex justify-between">
                                  <span>💳 Datáfono:</span>
                                  <span className="text-pink-400">${hoveredDatePoint.datafono.toLocaleString()}</span>
                                </div>
                              )}
                              {hoveredDatePoint.transferencia > 0 && (
                                <div className="flex justify-between">
                                  <span>⇄ Transferencia:</span>
                                  <span className="text-sky-400">${hoveredDatePoint.transferencia.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick helper tip */}
                    <p className="text-[9px] text-neutral-500 font-mono italic text-center">
                      💡 Pasa el cursor sobre los puntos de la gráfica para ver el desglose detallado de los métodos de pago empleados cada día.
                    </p>
                  </div>

                  {/* Best Selling Products Breakdown */}
                  <div className="lg:col-span-4 bg-neutral-900/30 border border-neutral-850 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500 animate-bounce" />
                        Productos Más Vendidos
                      </span>
                      <p className="text-[9px] text-neutral-500 mt-1">
                        Clasificados por volumen de pedidos entregados y facturados en este rango de fechas.
                      </p>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-1 py-2 max-h-[180px]">
                      {topProductsList.length === 0 ? (
                        <div className="text-center py-8 text-neutral-600 font-mono text-xs">
                          Ningún producto vendido registrado en este período.
                        </div>
                      ) : (
                        topProductsList.slice(0, 5).map((p, idx) => {
                          const maxQty = Math.max(...topProductsList.map(item => item.qty), 1);
                          const percentage = Math.round((p.qty / maxQty) * 100);
                          
                          return (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-4 h-4 bg-amber-500/10 text-amber-500 font-bold font-mono text-[9px] flex items-center justify-center rounded">
                                    {idx + 1}
                                  </span>
                                  <span className="text-neutral-200 font-bold truncate max-w-[120px]">{p.name}</span>
                                </div>
                                <span className="text-neutral-400 font-mono text-[10px]">
                                  {p.qty} unid. | <strong className="text-emerald-400">${p.revenue.toLocaleString()}</strong>
                                </span>
                              </div>
                              <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-850">
                                <div
                                  style={{ width: `${percentage}%` }}
                                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Dynamic Fact */}
                    {topProductsList.length > 0 && (
                      <div className="bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-850 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="text-[9px] text-neutral-400">
                          El producto estrella es <strong className="text-white font-black">{topProductsList[0].name}</strong>, sumando un total de <span className="text-emerald-400 font-bold">{topProductsList[0].qty} unidades</span> y recaudando <strong className="text-emerald-400 font-mono">${topProductsList[0].revenue.toLocaleString()}</strong>.
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                {/* Detailed Table (as seen in image 2) */}
                <div className="space-y-3">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-4 h-4 text-neutral-400" />
                    Tabla de Desglose de Ventas por Día
                  </span>
                  
                  <div className="border border-neutral-850 rounded-2xl overflow-hidden bg-neutral-950">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-neutral-900 text-neutral-400 font-bold uppercase tracking-wider border-b border-neutral-850">
                            <th className="py-2.5 px-3 font-bold">Fecha</th>
                            <th className="py-2.5 px-3 font-mono text-right text-white">Ventas Brutas</th>
                            <th className="py-2.5 px-3 font-mono text-right text-emerald-400">Efectivo</th>
                            <th className="py-2.5 px-3 font-mono text-right text-cyan-400 font-extrabold drop-shadow-[0_0_4px_rgba(34,211,238,0.5)]">Nequi</th>
                            <th className="py-2.5 px-3 font-mono text-right text-blue-400 font-bold">PSE</th>
                            <th className="py-2.5 px-3 font-mono text-right text-pink-400 font-bold">Datáfono</th>
                            <th className="py-2.5 px-3 font-mono text-right text-sky-400 font-bold">Transferencia</th>
                            <th className="py-2.5 px-3 font-mono text-right text-red-400">Costo Est. ({customCogsPercent}%)</th>
                            <th className="py-2.5 px-3 font-mono text-right text-emerald-400 font-bold">Utilidad Est.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-850 font-mono text-neutral-300">
                          {salesByDateList.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-neutral-600">
                                Ningún comprobante en el rango seleccionado.
                              </td>
                            </tr>
                          ) : (
                            salesByDateList.map((day, idx) => {
                              const dayCogs = day.total * (customCogsPercent / 100);
                              const dayMargin = day.total - dayCogs;
                              return (
                                <tr key={idx} className="hover:bg-neutral-900/40 transition-colors">
                                  <td className="py-2 px-3 font-bold text-white">{day.dateStr}</td>
                                  <td className="py-2 px-3 text-right text-white font-bold">${day.total.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-emerald-500">${day.efectivo.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-cyan-400 font-bold drop-shadow-[0_0_4px_rgba(34,211,238,0.3)]">${day.nequi.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-blue-400">${day.pse.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-pink-400">${day.datafono.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-sky-400">${day.transferencia.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-red-400">-${dayCogs.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-right text-emerald-400 font-bold">${dayMargin.toLocaleString()}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {salesByDateList.length > 0 && (
                          <tfoot>
                            <tr className="bg-neutral-900/60 font-black border-t border-neutral-850 text-white text-[11px]">
                              <td className="py-3 px-3 uppercase text-neutral-400">Total Acumulado</td>
                              <td className="py-3 px-3 text-right font-mono">${totalGrossSales.toLocaleString()}</td>
                              <td className="py-3 px-3 text-right font-mono text-emerald-400">
                                ${salesByDateList.reduce((sum, d) => sum + d.efectivo, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-cyan-400 font-black drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                                ${salesByDateList.reduce((sum, d) => sum + d.nequi, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-blue-400 font-bold">
                                ${salesByDateList.reduce((sum, d) => sum + d.pse, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-pink-400 font-bold">
                                ${salesByDateList.reduce((sum, d) => sum + d.datafono, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-sky-400 font-bold">
                                ${salesByDateList.reduce((sum, d) => sum + d.transferencia, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-red-400">
                                -${(totalGrossSales * (customCogsPercent / 100)).toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-emerald-400">
                                ${(totalGrossSales * (1 - customCogsPercent / 100)).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-neutral-900 px-6 py-4 border-t border-neutral-850 flex justify-end shrink-0">
                <button
                  onClick={() => {
                    setShowSalesAnalyticsModal(false);
                    setHoveredDatePoint(null);
                  }}
                  className="px-6 py-2 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 hover:text-white font-bold text-xs rounded-xl active:scale-95 transition-all cursor-pointer"
                >
                  Entendido / Cerrar Analítica
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center gap-3">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-neutral-400 font-mono text-xs">Cargando Sabor York POS...</span>
      </div>
    );
  }

  // Si no está firmado, o si el email no es válido (pendiente), LoginScreen administra el bloqueo.
  if (!user || userProfile?.rol === 'pendiente') {
    return <LoginScreen />;
  }

  return <POSDashboard />;
}
