import React, { useState } from "react";
import { auth, googleProvider } from "../services/firebase";
import { signInWithPopup } from "firebase/auth";
import { LogIn, AlertCircle } from "lucide-react";

export default function Login() {
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Error detallado al iniciar sesión con Google:", err);
      const detailedError = `Error: ${err.message} (Código: ${err.code})`;
      setError(detailedError);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col font-sans overflow-hidden">
      {/* Header Decor */}
      <div className="relative h-48 bg-primary overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-secondary/30 rounded-full blur-3xl"></div>
        <div className="absolute top-10 right-10 w-60 h-60 bg-secondary/20 rounded-full blur-3xl"></div>
        <div className="flex flex-col items-center justify-center h-full pt-8">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl mb-2">
            <span className="text-white text-3xl font-black">G</span>
          </div>
          <h1 className="text-white text-xl font-bold tracking-tight">
            gmynimaxitienda
          </h1>
        </div>
      </div>

      {/* Main Card */}
      <div className="flex-1 bg-bg-light rounded-t-[50px] px-8 pt-12 pb-8 shadow-[0_-20px_50px_rgba(0,0,0,0.1)] animate-slide-up">
        <div className="max-w-md mx-auto space-y-10">
          <div className="space-y-2 text-center">
            <h2 className="text-4xl font-black text-primary tracking-tight">
              Bienvenido
            </h2>
            <p className="text-secondary font-medium">
              Inicia sesión para gestionar tus bonos
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3 text-red-600 text-sm animate-fade-in">
              <AlertCircle size={20} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-primary font-bold py-5 px-8 rounded-full border-2 border-primary/10 shadow-xl shadow-primary/5 transition-all active:scale-95 group"
              style={{ borderRadius: "9999px" }}
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="Google"
                className="w-6 h-6"
              />
              <span className="text-lg">Continuar con Google</span>
            </button>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold text-secondary">
                <span className="bg-bg-light px-4">Acceso Seguro</span>
              </div>
            </div>
          </div>

          <div className="pt-10 text-center space-y-4">
            <p className="text-xs text-secondary/60 leading-relaxed px-8">
              Al continuar, aceptas nuestros{" "}
              <a href="#" className="text-primary font-bold hover:underline">
                Términos
              </a>{" "}
              y{" "}
              <a href="#" className="text-primary font-bold hover:underline">
                Privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
