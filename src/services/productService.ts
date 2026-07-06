import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  limit,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./firebase";

/**
 * Redime un bono de forma dinámica y atómica, siguiendo la estructura de datos real.
 * La función extrae la información necesaria del bonoId para localizar el inventario.
 * @param bonoId El ID del bono a redimir (ej. 'td1-b9n3m7x6v1-5-0').
 * @param userCode El código del usuario que redime el bono.
 * @returns {Promise<boolean>} True si la operación es exitosa.
 * @throws {Error} Si alguna de las operaciones o validaciones falla.
 */
export const redeemProductBono = async (
  bonoId: string,
  userCode: string,
): Promise<boolean> => {
  // 1. Extraer partes dinámicas del bonoId
  const bonoParts = bonoId.split("-");
  const prefix = bonoParts[0];
  const inventoryId = bonoParts[bonoParts.length - 1];

  if (!prefix || inventoryId === undefined) {
    throw new Error(`El formato del bonoId no es válido: ${bonoId}`);
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Operación no permitida: Usuario no autenticado.");
  }
  const userBonoRef = doc(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
    bonoId,
  );

  // 3. Ejecutar la transacción con validaciones robustas y manejo de errores simplificado
  try {
    await runTransaction(db, async (transaction) => {
      const userBonoDoc = await transaction.get(userBonoRef);

      if (!userBonoDoc.exists()) {
        throw new Error(
          `Error de consistencia: No se encontró el bono en el perfil del usuario.`,
        );
      }

      const bonoData = userBonoDoc.data();

      if (bonoData.estado !== "Asignado") {
        throw new Error(
          `El bono ya no está disponible. Estado actual: ${bonoData.estado || "No encontrado"}.`,
        );
      }

      // Si todo es correcto, realizar las actualizaciones
      transaction.update(userBonoRef, {
        estado: "Redimido",
        fechaRedencion: serverTimestamp(),
      });
    });

    console.log(
      `Transacción de redención completada con éxito para el bono ${bonoId}.`,
    );
    return true;
  } catch (error) {
    // Manejo de errores simplificado y robusto.
    // Se registra el error en consola y se propaga a la UI para ser mostrado.
    console.error("La transacción de redención falló:", error);
    throw error;
  }
};

/**
 * Deshace la redención de un bono, revirtiendo su estado de 'Redimido' a 'Asignado'.
 * Esta operación es útil para corregir errores de redención.
 * @param bonoId El ID del bono a restaurar (ej. 'td1-b9n3m7x6v1-5-0').
 * @param userCode El código del usuario propietario del bono.
 * @returns {Promise<boolean>} True si la operación es exitosa.
 * @throws {Error} Si alguna de las validaciones o la transacción falla.
 */
export const undoRedemption = async (
  bonoId: string,
  userCode: string,
): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Operación no permitida: Usuario no autenticado.");
  }
  const userBonoRef = doc(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
    bonoId,
  );

  // 3. Ejecutar la transacción para revertir el estado del bono
  try {
    await runTransaction(db, async (transaction) => {
      const userBonoDoc = await transaction.get(userBonoRef);

      if (!userBonoDoc.exists()) {
        throw new Error(
          "Error de consistencia: No se pudo encontrar el bono o el inventario del producto.",
        );
      }

      const bonoData = userBonoDoc.data();

      if (bonoData.estado !== "Redimido") {
        throw new Error(
          `Solo se puede deshacer la redención de bonos en estado 'Redimido'. Estado actual: ${bonoData.estado || "No encontrado"}.`,
        );
      }

      // Revertir el estado en el perfil del usuario y eliminar la fecha de redención
      transaction.update(userBonoRef, {
        estado: "Asignado",
        fechaRedencion: deleteField(), // Elimina el campo de la fecha de redención
      });
    });

    console.log(`La redención del bono ${bonoId} ha sido deshecha con éxito.`);
    return true;
  } catch (error) {
    console.error("Falló la transacción para deshacer la redención:", error);
    throw error;
  }
};

/**
 * Reclama un premio utilizando 5 bonos redimidos.
 * Esta función realiza una transacción para asegurar la atomicidad de la operación:
 * 1. Verifica que el usuario tenga al menos 5 bonos en estado 'Redimido'.
 * 2. Crea un documento en la subcolección 'premios_canjeados' con los IDs de los bonos utilizados.
 * 3. Actualiza el estado de esos 5 bonos a 'USADO PARA PREMIO'.
 *
 * @param userCode El código del usuario que reclama el premio.
 * @returns {Promise<boolean>} True si la operación es exitosa.
 * @throws {Error} Si el usuario no está autenticado, no tiene suficientes bonos o la transacción falla.
 */
export const claimPrizeWithBonos = async (
  userCode: string,
): Promise<boolean> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Operación no permitida: Usuario no autenticado.");
  }

  const userBonosRef = collection(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados",
  );
  const q = query(userBonosRef, where("estado", "==", "Redimido"), limit(5));

  try {
    // 1. Obtener los documentos candidatos FUERA de la transacción
    const redeemedBonosSnap = await getDocs(q);

    if (redeemedBonosSnap.docs.length < 5) {
      throw new Error(
        `No tienes suficientes bonos redimidos para reclamar un premio. Necesitas 5 y tienes ${redeemedBonosSnap.docs.length}.`,
      );
    }

    await runTransaction(db, async (transaction) => {
      // 2. Ejecutar TODOS los READS al inicio de la transacción para asegurar consistencia
      const snaps = [];
      for (const docRef of redeemedBonosSnap.docs) {
        const snap = await transaction.get(docRef.ref);
        snaps.push({ snap, ref: docRef.ref });
      }

      // Validar que sigan siendo válidos y estén en estado 'Redimido'
      for (const item of snaps) {
        if (!item.snap.exists()) {
          throw new Error("Uno de los bonos seleccionados no existe.");
        }
        if (item.snap.data()?.estado !== "Redimido") {
          throw new Error("Uno de los bonos ya no está en estado 'Redimido'.");
        }
      }

      const prizeBonosIds = snaps.map((s) => s.snap.id);

      // 3. Crear un nuevo documento de premio canjeado (WRITE)
      const newPrizeRef = doc(
        collection(
          db,
          "usuarios",
          currentUser.uid,
          "bonoflow",
          userCode,
          "premios_canjeados",
        ),
      );
      transaction.set(newPrizeRef, {
        fechaCanje: serverTimestamp(),
        tipoPremio: "snack", // o el tipo de premio que corresponda
        bonosUtilizados: prizeBonosIds,
      });

      // 4. Actualizar el estado de los bonos utilizados (WRITE)
      for (const item of snaps) {
        transaction.update(item.ref, {
          estado: "USADO PARA PREMIO",
          fechaRedencion: serverTimestamp(), // Opcional: actualizar fecha al usar para premio
        });
      }
    });

    console.log(`Premio reclamado con éxito para el usuario ${userCode}.`);
    return true;
  } catch (error) {
    console.error("La transacción para reclamar el premio falló:", error);
    throw error;
  }
};
