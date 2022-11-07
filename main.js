'use strict';

//Server consts
const 
http = require('http'),
api = require('./server/rutas');


let server = http.createServer(api);
let port = process.env.PORT || 55555;
server.listen(port).on('error', function (e) {
    if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') { throw e;  }
  server.listen(++port);

  console.log(port);

}).on('listening', function () {  console.log(port); });

