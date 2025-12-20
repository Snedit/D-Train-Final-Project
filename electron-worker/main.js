const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn, exec } = require("child_process");
const os = require("os");
const fetch = require('node-fetch'); // ✅ node-fetch v2 (CommonJS)

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
  
  win.webContents.on('did-finish-load', () => {
    console.log('✅ Window loaded - checking worker...');
    win.webContents.executeJavaScript(`
      setTimeout(() => {
        console.log('🔍 PRELOAD CHECK - window.worker:', !!window.worker);
        console.log('🔍 Methods:', Object.keys(window.worker || {}));
      }, 1000);
    `);
  });
}

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

// ✅ FIXED: Job runner with proper fetch handling
ipcMain.handle("run-test-job", async (event, jobId, authToken) => {
  const shortId = jobId.slice(-8);
  const jobDir = path.join(__dirname, "jobs", `job-${shortId}`);
  const zipPath = path.join(__dirname, "temp", `job-${jobId}.zip`);
  const outputDir = path.join(__dirname, "jobs", `job-${shortId}`, "output");

  console.log(`🚀 Starting job ${jobId} (${shortId})`);

  try {
    // 🔄 Cleanup previous run
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    fs.mkdirSync(path.dirname(zipPath), { recursive: true });
    fs.mkdirSync(jobDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    event.sender.send("job-log", "🔍 Fetching job from backend...\n");

    // 1️⃣ Get job details from YOUR backend
    const token = authToken || 'test-token';
    console.log('🔑 Using token:', token ? `${token.slice(0,10)}...` : 'none');

    const jobResponse = await fetch(`http://localhost:5000/api/jobs/${jobId}/status`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!jobResponse.ok) {
      throw new Error(`Job fetch failed: ${jobResponse.status} ${jobResponse.statusText}`);
    }

    const jobData = await jobResponse.json();
    event.sender.send("job-log", `✅ Job found: ${jobData.title || 'Untitled'}\n`);
    event.sender.send("job-log", `📋 Main file: ${jobData.config?.entryFile || 'main.py'}\n`);

    // 2️⃣ Download ZIP from Supabase
    if (!jobData.zipFileUrl) {
      throw new Error('❌ No zipFileUrl in job data');
    }

    event.sender.send("job-log", "📥 Downloading ZIP from Supabase...\n");
    console.log('📎 ZIP URL:', jobData.zipFileUrl);

    const zipResponse = await fetch(jobData.zipFileUrl);

    if (!zipResponse.ok) {
      throw new Error(`ZIP download failed: ${zipResponse.status}`);
    }

    const zipBuffer = await zipResponse.buffer();
    fs.writeFileSync(zipPath, zipBuffer);
    event.sender.send("job-log", `✅ ZIP downloaded (${(zipBuffer.length/1024/1024).toFixed(1)}MB)\n`);

    // 3️⃣ Extract ZIP files
    event.sender.send("job-log", "📦 Extracting job files...\n");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(jobDir, true);
    fs.unlinkSync(zipPath);
    event.sender.send("job-log", "✅ Files extracted successfully\n\n");

    // 4️⃣ Validate main file exists
    const mainFileName = jobData.config?.entryFile || 'main.py';
    const mainFilePath = path.join(jobDir, mainFileName);
    if (!fs.existsSync(mainFilePath)) {
      throw new Error(`❌ Main file '${mainFileName}' not found in ZIP`);
    }
    event.sender.send("job-log", `🚀 Main file verified: ${mainFileName}\n`);

    // 5️⃣ Create dynamic Dockerfile
    const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "${mainFileName}"]
    `.trim();

    fs.writeFileSync(path.join(jobDir, "Dockerfile"), dockerfile);
    event.sender.send("job-log", "🐳 Creating Dockerfile... ✅\n");
    event.sender.send("job-log", "🐳 Building Docker image...\n");

    // 6️⃣ Build Docker image
    const imageName = `dtrain-job-${shortId}`;
    await new Promise((resolve, reject) => {
      const build = spawn("docker", ["build", "-t", imageName, "."], {
        cwd: jobDir,
        shell: true
      });

      build.stdout.on("data", (data) => {
        event.sender.send("job-log", data.toString());
      });

      build.stderr.on("data", (data) => {
        event.sender.send("job-log", data.toString());
      });

      build.on("close", (code) => {
        if (code === 0) {
          resolve(null);
        } else {
          reject(new Error(`Docker build failed with code ${code}`));
        }
      });
    });

    event.sender.send("job-log", "\n🚀 Docker image built successfully!\n");
    event.sender.send("job-log", "▶️  Running training job...\n");

    // 7️⃣ Run Docker container
    const containerName = `dtrain-container-${shortId}`;
    
    await new Promise((resolve, reject) => {
      const run = spawn("docker", ["run", "--name", containerName, imageName], {
        shell: true
      });

      run.stdout.on("data", (data) => {
        event.sender.send("job-log", data.toString());
      });

      run.stderr.on("data", (data) => {
        event.sender.send("job-log", data.toString());
      });

      run.on("close", (code) => {
        if (code === 0) {
          event.sender.send("job-log", "\n✅ Training completed!\n");
          resolve(null);
        } else {
          reject(new Error(`Container failed with code ${code}`));
        }
      });
    });

    // 8️⃣ Extract output files
    event.sender.send("job-log", "📥 Extracting output files...\n");
    await new Promise((resolve) => {
      exec(
        `docker cp ${containerName}:/app/. "${outputDir}"`,
        (error, stdout, stderr) => {
          if (error) {
            event.sender.send("job-log", `⚠️  Copy warning: ${stderr}\n`);
          }
          resolve(null);
        }
      );
    });

    // 9️⃣ Cleanup container
    await new Promise((resolve) => {
      exec(`docker rm ${containerName}`, () => {
        event.sender.send("job-log", "🧹 Container cleaned up\n");
        resolve(null);
      });
    });

    // 🔟 List output files
    const files = fs.readdirSync(outputDir);
    const outputFiles = files.filter(f => 
      !['main.py', 'requirements.txt', 'Dockerfile', '__pycache__'].includes(f) &&
      !f.startsWith('.')
    );

    if (outputFiles.length > 0) {
      event.sender.send("job-log", `\n✅ OUTPUT FILES GENERATED:\n`);
      outputFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        event.sender.send("job-log", `  📄 ${file.padEnd(25)} ${sizeKB} KB\n`);
      });
      event.sender.send("job-log", `\n📂 Output folder: ${outputDir}\n`);
    } else {
      event.sender.send("job-log", `\n⚠️  No output files generated (check logs above)\n`);
    }

    event.sender.send("job-log", `\n🎉 JOB ${shortId.toUpperCase()} COMPLETED SUCCESSFULLY!\n`);
    event.sender.send("job-log", `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return { 
      success: true, 
      outputDir, 
      outputFiles,
      jobId,
      shortId 
    };

  } catch (err) {
    const errorMsg = err.message || 'Unknown error';
    console.error('❌ Job failed:', errorMsg);
    
    event.sender.send("job-log", `\n❌ JOB FAILED:\n`);
    event.sender.send("job-log", `   ${errorMsg}\n`);
    event.sender.send("job-log", `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Cleanup on error
    try {
      const shortId = jobId.slice(-8);
      exec(`docker rm -f dtrain-container-${shortId}`, () => {});
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error('Cleanup failed:', cleanupErr);
    }
    
    return { success: false, error: errorMsg };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});