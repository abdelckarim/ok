// 'use strict';
// const 
// WebTorrent = require('webtorrent'),
// fs = require('fs'),
// express = require("express"),
// bodyParser = require('body-parser'),
// _ = require('lodash'),
// rangeParser = require('range-parser'),
// pump = require('pump'),
// path = require('path'),
// // nodes = require('./nodes'),
// api = express();
// // storagTemp = path.join(__dirname, "../temp"),
// // userSettings = './config/settings.json';

// api.use(bodyParser.json());

// api.use(function (req, res, next) {
//   res.header('Access-Control-Allow-Origin', '*');
//   res.header('Access-Control-Allow-Methods', 'GET');
//   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
//   next();
// });

// api.get('/nodes', function(req, res, next) {
//   res.send(200);
// });


// module.exports = api;


'use strict';
const WebTorrent = require('webtorrent'),
fs = require('fs'),
express = require("express"),
bodyParser = require('body-parser'),
_ = require('lodash'),
rangeParser = require('range-parser'),
pump = require('pump'),
path = require('path'),
api = express(),
storagTemp = path.join(__dirname, "../temp"),
userSettings = './config/settings.json';

api.use(bodyParser.json());

api.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

function removeA(arr) {
    var what, a = arguments, L = a.length, ax;
    while (L > 1 && arr.length) {
        what = a[--L];
        while ((ax= arr.indexOf(what)) !== -1) {
            arr.splice(ax, 1);
        }
    }
    return arr;
}

function settings() {
  if (fs.existsSync(userSettings)) {
      const mysettings = () => fs.readFileSync(userSettings);
      const settingsI = JSON.parse(mysettings());
    return settingsI;
  }else {
      const mysettings = 404;
    return mysettings;
  }
}

function serialize(torrent) {

  if (torrent) {

    let pieceLength = torrent.pieceLength;
    return {
      infoHash: torrent.infoHash,
      name: torrent.name,
      length: torrent.length,
      interested: torrent.amInterested,
      ready: torrent.ready,
      files: torrent.files.map(function (f) {
        // jshint -W016
        var start = f.offset / pieceLength | 0;
        var end = (f.offset + f.length - 1) / pieceLength | 0;
        var pfath = encodeURIComponent(f.path);

          if(pfath.indexOf('.mp4') >= 0 || pfath.indexOf('.mkv') >= 0) {

            return {
              name: f.name,
              path: f.path,
              link: '/stream/' + torrent.infoHash + '/file/' + pfath,
              length: f.length,
              offset: f.offset
            };

          }

      }),
      stats: {
        peers: {
          total: torrent.wires.length,
          unchocked: torrent.wires.reduce(function (prev, wire) {
            return prev + !wire.peerChoking;
          }, 0)
        },
        traffic: {
          down: torrent.downloaded,
          up: torrent.uploaded
        },
        progress: (torrent.progress * 100).toFixed(2)
      }
    };
  }
}

const torrentio = {}
//const options = {
  // maxConns: Number,        // Max number of connections per torrent (default=55)
  // nodeId: String|Buffer,   // DHT protocol node ID (default=randomly generated)
  // peerId: String|Buffer,   // Wire protocol peer ID (default=randomly generated)
  // tracker: Boolean|Object, // Enable trackers (default=true), or options object for Tracker
  // dht: Boolean|Object,     // Enable DHT (default=true), or options object for DHT
  // webSeeds: Boolean,       // Enable BEP19 web seeds (default=true)
  // downloadLimit: 5000*1024,   // Download speed limit in bytes (default=Number.MAX_VALUE) - e.g. (200*1024) is 200kB or 1.6mbps
  // uploadLimit: Number,     // Upload speed limit in bytes (default=Number.MAX_VALUE) 
//};
api.get("/", function(req, res) {  res.send({ status: 200 });  });

var i
const hashs = []

// Añair torrent
api.get('/add/:infoHash', function (req, res) {

    res.setTimeout(60000, function () {
      res.send({status:500})
    });

    var hash = req.params.infoHash;

    if (hashs.length > 0) {
      hashs.forEach( function(v, i, a) { 
        let forTor = torrentio['webtorrent'].get(v)
        if (forTor) { 
          forTor.destroy() 
          removeA(hashs, v)
          console.log('REMOVED: '+v)
        }
      });
    }

    var down = Number.MAX_VALUE;  var conx = 55;

    let mySettings = settings(); 
    if (mySettings != 404) {
      let exisSettings = mySettings.filter(p => p.id == 'network');
      if (exisSettings[0]['down'] != null) {
        var down = (exisSettings[0]['down']*100)*1024;
      }
      if (exisSettings[0]['conx'] != null) {
        var conx = exisSettings[0]['conx'];
      }
    }

    const options = {
      maxConns: conx,
      downloadLimit: down
    };

    torrentio['webtorrent'] = new WebTorrent(options)
    torrentio['webtorrent'].add(hash, { path: storagTemp }, function (torrent) {

      torrent.deselect(0, torrent.pieces.length - 1, false)
      // for(i = 0; i < torrent.files.length; i++){
      //   torrent.files[i].deselect();
      // }
      res.send({status:200});
      hashs.push(hash);
      console.log('ADD: '+hash);
    });

    torrentio['webtorrent'].once('error', () => res.send({status:404}));

});

// Eliminar todos los torrents
api.get('/remove', function(req, res, next) {

  if (hashs.length > 0) {

      hashs.forEach( function(v, i, a) { 
        var forTor = torrentio['webtorrent'].get(v)
        if (forTor) { 
          forTor.destroy() 
          removeA(hashs, v)
          console.log('REMOVED: '+v)
        }
      });

      res.send({status:200}); 

  }else { res.send({status:404}); }

});


// Get Infor Torrent
api.get('/stats/:infoHash', function (req, res) {
  if (hashs.length > 0) {
    let torrent = torrentio['webtorrent'].get(req.params.infoHash)
    if (torrent) { 
        res.send(serialize(torrent));
    }else {
      res.send({status:404})
    }
  }else { res.send({status:404}) }

});


// Stream Torrent
api.all('/stream/:infoHash/file/:path([^"]+)', function (req, res) {

  if (hashs.length > 0) {
  var tor = torrentio['webtorrent'].get(req.params.infoHash);

    if (tor) {

      let file = {};
      for(i = 0; i < tor.files.length; i++)
      {
        if(tor.files[i].path == req.params.path)
        {
          file = tor.files[i];
        }
      }

      if (!file) {
        return res.send({status:404});
      }

      var range = req.headers.range;
      range = range && rangeParser(file.length, range)[0];
      res.setHeader('Accept-Ranges', 'bytes');
      res.type(file.name);
      req.connection.setTimeout(3600000);

      if (!range) {
        res.setHeader('Content-Length', file.length);
        if (req.method === 'HEAD') {
          return res.end();
        }
        return pump(file.createReadStream(), res);
      }

      res.statusCode = 206;
      res.setHeader('Content-Length', range.end - range.start + 1);
      res.setHeader('Content-Range', 'bytes ' + range.start + '-' + range.end + '/' + file.length);

      if (req.method === 'HEAD') {
        return res.end();
      }

      pump(file.createReadStream(range), res);

    }else { res.send({status:404}) }
  }else { res.send({status:404}) }
  
});




module.exports = api;