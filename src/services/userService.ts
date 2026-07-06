import { db, auth, OperationType, handleFirestoreError } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export interface UserData {
  codigo: string;
  nombre: string;
  whatsappcelular: string;
}

const getCurrentUserId = () => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuario no autenticado.");
  }
  return user.uid;
};

/**
 * Busca un usuario en Firestore por su código único.
 * @param codigo El código del usuario a buscar.
 * @returns Los datos del usuario si se encuentra, de lo contrario null.
 */
export const findUserByCode = async (
  codigo: string,
): Promise<UserData | null> => {
  const cleanCode = codigo.trim().toUpperCase();
  if (!cleanCode) return null;

  const uid = getCurrentUserId();
  const path = `usuarios/${uid}/bonoflow/${cleanCode}`;
  try {
    const userDocRef = doc(db, path);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        codigo: data.codigo || docSnap.id,
        nombre: data.nombre || "",
        whatsappcelular: data.whatsappcelular || "",
      } as UserData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null; // unreachable due to throw in handleFirestoreError
  }
};

/**
 * Guarda o actualiza los datos de un usuario en Firestore.
 * @param userData Los datos del usuario a guardar.
 */
export const saveUser = async (userData: {
  codigo: string;
  usuario: string;
  whatsapp: string;
}) => {
  const { codigo, usuario, whatsapp } = userData;
  const cleanCode = codigo.trim().toUpperCase();
  const uid = getCurrentUserId();

  const path = `usuarios/${uid}/bonoflow/${cleanCode}`;
  try {
    const userDocRef = doc(db, path);

    await setDoc(
      userDocRef,
      {
        codigo: cleanCode,
        nombre: usuario,
        whatsappcelular: whatsapp,
        updatedAt: serverTimestamp(),
        createdBy: uid,
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
