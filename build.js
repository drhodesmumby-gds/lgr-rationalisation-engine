const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');

async function build() {
    // Bundle JS modules into a single IIFE
    const jsResult = await esbuild.build({
        entryPoints: [path.join(SRC, 'main.js')],
        bundle: true,
        format: 'iife',
        target: 'es2020',
        minify: false,
        write: false,
    });
    const jsBundle = jsResult.outputFiles[0].text;

    // Read CSS
    const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf-8');

    // Read HTML template and inject
    let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
    html = html.replace('{{STYLES}}', css);
    html = html.replace('{{BUNDLE}}', jsBundle);

    // Write output
    fs.mkdirSync(DIST, { recursive: true });
    const outPath = path.join(DIST, 'lgr-rationalisation-engine.html');
    fs.writeFileSync(outPath, html);

    const sizeKB = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`Built ${outPath} (${sizeKB} KB)`);
}

// Watch mode
if (process.argv.includes('--watch')) {
    const chokidar = (() => {
        try { return require('chokidar'); } catch { return null; }
    })();
    if (chokidar) {
        build();
        chokidar.watch(SRC, { ignoreInitial: true }).on('all', () => {
            build().catch(e => console.error('Build error:', e.message));
        });
        console.log('Watching src/ for changes...');
    } else {
        console.log('Watch mode requires chokidar (npm install --save-dev chokidar). Running single build.');
        build().catch(e => { console.error(e); process.exit(1); });
    }
} else {
    build().catch(e => { console.error(e); process.exit(1); });
}
