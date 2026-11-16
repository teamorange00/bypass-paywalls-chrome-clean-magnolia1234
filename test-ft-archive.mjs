import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ext = path.resolve(__dirname);
const ARTICLE=process.argv[2]||'https://www.ft.com/content/45383d86-33c4-4d99-86e5-5e058d3567c1';
const browser=await puppeteer.launch({headless:false,pipe:true,defaultViewport:{width:1400,height:950},enableExtensions:[ext],args:['--disable-blink-features=AutomationControlled'],protocolTimeout:180000});
try{
  await browser.waitForTarget(t=>t.type()==='service_worker'&&t.url().includes('chrome-extension://'),{timeout:20000});
  const page=await browser.newPage();
  page.on('console',m=>{ if(/BPC|FT/i.test(m.text())) console.log('[console]',m.text().slice(0,160)); });
  await page.goto('https://www.ft.com/',{waitUntil:'domcontentloaded',timeout:60000});
  await new Promise(r=>setTimeout(r,2500));
  await page.goto(ARTICLE,{waitUntil:'domcontentloaded',timeout:60000});
  // archive snapshot is ~12MB; SW fetch + inject can take a while
  let info=null;
  for(let i=0;i<12;i++){
    await new Promise(r=>setTimeout(r,5000));
    info=await page.evaluate(()=>{
      const r=document.getElementById('bpc_ft_restored');
      return {title:document.title, restored:!!r, restoredLen:r?r.innerText.trim().length:0, head:r?r.innerText.slice(0,260):null, tail:r?r.innerText.slice(-220):null};
    });
    console.log(`t=${(i+1)*5}s`, JSON.stringify(info).slice(0,420));
    if(info.restored && info.restoredLen>2000) break;
  }
  await page.screenshot({path:path.join(__dirname,'.firecrawl/ft-archive-restored.png')});
  const pass=info.restored && info.restoredLen>2500 && /Jensen Huang is considering a comeback/i.test(info.head||'') || (info.restored && info.restoredLen>2500);
  console.log(pass?'PASS ft archive fallback':'FAIL ft archive fallback');
  process.exitCode=pass?0:1;
} finally { await browser.close(); }
