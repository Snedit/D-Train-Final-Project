// electron-worker/main.js - FIXED: Use Lucide-style symbols instead of emojis
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn, exec } = require("child_process");
const os = require("os");
const fetch = require('node-fetch');
const FormData = require('form-data');

let REGISTERED_DEVICE_ID = null;

// Icon replacements (using text symbols that match Lucide style)
const icons = {
  mobile: '[DEVICE]',
  rocket: '[START]',
  robot: '[WORKER]',
  search: '[SEARCH]',
  check: '[OK]',
  clipboard: '[INFO]',
  download: '[DOWNLOAD]',
  package: '[EXTRACT]',
  docker: '[DOCKER]',
  play: '[RUN]',
  inbox: '[OUTPUT]',
  file: '[FILE]',
  cloud: '[UPLOAD]',
  link: '[LINK]',
  broom: '[CLEAN]',
  party: '[SUCCESS]',
  error: '[ERROR]',
  warning: '[WARN]'
};

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
  win.loadFile(path.join(__dirname, "../worker-ui","dist", "index.html"));
  // win.webContents.openDevTools();
}

ipcMain.handle("set-device-id", async (event, deviceId) => {
  console.log(`${icons.mobile} Setting deviceId from frontend:`, deviceId);
  REGISTERED_DEVICE_ID = deviceId;
  
  const configPath = path.join(app.getPath('userData'), 'device-config.json');
  try {
    fs.writeFileSync(configPath, JSON.stringify({ deviceId }, null, 2));
  } catch (err) {
    console.error('Error saving device config:', err);
  }
  
  return { success: true, deviceId };
});

ipcMain.handle("get-device-id", async () => {
  if (REGISTERED_DEVICE_ID) {
    return REGISTERED_DEVICE_ID;
  }
  
  const configPath = path.join(app.getPath('userData'), 'device-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.deviceId) {
        console.log(`${icons.mobile} Loaded deviceId from disk:`, config.deviceId);
        REGISTERED_DEVICE_ID = config.deviceId;
        return config.deviceId;
      }
    }
  } catch (err) {
    console.error('Error reading device config:', err);
  }
  
  return null;
});

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

