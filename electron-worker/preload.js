const { contextBridge, ipcRenderer } = require('electron');

// ✅ Clean up old listeners before adding new ones
const removeJobLogListeners = () => {
  ipcRenderer.removeAllListeners('job-log');
};

contextBridge.exposeInMainWorld("worker", {
  // ✅ Get persistent deviceId
  getDeviceId: () => ipcRenderer.invoke("get-device-id"),
  
  // ✅ Device hardware info
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info"),
  
  // ✅ Job execution with token
  runTestJob: (jobId, authToken) => ipcRenderer.invoke("run-test-job", jobId, authToken),
  
  // ✅ NEW: Fetch available jobs from backend
  fetchAvailableJobs: () => ipcRenderer.invoke("fetch-available-jobs"),
  
  // ✅ NEW: Accept/claim a job
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
  }
});
