import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "fs";
import path from "path";

const logoPath = path.join(process.cwd(), "src", "app", "newFavicon.png");
const outputPath = path.join(process.cwd(), "src", "app", "favicon.ico");

const size = 256;
// fit: "contain" - 위아래 잘림 없이 전체 로고 포함 (투명 여백)
const buf = await sharp(logoPath)
  .resize(size, size, {
    fit: "contain",
    position: "center",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

const ico = await pngToIco(buf);
fs.writeFileSync(outputPath, ico);
console.log("favicon.ico created at", outputPath);
