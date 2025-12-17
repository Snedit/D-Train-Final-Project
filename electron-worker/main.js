const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { spawn, exec } = require("child_process");

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "dist", "index.html"));
  
  // Open DevTools for debugging
  // win.webContents.openDevTools();
}

ipcMain.handle("run-test-job", async (event) => {
  const jobDir = path.join(__dirname, "jobs", "job-test");
  const zipPath = path.join(__dirname, "test-job", "job.zip");
  const outputDir = path.join(__dirname, "jobs", "job-test", "output");

  try {
    // Clean job directory
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
    fs.mkdirSync(jobDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // Unzip
    event.sender.send("job-log", "📦 Extracting job files...\n");
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(jobDir, true);
    event.sender.send("job-log", "✅ Files extracted successfully\n\n");

    // Create Dockerfile
    const dockerfile = `
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "main.py"]
    `.trim();

    fs.writeFileSync(path.join(jobDir, "Dockerfile"), dockerfile);

    event.sender.send("job-log", "🐳 Building Docker image...\n");

    // Build image
    await new Promise((resolve, reject) => {
      const build = spawn("docker", ["build", "-t", "dtrain-test", "."], {
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
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });

    event.sender.send("job-log", "\n🚀 Running training...\n");

    // Run container (without --rm so we can copy files)
    const containerName = "dtrain-test-container";
    
    await new Promise((resolve, reject) => {
      const run = spawn("docker", ["run", "--name", containerName, "dtrain-test"], {
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
          resolve();
        } else {
          reject(new Error(`Training failed with code ${code}`));
        }
      });
    });

    event.sender.send("job-log", "\n📥 Extracting output files...\n");

    // Copy files from container
    await new Promise((resolve, reject) => {
      exec(
        `docker cp ${containerName}:/app/. "${outputDir}"`,
        (error, stdout, stderr) => {
          if (error) {
            event.sender.send("job-log", `⚠️ Copy warning: ${stderr}\n`);
          }
          resolve();
        }
      );
    });

    // Clean up container
    await new Promise((resolve) => {
      exec(`docker rm ${containerName}`, () => resolve());
    });

    // Check what files were created
    const files = fs.readdirSync(outputDir);
    const outputFiles = files.filter(f => 
      !['main.py', 'requirements.txt', 'Dockerfile', '__pycache__'].includes(f) &&
      !f.startsWith('.')
    );

    if (outputFiles.length > 0) {
      event.sender.send("job-log", `\n✅ Output files extracted:\n`);
      outputFiles.forEach(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        event.sender.send("job-log", `   📄 ${file} (${stats.size} bytes)\n`);
      });
      event.sender.send("job-log", `\n📂 Location: ${outputDir}\n`);
    } else {
      event.sender.send("job-log", `\n⚠️ No output files generated\n`);
    }

    event.sender.send("job-log", "\n✅ Job completed successfully!\n");
    
    return { success: true, outputDir, outputFiles };

  } catch (err) {
    event.sender.send("job-log", `\n❌ Error: ${err.message}\n`);
    
    // Try to clean up container if it exists
    exec("docker rm -f dtrain-test-container", () => {});
    
    return { success: false };
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
