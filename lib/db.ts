import Dexie, { type Table } from 'dexie';

export interface CheckHistory {
  id?: string; // UUID or Auto-increment
  drug1: string;
  drug2: string;
  severity: "none" | "moderate" | "severe";
  confidence: number;
  classProbs?: [number, number, number];
  latencyMs: number;
  timestamp: number;
  notes?: string;
}

export class ClinicalDDIDatabase extends Dexie {
  history!: Table<CheckHistory>;

  constructor() {
    super('ClinicalDDIDB');
    this.version(1).stores({
      history: '++id, drug1, drug2, severity, timestamp' // Indexed fields
    });
  }
}

export const db = new ClinicalDDIDatabase();
