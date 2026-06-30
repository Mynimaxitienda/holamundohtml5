import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase/config';
import { Categoria, Producto, Insumo, IngredienteReceta } from '../../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  Check, 
  Eye, 
  EyeOff, 
  Tag, 
  ShoppingBag, 
  FileText, 
  Calendar, 
  Clock, 
  Database, 
  TrendingUp, 
  Trash, 
  AlertCircle,
  FolderPlus,
  Layers,
  Sparkles
} from 'lucide-react';

const DEFAULT_CATEGORIAS: Categoria[] = [
  {
    id: "cat_perros",
    nombre: "Perros Calientes",
    imagen: "https://images.unsplash.com/photo-1627059318424-d729322b28b3?q=80&w=300&auto=format&fit=crop",
    descripcion: "Salchichas premium, tocineta y nuestro ripio crujiente artesanal",
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:00:00",
    publicado: true
  },
  {
    id: "cat_salchipapas",
    nombre: "Salchipapas York",
    imagen: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop",
    descripcion: "Papas amarillas crocantes con salchichas y quesos fundidos extravagantes",
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:05:00",
    publicado: true
  },
  {
    id: "cat_hamburguesas",
    nombre: "Hamburguesas a la Parrilla",
    imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop",
    descripcion: "Carne selecta madurada, vegetales frescos y pan brioche artesanal",
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:10:00",
    publicado: true
  }
];

const DEFAULT_PRODUCTOS: Producto[] = [
  {
    id: "prod_sencillo",
    categoriaId: "cat_perros",
    categoriaNombre: "Perros Calientes",
    nombre: "Perro Sencillo Clásico",
    imagen: "https://images.unsplash.com/photo-1627059318424-d729322b28b3?q=80&w=300&auto=format&fit=crop",
    descripcion: "Salchicha americana, ripio crocante y salsas de la casa",
    precio: 12000,
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:15:00",
    publicado: true
  },
  {
    id: "prod_york_salvaje",
    categoriaId: "cat_salchipapas",
    categoriaNombre: "Salchipapas York",
    nombre: "Salchipapa York Salvaje",
    imagen: "https://images.unsplash.com/photo-1620921556328-1a9300dce76d?q=80&w=300&auto=format&fit=crop",
    descripcion: "Papas, carne desmechada, tocineta, maíz dulce, doble queso cheddar fundido y salsa tártara",
    precio: 25000,
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:20:00",
    publicado: true
  },
  {
    id: "prod_burguer_double",
    categoriaId: "cat_hamburguesas",
    categoriaNombre: "Hamburguesas a la Parrilla",
    nombre: "Burguer York Doble Carne de la Casa",
    imagen: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=300&auto=format&fit=crop",
    descripcion: "Doble carne premium a la plancha, queso cheddar, tocineta ahumada y salsa de la casa",
    precio: 22000,
    fechaCreacion: "2026-06-17",
    horaCreacion: "12:30:00",
    publicado: true
  }
];

interface Props {
  onNotify?: (message: string, type: 'success' | 'error') => void;
}

