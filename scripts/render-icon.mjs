// Raster desktop icon comes from the same SVG used in the application header.
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/usr/bin/google-chrome'});
try{
 const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
 const svg=await fs.readFile(new URL('../web/icon.svg',import.meta.url),'utf8');
 await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:256px;height:256px}</style>${svg}`);
 await page.screenshot({path:new URL('../web/icon.png',import.meta.url).pathname,omitBackground:true});
}finally{await browser.close();}
