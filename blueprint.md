# Visión General

Esta aplicación permite a los usuarios gestionar y canjear bonos de fidelidad. Los usuarios pueden ver los bonos que se les han asignado, los que han canjeado y los que han utilizado para obtener premios. La aplicación está diseñada para ser intuitiva y fácil de usar, con una interfaz limpia y moderna.

## Características Implementadas

- **Autenticación de usuarios:** Los usuarios pueden iniciar sesión para acceder a su cuenta.
- **Panel de control:** La página principal cuenta con un panel de control que permite a los usuarios navegar por las diferentes secciones de la aplicación.
- **Bonos asignados:** Los usuarios pueden ver una lista de los bonos que se les han asignado, incluyendo el código del bono y la fecha de asignación.
- **Bonos canjeados:** Los usuarios pueden ver los bonos que ya han sido canjeados, con su fecha de canje.
- **Código QR:** Se muestra un código QR para facilitar el proceso de canje de bonos.
- **Premios:** Se ha añadido una nueva sección para que los usuarios puedan ver los bonos que han sido utilizados para reclamar premios.
- **Perfil de usuario:** Los usuarios pueden ver y actualizar sus datos personales.

## Plan para la Solicitud Actual

1.  **Añadir una nueva pestaña "Premios":** Se añadirá un nuevo botón al panel de control para la sección de premios.
2.  **Crear un nuevo componente `PrizeBonoList`:** Este componente se encargará de obtener y mostrar la lista de bonos utilizados para premios.
3.  **Integrar el nuevo componente:** El componente `PrizeBonoList` se mostrará cuando el usuario haga clic en la pestaña "Premios".
4.  **Añadir estilos:** Se crearán estilos para el nuevo componente para que coincida con el diseño general de la aplicación.
5.  **Verificar la funcionalidad:** Se realizarán pruebas para asegurar que la nueva funcionalidad se integre correctamente sin afectar a las características existentes.
