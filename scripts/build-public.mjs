import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd(); const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true }); await mkdir(dist, { recursive: true });
const rootFiles = [
  'index.html', 'style.css', 'script.js', 'Nosotros.html', 'style-quienes_somos.css', 'script-Quienes_Somos.js',
  'Servicios-de-la-guarderia-para-gatos.html', 'Style-servicios.css', 'script-servicios.js',
  'requisitos-para-ingresar-a-la-guarderia-para-gatos.html', 'style-requisitos.css', 'requisitos.js',
  'galeria.html', 'galeria.css', 'galeria.js', 'robots.txt', 'sitemap.xml',
  'google47b8109bb429b46e.html', 'google80c4dc20751ce79d.html'
];
const publicDirs = ['imagenes', 'fuentes', 'video', 'curso', 'lanzamiento', 'bonos-trasportadora', 'tatotienda'];
for (const file of rootFiles) await copyFile(path.join(root, file), path.join(dist, file));
for (const dir of publicDirs) await cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
await cp(path.join(root, 'js'), path.join(dist, 'js'), { recursive: true });
// Keep the dependency available to root-based static previews as well as dist.
await mkdir(path.join(root, 'vendor'), { recursive: true });
await copyFile(path.join(root, 'node_modules/libphonenumber-js/bundle/libphonenumber-max.js'), path.join(root, 'vendor/libphonenumber-js.min.js'));
await mkdir(path.join(dist, 'vendor'), { recursive: true });
await copyFile(path.join(root, 'vendor/libphonenumber-js.min.js'), path.join(dist, 'vendor/libphonenumber-js.min.js'));
console.log(`Staging público creado con ${rootFiles.length} archivos raíz y ${publicDirs.length + 1} carpetas permitidas.`);
