import { db, auth } from "./firebase";
import { doc, runTransaction } from "firebase/firestore";

/**
 * Elimina la asignación de un bono.
 * Borra el bono de la colección 'usuarios' (en bonos_asignados) y de la colección 'stores' (en el inventario del producto).
 *
 * @param bonoId - El ID completo del bono (ej. 'td1-b9n3m7x6v1-5-0').
 * @param userCode - El código único del usuario.
 * @returns {Promise<boolean>} - True si la eliminación fue exitosa.
 */
export const deleteAssignedBono = async (
  bonoId: string,
  userCode: string,
): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Usuario no autenticado.");
  }

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
    await runTransaction(db, async (transaction) => {
      // 1. Ejecutar todos los reads al inicio de la transacción si se requiere verificar su estado
      const userBonoSnap = await transaction.get(userBonoRef);
      const productBonoSnap = await transaction.get(productBonoRef);

      if (!userBonoSnap.exists()) {
        throw new Error("El bono asignado no existe en el perfil del usuario.");
      }

      // 2. Ejecutar las eliminaciones de manera atómica
      transaction.delete(userBonoRef);
      if (productBonoSnap.exists()) {
        transaction.delete(productBonoRef);
      }
    });

    console.log(`Bono ${bonoId} eliminado correctamente de stores y usuarios.`);
    return true;
  } catch (error: any) {
    console.error("Error al eliminar la asignación del bono:", error);
    throw error;
  }
};
