// Roles de la simulación: son los carriles del diagrama de flujo.
export const ROLES = {
  OPERARIO: { nombre: 'Operario de conteo', corto: 'Operario', tarea: 'Recorre el rack y cuenta cada posición.' },
  CONTROL: { nombre: 'Control de inventarios', corto: 'Control', tarea: 'Concilia, analiza diferencias y pide reconteos.' },
  SUPERVISOR: { nombre: 'Jefe de almacén', corto: 'Jefe de almacén', tarea: 'Aprueba los ajustes y el cierre del conteo.' },
};

export const puedeConciliar = (rol) => rol === 'CONTROL' || rol === 'SUPERVISOR';
