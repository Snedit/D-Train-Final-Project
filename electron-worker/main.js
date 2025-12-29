// electron-worker/main.js - FIXED: Use consistent deviceId + Real-time Log Streaming
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn, exec } = require("child_process");
const os = require("os");
const fetch = require('node-fetch');
const FormData = require('form-data');

// ✅ FIXED: Store deviceId from registration instead of generating new one
let REGISTERED_DEVICE_ID = null;

// ✅ NEW: Helper function to stream logs to backend for real-time display in frontend
const streamLogToBackend = async (jobId, deviceId, logLine) => {
  try {
    await fetch('http://localhost:5000/api/worker/push-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        deviceId,
        line: logLine
      })
    });
  } catch (err) {
    // Silently fail - don't block job execution if log streaming fails
    console.error('Failed to stream log to backend:', err.message);
  }
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  });

  win.setMenu(null);
  win.maximize();
  win.loadFile(path.join(__dirname, "dist", "index.html"));
  win.webContents.openDevTools();
}

// ✅ NEW: Set deviceId from frontend (called after registration)
ipcMain.handle("set-device-id", async (event, deviceId) => {
  console.log('📱 Setting deviceId from frontend:', deviceId);
  REGISTERED_DEVICE_ID = deviceId;
  
  // Optionally save to disk for persistence
  const configPath = path.join(app.getPath('userData'), 'device-config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ deviceId }, null, 2));
  } catch (err) {
    console.error('Error saving device config:', err);
  }
  
  return { success: true, deviceId };
});

// ✅ Get Device ID Handler - returns registered ID or loads from disk
ipcMain.handle("get-device-id", async () => {
  if (REGISTERED_DEVICE_ID) {
    return REGISTERED_DEVICE_ID;
  }
  
  // Try loading from disk
  const configPath = path.join(app.getPath('userData'), 'device-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.deviceId) {
        console.log('📱 Loaded deviceId from disk:', config.deviceId);
        REGISTERED_DEVICE_ID = config.deviceId;
        return config.deviceId;
      }
    }
  } catch (err) {
    console.error('Error reading device config:', err);
  }
  
  return null; // Let frontend generate it
});

// Device Info Handler
ipcMain.handle("get-device-info", async () => {
  const cpus = os.cpus();
  const totalRAM = (os.totalmem() / (1024 ** 3)).toFixed(1);
  
  let gpuInfo = "Not detected";
  try {
    const gpuOutput = await new Promise((resolve) => {
      exec("wmic path win32_VideoController get name", (error, stdout) => {
        if (error) {
          resolve("Not detected");
        } else {
          const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Name'));
          resolve(lines[0]?.trim() || "Not detected");
        }
      });
    });
    gpuInfo = gpuOutput;
  } catch (err) {
    console.error("GPU detection failed:", err);
  }

  return {
    os: `${os.type()} ${os.release()}`,
    cpu: `${cpus[0]?.model || 'Unknown CPU'} (${cpus.length} cores)`,
    ram: `${totalRAM}GB`,
    gpu: gpuInfo
  };
});

