const { contextBridge, ipcRenderer } = require('electron');

// ✅ Clean up old listeners before adding new ones
const removeJobLogListeners = () => {
  ipcRenderer.removeAllListeners('job-log');
};

contextBridge.exposeInMainWorld("worker", {
  // ✅ NEW: Set deviceId from frontend after registration
  setDeviceId: (deviceId) => ipcRenderer.invoke("set-device-id", deviceId),
  
  // ✅ Get persistent deviceId
  getDeviceId: () => ipcRenderer.invoke("get-device-id"),
  
  // ✅ Device hardware info
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info"),
  
  // ✅ Job execution with deviceId (not token)
  runTestJob: (jobId, deviceId) => ipcRenderer.invoke("run-test-job", jobId, deviceId),
  
  // ✅ Fetch available jobs from backend
  fetchAvailableJobs: () => ipcRenderer.invoke("fetch-available-jobs"),
  
  // ✅ Accept/claim a job
  acceptJob: (jobId) => ipcRenderer.invoke("accept-job", jobId),
  
  // ✅ Real-time log streaming
  onLog: (callback) => {
    // Remove old listeners first
    removeJobLogListeners();
    
    // Add single listener
    ipcRenderer.on('job-log', (_, data) => {
      callback(data);
    });
    
    console.log('✅ Job-log listener registered');
  },

  // ✅ Real-time Docker metrics (cpu%, memory%)
  onMetrics: (callback) => {
    ipcRenderer.removeAllListeners('job-metrics');
    ipcRenderer.on('job-metrics', (_, data) => {
      callback(data);
    });
  },

  // ✅ Remove metrics listener
  offMetrics: () => {
    ipcRenderer.removeAllListeners('job-metrics');
  },

  // ✅ Docker status check
  checkDocker: () => ipcRenderer.invoke("check-docker"),

  // ✅ Launch Docker Desktop
  launchDocker: () => ipcRenderer.invoke("launch-docker"),
});