ipcMain.handle("run-test-job", async (event, jobId, passedDeviceId) => {
  const shortId = jobId.slice(-8);
  const jobDir = path.join(os.tmpdir(), "dtrain-jobs", `job-${shortId}`);
  const zipPath = path.join(os.tmpdir(), "dtrain-temp", `job-${jobId}.zip`);
  const outputDir = path.join(os.tmpdir(), "dtrain-jobs", `job-${shortId}`, "output");
  const outputZipPath = path.join(os.tmpdir(), "dtrain-temp", `output-${jobId}.zip`);

  const collectedLogs = [];
  const deviceId = passedDeviceId || REGISTERED_DEVICE_ID;
  
  if (!deviceId) {
    throw new Error(`${icons.error} No deviceId available. Please register first.`);
  }

  const sendLog = async (msg) => {
    event.sender.send("job-log", msg);
    const cleanMsg = msg.replace(/\n$/, '');
    collectedLogs.push(cleanMsg);
    await streamLogToBackend(jobId, deviceId, cleanMsg);
  };

  console.log(`${icons.rocket} Starting job ${jobId} (${shortId}) for worker ${deviceId}`);

  const imageName = `dtrain-job-${shortId}`;
  const containerName = `dtrain-container-${shortId}`;

  try {
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    if (fs.existsSync(outputZipPath)) fs.unlinkSync(outputZipPath);
    
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    fs.mkdirSync(jobDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    await sendLog(`${icons.search} Fetching job from backend...\n`);
    await sendLog(`${icons.robot} Using Worker ID: ${deviceId}\n`);

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
    
    await sendLog(`${icons.check} Job found: ${jobData.title || 'Untitled'}\n`);
    await sendLog(`${icons.clipboard} Main file: ${jobData.config?.entryFile || 'main.py'}\n`);

    if (!jobData.zipFileUrl) {
      throw new Error(`${icons.error} No zipFileUrl in job data`);
    }

    await sendLog(`${icons.download} Downloading ZIP from Supabase...\n`);
    const zipResponse = await fetch(jobData.zipFileUrl);

    if (!zipResponse.ok) {
      throw new Error(`ZIP download failed: ${zipResponse.status}`);
    }

    const zipBuffer = await zipResponse.buffer();
    fs.writeFileSync(zipPath, zipBuffer);
    await sendLog(`${icons.check} ZIP downloaded (${(zipBuffer.length/1024/1024).toFixed(1)}MB)\n`);

    await sendLog(`${icons.package} Extracting job files...\n`);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(jobDir, true);
    fs.unlinkSync(zipPath);
    await sendLog(`${icons.check} Files extracted successfully\n\n`);

    const mainFileName = jobData.config?.entryFile || 'main.py';
    const mainFilePath = path.join(jobDir, mainFileName);
    if (!fs.existsSync(mainFilePath)) {
      throw new Error(`${icons.error} Main file '${mainFileName}' not found in ZIP`);
    }
    await sendLog(`${icons.rocket} Main file verified: ${mainFileName}\n`);

    const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "${mainFileName}"]
    `.trim();

    fs.writeFileSync(path.join(jobDir, "Dockerfile"), dockerfile);
    await sendLog(`${icons.docker} Creating Dockerfile... ${icons.check}\n`);
    await sendLog(`${icons.docker} Building Docker image...\n`);

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

    await sendLog(`\n${icons.rocket} Docker image built successfully!\n`);
    await sendLog(`${icons.play} Running training job...\n`);
    
    await new Promise((resolve, reject) => {
      const run = spawn("docker", ["run", "--name", containerName, imageName], {
        shell: true
      });

      run.stdout.on("data", async (data) => await sendLog(data.toString()));
      run.stderr.on("data", async (data) => await sendLog(data.toString()));

      run.on("close", async (code) => {
        if (code === 0) {
          await sendLog(`\n${icons.check} Training completed!\n`);
          resolve();
        } else {
          reject(new Error(`Container failed with code ${code}`));
        }
      });
    });

    await sendLog(`${icons.download} Extracting output files...\n`);
    await new Promise((resolve) => {
      exec(
        `docker cp ${containerName}:/app/. "${outputDir}"`,
        async (error, stdout, stderr) => {
          if (error) await sendLog(`${icons.warning} Copy warning: ${stderr}\n`);
          resolve();
        }
      );
    });

    await sendLog(`${icons.broom} Cleaning up Docker resources...\n`);
    await new Promise((resolve) => {
      exec(`docker rm ${containerName}`, async (error) => {
        if (!error) await sendLog(`   ${icons.check} Container removed\n`);
        resolve();
      });
    });
    
    await new Promise((resolve) => {
      exec(`docker rmi ${imageName}`, async (error) => {
        if (!error) await sendLog(`   ${icons.check} Image removed\n`);
        resolve();
      });
    });

    const files = fs.readdirSync(outputDir);
    const outputFiles = files.filter(f => {
      const filePath = path.join(outputDir, f);
      const stats = fs.statSync(filePath);
      
      return stats.isFile() && 
             !['main.py', 'requirements.txt', 'Dockerfile', '__pycache__'].includes(f) &&
             !f.startsWith('.');
    });

    if (outputFiles.length === 0) {
      await sendLog(`\n${icons.warning} No output files generated\n`);
      
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

    await sendLog(`\n${icons.check} OUTPUT FILES GENERATED (${outputFiles.length}):\n`);
    for (const file of outputFiles) {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      await sendLog(`  ${icons.file} ${file.padEnd(25)} ${sizeKB} KB\n`);
    }

    await sendLog(`\n${icons.package} Creating output ZIP...\n`);
    const outputZip = new AdmZip();
    
    outputFiles.forEach(file => {
      const filePath = path.join(outputDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        outputZip.addLocalFile(filePath);
      } else if (stats.isDirectory()) {
        outputZip.addLocalFolder(filePath, file);
      }
    });
    
    outputZip.writeZip(outputZipPath);
    const zipStats = fs.statSync(outputZipPath);
    await sendLog(`${icons.check} Output ZIP created: ${(zipStats.size / 1024 / 1024).toFixed(2)} MB\n`);

    await sendLog(`${icons.cloud} Uploading results to server...\n`);
    
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
    await sendLog(`${icons.check} Results uploaded successfully!\n`);

    await sendLog(`${icons.broom} Cleaning up local files...\n`);
    if (fs.existsSync(outputZipPath)) {
      fs.unlinkSync(outputZipPath);
      await sendLog(`   ${icons.check} Output ZIP removed\n`);
    }
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      await sendLog(`   ${icons.check} Job directory removed\n`);
    }

    await sendLog(`\n${icons.party} JOB ${shortId.toUpperCase()} COMPLETED SUCCESSFULLY!\n`);
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
    console.error(`${icons.error} Job failed:`, errorMsg);
    
    await sendLog(`\n${icons.error} JOB FAILED:\n`);
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
      await sendLog(`${icons.broom} Cleaning up after error...\n`);
      exec(`docker rm -f ${containerName}`, () => {});
      exec(`docker rmi -f ${imageName}`, () => {});
      if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
      if (fs.existsSync(outputZipPath)) fs.unlinkSync(outputZipPath);
      await sendLog(`   ${icons.check} Cleanup complete\n`);
    } catch (cleanupErr) {
      console.error('Cleanup failed:', cleanupErr);
    }
    
    return { success: false, error: errorMsg, deviceId };
  }
});

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