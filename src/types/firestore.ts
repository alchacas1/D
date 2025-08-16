export interface Location {
  id?: string;
  label: string;
  value: string;
  names: string[];
  employees?: Employee[]; // Nueva estructura para empleados con tipo CCSS
}

export interface Employee {
  name: string;
  ccssType: 'TC' | 'MT'; // TC = Tiempo Completo, MT = Medio Tiempo
  extraAmount?: number; // Monto extra, valor inicial 0
  hoursPerShift?: number; // Horas por turno, valor predeterminado 8
}

export interface Sorteo {
  id?: string;
  name: string;
}
export interface UserPermissions {
  scanner: boolean;      // Escáner - Escanear códigos de barras
  calculator: boolean;   // Calculadora - Calcular precios con descuentos
  converter: boolean;    // Conversor - Convertir y transformar texto
  cashcounter: boolean;  // Contador Efectivo - Contar billetes y monedas
  timingcontrol: boolean; // Control Tiempos - Registro de venta de tiempos
  controlhorario: boolean; // Control Horario - Registro de horarios de trabajo
  supplierorders: boolean; // Órdenes Proveedor - Gestión de órdenes de proveedores
  mantenimiento: boolean;  // Mantenimiento - Nueva sección de mantenimiento
  scanhistory: boolean;    // Historial General de Escaneos - Ver historial completo de escaneos
  scanhistoryLocations?: string[]; // Locaciones específicas para historial de escaneos
}

export interface User {
  id?: string;
  name: string;
  location?: string;
  password?: string;
  role?: 'admin' | 'user' | 'superadmin';
  isActive?: boolean;
  permissions?: UserPermissions;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScheduleEntry {
  id?: string;
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string; // 'N', 'D', 'L', or empty string
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ScanResult {
  id?: string;
  code: string;
  timestamp: Date;
  source: 'mobile' | 'web';
  userId?: string;
  userName?: string;
  processed: boolean;
  sessionId?: string;
  processedAt?: Date;
  productName?: string; // Optional product name for scanned codes
  location?: string; // Selected location from mobile scanning
  hasImages?: boolean; // Indicates if the code has associated images
}

export interface CcssConfig {
  id?: string;
  mt: number; // Valor para Medio Tiempo
  tc: number; // Valor para Tiempo Completo
  valorhora: number; // Valor por hora predeterminado
  horabruta: number; // Valor por hora bruta
  updatedAt?: Date;
}
