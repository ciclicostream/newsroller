import { useStoredFlag } from "./storedFlag";

// Orientación de los monitores de vista previa: false = 16:9 (horizontal), true = 9:16 (vertical).
export const useMonitorVertical = () => useStoredFlag("nr.monitorVertical");
