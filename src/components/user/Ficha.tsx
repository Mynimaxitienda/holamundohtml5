import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { findUserByCode, UserData } from "../../services/userService";
import QRCode from "react-qr-code";
import {
  ChevronLeft,
  User,
  Phone,
  Ticket,
  Download,
  Share2,
} from "lucide-react";
import LoadingOverlay from "../loading/LoadingOverlay";
import Header from "../layout/Header";
import { auth, db } from "../../services/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Ficha() {
  const { codigo } = useParams<{ codigo: string }>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("gmynimaxitienda");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      if (!codigo) return;

      // Esperar a que el estado de autenticación esté listo
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const data = await findUserByCode(codigo);
            setUserData(data);

            const profileRef = doc(db, "profile", user.uid);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists() && profileSnap.data().storeName) {
              setStoreName(profileSnap.data().storeName);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
          } finally {
            setLoading(false);
          }
        } else {
          setLoading(false);
          // Opcional: Redirigir a login si no hay usuario
          // navigate('/login');
        }
      });

      return () => unsubscribe();
    };
    fetchData();
  }, [codigo, navigate]);

  if (loading) return <LoadingOverlay isLoading={true} />;

  if (!userData) {
    return (
      <div className="min-h-screen bg-bg-light flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black text-primary mb-4">
          Usuario no encontrado
        </h2>
        <button
          onClick={() => navigate("/home")}
          className="bg-primary text-white px-8 py-3 rounded-full font-bold shadow-lg"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans">
      <Header
        storeName={storeName}
        onLogout={() => navigate("/login")}
        onProfileClick={() => navigate("/home")}
      />

      <main className="flex-1 bg-bg-light rounded-t-[50px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] p-6 md:p-10">
        <div className="max-w-md mx-auto">
          <button
            onClick={() => navigate("/home")}
            className="flex items-center gap-2 text-secondary font-bold mb-8 hover:text-primary transition-colors"
          >
            <ChevronLeft size={20} />
            Volver
          </button>

          <div className="bg-white rounded-[40px] shadow-2xl overflow-hidden border border-white">
            <div className="bg-gradient-to-br from-primary to-blue-700 p-10 text-center text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-12 -mb-12 blur-xl"></div>

              <div className="relative z-10">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 border border-white/30">
                  <User size={48} strokeWidth={1.5} />
                </div>
                <h2 className="text-2xl font-black tracking-tight mb-1">
                  {userData.nombre}
                </h2>
                <p className="text-white/70 font-medium uppercase tracking-widest text-xs">
                  Cliente Premium
                </p>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-6 bg-accent/30 rounded-[32px] border-2 border-accent/50">
                  <QRCode
                    value={userData.codigo}
                    size={180}
                    fgColor="#1A73E8"
                    level="H"
                  />
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em] mb-1">
                    Código de Usuario
                  </p>
                  <p className="text-2xl font-black text-primary tracking-tighter">
                    {userData.codigo}
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-bg-light pt-8">
                <div className="flex items-center gap-4 p-4 bg-bg-light rounded-[20px]">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary shadow-sm">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                      Whatsapp
                    </p>
                    <p className="font-bold text-dark">
                      {userData.whatsappcelular}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-bg-light rounded-[20px]">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary shadow-sm">
                    <Ticket size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-secondary/40 uppercase tracking-widest">
                      Estado
                    </p>
                    <p className="font-bold text-emerald-600">Activo</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button className="flex items-center justify-center gap-2 bg-bg-light hover:bg-primary/5 text-primary font-bold py-4 rounded-[16px] transition-all active:scale-95">
                  <Download size={18} />
                  Guardar
                </button>
                <button className="flex items-center justify-center gap-2 bg-primary text-white font-bold py-4 rounded-[16px] shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all active:scale-95">
                  <Share2 size={18} />
                  Compartir
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-bg-light py-10 text-center">
        <p className="text-[10px] font-black text-secondary/40 uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} {storeName} &bull; Ficha de Cliente
        </p>
      </footer>
    </div>
  );
}
