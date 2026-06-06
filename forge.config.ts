import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { MakerZIP } from '@electron-forge/maker-zip'
import { MakerDeb } from '@electron-forge/maker-deb'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { PublisherGithub } from '@electron-forge/publisher-github'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'contractor-system',
    executableName: 'contractor-system',
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