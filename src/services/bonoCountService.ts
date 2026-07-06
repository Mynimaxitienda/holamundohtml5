import { db, auth } from "./firebase";
import { collection, onSnapshot } from "firebase/firestore";

export interface BonoCounts {
  asignados: number;
  redimidos: number;
  premios: number;
}

/**
 * Suscribe a los cambios en tiempo real de los bonos del usuario especificado
 * para calcular los contadores de cada categoría.
 * 
 * @param userCode - El código único del usuario.
 * @param onUpdate - Callback llamado con los nuevos conteos cada vez que cambia la base de datos.
 * @param onError - Callback opcional en caso de error.
 * @returns {() => void} - Función de desuscripción.
 */
export const subscribeToBonoCounts = (
  userCode: string,
  onUpdate: (counts: BonoCounts) => void,
  onError?: (error: any) => void
): (() => void) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !userCode) {
    onUpdate({ asignados: 0, redimidos: 0, premios: 0 });
    return () => {};
  }

  const bonosRef = collection(
    db,
    "usuarios",
    currentUser.uid,
    "bonoflow",
    userCode,
    "bonos_asignados"
  );

  const unsubscribe = onSnapshot(
    bonosRef,
    (snapshot) => {
      let asignados = 0;
      let redimidos = 0;
      let premios = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const estado = data.estado;
        if (estado === "Asignado") {
          asignados++;
        } else if (estado === "Redimido") {
          redimidos++;
        } else if (estado === "USADO PARA PREMIO" || estado === "UsadoParaPremio") {
          premios++;
        }
      });

      onUpdate({ asignados, redimidos, premios });
    },
    (error) => {
      console.error("Error al escuchar cambios de contadores de bonos:", error);
      if (onError) onError(error);
    }
  );

  return unsubscribe;
};
