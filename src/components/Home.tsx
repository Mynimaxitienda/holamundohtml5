import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { signOutFromGoogle } from "../services/auth";
import { findUserByCode, saveUser, UserData } from "../services/userService";
import UserProfileModal from "./user/UserProfileModal";
import LoadingOverlay from "./loading/LoadingOverlay";
import Header from "./layout/Header";
import UserForm from "./user/UserForm";
import QRBono from "./user/QRBono";
import BonoList from "./user/BonoList";
import Notification from "./utils/Notification";
import { auth, db } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { User, QrCode, Ticket, CheckCircle, Award, Shield } from "lucide-react";
import RoleManager from "./admin/RoleManager";
import BonoBadge from "./user/BonoBadge";
import { subscribeToBonoCounts, BonoCounts } from "../services/bonoCountService";

interface NotificationState {
  message: string;
  type: "success" | "error";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("datos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [storeName, setStoreName] = useState("Cargando...");
  const [notification, setNotification] = useState<NotificationState | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [userData, setUserData] = useState<UserData>({ codigo: "", nombre: "", whatsappcelular: "" });
  const [forceUpdate, setForceUpdate] = useState(0);
  const [bonoCounts, setBonoCounts] = useState<BonoCounts>({
    asignados: 0,
    redimidos: 0,
    premios: 0,
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!userData.codigo) {
      setBonoCounts({ asignados: 0, redimidos: 0, premios: 0 });
      return;
    }

    const unsubscribe = subscribeToBonoCounts(userData.codigo, (newCounts) => {
      setBonoCounts(newCounts);
    });

    return () => unsubscribe();
  }, [userData.codigo]);

  const currentUser = auth.currentUser;

  const [role, setRole] = useState<string>("usuario");

  const fetchUserProfileAndRole = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      const devs = [
        "devluisluzardo@gmail.com",
        "gmynitiendasmaxi@gmail.com",
        "tiendawebapps@gmail.com",
      ];
      const isDev = user.email && devs.includes(user.email);
      
      const profileRef = doc(db, "profile", user.uid);
      const profileSnap = await getDoc(profileRef);
      