// ✅ UPDATED: Complete Job Runner with Real-time Log Streaming
ipcMain.handle("run-test-job", async (event, jobId, passedDeviceId) => {
  const shortId = jobId.slice(-8);
  const jobDir = path.join(__dirname, "jobs", `job-${shortId}`);
  const zipPath = path.join(__dirname, "temp", `job-${jobId}.zip`);
  const outputDir = path.join(__dirname, "jobs", `job-${shortId}`, "output");
  const outputZipPath = path.join(__dirname, "temp", `output-${jobId}.zip`);

  const collectedLogs = [];
  
  // ✅ CRITICAL: Use PASSED deviceId from frontend (already registered)
  const deviceId = passedDeviceId || REGISTERED_DEVICE_ID;
  
  if (!deviceId) {
    throw new Error('❌ No deviceId available. Please register first.');
  }

  // ✅ UPDATED: Helper to send logs to worker UI AND stream to backend for frontend dashboard
  const sendLog = async (msg) => {
    // Send to worker UI (electron window)
    event.sender.send("job-log", msg);
    
    // Clean and collect for batch upload at end
    const cleanMsg = msg.replace(/\n$/, '');
    collectedLogs.push(cleanMsg);
    
    // ✅ NEW: Stream to backend in real-time for frontend dashboard
    await streamLogToBackend(jobId, deviceId, cleanMsg);
  };

  console.log(`🚀 Starting job ${jobId} (${shortId}) for worker ${deviceId}`);

  try {
    // 🔄 Cleanup previous run
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(outputZipPath)) fs.unlinkSync(outputZipPath);
    
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    fs.mkdirSync(jobDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    await sendLog("🔍 Fetching job from backend...\n");
    await sendLog(`🤖 Using Worker ID: ${deviceId}\n`);

    // ✅ Get job details using worker endpoint
    const jobResponse = await fetch(
      `http://localhost:5000/api/worker/job/${jobId}/details?deviceId=${deviceId}`,
      {
        headers: { 
          'Content-Type': 'application/json'
        }
      }
    );

    if (!jobResponse.ok) {
      const errorData = await jobResponse.text();
      throw new Error(`Job fetch failed: ${jobResponse.status} - ${errorData}`);
    }

    const responseData = await jobResponse.json();
    const jobData = responseData.job || responseData;
    
    await sendLog(`✅ Job found: ${jobData.title || 'Untitled'}\n`);
    await sendLog(`📋 Main file: ${jobData.config?.entryFile || 'main.py'}\n`);

    // 2️⃣ Download ZIP from Supabase
    if (!jobData.zipFileUrl) {
      throw new Error('❌ No zipFileUrl in job data');
    }

    await sendLog("📥 Downloading ZIP from Supabase...\n");
    const zipResponse = await fetch(jobData.zipFileUrl);

    if (!zipResponse.ok) {
      throw new Error(`ZIP download failed: ${zipResponse.status}`);
    }

    const zipBuffer = await zipResponse.buffer();
    fs.writeFileSync(zipPath, zipBuffer);
    await sendLog(`✅ ZIP downloaded (${(zipBuffer.length/1024/1024).toFixed(1)}MB)\n`);

    // 3️⃣ Extract ZIP files
    await sendLog("📦 Extracting job files...\n");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(jobDir, true);
    fs.unlinkSync(zipPath);
    await sendLog("✅ Files extracted successfully\n\n");

    // 4️⃣ Validate main file
    const mainFileName = jobData.config?.entryFile || 'main.py';
    const mainFilePath = path.join(jobDir, mainFileName);
    if (!fs.existsSync(mainFilePath)) {
      throw new Error(`❌ Main file '${mainFileName}' not found in ZIP`);
    }
    await sendLog(`🚀 Main file verified: ${mainFileName}\n`);

    // 5️⃣ Create Dockerfile
    const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "${mainFileName}"]
    `.trim();

    fs.writeFileSync(path.join(jobDir, "Dockerfile"), dockerfile);
    await sendLog("🐳 Creating Dockerfile... ✅\n");
    await sendLog("🐳 Building Docker image...\n");

    // 6️⃣ Build Docker image
    const imageName = `dtrain-job-${shortId}`;
    await new Promise((resolve, reject) => {
      const build = spawn("docker", ["build", "-t", imageName, "."], {
        cwd: jobDir,
        shell: true
      });

      build.stdout.on("data", async (data) => await sendLog(data.toString()));
      build.stderr.on("data", async (data) => await sendLog(data.toString()));

      build.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Docker build failed with code ${code}`));
      });
    });

    await sendLog("\n🚀 Docker image built successfully!\n");
    await sendLog("▶️  Running training job...\n");

    // 7️⃣ Run Docker container
    const containerName = `dtrain-container-${shortId}`;
    
    await new Promise((resolve, reject) => {
      const run = spawn("docker", ["run", "--name", containerName, imageName], {
        shell: true
      });

      run.stdout.on("data", async (data) => await sendLog(data.toString()));
      run.stderr.on("data", async (data) => await sendLog(data.toString()));

      run.on("close", async (code) => {
        if (code === 0) {
          await sendLog("\n✅ Training completed!\n");
          resolve();
        } else {
          reject(new Error(`Container failed with code ${code}`));
        }
      });
    });

    // 8️⃣ Extract output files
    await sendLog("📥 Extracting output files...\n");
    await new Promise((resolve) => {
      exec(
        `docker cp ${containerName}:/app/. "${outputDir}"`,
        async (error, stdout, stderr) => {
          if (error) await sendLog(`⚠️  Copy warning: ${stderr}\n`);
          resolve();
        }
      );
    });

    // 9️⃣ Cleanup container
    await new Promise((resolve) => {
      exec(`docker rm ${containerName}`, async () => {
        await sendLog("🧹 Container cleaned up\n");
        resolve();
      });
    });

    // 🔟 List and ZIP output files (only files, not directories)
    const files = fs.readdirSync(outputDir);
    const outputFiles = files.filter(f => {
      const filePath = path.join(outputDir, f);
      const stats = fs.statSync(filePath);
      
      // Only include files (not directories) and exclude input files
      return stats.isFile() && 
             !['main.py', 'requirements.txt', 'Dockerfile', '__pycache__'].includes(f) &&
             !f.startsWith('.');
    });

    if (outputFiles.length === 0) {
      await sendLog(`\n⚠️  No output files generated\n`);
      
      await fetch(`http://localhost:5000/api/jobs/${jobId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          errorMessage: 'No output files generated',
          logs: JSON.stringify(collectedLogs)
        })
      });
      
      throw new Error('No output files to upload');
    }

    await sendLog(`\n✅ OUTPUT FILES GENERATED (${outputFiles.length}):\n`);
    for (const file of outputFiles) {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      await sendLog(`  📄 ${file.padEnd(25)} ${sizeKB} KB\n`);
    }

    // Create ZIP of output files
    await sendLog("\n📦 Creating output ZIP...\n");
    const outputZip = new AdmZip();
    
    outputFiles.forEach(file => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        outputZip.addLocalFile(filePath);
      } else if (stats.isDirectory()) {
        // Add directory and its contents recursively
        outputZip.addLocalFolder(filePath, file);
      }
    });
    
    outputZip.writeZip(outputZipPath);
    const zipStats = fs.statSync(outputZipPath);
    await sendLog(`✅ Output ZIP created: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB\n`);

    // Upload ZIP and logs
    await sendLog("☁️  Uploading results to server...\n");
    
    const formData = new FormData();
    formData.append('deviceId', deviceId);
    formData.append('logs', JSON.stringify(collectedLogs));
    formData.append('outputZip', fs.createReadStream(outputZipPath));

    const uploadResponse = await fetch(`http://localhost:5000/api/jobs/${jobId}/complete`, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({ message: uploadResponse.statusText }));
      throw new Error(`Upload failed: ${errorData.message || uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    await sendLog(`✅ Results uploaded successfully!\n`);
    await sendLog(`🔗 Output URL: ${uploadResult.outputUrl}\n`);

    // Cleanup local files
    fs.unlinkSync(outputZipPath);
    fs.rmSync(jobDir, { recursive: true, force: true });

    await sendLog(`\n🎉 JOB ${shortId.toUpperCase()} COMPLETED SUCCESSFULLY!\n`);
    await sendLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return { 
      success: true, 
      outputUrl: uploadResult.outputUrl,
      jobId,
      shortId,
      deviceId
    };

  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    console.error('❌ Job failed:', errorMsg);
    
    await sendLog(`\n❌ JOB FAILED:\n`);
    await sendLog(`   ${errorMsg}\n`);
    await sendLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    try {
      await fetch(`http://localhost:5000/api/jobs/${jobId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          errorMessage: errorMsg,
          logs: JSON.stringify(collectedLogs)
        })
      });
    } catch (failErr) {
      console.error('Failed to report job failure:', failErr);
    }
    
    try {
      exec(`docker rm -f dtrain-container-${shortId}`, () => {});
      if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
      if (fs.existsSync(outputZipPath)) fs.unlinkSync(outputZipPath);
    } catch (cleanupErr) {
      console.error('Cleanup failed:', cleanupErr);
    }
    
    return { success: false, error: errorMsg, deviceId };
  }
});

// Fetch available jobs handler
ipcMain.handle("fetch-available-jobs", async () => {
  try {
    const deviceId = REGISTERED_DEVICE_ID;
    
    if (!deviceId) {
      return { success: false, error: 'No deviceId set', jobs: [] };
    }

    const response = await fetch(
      `http://localhost:5000/api/worker/available-jobs?deviceId=${deviceId}`,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return { 
      success: true, 
      jobs: data.jobs || data.availableJobs || [],
      count: data.count || 0
    };
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    return { success: false, error: err.message, jobs: [] };
  }
});

// Accept job handler
ipcMain.handle("accept-job", async (event, jobId) => {
  try {
    const deviceId = REGISTERED_DEVICE_ID;
    
    if (!deviceId) {
      throw new Error('No deviceId set');
    }

    const response = await fetch(`http://localhost:5000/api/worker/accept-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, deviceId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, job: data.job };
  } catch (err) {
    console.error('Failed to accept job:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});