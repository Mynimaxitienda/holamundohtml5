import React, { useState, useEffect } from "react";
import { db } from "../../services/firebase";
import { collection, getDocs, doc, setDoc } from "firebase/firestore";
import { Shield, Store, User, Search, Save, Loader2, AlertCircle, Plus, X } from "lucide-react";

interface ProfileData {
  id: string;
  email?: string;
  storeName?: string;
  role?: string;
  location?: {
    address?: string;
    neighborhood?: string;
    phone?: string;
    notes?: string;
  };
}

interface RoleManagerProps {
  setNotification: (notif: { message: string; type: "success" | "error" } | null) => void;
}

export default function RoleManager({ setNotification }: RoleManagerProps) {
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Link user modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [linkUid, setLinkUid] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [linkStoreName, setLinkStoreName] = useState("");
  const [linkAddress, setLinkAddress] = useState("");
  const [linkRole, setLinkRole] = useState("usuario");
  const [isLinking, setIsLinking] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "profile"));
      const list: ProfileData[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          email: data.email || "",
          storeName: data.storeName || "",
          role: data.role || "usuario",
          location: data.location || {},
        });
      });
      setProfiles(list);
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
      setNotification({
        message: `Error al cargar perfiles: ${error.message}`,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const userDocRef = doc(db, "profile", userId);
      await setDoc(userDocRef, { role: newRole }, { merge: true });
      
      // Update local state
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      
      setNotification({
        message: "Rol actualizado exitosamente en Firestore.",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error updating role:", error);
      setNotification({
        message: `Error al actualizar rol: ${error.message}`,
        type: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleLinkUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUid.trim()) {
      setNotification({
        message: "Por favor, ingrese el UID del usuario.",
        type: "error",
      });
      return;
    }
    if (!linkEmail.trim()) {
      setNotification({
        message: "Por favor, ingrese el correo electrónico.",
        type: "error",
      });
      return;
    }

    setIsLinking(true);
    try {
      const uidClean = linkUid.trim();
      const emailClean = linkEmail.trim().toLowerCase();
      const storeNameClean = linkStoreName.trim();
      const addressClean = linkAddress.trim();

      const userDocRef = doc(db, "profile", uidClean);
      const dataToSave = {
        email: emailClean,
        storeName: storeNameClean || "Usuario Nuevo",
        role: linkRole,
        location: {
          address: addressClean || "",
        }
      };

      await setDoc(userDocRef, dataToSave, { merge: true });

      setNotification({
        message: `Usuario vinculado exitosamente con rol ${linkRole}.`,
        type: "success",
      });

      // Clear modal fields
      setLinkUid("");
      setLinkEmail("");
      setLinkStoreName("");
      setLinkAddress("");
      setLinkRole("usuario");
      setIsModalOpen(false);

      // Refresh list
      fetchProfiles();
    } catch (error: any) {
      console.error("Error linking user:", error);
      setNotification({
        message: `Error al vincular usuario: ${error.message}`,
        type: "error",
      });
    } finally {
      setIsLinking(false);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const search = searchQuery.toLowerCase();
    const address = p.location?.address?.toLowerCase() || "";
    return (
      p.email?.toLowerCase().includes(search) ||
      p.storeName?.toLowerCase().includes(search) ||
      p.id.toLowerCase().includes(search) ||
      p.role?.toLowerCase().includes(search) ||
      address.includes(search)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in text-dark">
      {/* Upper header segment */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-black text-primary uppercase tracking-wider">
            Gestión de Roles de Usuario
          </h2>
          <p className="text-sm text-secondary font-medium">
            Solo los administradores pueden cambiar los roles para otorgar o revocar permisos.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 bg-primary hover:bg-dark text-white font-bold px-6 py-3.5 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
        >
          <Plus size={16} />
          <span>Vincular Usuario Auth</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-secondary/50" size={18} />
        <input
          type="text"
          placeholder="Buscar por email o negocio..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#f1f5f9] border border-transparent rounded-[24px] pl-14 pr-6 py-4 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/50 shadow-inner"
        />
      </div>

      {/* Table Card container */}
      <div className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-xl shadow-primary/5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-primary" size={36} />
            <p className="text-sm font-bold text-secondary">Cargando perfiles de usuario...</p>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
            <AlertCircle className="text-secondary/30" size={40} />
            <p className="text-sm font-bold text-secondary">
              {searchQuery ? "No se encontraron resultados para tu búsqueda." : "No hay roles de usuario registrados."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-100 text-[11px] font-black text-secondary/75 uppercase tracking-widest">
                  <th className="py-4.5 px-6">USUARIO / EMAIL</th>
                  <th className="py-4.5 px-6">NEGOCIO / TIENDA</th>
                  <th className="py-4.5 px-6 text-center">ROL ASIGNADO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm font-medium text-dark">
                {filteredProfiles.map((p) => {
                  const displayName = p.storeName || "Usuario Sin Nombre";
                  const displayAddress = p.location?.address || p.storeName || "Sin especificar";
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* USUARIO / EMAIL */}
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-[15px] text-dark/90 mb-0.5">
                            {displayName}
                          </span>
                          <span className="text-xs text-secondary font-semibold">
                            {p.email || "Sin correo"}
                          </span>
                          <span className="text-[10px] font-mono text-secondary/50 mt-1 uppercase tracking-wider">
                            UID: {p.id}
                          </span>
                        </div>
                      </td>

                      {/* NEGOCIO / TIENDA */}
                      <td className="py-5 px-6">
                        <span className="text-sm font-bold text-dark/80">
                          {displayAddress}
                        </span>
                      </td>

                      {/* ROL ASIGNADO */}
                      <td className="py-5 px-6 text-center">
                        <div className="inline-flex items-center gap-2 justify-center">
                          {updatingId === p.id ? (
                            <Loader2 className="animate-spin text-primary" size={18} />
                          ) : (
                            <select
                              value={p.role || "usuario"}
                              onChange={(e) => handleUpdateRole(p.id, e.target.value)}
                              className="bg-white border border-gray-200 hover:border-primary/30 rounded-2xl px-4 py-2.5 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer transition-all"
                            >
                              <option value="admin">Administrador</option>
                              <option value="tienda">Tienda</option>
                              <option value="usuario">Usuario</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vincular Usuario Modal */}
      {isModalOpen && (
        <div className="modal-overlay animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-content animate-slide-up relative bg-white rounded-[40px] p-8 md:p-10 w-[90%] max-w-lg shadow-2xl border border-gray-100 text-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-secondary/60 hover:text-dark transition-colors p-1"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center border-b border-gray-100 pb-5 mb-6">
              <div className="bg-primary/10 p-4 rounded-full text-primary mb-3">
                <Shield size={32} />
              </div>
              <h3 className="text-lg font-black text-primary uppercase tracking-wider">
                Vincular Nuevo Usuario
              </h3>
              <p className="text-xs text-secondary/80 font-medium mt-1">
                Vincula un identificador UID de Firebase Auth con un rol y datos de negocio.
              </p>
            </div>

            <form onSubmit={handleLinkUserSubmit} className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-2 mb-1.5 block">
                  UID del Usuario (Firebase Auth ID)
                </label>
                <input
                  type="text"
                  placeholder="Ej. ThB1NpJ1FMM1GrRfv1KnD7un6q11"
                  value={linkUid}
                  onChange={(e) => setLinkUid(e.target.value)}
                  required
                  className="w-full bg-[#f8fafc] border border-gray-100 rounded-[20px] px-5 py-3.5 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-2 mb-1.5 block">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@correo.com"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  required
                  className="w-full bg-[#f8fafc] border border-gray-100 rounded-[20px] px-5 py-3.5 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-2 mb-1.5 block">
                  Nombre / Negocio / Tienda
                </label>
                <input
                  type="text"
                  placeholder="Ej. Gmynitiendasmaxi"
                  value={linkStoreName}
                  onChange={(e) => setLinkStoreName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-gray-100 rounded-[20px] px-5 py-3.5 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-2 mb-1.5 block">
                  Dirección (Ubicación)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Calle 14 # 7A-100"
                  value={linkAddress}
                  onChange={(e) => setLinkAddress(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-gray-100 rounded-[20px] px-5 py-3.5 text-sm font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-secondary/40"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-primary uppercase tracking-widest ml-2 mb-1.5 block">
                  Rol a Asignar
                </label>
                <select
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-gray-100 rounded-[20px] px-5 py-3.5 text-sm font-bold text-primary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="admin">Administrador</option>
                  <option value="tienda">Tienda</option>
                  <option value="usuario">Usuario</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-dark font-bold px-6 py-3.5 rounded-full text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isLinking}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-dark disabled:bg-primary/50 text-white font-bold px-8 py-3.5 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-95 text-sm"
                >
                  {isLinking ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Vinculando...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Vincular y Guardar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
