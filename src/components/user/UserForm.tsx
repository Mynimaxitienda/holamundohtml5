import React, { useState, useEffect } from "react";
import { Search, Plus, Save, ChevronRight, Trash2 } from "lucide-react";

interface UserFormProps {
  initialData: { codigo: string; usuario: string; whatsapp: string };
  onSearch: (codigo: string) => void;
  onSave: (userData: { codigo: string; usuario: string; whatsapp: string }) => void;
  onNext: () => void;
  setNotification: (notif: { message: string; type: "success" | "error" } | null) => void;
  onClear: () => void; // Añadido para limpiar el formulario
}

const UserForm: React.FC<UserFormProps> = ({
  initialData,
  onSearch,
  onSave,
  onNext,
  setNotification,
  onClear,
}) => {
  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "whatsapp") {
      // Solo permite números y elimina espacios
      const numericValue = value.replace(/\D/g, "");
      setFormData({ ...formData, [name]: numericValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleClear = () => {
    onClear(); // Llama a la función del padre para limpiar
  };

  const handleGenerateNew = () => {
    const newCode = Math.random().toString(36).substring(7).toUpperCase();
    setFormData({ codigo: newCode, usuario: "", whatsapp: "" });
    setNotification(null); // Limpia notificaciones al generar nuevo código
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid md:grid-cols-1 gap-8">
        <div className="space-y-3">
          <label className="text-[11px] font-black text-[#5F7D8C] uppercase tracking-widest ml-2">
            Código de Usuario
          </label>
          <div className="relative group flex items-center bg-highlight rounded-[32px] px-6 shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary/20">
            <button
              onClick={() => onSearch(formData.codigo)}
              className="text-primary/60 hover:text-primary transition-all duration-300 hover:scale-110 flex items-center justify-center shrink-0"
              title="Buscar código"
            >
              <Search size={20} />
            </button>
            <input
              type="text"
              name="codigo"
              value={formData.codigo}
              onChange={handleChange}
              placeholder="ingrese código o genere nuevo"
              className="w-full bg-transparent border-none py-4 pl-2 focus:outline-none text-dark placeholder:text-dark/60 font-medium appearance-none"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[11px] font-black text-[#5F7D8C] uppercase tracking-widest ml-2">
            Nombre del Usuario
          </label>
          <input
            type="text"
            name="usuario"
            value={formData.usuario}
            onChange={handleChange}
            placeholder="Nombres y Apellidos completos"
            className="input-custom rounded-[24px] border-[#E0E0E0]"
          />
        </div>

        <div className="space-y-3">
          <label className="text-[11px] font-black text-[#5F7D8C] uppercase tracking-widest ml-2">
            Whatsapp / Celular
          </label>
          <input
            type="text"
            name="whatsapp"
            value={formData.whatsapp}
            onChange={handleChange}
            placeholder="Ej: 3015444421"
            className="input-custom rounded-[24px] border-[#E0E0E0]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10">
        <button
          onClick={handleClear}
          className="flex items-center justify-center gap-2 bg-[#F0F7FA] hover:bg-blue-50 text-primary font-bold py-4 px-4 rounded-[32px] border border-primary/5 transition-all group active:scale-95"
        >
          <Trash2 size={18} />
          Limpiar
        </button>
        <button
          onClick={handleGenerateNew}
          className="flex items-center justify-center gap-2 bg-highlight hover:bg-highlight/80 text-dark font-bold py-4 px-4 rounded-[32px] shadow-lg shadow-highlight/20 transition-all active:scale-95"
        >
          <Plus size={18} />
          Nuevo
        </button>
        <button
          onClick={() => onSave(formData)}
          disabled={!formData.codigo || !formData.usuario}
          className={`flex items-center justify-center gap-2 font-bold py-4 px-4 rounded-[32px] transition-all ${
            formData.codigo && formData.usuario
              ? "bg-primary hover:bg-dark text-white shadow-lg shadow-primary/20"
              : "bg-[#F1F3F4] text-[#9AA0A6] cursor-not-allowed"
          }`}
        >
          <Save size={18} />
          Grabar
        </button>
        <button
          onClick={onNext}
          disabled={!formData.codigo}
          className={`flex items-center justify-center gap-2 font-bold py-4 px-4 rounded-[32px] transition-all ${
            formData.codigo
              ? "bg-primary hover:bg-dark text-white shadow-xl shadow-primary/20"
              : "bg-[#F1F3F4] text-[#9AA0A6] cursor-not-allowed"
          }`}
        >
          Siguiente
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default UserForm;
