import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, loadEnv } from 'vite'
import { createBillPdfHandler } from './server/bill-pdf.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /@firebase\/firestore/, priority: 30 },
            { name: 'firebase-auth', test: /@firebase\/auth/, priority: 30 },
            { name: 'react', test: /\/(?:react|react-dom|scheduler)\//, priority: 20 },
            { name: 'firebase-core', test: /@firebase|\/firebase\//, priority: 10 },
          ],
        },
      },
    },
  },
  plugins: [
    { name: 'hariom-bill-api', configureServer(server) { server.middlewares.use('/api/bills/pdf', createBillPdfHandler({ env: { ...loadEnv(mode, process.cwd(), ''), ...process.env } })) } },
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
}))
