// Renders ui/brand/icon.svg to build/icon.png (1024px) and ui/brand/icon-256.png.
// Run with: npm run icon
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SIZE = 1024;

async function main() {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  const svg = fs.readFileSync(path.join(root, 'ui', 'brand', 'icon.svg'), 'utf8');
  const html = `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden">
    <div style="width:${SIZE}px;height:${SIZE}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.writeFileSync(path.join(root, 'build', 'icon.png'), image.resize({ width: 1024, height: 1024 }).toPNG());
  fs.writeFileSync(
    path.join(root, 'ui', 'brand', 'icon-256.png'),
    image.resize({ width: 256, height: 256, quality: 'best' }).toPNG()
  );
  console.log('icons written');
}

app.disableHardwareAcceleration();
app.whenReady().then(main).then(
  () => app.exit(0),
  (err) => {
    console.error(err);
    app.exit(1);
  }
);
