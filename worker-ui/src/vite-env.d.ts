/// <reference types="vite/client" />

interface Window {
  worker: {
    runTestJob: () => Promise<{ success: boolean }>;
    onLog: (callback: (data: string) => void) => void;
  };
}
