import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { localRooms } from './server/dev.js';
export default defineConfig({ plugins: [svelte(),localRooms()], server: { host: '127.0.0.1' } });
