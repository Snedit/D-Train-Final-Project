const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worker", {
  runTestJob: () => ipcRenderer.invoke("run-test-job"),
  onLog: (callback) =>
    ipcRenderer.on("job-log", (_, data) => callback(data))
});

contextBridge.exposeInMainWorld("electron", {
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info")
});
