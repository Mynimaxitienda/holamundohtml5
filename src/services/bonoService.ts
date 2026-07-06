import { db, auth } from "./firebase";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

/**
 * Asigna un bono a un usuario específico, actualizando el estado en el inventario.
 *
 * Esta función realiza una transacción para asegurar la atomicidad de la operación:
 * 1. Cambia el estado del bono de 'Pendiente' a 'Asignado' en el inventario de productos.
 * 2. Crea un nuevo documento para el bono en la subcolección 'bonos_asignados' del usuario.
 *
 * @param bonoId - El ID del bono a asignar (ej. 'td1-b9n3m7x6v1-5-0').
 * @param userCode - El código único del usuario al que se le asigna el bono.
 * @returns {Promise<boolean>} - True si la asignación fue exitosa, de lo contrario, se lanza un error.
 * @throws {Error} - Si el usuario no está autenticado, el bono no es válido, o la transacción falla.
 */
export const assignBonoToUser = async (
  bonoId: string,
  userCode: string,
): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado.");

  const bonoIdParts = bonoId.split("-");
  if (bonoIdParts.length !== 4) {
    throw new Error("El formato del código del bono no es válido.");
  }
  const storeId = bonoIdParts[0];
  const productId = bonoIdParts[1];
  const bonoNumber = bonoIdParts[2];

  const userBonoRef = doc(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
    bonoId,
  );
  const userProfileRef = doc(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
  );
  const productBonoRef = doc(
    db,
    "stores",
    storeId,
    "products",
    productId,
    "bonos",
    bonoNumber,
  );

  try {
    // Obtener el nombre de la tienda dinámicamente del perfil del usuario administrador actual
    const adminProfileRef = doc(db, "profile", currentUser.uid);
    const adminProfileSnap = await getDoc(adminProfileRef);
    let storeName = "Gmynimaxitiendas";
    if (adminProfileSnap.exists() && adminProfileSnap.data().storeName) {
      storeName = adminProfileSnap.data().storeName.replace(/^GRAMO\./i, "");
    }

    // Al manejar permisos directo en Firebase, realizamos la transacción
    // directamente sobre el perfil de usuario, bono asignado y el bono central
    await runTransaction(db, async (transaction) => {
      const userProfileSnap = await transaction.get(userProfileRef);
      if (!userProfileSnap.exists()) {
        throw new Error(
          `El perfil de usuario con el código "${userCode}" no existe.`,
        );
      }

      const userBonoSnap = await transaction.get(userBonoRef);
      if (userBonoSnap.exists()) {
        throw new Error("Este bono ya ha sido asignado a este usuario.");
      }

      // Validar el estado del bono central si existe
      const productBonoSnap = await transaction.get(productBonoRef);
      if (productBonoSnap.exists()) {
        const productBonoData = productBonoSnap.data();
        if (productBonoData.estado && productBonoData.estado !== "Pendiente") {
          throw new Error(
            `El bono ya no está disponible. Estado actual: ${productBonoData.estado}`,
          );
        }
        transaction.update(productBonoRef, {
          estado: "Asignado",
          fechaAsignacion: serverTimestamp(),
          asignadoA: userCode,
        });
      } else {
        // Si no existe el documento en el inventario, lo creamos para registrar que ya fue asignado
        transaction.set(productBonoRef, {
          id: bonoNumber,
          estado: "Asignado",
          fechaAsignacion: serverTimestamp(),
          asignadoA: userCode,
        });
      }

      transaction.set(userBonoRef, {
        id: bonoId,
        nombreTienda: storeName,
        fechaAsignacion: serverTimestamp(),
        estado: "Asignado",
        userCode: userCode,
        asignadoPor: currentUser.uid,
      });
    });

    console.log(
      `Bono ${bonoId} asignado correctamente en la ruta dinámica del usuario.`
    );
    return true;
  } catch (error: any) {
    console.error("Error al asignar el bono:", error);
    throw error;
  }
};

/**
 * Obtiene la lista de bonos asignados a un usuario, ordenados por fecha.
 * @param userCode - El código del usuario.
 * @returns {Promise<any[]>} - Una lista de los bonos del usuario.
 */
export const getBonosByUser = async (userCode: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado.");
  const bonosRef = collection(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
  );
  const q = query(bonosRef, orderBy("fechaAsignacion", "desc"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Obtiene la lista de bonos usados para premio por un usuario.
 * @param userCode - El código del usuario.
 * @returns {Promise<any[]>} - Una lista de los bonos usados para premio.
 */
export const getUsedForPrizeBonosByUser = async (userCode: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado.");
  const bonosRef = collection(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
  );
  const q = query(
    bonosRef,
    where("estado", "==", "USADO PARA PREMIO"),
    orderBy("fechaRedencion", "desc"),
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Redime un bono para un usuario, actualizando su estado a 'Redimido'.
 * @param userCode - El código del usuario.
 * @param bonoId - El ID del bono a redimir.
 * @returns {Promise<boolean>} - True si la redención fue exitosa.
 */
export const redeemBono = async (
  userCode: string,
  bonoId: string,
): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado.");
  const userBonoRef = doc(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
    bonoId,
  );

  try {
    await runTransaction(db, async (transaction) => {
      const bonoSnap = await transaction.get(userBonoRef);
      if (!bonoSnap.exists() || bonoSnap.data().estado !== "Asignado") {
        throw new Error("El bono no es válido para la redención.");
      }
      transaction.update(userBonoRef, {
        estado: "Redimido",
        fechaRedencion: serverTimestamp(),
      });
    });
    return true;
  } catch (error) {
    console.error("Error al redimir el bono:", error);
    throw error;
  }
};
