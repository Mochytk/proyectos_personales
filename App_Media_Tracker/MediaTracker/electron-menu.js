// Actions the menu can send to the renderer. The renderer ignores anything not listed here.
const ACTIONS = [
  'new-item',
  'new-list',
  'search',
  'settings',
  'export-backup',
  'import-backup',
  'go-lists',
  'go-enjoying',
  'go-planner',
  'go-logbook',
];

/** Builds the application menu template. `send(action)` forwards an action to the window. */
function buildMenuTemplate({ isMac, appName, send }) {
  const action = (label, id, accelerator) => ({ label, accelerator, click: () => send(id) });

  const appMenu = {
    label: appName,
    submenu: [
      { role: 'about', label: `Acerca de ${appName}` },
      { type: 'separator' },
      action('Ajustes…', 'settings', 'CmdOrCtrl+,'),
      { type: 'separator' },
      { role: 'services', label: 'Servicios' },
      { type: 'separator' },
      { role: 'hide', label: `Ocultar ${appName}` },
      { role: 'hideOthers', label: 'Ocultar otros' },
      { role: 'unhide', label: 'Mostrar todo' },
      { type: 'separator' },
      { role: 'quit', label: `Salir de ${appName}` },
    ],
  };

  const fileMenu = {
    label: 'Archivo',
    submenu: [
      action('Nuevo elemento', 'new-item', 'CmdOrCtrl+N'),
      action('Nueva lista', 'new-list', 'Shift+CmdOrCtrl+N'),
      action('Buscar', 'search', 'CmdOrCtrl+F'),
      { type: 'separator' },
      action('Exportar respaldo…', 'export-backup', 'Shift+CmdOrCtrl+E'),
      action('Importar respaldo…', 'import-backup', 'Shift+CmdOrCtrl+I'),
      { type: 'separator' },
      isMac ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' },
    ],
  };

  const editMenu = {
    label: 'Edición',
    submenu: [
      { role: 'undo', label: 'Deshacer' },
      { role: 'redo', label: 'Rehacer' },
      { type: 'separator' },
      { role: 'cut', label: 'Cortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Pegar' },
      { role: 'selectAll', label: 'Seleccionar todo' },
    ],
  };

  const goMenu = {
    label: 'Ir',
    submenu: [
      action('Listas', 'go-lists', 'CmdOrCtrl+1'),
      action('Disfrutando', 'go-enjoying', 'CmdOrCtrl+2'),
      action('Planificador', 'go-planner', 'CmdOrCtrl+3'),
      action('Bitácora', 'go-logbook', 'CmdOrCtrl+4'),
    ],
  };

  const viewMenu = {
    label: 'Visualización',
    submenu: [
      { role: 'reload', label: 'Recargar' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Tamaño real' },
      { role: 'zoomIn', label: 'Acercar' },
      { role: 'zoomOut', label: 'Alejar' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Pantalla completa' },
    ],
  };

  const windowMenu = {
    label: 'Ventana',
    submenu: [
      { role: 'minimize', label: 'Minimizar' },
      { role: 'zoom', label: 'Zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front', label: 'Traer todo al frente' }] : []),
    ],
  };

  return [...(isMac ? [appMenu] : []), fileMenu, editMenu, goMenu, viewMenu, windowMenu];
}

module.exports = { ACTIONS, buildMenuTemplate };
