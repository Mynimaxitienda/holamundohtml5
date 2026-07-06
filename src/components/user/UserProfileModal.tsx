import React, { useState, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { User } from "lucide-react";
import Notification from "../utils/Notification";
import "../../styles/user/UserProfileModal.css";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: () => void;
}

interface NotificationState {
  message: string;
  type: "success" | "error";
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdate,
}) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [notification, setNotification] = useState<NotificationState | null>(
    null,
  );

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (isOpen && user) {
      setUserEmail(user.email);
      const userDocRef = doc(db, "profile", user.uid);

      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setStoreName(data.storeName || "");
            setAddress(data.location?.address || "");
            setNeighborhood(data.location?.neighborhood || "");
            setPhone(data.location?.phone || "");
            setNotes(data.location?.notes || "");
          }
        })
        .catch((error) => {
          console.error("Error fetching user data:", error);
          setNotification({
            message: `Error al cargar: ${error.message}`,
            type: "error",
          });
        });
    }
  }, [isOpen, user]);

  const handleSave = async () => {
    if (user) {
      const userDocRef = doc(db, "profile", user.uid);
      const dataToSave = {
        email: user.email,
        storeName,
        location: {
          address,
          neighborhood,
          phone,
          notes,
        },
      };
      try {
        await setDoc(userDocRef, dataToSave, { merge: true });
        setNotification({
          message: "¡Perfil grabado exitosamente!",
          type: "success",
        });
        onProfileUpdate();
        setTimeout(() => {
          setNotification(null);
        }, 3000);
      } catch (error: any) {
        console.error("Error saving user data:", error);
        setNotification({
          message: `Error al grabar: ${error.message}`,
          type: "error",
        });
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      {notification && (
        <Notification
          notification={notification}
          onClose={() => setNotification(null)}
        />
      )}
      <div
        className="modal-content animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header border-b border-primary/10 pb-6 mb-8">
          <div className="profile-icon-container bg-primary/10 p-4 rounded-full text-primary mb-4">
            <User size={40} />
          </div>
          <div className="user-info text-center">
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
              EMAIL
            </p>
            <p className="text-sm font-bold text-dark/80">{userEmail || ""}</p>
          </div>
        </div>

        <div className="modal-section mb-6">
          <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-2 mb-2 block">
            Negocio / Persona
          </label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full bg-bg-light border border-primary/10 rounded-[24px] px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            placeholder="Nombre de la tienda"
          />
        </div>

        <div className="modal-section location-section bg-bg-light/50 p-6 rounded-[32px] border border-primary/5 mb-6">
          <label className="text-[11px] font-black text-primary uppercase tracking-widest ml-2 mb-4 block">
            Ubicación
          </label>
          <div className="space-y-3">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-white border border-primary/5 rounded-[24px] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Dirección"
            />
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="w-full bg-white border border-primary/5 rounded-[24px] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Barrio"
            />
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-white border border-primary/5 rounded-[24px] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Celular"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-white border border-primary/5 rounded-[24px] px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Observaciones"
            />
          </div>
        </div>

        <div className="modal-footer flex justify-center mt-8">
          <button
            className="bg-primary hover:bg-dark text-white font-bold py-4 px-12 rounded-full shadow-lg shadow-primary/20 transition-all active:scale-95"
            onClick={handleSave}
          >
            Grabar
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
