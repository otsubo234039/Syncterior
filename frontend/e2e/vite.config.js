import { defineConfig } from 'vite';

// Only E2E previews use this fixture server. Production API configuration is unchanged.
export default defineConfig({ preview: { proxy: { '/api': 'http://127.0.0.1:4175' } } });
