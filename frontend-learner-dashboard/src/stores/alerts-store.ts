import { create } from "zustand"

interface Alert {
  id: string
  message: string
  timestamp: number
}

interface Request {
  id: string
  type: "reattempt" | "timeIncrease"
  message: string
  timestamp: number
}

interface AlertsStore {
  alerts: Alert[]
  requests: Request[]
  addAlert: (message: string) => void
  addRequest: (type: "reattempt" | "timeIncrease", message: string) => void
}

const useAlertsStore = create<AlertsStore>((set) => ({
  alerts: [],
  requests: [],
  addAlert: (message) =>
    set((state) => ({
      alerts: [...state.alerts, { id: Date.now().toString(), message, timestamp: Date.now() }],
    })),
  addRequest: (type, message) =>
    set((state) => ({
      requests: [...state.requests, { id: Date.now().toString(), type, message, timestamp: Date.now() }],
    })),
}))

export default useAlertsStore

