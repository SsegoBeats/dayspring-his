import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Merge any existing ignored patterns with our project-specific ignores.
      const existingIgnored = Array.isArray(config.watchOptions?.ignored)
        ? config.watchOptions.ignored
        : typeof config.watchOptions?.ignored === 'string'
        ? [config.watchOptions.ignored]
        : []

      const systemFiles = [
        // Use Windows absolute paths (backslash form) which satisfy Webpack schema
        path.win32.join('C:', 'DumpStack.log.tmp'),
        path.win32.join('C:', 'hiberfil.sys'),
        path.win32.join('C:', 'pagefile.sys'),
        path.win32.join('C:', 'swapfile.sys'),
      ]

      config.watchOptions = {
        ...config.watchOptions,
        ignored: Array.from(new Set([
          ...existingIgnored,
          '**/node_modules/**',
          '**/.git/**',
          '**/.claude/**',
          '**/.worktrees/**',
          ...systemFiles,
        ])),
        followSymlinks: false,
      }
    }
    return config
  },
}

export default nextConfig
