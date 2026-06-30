/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'mesero' | 'caja' | 'cocina' | 'inventario' | 'pendiente';

export interface Usuario {
  uid: string;
  nombre: string;
  email: string;
  rol: UserRole;
  roles?: UserRole[];
  createdAt: any; // Firestore serverTimestamp or Date ISO String
  updatedAt: any;
}

export interface ProductoPedido {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  notas?: string;
}

export interface Pedido {
  id?: string;
  mesa: string;
  productos: ProductoPedido[];
  total: number;
  estado: 'pendiente' | 'en_proceso' | 'terminado' | 'entregado' | 'cancelado';
  notas?: string; // Alertas visuales si contiene exclusión de ingredientes
  meseroUid: string;
  meseroName: string;
  createdAt: any;
  updatedAt: any;
  pagado: boolean;
  metodoPago?: 'efectivo' | 'transferencia' | 'pendiente';
}

export interface EgresoCaja {
  id: string;
  concepto: string;
  monto: number;
  hora: string;
  autorizadoPor: string;
}

export interface VentaDiaria {
  id?: string;
  fecha: string; // YYYY-MM-DD
  montoApertura: number;
  ventasEfectivo: number;
  ventasTransferencia: number;
  ventasNequi?: number;
  ventasPse?: number;
  ventasDatafono?: number;
  totalVentas: number;
  egresos: EgresoCaja[];
  estado: 'abierto' | 'cerrado';
  createdAt: any;
  cerradoAt?: any;
  cerradoPor?: string;
}

export interface Insumo {
  id?: string;
  nombre: string;
  stock: number;
  unidad: string; // e.g. "unidades", "kg", "litros"
  stockMinimo: number;
  updatedAt: any;
}

export interface Configuracion {
  nombreLocal: string;
  direccion: string;
  telefono: string;
  limiteAlertaStock: number;
}

export interface Categoria {
  id?: string;
  nombre: string;
  imagen: string; // url o base64 data string
  descripcion?: string;
  fechaCreacion: string; // automítico YYYY-MM-DD
  horaCreacion: string;  // automático HH:MM:SS
  publicado: boolean;
  createdAt?: any;
}

export interface IngredienteReceta {
  insumoId: string;
  nombre: string;
  cantidad: number;
}

export interface Producto {
  id?: string;
  categoriaId: string;
  categoriaNombre: string; // caché de relación
  nombre: string;
  imagen: string; // url o base64 data string
  descripcion?: string;
  precio: number;
  fechaCreacion: string; // automático YYYY-MM-DD
  horaCreacion: string;  // automático HH:MM:SS
  publicado: boolean;
  createdAt?: any;
  receta?: IngredienteReceta[];
}