      let userRole = "usuario";
      
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        if (data.storeName) {
          const nameToDisplay = data.storeName.replace(/^GRAMO\./i, "");
          setStoreName(nameToDisplay);
        } else {
          setStoreName("");
        }
        userRole = data.role || "usuario";
      } else {
        setStoreName("");
      }

      if (isDev) {
        userRole = "admin";
        if (!profileSnap.exists() || profileSnap.data().role !== "admin") {
          await setDoc(
            profileRef,
            {
              role: "admin",
              email: user.email,
              storeName: profileSnap.data()?.storeName || "Administrador",
            },
            { merge: true }
          );
        }
      }
      
      setRole(userRole);
    }
  }, []);

  const fetchStoreName = fetchUserProfileAndRole;

  useEffect(() => {
    fetchUserProfileAndRole();
  }, [fetchUserProfileAndRole]);

  const handleLogout = async () => {
    try {
      await signOutFromGoogle();
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      setNotification({ message: "Error al cerrar sesión.", type: "error" });
    }
  };

  const handleSearch = async (codigo: string) => {
    if (!codigo) {
      setNotification({
        message: "Por favor, ingrese un código para buscar.",
        type: "error",
      });
      return;
    }

    setIsSearching(true);
    try {
      const cleanCode = codigo.trim().toUpperCase();
      const user = await findUserByCode(cleanCode);
      if (user) {
        setUserData(user);
        setNotification({ message: "Usuario encontrado.", type: "success" });
      } else {
        setUserData({ codigo: cleanCode, nombre: "", whatsappcelular: "" });
        setNotification({
          message: "No se encontró ningún usuario con ese código.",
          type: "error",
        });
      }
    } catch (error) {
      console.error("Error al buscar el usuario:", error);
      setNotification({
        message: "Hubo un error al buscar el usuario.",
        type: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSave = async (data: { codigo: string; usuario: string; whatsapp: string; }) => {
    setIsSearching(true);
    try {
      await saveUser(data);
      setNotification({
        message: "Usuario registrado exitosamente.",
        type: "success",
      });
      // Mantener los datos del usuario recién registrado activos
      setUserData({
        codigo: data.codigo.trim().toUpperCase(),
        nombre: data.usuario,
        whatsappcelular: data.whatsapp,
      });
    } catch (error) {
      console.error("Error al guardar el usuario:", error);
      setNotification({
        message: "Hubo un error al guardar el usuario.",
        type: "error",
      });
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleClearForm = () => {
    setUserData({ codigo: "", nombre: "", whatsappcelular: "" });
    setNotification(null);
  };

  const handleBonoAssigned = (message: string) => {
    setNotification({ message, type: "success" });
    setForceUpdate((prev) => prev + 1); // Trigger re-render of BonoList
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans">
      <LoadingOverlay isLoading={isSearching} />
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <Header
        storeName={storeName}
        onLogout={handleLogout}
        onProfileClick={() => setIsModalOpen(true)}
      />

      <main className="flex-1 bg-bg-light rounded-t-[50px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] animate-slide-up p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-[40px] shadow-2xl shadow-primary/5 border border-white overflow-hidden">
            <div className="p-8 md:p-10 bg-gradient-to-b from-primary/5 to-transparent">
              <h1 className="text-3xl font-black text-primary mb-3 text-center tracking-tight">
                Panel de Gestión
              </h1>

              <div className="flex flex-wrap justify-center items-center gap-3 mb-10">
                {/* Badge de Rol con diseño premium */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/20 shadow-sm transition-all duration-300 hover:scale-105">
                  <Shield size={14} className="text-primary animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-primary">
                    Rol: {role === "admin" ? "Administrador" : role === "colaborador" ? "Colaborador" : "Usuario"}
                  </span>
                </div>
                
                {/* Badge de Código de Usuario con diseño premium */}
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-100 to-sky-50 border border-sky-200 shadow-sm transition-all duration-300 hover:scale-105">
                  <User size={14} className="text-sky-600" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">
                    Código: <span className="font-black text-sky-900 font-mono select-all">{userData.codigo || "No seleccionado"}</span>
                  </span>
                </div>
              </div>

              <div className={`grid grid-cols-2 ${role === "admin" ? "md:grid-cols-6" : "md:grid-cols-5"} gap-4`}>
                {[
                  { id: "datos", icon: User, label: "Datos Personales" },
                  { id: "qr", icon: QrCode, label: "Código QR" },
                  { id: "asignados", icon: Ticket, label: "Asignados" },
                  { id: "redimidos", icon: CheckCircle, label: "Redimidos" },
                  { id: "premios", icon: Award, label: "Premios" },
                  ...(role === "admin" ? [{ id: "roles", icon: Shield, label: "Gestión Roles" }] : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex flex-col items-center gap-3 p-5 rounded-[32px] transition-all duration-300 ${
                      activeTab === tab.id
                        ? "bg-primary text-white shadow-xl shadow-primary/30 scale-105"
                        : "bg-[#F0F5F8] text-secondary hover:bg-secondary/10"
                    }`}
                  >
                    {["asignados", "redimidos", "premios"].includes(tab.id) && (
                      <BonoBadge
                        count={
                          tab.id === "asignados"
                            ? bonoCounts.asignados
                            : tab.id === "redimidos"
                            ? bonoCounts.redimidos
                            : bonoCounts.premios
                        }
                        type={tab.id as "asignados" | "redimidos" | "premios"}
                      />
                    )}
                    <tab.icon
                      size={22}
                      strokeWidth={activeTab === tab.id ? 2.5 : 2}
                    />
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest text-center ${
                        activeTab === tab.id
                          ? "text-white"
                          : "text-secondary"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 md:p-12">
              {activeTab === "datos" && (
                <UserForm
                  initialData={{
                    codigo: userData.codigo,
                    usuario: userData.nombre,
                    whatsapp: userData.whatsappcelular,
                  }}
                  onSearch={handleSearch}
                  onSave={handleSave}
                  onNext={() => setActiveTab("qr")}
                  setNotification={setNotification}
                  onClear={handleClearForm}
                />
              )}
              {activeTab === "qr" && (
                <QRBono
                  userCode={userData.codigo}
                  onSuccess={handleBonoAssigned}
                  onError={(message) =>
                    setNotification({ message, type: "error" })
                  }
                  onNext={() => setActiveTab("asignados")}
                />
              )}
              {activeTab === "asignados" && (
                <BonoList
                  userCode={userData.codigo}
                  type="Asignado"
                  onSuccess={(message) =>
                    setNotification({ message, type: "success" })
                  }
                  onError={(message) =>
                    setNotification({ message, type: "error" })
                  }
                  forceUpdate={forceUpdate}
                />
              )}
              {activeTab === "redimidos" && (
                <BonoList
                  userCode={userData.codigo}
                  type="Redimido"
                  onSuccess={(message) =>
                    setNotification({ message, type: "success" })
                  }
                  onError={(message) =>
                    setNotification({ message, type: "error" })
                  }
                  forceUpdate={forceUpdate}
                />
              )}
              {activeTab === "premios" && (
                <BonoList
                  userCode={userData.codigo}
                  type="UsadoParaPremio"
                  onSuccess={(message) =>
                    setNotification({ message, type: "success" })
                  }
                  onError={(message) =>
                    setNotification({ message, type: "error" })
                  }
                  forceUpdate={forceUpdate}
                />
              )}
              {activeTab === "roles" && role === "admin" && (
                <RoleManager setNotification={setNotification} />
              )}
            </div>
          </div>
        </div>
      </main>

      <UserProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProfileUpdate={fetchStoreName}
      />

      <footer className="bg-bg-light py-10 text-center">
        <p className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} &bull; Premium Management
        </p>
      </footer>
    </div>
  );
}
