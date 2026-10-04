import type {Plugin} from 'vite';
import {MemoryRoomStore} from './store.js';
import {roomHandler} from './rooms.js';

export function localRooms():Plugin {
  return {name:'local-pool-rooms',configureServer(server){
    const handle=roomHandler(new MemoryRoomStore());
    server.middlewares.use('/api/room',async(req,res)=>{
      try{
        const chunks:Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>8192){res.statusCode=413;res.end();return;}chunks.push(chunk);}
        const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
        const response=await handle(new Request(`http://${req.headers.host}/api/room${req.url??''}`,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks).toString()}: {})}));
        res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(await response.text());
      }catch{res.statusCode=500;res.end(JSON.stringify({error:'Local room server failed.'}));}
    });
  }};
}
