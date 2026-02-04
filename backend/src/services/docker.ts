import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

export async function restartBeamMP(): Promise<void> {
  const containerName = process.env.BEAMMP_CONTAINER_NAME || 'beammp';
  const dockerHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';

  try {
    if (dockerHost.includes('npipe')) {
      await executeCommand('docker', ['restart', containerName], {
        env: { ...process.env, DOCKER_HOST: dockerHost },
      });
    } else {
      await executeCommand('docker', ['restart', containerName]);
    }
    await sleep(2000);
  } catch (error) {
    console.error('Failed to restart BeamMP container:', error);
    throw new Error('Failed to restart server');
  }
}

export async function getContainerStatus(
  containerName: string
): Promise<{ running: boolean; state?: string; startedAt?: string }> {
  try {
    const output = await executeCommand('docker', [
      'inspect',
      containerName,
      '--format={{.State.Running}},{{.State.Status}},{{.State.StartedAt}}',
    ]);

    const [running, state, startedAt] = output.trim().split(',');

    return {
      running: running === 'true',
      state: state || 'unknown',
      startedAt,
    };
  } catch {
    return { running: false, state: 'stopped' };
  }
}

export async function getContainerUptime(
  containerName: string
): Promise<number | null> {
  try {
    const status = await getContainerStatus(containerName);
    if (!status.startedAt) return null;

    const startTime = new Date(status.startedAt).getTime();
    const now = Date.now();
    return Math.floor((now - startTime) / 1000); // seconds
  } catch {
    return null;
  }
}

export async function getContainerLogs(
  containerName: string,
  lines: number = 200
): Promise<string> {
  try {
    const output = await executeCommand('docker', [
      'logs',
      `--tail=${lines}`,
      containerName,
    ]);
    return output;
  } catch (error) {
    throw new Error('Failed to retrieve logs');
  }
}

function executeCommand(
  command: string,
  args: string[],
  options?: any
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, options);

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
