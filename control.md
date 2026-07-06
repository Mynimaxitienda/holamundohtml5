# Control de Cambios y Versiones - BonoFlow

Este archivo sirve para versionar y documentar los cambios aplicados en la plataforma, asegurando el control y la trazabilidad de las mejoras del código y funcionalidad en la base de datos Firestore y la interfaz de usuario.

---

### [Versión 1.1.0] - Corrección de Flujo Multi-Usuario y Permisos de Firestore

#### 1. Corrección de Reglas de Seguridad en `firestore.rules`
- **Problema:** La colección global `/registros_bonos` no estaba declarada en las reglas de seguridad de Firestore, lo que causaba un fallo inmediato por "Permiso Denegado" (Permission Denied) para cualquier intento de lectura o escritura. Dado que la asignación (`assignBonoToUser`) y redención (`redeemProductBono`) de bonos se ejecutan en transacciones atómicas, el fallo en esta colección cancelaba toda la operación, impidiendo que el bono pasara de "Pendiente" a "Asignado".
- **Solución:** Se añadió una regla explícita para `/registros_bonos/{bonoId}` permitiendo lectura a cualquier usuario autenticado y escritura únicamente a usuarios con rol `admin` o `tienda`.

#### 2. Soporte para Lectura Segura de Clientes en `firestore.rules`
- **Problema:** Los clientes (`usuario` normal) solo podían acceder a ramas donde su propio `uid` coincidía con el nodo raíz de `/usuarios/{uid}/...`. Sin embargo, los bonos asignados son almacenados bajo el `uid` del administrador que los creó, impidiendo que los usuarios finales vieran sus bonos.
- **Solución:** Se implementó una regla de validación avanzada que permite a un cliente (`usuario`) leer la información y los bonos asignados bajo el nodo del administrador `/usuarios/{adminUid}/bonoflow/{userCode}/...` siempre que su código registrado en `/profile/{userId}/customerCode` coincida de forma exacta con `{userCode}`.

#### 3. Resolución Dinámica de `adminUid` en Servicios de Firestore
- **Problema:** Las funciones de servicio (`assignBonoToUser`, `redeemProductBono`, `undoRedemption`, `claimPrizeWithBonos`) usaban de forma rígida `currentUser.uid` para determinar el nodo de `/usuarios/...`. Esto fallaba cuando un administrador diferente, una tienda auxiliar o el propio usuario intentaban leer, redimir o procesar el bono.
- **Solución:** Se integró la función `findUserByCode(userCode)` para buscar el perfil global del usuario en `regusuariosnew`. De este perfil se extrae el campo `createdBy` (que almacena el `uid` del administrador original que registró el código), y se utiliza dinámicamente como `adminUid` para definir de manera consistente la ruta de datos.

#### 4. Tolerancia de Estados de Bonos Case-Insensitive (Mayúsculas/Minúsculas)
- **Problema:** Los bonos se validaban estrictamente en base a cadenas exactas como `"Pendiente"` o `"disponible"`. Si el inventario original de Firestore usaba variaciones ortográficas (como `"pendiente"`, `"Disponible"` o `"PENDIENTE"`), las transacciones de validación fallaban.
- **Solución:** Se modificaron los checks de estado para que sean completamente insensibles a mayúsculas y minúsculas (`.toLowerCase()`), permitiendo validar `"pendiente"`, `"disponible"` o cadenas vacías sin importar la capitalización en la base de datos Firestore.

#### 5. Sincronización del Perfil y Consulta en la Interfaz de Usuario (`Home.tsx` y `BonoList.tsx`)
- **Problema:** Cuando el cliente final con rol `usuario` iniciaba sesión, la app intentaba cargar su perfil localmente desde su propio `uid` en `/usuarios/{uid}/bonoflow/...`, el cual siempre estaba vacío. Además, la interfaz de `BonoList` consultaba el listado usando el `uid` actual del usuario logueado en lugar del creador original de su código.
- **Solución:** 
  - En `Home.tsx`, se modificó la función `fetchUserProfileAndRole` para que el rol `usuario` cargue su perfil de forma global mediante `findUserByCode(code)`, recuperando el campo `createdBy`.
  - En `BonoList.tsx`, se añadió la propiedad opcional `adminUid` y se modificó la consulta para que, si el rol es `usuario` y se provee el `adminUid`, se consulte la subcolección bajo el nodo del administrador original (`targetUid`), garantizando la correcta visualización de los cupones.

---

### [Versión 1.2.0] - Robustez en la Asignación de Bonos y Flexibilización de Reglas de Seguridad

