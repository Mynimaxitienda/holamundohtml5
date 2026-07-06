import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../../services/firebase";
import {
  redeemProductBono,
  undoRedemption,
} from "../../services/productService";
import { deleteAssignedBono } from "../../services/elimAsignaService";
import {
  Ticket,
  CheckCircle,
  Clock,
  Calendar,
  User,
  ArrowRight,
  Eye,
  X,
  Store,
  RotateCcw,
  Gift,
} from "lucide-react";
const inactiveCart = "/img/0/carritoinactivo.png";
const activeCart = "/img/0/carritoactivo.png";

interface Bono {
  id: string;
  nombreTienda: string;
  fechaAsignacion: any;
  fechaRedencion?: any;
  estado: string;
  userCode: string;
  imageUrl?: string;
}

interface BonoListProps {
  userCode: string;
  type: "Asignado" | "Redimido" | "UsadoParaPremio";
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  forceUpdate: number;
}

const BonoList: React.FC<BonoListProps> = ({
  userCode,
  type,
  onSuccess,
  onError,
  forceUpdate,
}) => {
  const [bonos, setBonos] = useState<Bono[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!userCode) {
      setLoading(false);
      setBonos([]);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(
        db,
        "usuarios",
        currentUser.uid,
        "bonoflow",
        userCode,
        "bonos_asignados",
      ),
      where("estado", "==", type),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bonosData = snapshot.docs.map((doc) => {
          const bonoId = doc.id;
          const imageFolder = bonoId.slice(-1);
          return {
            ...doc.data(),
            id: bonoId,
            imageUrl: 
              doc.data().imageUrl ||
              (type === "Asignado"
                ? `/img/${imageFolder}/chicharrones.jpeg`
                : undefined),
          };
        }) as Bono[];

        bonosData.sort((a, b) => {
          const timeA = a.fechaAsignacion?.seconds || 0;
          const timeB = b.fechaAsignacion?.seconds || 0;
          return timeB - timeA;
        });

        setBonos(bonosData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching bonos:", error);
        onError("Error al cargar los bonos.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [userCode, type, onError, forceUpdate]);

  const handleRedeem = async (bonoId: string) => {
    try {
      const success = await redeemProductBono(bonoId, userCode);
      if (success) {
        onSuccess(`Bono ${bonoId} redimido con éxito.`);
      }
    } catch (error) {
      console.error("Error en handleRedeem:", error);
      onError(
        error instanceof Error
          ? error.message
          : "Hubo un error al redimir el bono.",
      );
    }
  };

  const handleUndoRedeem = async (bonoId: string) => {
    try {
      const success = await undoRedemption(bonoId, userCode);
      if (success) {
        onSuccess(`Redención del bono ${bonoId} deshecha con éxito.`);
      }
    } catch (error) {
      console.error("Error en handleUndoRedeem:", error);
      onError(
        error instanceof Error
          ? error.message
          : "Hubo un error al deshacer la redención del bono.",
      );
    }
  };

  const handleDelete = async (bonoId: string) => {
    try {
      const success = await deleteAssignedBono(bonoId, userCode);
      if (success) {
        setBonos((prev) => prev.filter((b) => b.id !== bonoId));
        onSuccess(`Asignación del bono ${bonoId} eliminada correctamente.`);
        setConfirmingDeleteId(null);
      }
    } catch (error) {
      console.error("Error en handleDelete:", error);
      onError(
        error instanceof Error
          ? error.message
          : "Hubo un error al eliminar el bono.",
      );
    }
  };

  const listConfig = {
    Asignado: {
      title: "Bonos Asignados",
      icon: <Clock size={16} />,
      emptyIcon: <Ticket size={64} strokeWidth={1} />,
      emptyText: "No hay bonos asignados",
    },
    Redimido: {
      title: "Bonos Redimidos",
      icon: <CheckCircle size={16} />,
      emptyIcon: <CheckCircle size={64} strokeWidth={1} />,
      emptyText: "No hay bonos redimidos",
    },
    UsadoParaPremio: {
      title: "Bonos Usados para Premio",
      icon: <Gift size={16} />,
      emptyIcon: <Gift size={64} strokeWidth={1} />,
      emptyText: "No hay bonos usados para premio",
    },
  };

  const config = listConfig[type];

  if (!userCode) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-secondary/40 space-y-6 animate-fade-in">
        <div className="p-8 bg-bg-light rounded-[40px] border border-primary/5">
          <User size={64} strokeWidth={1} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary/80">
            Sin usuario seleccionado
          </p>
          <p className="text-sm font-medium">
            Busque un usuario en la pestaña "Datos Personales" para ver sus
            bonos.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-pulse">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-xs font-black text-secondary/40 uppercase tracking-widest">
          Cargando bonos...
        </p>
      </div>
    );
  }

  if (bonos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-secondary/40 space-y-6 animate-fade-in">
        <div className="p-8 bg-bg-light rounded-[40px] border border-primary/5">
          {config.emptyIcon}
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-black text-primary/80">
            {config.emptyText}
          </p>
          <p className="text-sm font-medium">
            No se encontraron registros para este usuario.
          </p>
        </div>
      </div>
    );
  }

  const isPrizeEligible = type === "Redimido" && bonos.length >= 5;

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-sm font-black text-secondary/60 uppercase tracking-widest flex items-center gap-2">
            {config.icon}
            {config.title} ({bonos.length})
          </h2>
          {type === "Redimido" && (
            <div className="relative">
              <img
                src={isPrizeEligible ? activeCart : inactiveCart}
                alt="Carrito de compras"
                className="w-8 h-8"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {bonos.map((bono) => (
            <div
              key={bono.id}
              className="bg-white rounded-[32px] p-6 border border-primary/5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div
                className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] transition-transform group-hover:scale-110 ${
                  type === "Asignado" ? "bg-orange-500" : "bg-green-500"
                }`}
              ></div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-3 rounded-2xl ${
                        type === "Asignado"
                          ? "bg-orange-50 text-orange-500"
                          : "bg-green-50 text-green-500"
                      }`}
                    >
                      {type === "Asignado" ? (
                        <Ticket size={24} />
                      ) : (
                        <CheckCircle size={24} />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                        Código de Bono
                      </p>
                      <p className="text-lg font-black text-primary font-mono">
                        {bono.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-secondary/60">
                      <Store size={14} />
                      <span className="text-xs font-bold">
                        {bono.nombreTienda}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary/60">
                      <Calendar size={14} />
                      <span className="text-xs font-bold">
                        {bono.fechaAsignacion
                          ?.toDate()
                          .toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-secondary/60">
                      <User size={14} />
                      <span className="text-xs font-bold">{bono.userCode}</span>
                    </div>
                  </div>
                </div>

                {type === "Asignado" ? (
                  <div className="flex items-center gap-2">
                    {confirmingDeleteId === bono.id ? (
                      <div className="flex items-center gap-2 bg-red-50 p-2 rounded-2xl border border-red-200">
                        <span className="text-xs font-black text-red-700 px-2">¿Eliminar?</span>
                        <button
                          onClick={() => handleDelete(bono.id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        {bono.imageUrl && (
                          <button
                            onClick={() => setPreviewImage(bono.imageUrl!)}
                            className="flex items-center justify-center bg-sky-100 hover:bg-sky-200 text-sky-600 font-bold p-4 rounded-2xl transition-all active:scale-95"
                            aria-label="Vista previa del bono"
                          >
                            <Eye size={20} />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmingDeleteId(bono.id)}
                          className="flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 font-bold p-4 rounded-2xl transition-all active:scale-95 cursor-pointer"
                          title="Eliminar Asignación"
                          aria-label="Eliminar Asignación"
                        >
                          <X size={20} />
                        </button>
                        <button
                          onClick={() => handleRedeem(bono.id)}
                          className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-green-500/20 transition-all active:scale-95"
                        >
                          <>
                            Redimir
                            <ArrowRight size={18} />
                          </>
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-2 text-green-600">
                      <div className="flex items-center gap-2 bg-green-50 py-2 px-4 rounded-full border border-green-100">
                        <CheckCircle size={16} />
                        <span className="text-xs font-black uppercase tracking-widest">
                          Redimido
                        </span>
                      </div>
                      {bono.fechaRedencion && (
                        <div className="flex items-center gap-2 text-xs font-bold text-secondary/60">
                          <Calendar size={14} />
                          <span>
                            {bono.fechaRedencion
                              .toDate()
                              .toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUndoRedeem(bono.id)}
                      className="flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 font-bold p-4 rounded-2xl transition-all active:scale-95"
                      aria-label="Deshacer redención"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative p-2 rounded-[2rem] bg-white shadow-2xl border-4 border-white transition-transform duration-500 max-w-md w-11/12"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Vista previa del bono"
              className="rounded-2xl object-contain w-full"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              aria-label="Cerrar vista previa"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BonoList;
