import { join } from 'node:path';
import { getGlobalVariable } from './env';
import { writeFile, readFile } from './fs';
import { mktempd } from './utils';
import { runServer as runVerdaccioServer } from 'verdaccio';
import { setup as setupVerdaccioLogger } from 'verdaccio/build/lib/logger';

export async function createNpmRegistry(
  port: number,
  httpsPort: number,
  withAuthentication = false,
): Promise<void> {
  // Setup local package registry
  const registryPath = await mktempd('angular-cli-e2e-registry-');

  let configContent = await readFile(
    join('tests/legacy-cli', withAuthentication ? 'verdaccio_auth.yaml' : 'verdaccio.yaml'),
  );
  configContent = configContent.replace(/\$\{HTTP_PORT\}/g, String(port));
  configContent = configContent.replace(/\$\{HTTPS_PORT\}/g, String(httpsPort));
  const configPath = join(registryPath, 'verdaccio.yaml');
  await writeFile(configPath, configContent);

  const instancePort = withAuthentication ? httpsPort : port;

  // Verdaccio config `log` section is not respected by the programmatic API.
  setupVerdaccioLogger({
    type: 'stdout',
    level: 'warn',
    format: 'pretty',
  });

  const server = await runVerdaccioServer(configPath);

  await new Promise<void>((resolve) => {
    server.listen(instancePort, () => resolve());
  });

  console.log(`Verdaccio running on: http://localhost:${instancePort}`);
}

// Token was generated using `echo -n 'testing:s3cret' | openssl base64`.
const VALID_TOKEN = `dGVzdGluZzpzM2NyZXQ=`;

export function createNpmConfigForAuthentication(
  /**
   * When true, the authentication token will be scoped to the registry URL.
   * @example
   * ```ini
   * //localhost:4876/:_auth="dGVzdGluZzpzM2NyZXQ="
   * ```
   *
   * When false, the authentication will be added as seperate key.
   * @example
   * ```ini
   * _auth="dGVzdGluZzpzM2NyZXQ="`
   * ```
   */
  scopedAuthentication: boolean,
  /** When true, an incorrect token is used. Use this to validate authentication failures. */
  invalidToken = false,
): Promise<void> {
  const token = invalidToken ? `invalid=` : VALID_TOKEN;
  const registry = (getGlobalVariable('package-secure-registry') as string).replace(/^\w+:/, '');

  return writeFile(
    '.npmrc',
    scopedAuthentication
      ? `
        ${registry}:_auth="${token}"
        registry=http:${registry}
      `
      : `
        _auth="${token}"
        registry=http:${registry}
      `,
  );
}

export function setNpmEnvVarsForAuthentication(
  /** When true, an incorrect token is used. Use this to validate authentication failures. */
  invalidToken = false,
  /** When true, `YARN_REGISTRY` is used instead of `NPM_CONFIG_REGISTRY`. */
  useYarnEnvVariable = false,
): void {
  delete process.env['YARN_REGISTRY'];
  delete process.env['NPM_CONFIG_REGISTRY'];

  const registryKey = useYarnEnvVariable ? 'YARN_REGISTRY' : 'NPM_CONFIG_REGISTRY';
  process.env[registryKey] = getGlobalVariable('package-secure-registry');

  process.env['NPM_CONFIG__AUTH'] = invalidToken ? `invalid=` : VALID_TOKEN;

  // Needed for verdaccio when used with yarn
  // https://verdaccio.org/docs/en/cli-registry#yarn
  process.env['NPM_CONFIG_ALWAYS_AUTH'] = 'true';
}