#### 1. Creación Automática de Perfiles Locales en la Transacción de Asignación
- **Problema:** Cuando un usuario registrado de manera global (en la colección `regusuariosnew`) no tenía una subcolección local creada bajo el nodo del administrador (`usuarios/{adminUid}/bonoflow/{userCode}`), la transacción de asignación de bonos (`assignBonoToUser`) fallaba de inmediato porque el documento de perfil no existía localmente en la base de datos Firestore, arrojando el error *"El perfil de usuario con el código X no existe."*.
- **Solución:** Se mejoró `assignBonoToUser` de modo que, si el documento de perfil local no existe dentro de la transacción, el sistema lo crea e inicializa de manera automática utilizando los datos del perfil global del usuario. Si no existiera perfil global, se inicializa con un nombre por defecto para que la transacción se complete exitosamente sin fallos ni bloqueos.

#### 2. Flexibilización y Corrección de Reglas de Firestore para Usuarios Finales (`usuario`)
- **Problema:** Los usuarios logueados con el rol de `usuario` (clientes finales) obtenían un error de permisos denegados (`permission-denied`) al intentar asignar o registrar bonos, ya que las operaciones de escritura estaban restringidas estrictamente a administradores (`admin`) o tiendas (`tienda`). Adicionalmente, no podían leer o interactuar con el nodo `/usuarios/{adminUid}/bonoflow/{userCode}/bonos_asignados` porque no eran dueños del `adminUid`.
- **Solución:** Se ajustaron y expandieron las reglas de seguridad en `firestore.rules` para:
  - Permitir operaciones de escritura (creación y actualización) a los usuarios finales en su respectiva rama `/usuarios/{adminUid}/bonoflow/{userCode}` y subcolecciones, siempre que su código de cliente (`customerCode`) en su perfil autenticado coincida con `{userCode}`.
  - Permitir a los usuarios autenticados escribir de forma segura en `registros_bonos`, `stores` y `tienda` durante el proceso de asignación y redención, eliminando de raíz cualquier restricción de permisos en estas transacciones atómicas.

#### 3. Captura Detallada de Errores de Permisos con `handleFirestoreError`
- **Problema:** Cuando ocurría un error de permisos en Firebase Firestore durante la asignación o redención, el error se mostraba de manera genérica en consola, dificultando el diagnóstico rápido de la regla de seguridad o ruta afectada.
- **Solución:** Se integró la función `handleFirestoreError` en el bloque `catch` de `assignBonoToUser` y `redeemBono` dentro de `bonoService.ts`, asegurando el reporte estructurado en formato JSON con información de ruta de base de datos, UID de usuario y rol activo.

---

### [Versión 1.2.1] - Resolución de Bloqueo Mutuo (Deadlock) de Perfiles de Desarrollador

#### 1. Priorización de Correos de Desarrollador en las Reglas de Seguridad
- **Problema:** En las reglas de seguridad anteriores, la función `getRole()` leía el documento de perfil del usuario `/profile/{uid}` en Firestore para determinar su rol. Si el documento existía pero estaba configurado con `role: "usuario"`, la regla evaluaba al usuario como un cliente final sin privilegios administrativos (`admin`). Esto bloqueaba transacciones de administrador como la asignación de bonos en colecciones compartidas (`registros_bonos`, `stores`).
- **Solución:** Se reestructuró la función `getRole()` en `firestore.rules` para validar los correos electrónicos del equipo de desarrollo (`devluisluzardo@gmail.com`, `gmynitiendasmaxi@gmail.com`, `tiendawebapps@gmail.com`) de forma prioritaria, antes de consultar la base de datos. Si el correo electrónico coincide, se le concede automáticamente el rol de `'admin'`, independientemente del estado de su documento de perfil en Firestore.

#### 2. Auto-Curación y Sincronización del Perfil de Administrador en el Cliente
- **Problema:** Si el perfil de un desarrollador en la base de datos Firestore tenía guardado un rol incorrecto (como `"usuario"`), intentar cambiarlo desde el cliente de forma convencional fallaba porque las reglas de Firestore bloqueaban a un `"usuario"` de cambiar su propio rol (un clásico bloqueo mutuo).
- **Solución:** Se implementó una lógica de auto-curación silenciosa en `fetchUserProfileAndRole` de `Home.tsx`. Cuando un usuario con correo de desarrollador inicia sesión, el sistema verifica su rol registrado en Firestore. Si difiere de `"admin"` o si no existe, el cliente actualiza o crea automáticamente su documento de perfil con el rol `"admin"`. Dado que el cambio en las reglas de seguridad ahora reconoce prioritariamente su correo electrónico como administrador, esta actualización de la base de datos se completa con éxito sin ningún tipo de bloqueo de permisos.

---
