const { contextBridge, ipcRenderer } = require('electron');

// ✅ Clean up old listeners before adding new ones
const removeJobLogListeners = () => {
  ipcRenderer.removeAllListeners('job-log');
};

contextBridge.exposeInMainWorld("worker", {
  // ✅ Accept token as second parameter
  runTestJob: (jobId, authToken) => ipcRenderer.invoke("run-test-job", jobId, authToken),
  
  onLog: (callback) => {
    // ✅ Remove old listeners first
    removeJobLogListeners();
    
    // ✅ Add single listener
    ipcRenderer.on('job-log', (_, data) => {
      callback(data);
    });
    
    console.log('✅ Job-log listener registered');
  }
});