const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');

class ArtifactsManager {
  constructor(bus) {
    this.bus = bus;
    this.baseDir = path.join(os.tmpdir(), 'ml-worker-artifacts');
    if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
  }

  async downloadFile(url, destPath, expectedSha256) {
    const writer = fs.createWriteStream(destPath);
    const res = await axios({ url, method: 'GET', responseType: 'stream' });
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (expectedSha256) {
      const hash = crypto.createHash('sha256');
      hash.update(fs.readFileSync(destPath));
      const digest = hash.digest('hex');
      if (digest !== expectedSha256) {
        throw new Error(`Checksum mismatch for ${destPath}`);
      }
    }
  }

  async prepareJobArtifacts(job) {
    const jobDir = path.join(this.baseDir, job.id);
    fs.mkdirSync(jobDir, { recursive: true });

    const bundle = {
      jobDir,
      scriptPath: null,
      dataDir: path.join(jobDir, 'data'),
      configPath: null,
      checkpointsDir: path.join(jobDir, 'checkpoints')
    };
    fs.mkdirSync(bundle.dataDir, { recursive: true });
    fs.mkdirSync(bundle.checkpointsDir, { recursive: true });

    for (const artifact of job.artifacts) {
      const dest = path.join(jobDir, artifact.relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await this.downloadFile(artifact.url, dest, artifact.sha256);
      if (artifact.type === 'script') bundle.scriptPath = dest;
      if (artifact.type === 'config') bundle.configPath = dest;
    }

    return bundle;
  }

  async uploadOutputs(job, result) {
    // Example: your backend returns presigned URLs in job.outputTargets
    for (const out of job.outputTargets || []) {
      const filepath = path.join(result.outputDir, out.relativePath);
      if (!fs.existsSync(filepath)) continue;
      const fileStream = fs.createReadStream(filepath);
      await axios.put(out.uploadUrl, fileStream, {
        headers: { 'Content-Type': out.contentType || 'application/octet-stream' }
      });
    }
  }

  async cleanup(job) {
    const jobDir = path.join(this.baseDir, job.id);
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

module.exports = ArtifactsManager;
