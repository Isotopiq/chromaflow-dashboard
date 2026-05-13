import { create } from "zustand";
import {
  METHODS_DATA,
  RUNS,
  COLUMNS,
  BATCHES,
  ANALYTES,
  USERS,
  CURRENT_USER,
  type Method,
  type Run,
  type Column,
  type Batch,
} from "./mock-data";

type State = {
  methods: Method[];
  runs: Run[];
  columns: Column[];
  batches: Batch[];
  analytes: typeof ANALYTES;
  users: typeof USERS;
  currentUser: typeof CURRENT_USER;
  addMethod: (m: Method) => void;
  updateMethod: (id: string, patch: Partial<Method>) => void;
  annotatePeak: (runId: string, peakId: string, label: string) => void;
};

export const useLab = create<State>((set) => ({
  methods: METHODS_DATA,
  runs: RUNS,
  columns: COLUMNS,
  batches: BATCHES,
  analytes: ANALYTES,
  users: USERS,
  currentUser: CURRENT_USER,
  addMethod: (m) => set((s) => ({ methods: [m, ...s.methods] })),
  updateMethod: (id, patch) =>
    set((s) => ({
      methods: s.methods.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)),
    })),
  annotatePeak: (runId, peakId, label) =>
    set((s) => ({
      runs: s.runs.map((r) =>
        r.id === runId
          ? {
              ...r,
              peaks: r.peaks.map((p) =>
                p.id === peakId ? { ...p, analyteName: label, confidence: 1 } : p,
              ),
            }
          : r,
      ),
    })),
}));
