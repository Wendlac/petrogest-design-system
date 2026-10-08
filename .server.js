const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2'};
http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/design-system.html';
  const f=path.join(__dirname,p);
  fs.readFile(f,(e,d)=>{
    if(e){res.writeHead(404);return res.end('404');}
    res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});
    res.end(d);
  });
}).listen(4173,()=>console.log('serving on 4173'));
