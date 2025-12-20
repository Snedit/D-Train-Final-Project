/// <reference types="vite/client" />

// Remove ALL previous Window interface declarations
declare global {
  interface Window {
    worker: {
      runTestJob: (jobId: string, authToken: string) => Promise<any>; // ✅ Added authToken parameter
      onLog: (callback: (data: string) => void) => void;
    };
    electron?: {
      getDeviceInfo: () => Promise<any>;
    };
  }
}

export {};