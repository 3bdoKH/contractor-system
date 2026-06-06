import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { PublisherGithub } from '@electron-forge/publisher-github'

import { execSync } from 'node:child_process'

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/sql.js/**'
    },
    name: 'contractor-system',
    executableName: 'contractor-system',
    extraResource: ['assets/', 'public/sql-wasm.wasm'],
  },
  hooks: {
    packageAfterCopy: async (forgeConfig, buildPath) => {
      const fs = require('node:fs');
      const path = require('node:path');
      const { execSync } = require('node:child_process');

      // 1. Copy package.json to staging folder
      fs.copyFileSync(
        path.resolve(__dirname, 'package.json'),
        path.resolve(buildPath, 'package.json')
      );

      // 2. Install production dependencies (like sql.js and pdfkit) in staging folder
      console.log('Installing production dependencies in packaged app at:', buildPath);
      execSync('npm install --production --no-audit --no-fund', {
        cwd: buildPath,
        stdio: 'inherit',
      });
    }
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'contractor_system',
    }),
    new MakerZIP({}, ['darwin']),
    new MakerDeb({}),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: '3bdoKH',         // your GitHub username
        name: 'contractor-system' // your repo name
      },
      prerelease: false,
      draft: false,
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.mts' },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config