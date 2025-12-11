import { app, BrowserWindow } from "electron";
import path from "path";
import "./worker/redis.js";   // starts redis job subscriber

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join("ui", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
});