export function AdminProductosCategorias({ onNotify }: Props) {
  // Tabs: 'categorias' | 'productos' | 'carga_masiva'
  const [activeTab, setActiveTab] = useState<'categorias' | 'productos' | 'carga_masiva'>('categorias');

  // Listas de datos
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);

  // Estados de carga y protección de doble clic de grabación
  const [isGuardando, setIsGuardando] = useState(false);

  // Modal de confirmación de eliminación segura
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    tipo: 'categoria' | 'producto';
    id: string;
    nombre: string;
  } | null>(null);

  // Acceso restringido o fallback local (Sandbox)
  const [sandboxMode, setSandboxMode] = useState(() => {
    return localStorage.getItem('sabor_york_sandbox_active') === 'true';
  });
  const [permissionErrorReason, setPermissionErrorReason] = useState<string | null>(null);
  const [copiedRules, setCopiedRules] = useState(false);

  // Guardar datos locales helper
  const saveLocalCategorias = (list: Categoria[]) => {
    setCategorias(list);
    localStorage.setItem('sabor_york_local_categorias', JSON.stringify(list));
  };

  const saveLocalProductos = (list: Producto[]) => {
    setProductos(list);
    localStorage.setItem('sabor_york_local_productos', JSON.stringify(list));
  };

  const activateSandboxAfterError = (err: any) => {
    setSandboxMode(true);
    localStorage.setItem('sabor_york_sandbox_active', 'true');
    const msg = err instanceof Error ? err.message : String(err);
    setPermissionErrorReason(msg);
  };

  const firestoreRulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data;
    }

    function hasRole(role) {
      return isAuthenticated() && 
             exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && 
             getUserData().rol == role;
    }

    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.email == 'elbuensabordelyorks@gmail.com' || 
        request.auth.token.email == 'elbuensabordelyorks_admin@gmail.com' || 
        request.auth.token.email == 'devluisluzardo@gmail.com' ||
        (request.auth.token.email != null && (
          request.auth.token.email.matches('.*luzardo.*') || 
          request.auth.token.email.matches('.*york.*') ||
          request.auth.token.email.matches('.*admin.*')
        )) ||
        (exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && getUserData().rol == 'admin')
      );
    }

    // 1. USUARIOS
    match /usuarios/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update, delete: if isAdmin();
    }

    // 2. PEDIDOS
    match /pedidos/{pedidoId} {
      allow read: if isAdmin() || hasRole('mesero') || hasRole('caja') || hasRole('cocina');
      allow create: if isAdmin() || hasRole('mesero');
      allow update: if isAdmin() || hasRole('mesero') || hasRole('caja') || hasRole('cocina');
      allow delete: if isAdmin();
    }

    // 3. CAJA / VENTAS
    match /ventasDiarias/{ventaId} {
      allow read: if isAdmin() || hasRole('caja') || hasRole('cocina');
      allow create, update: if isAdmin() || hasRole('caja');
      allow delete: if isAdmin();
    }

    // 4. INVENTARIO
    match /inventario/{itemId} {
      allow read: if isAuthenticated();
      allow create, update: if isAdmin() || hasRole('inventario');
      allow delete: if isAdmin();
    }
    
    // 5. CONFIGURACIÓN
    match /configuracion/{configId} {
      allow read, write: if isAdmin();
    }

    // 6. CATEGORIAS (Admin escribe, cualquiera lee)
    match /categorias/{categoriaId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 7. PRODUCTOS (Admin escribe, cualquiera lee)
    match /productos/{productoId} {
      allow read: if true;
      allow write: if isAdmin();
    }
  }
}`;

  const handleCopyRules = () => {
    navigator.clipboard.writeText(firestoreRulesText);
    setCopiedRules(true);
    if (onNotify) onNotify("¡Reglas de Seguridad copiadas al portapapeles!", "success");
    setTimeout(() => setCopiedRules(false), 3000);
  };

  const handleToggleSandbox = () => {
    const nextState = !sandboxMode;
    setSandboxMode(nextState);
    localStorage.setItem('sabor_york_sandbox_active', String(nextState));
    if (onNotify) {
      if (nextState) {
        onNotify("Modo local activo. Se han cargado tus datos del navegador.", "success");
      } else {
        onNotify("Intentando reconectar con tu base de datos de producción...", "success");
      }
    }
  };

  // Cargar datos locales cuando cambie sandboxMode
  useEffect(() => {
    if (sandboxMode) {
      const savedCats = localStorage.getItem('sabor_york_local_categorias');
      const savedProds = localStorage.getItem('sabor_york_local_productos');
      
      if (savedCats) {
        setCategorias(JSON.parse(savedCats));
      } else {
        setCategorias(DEFAULT_CATEGORIAS);
        localStorage.setItem('sabor_york_local_categorias', JSON.stringify(DEFAULT_CATEGORIAS));
      }

      if (savedProds) {
        setProductos(JSON.parse(savedProds));
      } else {
        setProductos(DEFAULT_PRODUCTOS);
        localStorage.setItem('sabor_york_local_productos', JSON.stringify(DEFAULT_PRODUCTOS));
      }
    }
  }, [sandboxMode]);

  // ==========================================
  // ESTADOS FORMULARIO CATEGORÍA
  // ==========================================
  const [catId, setCatId] = useState<string | null>(null); // null significa "Crear nuevo"
  const [catNombre, setCatNombre] = useState('');
  const [catImagen, setCatImagen] = useState('');
  const [catDescripcion, setCatDescripcion] = useState('');
  const [catPublicado, setCatPublicado] = useState(true);
  const [catFecha, setCatFecha] = useState('');
  const [catHora, setCatHora] = useState('');

  // ==========================================
  // ESTADOS FORMULARIO PRODUCTO
  // ==========================================
  const [prodId, setProdId] = useState<string | null>(null); // null significa "Crear nuevo"
  const [prodCategoriaId, setProdCategoriaId] = useState('');
  const [prodNombre, setProdNombre] = useState('');
  const [prodImagen, setProdImagen] = useState('');
  const [prodDescripcion, setProdDescripcion] = useState('');
  const [prodPrecio, setProdPrecio] = useState<number | ''>('');
  const [prodPublicado, setProdPublicado] = useState(true);
  const [prodFecha, setProdFecha] = useState('');
  const [prodHora, setProdHora] = useState('');
  
  // Estados para Receta de Producto (Insumos atómicos)
  const [inventario, setInventario] = useState<Insumo[]>([]);
  const [prodReceta, setProdReceta] = useState<IngredienteReceta[]>([]);
  const [nuevoIngredienteInsumoId, setNuevoIngredienteInsumoId] = useState('');
  const [nuevoIngredienteCantidad, setNuevoIngredienteCantidad] = useState<number>(1);

  // ==========================================
  // ESTADO CARGA MASIVA (Sembrador Reutilizable)
  // ==========================================
  const [cargaMasivaInput, setCargaMasivaInput] = useState('');
  const [cargaProgreso, setCargaProgreso] = useState<string | null>(null);
  const [cargaError, setCargaError] = useState<string | null>(null);

  // Referencias para inputs de archivos
  const fileInputCatRef = useRef<HTMLInputElement>(null);
  const fileInputProdRef = useRef<HTMLInputElement>(null);

  // Auto-fechas en tiempo real para nuevos registros
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const localDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const localTime = now.toTimeString().split(' ')[0]; // HH:MM:SS
      
      // Solo actualizamos si no estamos editando un registro existente
      if (!catId) {
        setCatFecha(localDate);
        setCatHora(localTime);
      }
      if (!prodId) {
        setProdFecha(localDate);
        setProdHora(localTime);
      }
    };

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);
    return () => clearInterval(interval);
  }, [catId, prodId]);

  // ==========================================
  // LISTENERS EN TIEMPO REAL FIRESTORE
  // ==========================================
  useEffect(() => {
    if (sandboxMode) return;

    // 1. Obtener categorías
    const qCat = query(collection(db, 'categorias'));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      const list: Categoria[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() as Omit<Categoria, 'id'> });
      });
      // Ordenar por fecha y hora de creación descendente o por nombre
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setCategorias(list);
    }, (err) => {
      console.warn("Fallo de onSnapshot de categorías, iniciando Modo Sandbox Local.", err);
      activateSandboxAfterError(err);
    });

    // 2. Obtener productos
    const qProd = query(collection(db, 'productos'));
    const unsubProd = onSnapshot(qProd, (snapshot) => {
      const list: Producto[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() as Omit<Producto, 'id'> });
      });
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setProductos(list);
    }, (err) => {
      console.warn("Fallo de onSnapshot de productos, iniciando Modo Sandbox Local.", err);
      activateSandboxAfterError(err);
    });

    // 3. Obtener inventario
    const qInv = query(collection(db, 'inventario'));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const list: Insumo[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() as Omit<Insumo, 'id'> });
      });
      list.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setInventario(list);
    }, (err) => {
      console.warn("Fallo de onSnapshot de inventario, cargando de local.", err);
    });

    return () => {
      unsubCat();
      unsubProd();
      unsubInv();
    };
  }, [sandboxMode]);

  // Sincronizar inventario local si estamos en Sandbox
  useEffect(() => {
    if (sandboxMode) {
      const savedInv = localStorage.getItem('sabor_york_local_inventario');
      if (savedInv) {
        setInventario(JSON.parse(savedInv));
      } else {
        const defaultInv = [
          { id: "inv_pan", nombre: "Pan Brioche de Hamburguesa", stock: 65, unidad: "unidades", stockMinimo: 10, updatedAt: new Date().toISOString() },
          { id: "inv_carne", nombre: "Carne Premium 150g", stock: 48, unidad: "unidades", stockMinimo: 15, updatedAt: new Date().toISOString() },
          { id: "inv_papas", nombre: "Papa Amarilla en Bastón", stock: 15, unidad: "kg", stockMinimo: 5, updatedAt: new Date().toISOString() },
          { id: "inv_salchicha", nombre: "Salchicha Americana", stock: 80, unidad: "unidades", stockMinimo: 20, updatedAt: new Date().toISOString() },
          { id: "inv_queso", nombre: "Queso Cheddar lonjas", stock: 120, unidad: "unidades", stockMinimo: 30, updatedAt: new Date().toISOString() },
        ];
        setInventario(defaultInv);
        localStorage.setItem('sabor_york_local_inventario', JSON.stringify(defaultInv));
      }
    }
  }, [sandboxMode]);

  // ==========================================
  // MANEJO DE ARCHIVOS MULTIMEDIA (Base64)
  // ==========================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'categoria' | 'producto') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Alerta si es mayor a 800KB para evitar sobrepasar límites de Firestore (1MB completo)
      alert("La imagen seleccionada es un poco grande (límite recomendado: bajo 800KB). Intentaremos procesarla, pero se sugiere una imagen más pequeña.");
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (target === 'categoria') {
        setCatImagen(base64String);
        if (onNotify) onNotify("Imagen de categoría adjuntada correctamente", "success");
      } else {
        setProdImagen(base64String);
        if (onNotify) onNotify("Imagen del producto adjuntada correctamente", "success");
      }
    };
    reader.onerror = () => {
      alert("Error al leer el archivo. Intenta de nuevo con otra imagen.");
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // LÓGICA DE CATEGORÍAS
  // ==========================================
  const isCatFormValid = catNombre.trim() !== '' && catImagen.trim() !== '';

  const resetCatForm = () => {
    setCatId(null);
    setCatNombre('');
    setCatImagen('');
    setCatDescripcion('');
    setCatPublicado(true);
    // Reiniciar input de archivo
    if (fileInputCatRef.current) {
      fileInputCatRef.current.value = '';
    }
  };

  const handleGrabarCategoria = async () => {
    if (!isCatFormValid || isGuardando) return;
    setIsGuardando(true);

    const payload: Omit<Categoria, 'id'> = {
      nombre: catNombre.trim(),
      imagen: catImagen,
      descripcion: catDescripcion.trim() || 'Sin descripción',
      fechaCreacion: catFecha,
      horaCreacion: catHora,
      publicado: catPublicado
    };

    if (sandboxMode) {
      if (catId) {
        const list = categorias.map(c => c.id === catId ? { ...c, ...payload } : c);
        saveLocalCategorias(list);
        if (onNotify) onNotify(`Categoría "${catNombre}" modificada localmente (Modo Sandbox)`, "success");
      } else {
        const list = [...categorias, { id: `cat_${Date.now()}`, ...payload }];
        saveLocalCategorias(list);
        if (onNotify) onNotify(`Categoría "${catNombre}" creada localmente (Modo Sandbox)`, "success");
      }
      resetCatForm();
      setIsGuardando(false);
      return;
    }

    try {
      const fullPayload = { ...payload, createdAt: serverTimestamp() };
      if (catId) {
        await setDoc(doc(db, 'categorias', catId), fullPayload, { merge: true });
        if (onNotify) onNotify(`Categoría "${catNombre}" modificada con éxito`, "success");
      } else {
        await addDoc(collection(db, 'categorias'), fullPayload);
        if (onNotify) onNotify(`Categoría "${catNombre}" guardada en Firestore`, "success");
      }
      resetCatForm();
    } catch (err: any) {
      if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
        activateSandboxAfterError(err);
        // Fallback write
        if (catId) {
          const list = categorias.map(c => c.id === catId ? { ...c, ...payload } : c);
          saveLocalCategorias(list);
        } else {
          const list = [...categorias, { id: `cat_${Date.now()}`, ...payload }];
          saveLocalCategorias(list);
        }
        resetCatForm();
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'categorias');
      }
    } finally {
      setIsGuardando(false);
    }
  };

  const handlePublicarCategoria = async (especificoId?: string) => {
    const targetId = especificoId || catId;
    if (isGuardando) return;
    setIsGuardando(true);
    
    if (sandboxMode) {
      if (!targetId) {
        if (!isCatFormValid) {
          if (onNotify) onNotify("El nombre de la categoría y la imagen son requeridos", "error");
          setIsGuardando(false);
          return;
        }
        const payload: Categoria = {
          id: `cat_${Date.now()}`,
          nombre: catNombre.trim(),
          imagen: catImagen,
          descripcion: catDescripcion.trim() || 'Sin descripción',
          fechaCreacion: catFecha,
          horaCreacion: catHora,
          publicado: true
        };
        saveLocalCategorias([...categorias, payload]);
        if (onNotify) onNotify(`Categoría "${catNombre}" creada y publicada localmente`, "success");
        resetCatForm();
      } else {
        const item = categorias.find(c => c.id === targetId);
        if (!item) {
          setIsGuardando(false);
          return;
        }
        const nuevoEstado = especificoId ? !item.publicado : true;
        const list = categorias.map(c => c.id === targetId ? { ...c, publicado: nuevoEstado } : c);
        saveLocalCategorias(list);
        if (onNotify) onNotify(`Categoría "${item.nombre}" ${nuevoEstado ? 'Publicada' : 'Despublicada'} localmente`, "success");
        if (!especificoId) resetCatForm();
      }
      setIsGuardando(false);
      return;
    }

    if (!targetId) {
      if (!isCatFormValid) {
        if (onNotify) onNotify("El nombre de categoría y la imagen son obligatorios para Publicar", "error");
        setIsGuardando(false);
        return;
      }
      try {
        const payload: Omit<Categoria, 'id'> = {
          nombre: catNombre.trim(),
          imagen: catImagen,
          descripcion: catDescripcion.trim() || 'Sin descripción',
          fechaCreacion: catFecha,
          horaCreacion: catHora,
          publicado: true,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'categorias'), payload);
        if (onNotify) onNotify(`Categoría "${catNombre}" publicada exitosamente en Firestore`, "success");
        resetCatForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const payload: Categoria = {
            id: `cat_${Date.now()}`,
            nombre: catNombre.trim(),
            imagen: catImagen,
            descripcion: catDescripcion.trim() || 'Sin descripción',
            fechaCreacion: catFecha,
            horaCreacion: catHora,
            publicado: true
          };
          saveLocalCategorias([...categorias, payload]);
          resetCatForm();
        } else {
          handleFirestoreError(err, OperationType.CREATE, 'categorias');
        }
      } finally {
        setIsGuardando(false);
      }
    } else {
      try {
        const item = categorias.find(c => c.id === targetId);
        if (!item) {
          setIsGuardando(false);
          return;
        }
        const nuevoEstado = especificoId ? !item.publicado : true;
        await updateDoc(doc(db, 'categorias', targetId), {
          publicado: nuevoEstado,
          updatedAt: serverTimestamp()
        });
        if (onNotify) onNotify(`Categoría "${item.nombre}" ${nuevoEstado ? 'Publicada' : 'Despublicada'} correctamente`, "success");
        if (!especificoId) resetCatForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const item = categorias.find(c => c.id === targetId);
          if (!item) {
            setIsGuardando(false);
            return;
          }
          const nuevoEstado = especificoId ? !item.publicado : true;
          const list = categorias.map(c => c.id === targetId ? { ...c, publicado: nuevoEstado } : c);
          saveLocalCategorias(list);
          if (!especificoId) resetCatForm();
        } else {
          handleFirestoreError(err, OperationType.UPDATE, `categorias/${targetId}`);
        }
      } finally {
        setIsGuardando(false);
      }
    }
  };

  const handleSeleccionarCategoria = (cat: Categoria) => {
    setCatId(cat.id!);
    setCatNombre(cat.nombre);
    setCatImagen(cat.imagen);
    setCatDescripcion(cat.descripcion || '');
    setCatPublicado(cat.publicado);
    setCatFecha(cat.fechaCreacion);
    setCatHora(cat.horaCreacion);
  };

  const handleEliminarCategoria = async (id: string, nombre: string) => {
    setDeleteConfirmation({
      tipo: 'categoria',
      id,
      nombre
    });
  };


  // ==========================================
  // LÓGICA DE PRODUCTOS
  // ==========================================
  const isProdFormValid = prodNombre.trim() !== '' && prodCategoriaId !== '' && prodImagen.trim() !== '' && prodPrecio !== '';

  const resetProdForm = () => {
    setProdId(null);
    setProdNombre('');
    setProdImagen('');
    setProdCategoriaId('');
    setProdDescripcion('');
    setProdPrecio('');
    setProdPublicado(true);
    setProdReceta([]);
    setNuevoIngredienteInsumoId('');
    setNuevoIngredienteCantidad(1);
    if (fileInputProdRef.current) {
      fileInputProdRef.current.value = '';
    }
  };

  const handleGrabarProducto = async () => {
    if (!isProdFormValid || isGuardando) return;
    setIsGuardando(true);
    const descCategoria = categorias.find(c => c.id === prodCategoriaId)?.nombre || 'General';

    const payload: Omit<Producto, 'id'> = {
      nombre: prodNombre.trim(),
      categoriaId: prodCategoriaId,
      categoriaNombre: descCategoria,
      imagen: prodImagen,
      descripcion: prodDescripcion.trim() || 'Sin descripción',
      precio: Number(prodPrecio),
      fechaCreacion: prodFecha,
      horaCreacion: prodHora,
      publicado: prodPublicado,
      receta: prodReceta
    };

    if (sandboxMode) {
      if (prodId) {
        const list = productos.map(p => p.id === prodId ? { ...p, ...payload } : p);
        saveLocalProductos(list);
        if (onNotify) onNotify(`Producto "${prodNombre}" modificado localmente (Modo Sandbox)`, "success");
      } else {
        const list = [...productos, { id: `prod_${Date.now()}`, ...payload }];
        saveLocalProductos(list);
        if (onNotify) onNotify(`Producto "${prodNombre}" creado localmente (Modo Sandbox)`, "success");
      }
      resetProdForm();
      setIsGuardando(false);
      return;
    }

    try {
      const fullPayload = { ...payload, createdAt: serverTimestamp() };
      if (prodId) {
        await setDoc(doc(db, 'productos', prodId), fullPayload, { merge: true });
        if (onNotify) onNotify(`Producto "${prodNombre}" modificado correctamente`, "success");
      } else {
        await addDoc(collection(db, 'productos'), fullPayload);
        if (onNotify) onNotify(`Producto "${prodNombre}" guardado en Firestore`, "success");
      }
      resetProdForm();
    } catch (err: any) {
      if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
        activateSandboxAfterError(err);
        if (prodId) {
          const list = productos.map(p => p.id === prodId ? { ...p, ...payload } : p);
          saveLocalProductos(list);
        } else {
          const list = [...productos, { id: `prod_${Date.now()}`, ...payload }];
          saveLocalProductos(list);
        }
        resetProdForm();
      } else {
        handleFirestoreError(err, OperationType.WRITE, 'productos');
      }
    } finally {
      setIsGuardando(false);
    }
  };

  const handlePublicarProducto = async (especificoId?: string) => {
    const targetId = especificoId || prodId;
    if (isGuardando) return;
    setIsGuardando(true);

    if (sandboxMode) {
      if (!targetId) {
        if (!isProdFormValid) {
          if (onNotify) onNotify("Por favor completa los campos del producto, precio, categoría e imagen", "error");
          setIsGuardando(false);
          return;
        }
        const descCategoria = categorias.find(c => c.id === prodCategoriaId)?.nombre || 'General';
        const payload: Producto = {
          id: `prod_${Date.now()}`,
          nombre: prodNombre.trim(),
          categoriaId: prodCategoriaId,
          categoriaNombre: descCategoria,
          imagen: prodImagen,
          descripcion: prodDescripcion.trim() || 'Sin descripción',
          precio: Number(prodPrecio),
          fechaCreacion: prodFecha,
          horaCreacion: prodHora,
          publicado: true,
          receta: prodReceta
        };
        saveLocalProductos([...productos, payload]);
        if (onNotify) onNotify(`Producto "${prodNombre}" creado y publicado localmente`, "success");
        resetProdForm();
      } else {
        const item = productos.find(p => p.id === targetId);
        if (!item) {
          setIsGuardando(false);
          return;
        }
        const nuevoEstado = especificoId ? !item.publicado : true;
        const list = productos.map(p => p.id === targetId ? { ...p, publicado: nuevoEstado } : p);
        saveLocalProductos(list);
        if (onNotify) onNotify(`Producto "${item.nombre}" ${nuevoEstado ? 'Publicado' : 'Despublicado'} localmente`, "success");
        if (!especificoId) resetProdForm();
      }
      setIsGuardando(false);
      return;
    }

    if (!targetId) {
      if (!isProdFormValid) {
        if (onNotify) onNotify("Por favor completa los campos del producto, precio, categoría e imagen para Publicar", "error");
        setIsGuardando(false);
        return;
      }
      const descCategoria = categorias.find(c => c.id === prodCategoriaId)?.nombre || 'General';
      try {
        const payload: Omit<Producto, 'id'> = {
          nombre: prodNombre.trim(),
          categoriaId: prodCategoriaId,
          categoriaNombre: descCategoria,
          imagen: prodImagen,
          descripcion: prodDescripcion.trim() || 'Sin descripción',
          precio: Number(prodPrecio),
          fechaCreacion: prodFecha,
          horaCreacion: prodHora,
          publicado: true,
          createdAt: serverTimestamp(),
          receta: prodReceta
        };
        await addDoc(collection(db, 'productos'), payload);
        if (onNotify) onNotify(`Producto "${prodNombre}" publicado exitosamente en Firestore`, "success");
        resetProdForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const descCategoria = categorias.find(c => c.id === prodCategoriaId)?.nombre || 'General';
          const payload: Producto = {
            id: `prod_${Date.now()}`,
            nombre: prodNombre.trim(),
            categoriaId: prodCategoriaId,
            categoriaNombre: descCategoria,
            imagen: prodImagen,
            descripcion: prodDescripcion.trim() || 'Sin descripción',
            precio: Number(prodPrecio),
            fechaCreacion: prodFecha,
            horaCreacion: prodHora,
            publicado: true,
            receta: prodReceta
          };
          saveLocalProductos([...productos, payload]);
          resetProdForm();
        } else {
          handleFirestoreError(err, OperationType.CREATE, 'productos');
        }
      } finally {
        setIsGuardando(false);
      }
    } else {
      try {
        const item = productos.find(p => p.id === targetId);
        if (!item) {
          setIsGuardando(false);
          return;
        }
        const nuevoEstado = especificoId ? !item.publicado : true;
        await updateDoc(doc(db, 'productos', targetId), {
          publicado: nuevoEstado,
          updatedAt: serverTimestamp()
        });
        if (onNotify) onNotify(`Producto "${item.nombre}" ${nuevoEstado ? 'Publicado' : 'Despublicado'} con éxito`, "success");
        if (!especificoId) resetProdForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const item = productos.find(p => p.id === targetId);
          if (!item) {
            setIsGuardando(false);
            return;
          }
          const nuevoEstado = especificoId ? !item.publicado : true;
          const list = productos.map(p => p.id === targetId ? { ...p, publicado: nuevoEstado } : p);
          saveLocalProductos(list);
          if (!especificoId) resetProdForm();
        } else {
          handleFirestoreError(err, OperationType.UPDATE, `productos/${targetId}`);
        }
      } finally {
        setIsGuardando(false);
      }
    }
  };

  const handleSeleccionarProducto = (prod: Producto) => {
    setProdId(prod.id!);
    setProdNombre(prod.nombre);
    setProdImagen(prod.imagen);
    setProdCategoriaId(prod.categoriaId);
    setProdDescripcion(prod.descripcion || '');
    setProdPrecio(prod.precio);
    setProdPublicado(prod.publicado);
    setProdFecha(prod.fechaCreacion);
    setProdHora(prod.horaCreacion);
    setProdReceta(prod.receta || []);
  };

  const handleEliminarProducto = async (id: string, nombre: string) => {
    setDeleteConfirmation({
      tipo: 'producto',
      id,
      nombre
    });
  };

  const ejecutarEliminacionSegura = async () => {
    if (!deleteConfirmation) return;
    const { tipo, id, nombre } = deleteConfirmation;
    setDeleteConfirmation(null);

    if (tipo === 'categoria') {
      if (sandboxMode) {
        const list = categorias.filter(c => c.id !== id);
        saveLocalCategorias(list);
        if (onNotify) onNotify(`Categoría "${nombre}" eliminada localmente (Modo Sandbox)`, "success");
        if (catId === id) resetCatForm();
        return;
      }
      try {
        await deleteDoc(doc(db, 'categorias', id));
        if (onNotify) onNotify(`Categoría "${nombre}" eliminada correctamente de Firestore`, "success");
        if (catId === id) resetCatForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const list = categorias.filter(c => c.id !== id);
          saveLocalCategorias(list);
          if (catId === id) resetCatForm();
        } else {
          handleFirestoreError(err, OperationType.DELETE, `categorias/${id}`);
        }
      }
    } else {
      if (sandboxMode) {
        const list = productos.filter(p => p.id !== id);
        saveLocalProductos(list);
        if (onNotify) onNotify(`Producto "${nombre}" eliminado localmente (Modo Sandbox)`, "success");
        if (prodId === id) resetProdForm();
        return;
      }
      try {
        await deleteDoc(doc(db, 'productos', id));
        if (onNotify) onNotify(`Producto "${nombre}" eliminado de Firestore`, "success");
        if (prodId === id) resetProdForm();
      } catch (err: any) {
        if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
          activateSandboxAfterError(err);
          const list = productos.filter(p => p.id !== id);
          saveLocalProductos(list);
          if (prodId === id) resetProdForm();
        } else {
          handleFirestoreError(err, OperationType.DELETE, `productos/${id}`);
        }
      }
    }
  };

  // ==========================================
  // LÓGICA DE CARGA MASIVA (Sembrador Reutilizable)
  // ==========================================
  const handleCargaMasiva = async () => {
    setCargaError(null);
    setCargaProgreso("Iniciando análisis semántico del JSON...");
    try {
      const data = JSON.parse(cargaMasivaInput);
      
      const parsedCategorias : Omit<Categoria, 'id'>[] = [];
      const parsedProductos : Omit<Producto, 'id'>[] = [];

      // Validar si el JSON tiene un formato esperado o estructurado
      if (data.categorias && Array.isArray(data.categorias)) {
        // Caso 1: Estructurado { categorias: [...], productos: [...] }
        for (const c of data.categorias) {
          if (!c.nombre || !c.imagen) {
            throw new Error(`Cada categoría en la lista masiva debe tener como mínimo 'nombre' e 'imagen'.`);
          }
          parsedCategorias.push({
            nombre: String(c.nombre),
            imagen: String(c.imagen),
            descripcion: String(c.descripcion || "Importado masivamente"),
            fechaCreacion: new Date().toISOString().split('T')[0],
            horaCreacion: new Date().toTimeString().split(' ')[0],
            publicado: c.publicado !== false,
          });
        }

        if (data.productos && Array.isArray(data.productos)) {
          for (const p of data.productos) {
            if (!p.nombre || !p.imagen || !p.precio) {
              throw new Error(`Cada producto importado debe tener 'nombre', 'imagen' y 'precio'.`);
            }
            parsedProductos.push({
              nombre: String(p.nombre),
              imagen: String(p.imagen),
              descripcion: String(p.descripcion || "Importado masivamente"),
              categoriaId: String(p.categoriaId || p.categoriaNombre || ""), 
              categoriaNombre: String(p.categoriaNombre || "General"),
              precio: Number(p.precio),
              fechaCreacion: new Date().toISOString().split('T')[0],
              horaCreacion: new Date().toTimeString().split(' ')[0],
              publicado: p.publicado !== false,
            });
          }
        }
      } else if (Array.isArray(data)) {
        // Caso 2: Simplemente un array de productos
        for (const p of data) {
          if (!p.nombre || !p.precio) {
            throw new Error(`Cada producto en el array debe tener 'nombre' y 'precio'.`);
          }
          parsedProductos.push({
            nombre: String(p.nombre),
            imagen: String(p.imagen || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=200&auto=format&fit=crop"),
            descripcion: String(p.descripcion || "Importado masivamente"),
            categoriaId: String(p.categoriaId || p.categoriaNombre || ""),
            categoriaNombre: String(p.categoriaNombre || "General"),
            precio: Number(p.precio),
            fechaCreacion: new Date().toISOString().split('T')[0],
            horaCreacion: new Date().toTimeString().split(' ')[0],
            publicado: p.publicado !== false,
          });
        }
      } else {
        throw new Error("Formato JSON no admitido. Debe ser un Array de Productos o un objeto estructurado { categorias: Array, productos: Array }.");
      }

      if (sandboxMode) {
        setCargaProgreso(`Garantizando datos locales...`);
        const catMapNameId: Record<string, string> = {};
        const localCats = [...categorias];
        localCats.forEach(c => {
          catMapNameId[c.nombre.toLowerCase()] = c.id!;
        });

        for (const catPayload of parsedCategorias) {
          const nombreLower = catPayload.nombre.toLowerCase();
          if (!catMapNameId[nombreLower]) {
            const newId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            localCats.push({ id: newId, ...catPayload });
            catMapNameId[nombreLower] = newId;
          }
        }
        saveLocalCategorias(localCats);

        const localProds = [...productos];
        let countProd = 0;
        for (const prodPayload of parsedProductos) {
          let finalCatId = "";
          let finalCatName = prodPayload.categoriaNombre;
          const catLower = finalCatName.toLowerCase();

          if (catMapNameId[catLower]) {
            finalCatId = catMapNameId[catLower];
          } else {
            const newId = `cat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            localCats.push({
              id: newId,
              nombre: finalCatName,
              imagen: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop",
              descripcion: "Categoría auto-creada por carga masiva",
              fechaCreacion: new Date().toISOString().split('T')[0],
              horaCreacion: new Date().toTimeString().split(' ')[0],
              publicado: true
            });
            catMapNameId[catLower] = newId;
            finalCatId = newId;
          }

          localProds.push({
            id: `prod_${Date.now()}_${countProd}`,
            ...prodPayload,
            categoriaId: finalCatId,
            categoriaNombre: finalCatName
          });
          countProd++;
        }
        saveLocalCategorias(localCats);
        saveLocalProductos(localProds);
        setCargaProgreso(null);
        if (onNotify) onNotify(`¡Carga masiva local completada! Se guardaron ${parsedCategorias.length} categorías y ${countProd} productos en tu navegador.`, "success");
        setCargaMasivaInput('');
        return;
      }

      // Proceso de guardado en Firestore
      setCargaProgreso(`Procesando e insertando nucleos... (${parsedCategorias.length} categorías, ${parsedProductos.length} productos).`);
      
      // 1. Guardar categorías si existen
      const catMapNameId: Record<string, string> = {};
      
      // Alimentar mapa con categorías existentes en el backend
      categorias.forEach(c => {
        catMapNameId[c.nombre.toLowerCase()] = c.id!;
      });

      for (const catPayload of parsedCategorias) {
        const nombreLower = catPayload.nombre.toLowerCase();
        if (!catMapNameId[nombreLower]) {
          const docRef = await addDoc(collection(db, 'categorias'), {
            ...catPayload,
            createdAt: serverTimestamp()
          });
          catMapNameId[nombreLower] = docRef.id;
        }
      }

      // 2. Guardar productos vinculándolos a las categorías correspondientes
      let countProd = 0;
      for (const prodPayload of parsedProductos) {
        // Hallar ID de categoría o crearla por defecto
        let finalCatId = "";
        let finalCatName = prodPayload.categoriaNombre;

        const catLower = finalCatName.toLowerCase();
        if (catMapNameId[catLower]) {
          finalCatId = catMapNameId[catLower];
        } else {
          // Crear categoría de rescate
          const newCatRef = await addDoc(collection(db, 'categorias'), {
            nombre: finalCatName,
            imagen: "https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=200&auto=format&fit=crop",
            descripcion: "Categoría auto-creada por carga masiva",
            fechaCreacion: new Date().toISOString().split('T')[0],
            horaCreacion: new Date().toTimeString().split(' ')[0],
            publicado: true,
            createdAt: serverTimestamp()
          });
          catMapNameId[catLower] = newCatRef.id;
          finalCatId = newCatRef.id;
        }

        await addDoc(collection(db, 'productos'), {
          ...prodPayload,
          categoriaId: finalCatId,
          categoriaNombre: finalCatName,
          createdAt: serverTimestamp()
        });
        countProd++;
      }

      setCargaProgreso(null);
      if (onNotify) onNotify(`¡Carga masiva finalizada con éxito! Se cargaron ${parsedCategorias.length} categorías y ${countProd} productos de comida rápida.`, "success");
      setCargaMasivaInput('');
    } catch (err: any) {
      setCargaProgreso(null);
      if (err?.message?.includes("insufficient permissions") || err?.message?.includes("permission-denied")) {
        activateSandboxAfterError(err);
        if (onNotify) onNotify("No hay permisos de escritura. Cambiando e importando localmente.", "success");
        // Re-run handleCargaMasiva recursively under sandboxMode=true represents the ultimate fallback
        setTimeout(() => handleCargaMasiva(), 100);
      } else {
        setCargaError(err?.message || "Error desconocido analizando el JSON.");
      }
    }
  };

  // Cargar una plantilla de ejemplo para facilitarle al admin
  const handleCargarEjemploJSON = () => {
    const ejemplo = {
      categorias: [
        {
          nombre: "Perros Calientes",
          imagen: "https://images.unsplash.com/photo-1627059318424-d729322b28b3?q=80&w=300&auto=format&fit=crop",
          descripcion: "Salchichas premium, salsas artesanales y ripio crocante",
          publicado: true
        },
        {
          nombre: "Salchipapas",
          imagen: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop",
          descripcion: "Papas fritas con salchichas americanas de primera calidad",
          publicado: true
        }
      ],
      productos: [
        {
          nombre: "Perro Sencillo",
          categoriaNombre: "Perros Calientes",
          imagen: "https://images.unsplash.com/photo-1627059318424-d729322b28b3?q=80&w=300&auto=format&fit=crop",
          descripcion: "Salchicha americana, ripio, queso rallado y salsas tradicionales",
          precio: 12000,
          publicado: true
        },
        {
          nombre: "Perro a la Plancha Super",
          categoriaNombre: "Perros Calientes",
          imagen: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=300&auto=format&fit=crop",
          descripcion: "Salchicha premium, tocineta crujiente, cebolla caramelizada, doble queso cheddar fundido",
          precio: 18000,
          publicado: true
        },
        {
          nombre: "Salchipapa Clásica Sabor York",
          categoriaNombre: "Salchipapas",
          imagen: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=300&auto=format&fit=crop",
          descripcion: "Montaña de papa amarilla artesanal, salchicha premium picada y queso costeño",
          precio: 15000,
          publicado: true
        },
        {
          nombre: "Salchipapa York Salvaje",
          categoriaNombre: "Salchipapas",
          imagen: "https://images.unsplash.com/photo-1620921556328-1a9300dce76d?q=80&w=300&auto=format&fit=crop",
          descripcion: "Papas fritas tiernas, salchicha, carne desmechada, pechuga a la plancha, tocineta, maíz dulce y bañado en salsa de ajo",
          precio: 25000,
          publicado: true
        }
      ]
    };
    setCargaMasivaInput(JSON.stringify(ejemplo, null, 2));
    if (onNotify) onNotify("Plantilla de menú sembrador cargada en el campo de texto", "success");
  };

  return (
    <div id="admin-productos-categorias" className="bg-neutral-950 border border-neutral-850 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
      
      {/* Fondo estético con colores que recuerdan la imagen de marca de EL BUEN SABOR DEL YORK */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/5 via-blue-500/5 to-amber-500/5 blur-3xl rounded-full pointer-events-none -z-10" />

      {sandboxMode && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold">Modo Sandbox Activo (Borrador Local Seguro)</p>
              <p className="text-neutral-400 mt-0.5">
                La base de datos de producción requiere privilegios de Administrador para asegurar tus datos de comida rápida. {permissionErrorReason && `Detalle: "${permissionErrorReason}"`}.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 self-end md:self-auto">
            <button 
              onClick={handleCopyRules} 
              className="px-3 py-1.5 rounded bg-neutral-850 hover:bg-neutral-800 border border-neutral-700/60 font-semibold cursor-pointer active:scale-95 transition-all text-[11px] flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              {copiedRules ? "¡Copiado!" : "Copiar Reglas de Seguridad (Admin)"}
            </button>
            <button 
              onClick={handleToggleSandbox} 
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold active:scale-95 transition-all text-[11px] cursor-pointer"
            >
              Reconectar Firestore
            </button>
          </div>
        </div>
      )}

      {/* Cabecera del Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-neutral-850 pb-6">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="w-2.5 h-6 rounded bg-gradient-to-b from-emerald-500 via-blue-500 to-amber-500 inline-block" />
            SISTEMA DE ADMINISTRACIÓN DE MENÚ
          </h2>
          <p className="text-neutral-400 text-xs mt-1">
            Gestiona de forma dinámica las categorías, los productos activos de la carta y realiza cargas masivas seguras en Firestore.
          </p>
        </div>

        {/* selectores de opciones con los fantásticos colores corporativos (green/blue y blue/orange gradients) */}
        <div className="flex rounded-xl bg-neutral-900 border border-neutral-800 p-1 text-xs font-bold gap-1 self-stretch md:self-auto shadow-inner">
          <button
            onClick={() => setActiveTab('categorias')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'categorias' 
                ? 'bg-neutral-800 text-amber-500 border border-neutral-700/50 shadow-md' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            Categorías ({categorias.length})
          </button>
          
          <button
            onClick={() => setActiveTab('productos')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'productos' 
                ? 'bg-neutral-800 text-amber-500 border border-neutral-700/50 shadow-md' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Productos ({productos.length})
          </button>

          <button
            onClick={() => setActiveTab('carga_masiva')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'carga_masiva' 
                ? 'bg-amber-500 text-neutral-950 font-black shadow-md shadow-amber-500/10' 
                : 'text-neutral-400 hover:text-white hover:bg-neutral-850'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Cargador Masivo
          </button>
        </div>
      </div>

      {/* ========================================================== */}
      {/* 1. SECCIÓN DE CATEGORÍAS                                   */}
      {/* ========================================================== */}
      {activeTab === 'categorias' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Formulario de Categorías */}
          <div className="lg:col-span-5 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-amber-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <FolderPlus className="w-4 h-4" />
                  {catId ? 'Modificar Categoría' : 'Nueva Categoría de Parrilla'}
                </span>
                {catId && (
                  <button 
                    onClick={resetCatForm}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300 font-bold underline transition-colors cursor-pointer"
                  >
                    Nueva Categoría [+]
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {/* Nombre de la categoria */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Nombre de la Categoría
                  </label>
                  <input
                    type="text"
                    value={catNombre}
                    onChange={(e) => setCatNombre(e.target.value)}
                    placeholder="Ej: Perros Calientes, Salchipapas..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Subir imagen o pegar URL pública */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Imagen de Categoría
                  </label>
                  
                  <div className="space-y-2">
                    {/* Campo de URL */}
                    <input
                      type="text"
                      value={catImagen}
                      onChange={(e) => setCatImagen(e.target.value)}
                      placeholder="Pega enlace público (ej. imgbb, imgur, unsplash...)"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />

                    {/* Selector de Archivo Local -> Conversor Base64 automático */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputCatRef.current?.click()}
                        className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-750"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-500" />
                        Subir de la Tablet/Dispositivo
                      </button>
                      <input
                        type="file"
                        ref={fileInputCatRef}
                        onChange={(e) => handleFileChange(e, 'categoria')}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Vista Previa de la imagen en miniatura */}
                  {catImagen ? (
                    <div className="mt-2.5 relative rounded-lg overflow-hidden border border-neutral-800 h-28 bg-neutral-950 flex items-center justify-center group">
                      <img 
                        src={catImagen} 
                        alt="Previsualización" 
                        className="object-cover w-full h-full opacity-80"
                        onError={(e) => {
                          // Si falla, es una url incorrecta
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-neutral-400 font-bold">Imagen Lista</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 border border-dashed border-neutral-800 rounded-lg h-28 flex flex-col items-center justify-center text-neutral-600 bg-neutral-950/40 text-xs">
                      <Upload className="w-6 h-6 mb-1 text-neutral-700" />
                      <span>Sin imagen adjuntada aún</span>
                    </div>
                  )}
                </div>

                {/* Descripción opcional */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    value={catDescripcion}
                    onChange={(e) => setCatDescripcion(e.target.value)}
                    placeholder="Escribe detalles rápidos de esta línea de comida..."
                    rows={2}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                {/* Campos automáticos sólo para el Admin */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-850/60">
                  <div className="bg-neutral-950 px-2 py-1 rounded-lg text-neutral-400 text-[10px] font-mono flex items-center gap-1 border border-neutral-850">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>Fecha: {catFecha}</span>
                  </div>
                  <div className="bg-neutral-950 px-2 py-1 rounded-lg text-neutral-400 text-[10px] font-mono flex items-center gap-1 border border-neutral-850">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Hora: {catHora}</span>
                  </div>
                </div>

                {/* Switch de borrador / publicado */}
                <div className="flex items-center justify-between p-2.5 bg-neutral-950 rounded-xl border border-neutral-850">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Publicar inmediatamente</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={catPublicado}
                      onChange={(e) => setCatPublicado(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Panel de Botonera principal exactos del modelo */}
            <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Grabar (Borrador o actualizar con estado manual) */}
                <button
                  type="button"
                  onClick={handleGrabarCategoria}
                  disabled={!isCatFormValid}
                  className={`py-2 px-3 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-1 shadow-md ${
                    isCatFormValid 
                      ? 'bg-neutral-800 hover:bg-neutral-750 text-white cursor-pointer active:scale-95 border border-neutral-700' 
                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850'
                  }`}
                  title="Registra localmente o guarda modificaciones en Firebase"
                >
                  <Check className="w-3.5 h-3.5" />
                  {catId ? 'Grabar Cambios' : 'Grabar Borrador'}
                </button>

                {/* Publicar (Fuerza visibilidad disponible al POS en tiempo real) */}
                <button
                  type="button"
                  onClick={() => handlePublicarCategoria()}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 shadow-md ${
                    isCatFormValid
                      ? 'bg-gradient-to-r from-emerald-500 to-indigo-500 hover:brightness-110 text-neutral-950 cursor-pointer active:scale-95'
                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850'
                  }`}
                  title="Publica directamente esta categoría para habilitar menú en las comandas"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {catId ? 'Publicar Ahora' : 'Crear y Publicar'}
                </button>
              </div>

              {catId && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEliminarCategoria(catId!, catNombre)}
                    className="py-2 px-3 bg-red-950/20 hover:bg-red-900/30 text-red-500 font-bold border border-red-950 text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar Categoría
                  </button>

                  <button
                    type="button"
                    onClick={resetCatForm}
                    className="py-2 px-3 bg-neutral-950 hover:bg-neutral-850 text-neutral-400 text-xs rounded-xl transition-all border border-neutral-800"
                  >
                    Nuevo / Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Listado de Categorías registradas */}
          <div className="lg:col-span-7 bg-neutral-900/40 border border-neutral-850 p-5 rounded-2xl flex flex-col h-[520px]">
            <h3 className="text-sm font-bold text-white mb-3 flex justify-between items-center bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
              <span>Listado de Categorías de Comidas</span>
              <span className="text-[10px] text-neutral-400 font-mono">Total: {categorias.length}</span>
            </h3>

            {/* Contenedor escaneable con scroll */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {categorias.length === 0 ? (
                <div className="text-center py-12 text-neutral-600 font-mono text-xs">
                  Aucun registre. Inyecta categorías usando el panel izquierdo o carga la base de datos masilla de ejemplo.
                </div>
              ) : (
                categorias.map((c) => (
                  <div 
                    key={c.id}
                    onClick={() => handleSeleccionarCategoria(c)}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-4 relative overflow-hidden group cursor-pointer ${
                      catId === c.id 
                        ? 'bg-neutral-800 border-amber-500/70 shadow' 
                        : 'bg-neutral-950 border-neutral-850 hover:bg-neutral-900/90 hover:border-neutral-700/60'
                    }`}
                    title="Haz clic en cualquier parte de la fila para editar"
                  >
                    <div className="flex items-center gap-3">
                      {/* Miniatura previsualizadora */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-neutral-900">
                        <img 
                          src={c.imagen} 
                          alt={c.nombre} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=200&auto=format&fit=crop";
                          }}
                        />
                      </div>

                      {/* Nombre y metadatos */}
                      <div>
                        <span className="font-extrabold text-white text-xs block group-hover:text-amber-400 transition-colors">
                          {c.nombre}
                        </span>
                        <p className="text-[10px] text-neutral-400 max-w-sm truncate">
                          {c.descripcion}
                        </p>
                        <span className="text-[9px] text-neutral-600 font-mono block mt-1">
                          Creado: YYYY-MM-DD {c.fechaCreacion} · {c.horaCreacion}
                        </span>
                      </div>
                    </div>

                    {/* Acciones del listado de categorias de comidas */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Estado de Publicación */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublicarCategoria(c.id);
                        }}
                        className={`p-1.5 rounded-lg border text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          c.publicado 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                        }`}
                        title={c.publicado ? 'Ocultar del POS' : 'Mostrar en el POS'}
                      >
                        {c.publicado ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline font-bold uppercase">{c.publicado ? 'Público' : 'Borrador'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeleccionarCategoria(c);
                        }}
                        className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-800 hover:border-amber-500/30 transition-all cursor-pointer"
                        title="Modificar categoría"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminarCategoria(c.id!, c.nombre);
                        }}
                        className="p-1.5 bg-neutral-900 hover:bg-red-950 hover:text-red-500 text-neutral-500 rounded-lg border border-neutral-800 hover:border-red-900/30 transition-colors cursor-pointer"
                        title="Eliminar categoría"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================== */}
      {/* 2. SECCIÓN DE PRODUCTOS                                    */}
      {/* ========================================================== */}
      {activeTab === 'productos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Formulario de Productos */}
          <div className="lg:col-span-5 bg-neutral-900/60 p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-amber-500 font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <ShoppingBag className="w-4 h-4" />
                  {prodId ? 'Modificar Producto' : 'Nuevo Producto Sabor York'}
                </span>
                {prodId && (
                  <button 
                    onClick={resetProdForm}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300 font-bold underline transition-colors cursor-pointer"
                  >
                    Nuevo Producto [+]
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {/* Selector de categoría */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Categoría del Producto
                  </label>
                  <select
                    value={prodCategoriaId}
                    onChange={(e) => setProdCategoriaId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  >
                    <option value="">Selecciona Categoría...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                  {categorias.length === 0 && (
                    <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 text-red-400" />
                      Debes crear al menos una categoría de arriba antes de continuar.
                    </p>
                  )}
                </div>

                {/* Nombre de la categoria o producto */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Nombre del Producto
                  </label>
                  <input
                    type="text"
                    value={prodNombre}
                    onChange={(e) => setProdNombre(e.target.value)}
                    placeholder="Ej: Sencillo con Tocineta, A la Plancha Doble..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Imagen del producto */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Imagen del Producto
                  </label>
                  
                  <div className="space-y-2">
                    {/* Campo de URL */}
                    <input
                      type="text"
                      value={prodImagen}
                      onChange={(e) => setProdImagen(e.target.value)}
                      placeholder="Pega enlace público (ej. imgbb, imgur, unsplash...)"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />

                    {/* Selector de Archivo Local -> Conversor Base64 automático */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputProdRef.current?.click()}
                        className="flex-1 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-750"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-500" />
                        Adjuntar del Dispositivo
                      </button>
                      <input
                        type="file"
                        ref={fileInputProdRef}
                        onChange={(e) => handleFileChange(e, 'producto')}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Vista Previa de la imagen */}
                  {prodImagen ? (
                    <div className="mt-2 relative rounded-lg overflow-hidden border border-neutral-800 h-24 bg-neutral-950 flex items-center justify-center group">
                      <img 
                        src={prodImagen} 
                        alt="Previsualización" 
                        className="object-cover w-full h-full opacity-80"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=200&auto=format&fit=crop";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mt-2 border border-dashed border-neutral-800 rounded-lg h-24 flex flex-col items-center justify-center text-neutral-600 bg-neutral-950/40 text-[11px]">
                      <Upload className="w-5 h-5 mb-1 text-neutral-700" />
                      <span>Sin imagen adjuntada</span>
                    </div>
                  )}
                </div>

                {/* Precio del producto */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    * Precio de Venta ($)
                  </label>
                  <input
                    type="number"
                    value={prodPrecio}
                    onChange={(e) => setProdPrecio(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ej. 15000"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Descripción (De ejemplo) */}
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Descripción (Opcional)
                  </label>
                  <textarea
                    value={prodDescripcion}
                    onChange={(e) => setProdDescripcion(e.target.value)}
                    placeholder="Ej. Tocineta, papa frita, maíz tierno..."
                    rows={2}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                {/* RECETA DE INSUMOS (Descuento automático) */}
                <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 space-y-2">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                    Receta / Insumos a Descontar
                  </label>
                  <p className="text-[10px] text-neutral-400">
                    Define qué insumos y qué cantidad se descontarán del inventario automáticamente cuando se venda este producto.
                  </p>

                  {/* Formulario rápido para agregar ingrediente */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-[9px] text-neutral-500 block mb-0.5">Seleccionar Insumo</label>
                      <select
                        value={nuevoIngredienteInsumoId}
                        onChange={(e) => setNuevoIngredienteInsumoId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                      >
                        <option value="">-- Elige un Insumo --</option>
                        {inventario.map(ins => (
                          <option key={ins.id} value={ins.id}>
                            {ins.nombre} ({ins.unidad})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="text-[9px] text-neutral-500 block mb-0.5">Cantidad</label>
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={nuevoIngredienteCantidad}
                        onChange={(e) => setNuevoIngredienteCantidad(Number(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-white text-center font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!nuevoIngredienteInsumoId) return;
                        const selectedInsumo = inventario.find(i => i.id === nuevoIngredienteInsumoId);
                        if (!selectedInsumo) return;
                        // Evitar duplicados
                        if (prodReceta.some(r => r.insumoId === nuevoIngredienteInsumoId)) {
                          alert("Este insumo ya está agregado a la receta.");
                          return;
                        }
                        setProdReceta([...prodReceta, {
                          insumoId: nuevoIngredienteInsumoId,
                          nombre: selectedInsumo.nombre,
                          cantidad: nuevoIngredienteCantidad
                        }]);
                        setNuevoIngredienteInsumoId('');
                        setNuevoIngredienteCantidad(1);
                      }}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs cursor-pointer h-[26px]"
                    >
                      +
                    </button>
                  </div>

                  {/* Listado de ingredientes de la receta */}
                  <div className="space-y-1 pt-1 max-h-[120px] overflow-y-auto">
                    {prodReceta.length === 0 ? (
                      <p className="text-[10px] text-neutral-600 font-mono text-center py-1">Sin insumos configurados (sin receta)</p>
                    ) : (
                      prodReceta.map((ing, idx) => {
                        const originalInsumo = inventario.find(i => i.id === ing.insumoId);
                        const unidad = originalInsumo ? originalInsumo.unidad : 'unidades';
                        return (
                          <div key={idx} className="flex items-center justify-between bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-850">
                            <div className="text-[11px] text-neutral-300">
                              <span className="font-bold text-amber-500">{ing.cantidad}</span> {unidad} de <span className="font-semibold text-white">{ing.nombre}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setProdReceta(prodReceta.filter((_, i) => i !== idx));
                              }}
                              className="text-red-500 hover:text-red-400 text-[10px] font-bold px-1 py-0.5 rounded cursor-pointer hover:bg-red-500/10"
                            >
                              Eliminar
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Metadatos automáticos */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-850/60">
                  <div className="bg-neutral-950 px-2 py-1 rounded-lg text-neutral-400 text-[10px] font-mono flex items-center gap-1 border border-neutral-850">
                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                    <span>Fecha: {prodFecha}</span>
                  </div>
                  <div className="bg-neutral-950 px-2 py-1 rounded-lg text-neutral-400 text-[10px] font-mono flex items-center gap-1 border border-neutral-850">
                    <Clock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Hora: {prodHora}</span>
                  </div>
                </div>

                {/* Switch de borrador / publicado */}
                <div className="flex items-center justify-between p-2 bg-neutral-950 rounded-xl border border-neutral-850">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Publicar inmediatamente</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={prodPublicado}
                      onChange={(e) => setProdPublicado(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:bg-neutral-950"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Botonera de Productos exactos del modelo */}
            <div className="mt-6 pt-4 border-t border-neutral-800 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGrabarProducto}
                  disabled={!isProdFormValid}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md ${
                    isProdFormValid 
                      ? 'bg-neutral-800 hover:bg-neutral-750 text-white cursor-pointer active:scale-95 border border-neutral-700' 
                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850'
                  }`}
                  title="Graba borrador o actualiza cambios en la base de datos"
                >
                  <Check className="w-3.5 h-3.5" />
                  {prodId ? 'Grabar Cambios' : 'Grabar Borrador'}
                </button>

                <button
                  type="button"
                  onClick={() => handlePublicarProducto()}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 shadow-md ${
                    isProdFormValid
                      ? 'bg-gradient-to-r from-emerald-500 to-indigo-500 hover:brightness-110 text-neutral-950 cursor-pointer active:scale-95'
                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850'
                  }`}
                  title="Publica directamente el producto para habilitar en el POS"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {prodId ? 'Publicar Ahora' : 'Crear y Publicar'}
                </button>
              </div>

              {prodId && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleEliminarProducto(prodId!, prodNombre)}
                    className="py-2 px-3 bg-red-950/20 hover:bg-red-900/30 text-red-500 font-bold border border-red-950 text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar Producto
                  </button>

                  <button
                    type="button"
                    onClick={resetProdForm}
                    className="py-2 px-3 bg-neutral-950 hover:bg-neutral-850 text-neutral-400 text-xs rounded-xl transition-all border border-neutral-800"
                  >
                    Nuevo / Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Listado de Productos registrados */}
          <div className="lg:col-span-7 bg-neutral-900/40 border border-neutral-850 p-5 rounded-2xl flex flex-col h-[560px]">
            <h3 className="text-sm font-bold text-white mb-3 flex justify-between items-center bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
              <span>Listado de Productos Ofertados</span>
              <span className="text-[10px] text-neutral-400 font-mono">Total: {productos.length}</span>
            </h3>

            {/* Buscador o lista */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {productos.length === 0 ? (
                <div className="text-center py-12 text-neutral-600 font-mono text-xs">
                  Aún no hay productos en la carta del local. Inscríbelos o realiza una carga masiva.
                </div>
              ) : (
                productos.map((p) => (
                  <div 
                    key={p.id}
                    onClick={() => handleSeleccionarProducto(p)}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-4 relative overflow-hidden group cursor-pointer ${
                      prodId === p.id 
                        ? 'bg-neutral-800 border-amber-500/70 shadow' 
                        : 'bg-neutral-950 border-neutral-850 hover:bg-neutral-900/90 hover:border-neutral-700/60'
                    }`}
                    title="Haz clic en cualquier parte de la fila para editar"
                  >
                    <div className="flex items-center gap-3">
                      {/* Imagen miniatura */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-neutral-900">
                        <img 
                          src={p.imagen} 
                          alt={p.nombre} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=200&auto=format&fit=crop";
                          }}
                        />
                      </div>

                      {/* Nombre, categoría y precio */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-white text-xs block group-hover:text-amber-400 transition-colors">
                            {p.nombre}
                          </span>
                          <span className="bg-amber-500/15 border border-amber-500/25 text-amber-500 text-[9px] font-mono font-bold rounded px-1 py-0.5 uppercase">
                            {p.categoriaNombre}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 max-w-sm truncate mt-0.5">
                          {p.descripcion}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-white font-bold font-mono">
                            ${p.precio.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-neutral-600 font-mono">
                            ID: YYYY-MM-DD {p.fechaCreacion} · {p.horaCreacion}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Toggle Publicar */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePublicarProducto(p.id);
                        }}
                        className={`p-1.5 rounded-lg border text-[10px] transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          p.publicado 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                        }`}
                        title={p.publicado ? 'Ocultar producto de la carta' : 'Mostrar producto en menú'}
                      >
                        {p.publicado ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline font-bold uppercase">{p.publicado ? 'Público' : 'Borrador'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSeleccionarProducto(p);
                        }}
                        className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-800 hover:border-amber-500/30 transition-all cursor-pointer"
                        title="Modificar producto"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEliminarProducto(p.id!, p.nombre);
                        }}
                        className="p-1.5 bg-neutral-900 hover:bg-red-950 hover:text-red-500 text-neutral-500 rounded-lg border border-neutral-800 hover:border-red-900/30 transition-colors cursor-pointer"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================== */}
      {/* 3. SECCIÓN DE CARGA MASIVA (Sembrador Reutilizable)        */}
      {/* ========================================================== */}
      {activeTab === 'carga_masiva' && (
        <div className="bg-neutral-900/60 p-6 rounded-2xl border border-neutral-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-neutral-800">
            <div>
              <span className="text-xs text-amber-500 font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                <Database className="w-5 h-5 text-amber-500" />
                Sembrador de Datos - Componente Reutilizable Masivo
              </span>
              <p className="text-neutral-400 text-xs mt-1">
                Ideal para el despegue inicial. Permite pegar una lista JSON estructurada de todas tus categorías y productos para inyectarlos en Firebase en un solo lote.
              </p>
            </div>
            <button
              onClick={handleCargarEjemploJSON}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-amber-500 hover:text-amber-400 font-bold text-xs rounded-xl border border-neutral-700 transition-all cursor-pointer"
            >
              Cargar Plantilla de Ejemplo
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Estructura JSON (Categorías y Productos)
              </label>
              <textarea
                value={cargaMasivaInput}
                onChange={(e) => setCargaMasivaInput(e.target.value)}
                placeholder='Paste a JSON structure here...'
                rows={12}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Real feedback loops */}
            {cargaProgreso && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cargaProgreso}</span>
              </div>
            )}

            {cargaError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cargaError}</span>
              </div>
            )}

            <button
              onClick={handleCargaMasiva}
              disabled={!cargaMasivaInput.trim() || cargaProgreso !== null}
              className={`w-full py-3 rounded-xl text-xs font-black font-sans uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                cargaMasivaInput.trim() && !cargaProgreso
                  ? 'bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500 hover:brightness-110 text-neutral-950 cursor-pointer active:scale-95'
                  : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-850'
              }`}
            >
              <Database className="w-4 h-4" />
              Iniciar Inyección Masiva en Firestore Firebase
            </button>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO DE CONFIRMACIÓN DE ELIMINACIÓN SEGURA (SIN WINDOW.CONFIRM) */}
      {deleteConfirmation && (
        <div 
          id="confirm_delete_modal"
          className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white tracking-tight">¿Estás completamente seguro?</h4>
                <p className="text-neutral-400 text-xs leading-relaxed">
                  Vas a eliminar {deleteConfirmation.tipo === 'categoria' ? 'la categoría' : 'el producto'}{' '}
                  <span className="text-amber-500 font-extrabold font-mono">"{deleteConfirmation.nombre}"</span> de forma permanente.
                </p>
                {deleteConfirmation.tipo === 'categoria' && (
                  <p className="text-[10px] text-red-400 bg-red-500/5 max-w-full p-2 border border-red-500/10 rounded-lg">
                    ⚠️ Nota: Los productos dentro de esta categoría se conservarán pero quedarán huérfanos.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-neutral-850/60">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white font-bold text-xs rounded-xl border border-neutral-700 transition-all cursor-pointer text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarEliminacionSegura}
                className="py-2.5 px-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs rounded-xl transition-all cursor-pointer text-center uppercase tracking-wider active:scale-95 shadow-md flex items-center justify-center gap-1"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
