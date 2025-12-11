const si = require('systeminformation');
const os = require('os');
const osUtils = require('os-utils');

async function getSystemInfo() {
  const [cpu, mem, osInfo, graphics, dockerInfo] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.osInfo(),
    si.graphics(),
    si.dockerInfo().catch(() => null)
  ]);

  const gpus = (graphics.controllers || []).map(g => ({
    model: g.model,
    vendor: g.vendor,
    vram: g.vram
  }));

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpu: {
      brand: cpu.brand,
      cores: cpu.cores,
      physicalCores: cpu.physicalCores,
      speed: cpu.speed
    },
    memory: {
      total: mem.total
    },
    os: {
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel
    },
    gpu: gpus,
    dockerAvailable: !!dockerInfo
  };
}

function getLiveMetrics() {
  return new Promise(resolve => {
    osUtils.cpuUsage(cpuPercent => {
      si.mem().then(mem => {
        resolve({
          cpuPercent: cpuPercent * 100,
          memUsed: mem.used,
          memTotal: mem.total
        });
      });
    });
  });
}

module.exports = { getSystemInfo, getLiveMetrics };
