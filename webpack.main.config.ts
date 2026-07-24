import type { Configuration } from 'webpack';
import { Compilation, sources } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

/**
 * webpack-asset-relocator-loader rewrites native requires to use
 * `__webpack_require__.ab`, but its runtime injection is skipped by the
 * webpack version used by Electron Forge.  Initialise the base explicitly so
 * relocated `.node` binaries can be loaded in both development and packaged
 * builds.
 */
class NativeModuleAssetBasePlugin {
  apply(compiler: import('webpack').Compiler): void {
    const assetBase = compiler.options.mode === 'production'
      ? 'require("path").resolve(__dirname, "..")'
      : '__dirname';
    const initialization = `__webpack_require__.ab = ${assetBase} + "/native_modules/";\n`;

    compiler.hooks.thisCompilation.tap('NativeModuleAssetBasePlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'NativeModuleAssetBasePlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        () => {
          for (const asset of compilation.getAssets()) {
            if (!asset.name.endsWith('.js')) continue;
            const source = asset.source.source().toString();
            const startup = '// startup';
            const position = source.lastIndexOf(startup);
            if (position === -1 || source.includes(initialization)) continue;
            const updated = new sources.ReplaceSource(asset.source);
            updated.insert(position, initialization);
            compilation.updateAsset(asset.name, updated);
          }
        },
      );
    });
  }
}

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [...plugins, new NativeModuleAssetBasePlugin()],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
