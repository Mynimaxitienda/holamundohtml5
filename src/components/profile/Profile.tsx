import React, { useState, useEffect } from "react";
import { auth, db } from "../../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "../../styles/profile/profile.css";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
      const fetchProfile = async () => {
        const profileRef = doc(db, "profile", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setStoreName(profileSnap.data().storeName);
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSave = async () => {
    if (user) {
      try {
        // Actualizar perfil de Firebase Auth
        await updateProfile(user, { displayName, photoURL });

        // Guardar nombre de la tienda en Firestore
        const profileRef = doc(db, "profile", user.uid);
        await setDoc(profileRef, { storeName }, { merge: true });

        alert("Perfil actualizado con éxito");
      } catch (error) {
        console.error("Error al actualizar el perfil:", error);
        alert("Error al actualizar el perfil");
      }
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <img
            src={photoURL || "https://picsum.photos/seed/user/80/80"}
            alt="Avatar"
            className="profile-avatar"
          />
          <div className="profile-info">
            <h2>{displayName}</h2>
            <p>{user?.email}</p>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="displayName">Nombre</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="photoURL">URL de la Foto</label>
          <input
            id="photoURL"
            type="text"
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="storeName">Nombre de la Tienda</label>
          <input
            id="storeName"
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
          />
        </div>

        <div className="button-group-profile">
          <button
            className="form-button clear-button"
            onClick={() => navigate("/home")}
          >
            Cancelar
          </button>
          <button className="form-button save-button" onClick={handleSave}>
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
