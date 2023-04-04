const http = require('http');
const fs = require('fs');

const { Player } = require('./game/class/player');
const { World } = require('./game/class/world');

const worldData = require('./game/data/basic-world-data');

let player;
let world = new World();
world.loadWorld(worldData);

const server = http.createServer((req, res) => {
  // console.log(player)
  function redirect(str) {
    res.writeHead(301, {
      location: str
    })
    return res.end()
  }

  if(player) console.log(player.items)

  /* ============== ASSEMBLE THE REQUEST BODY AS A STRING =============== */
  let reqBody = '';
  req.on('data', (data) => {
    reqBody += data;
  });

  req.on('end', () => { // After the assembly of the request body is finished
    /* ==================== PARSE THE REQUEST BODY ====================== */
    if (reqBody) {
      req.body = reqBody
        .split("&")
        .map((keyValuePair) => keyValuePair.split("="))
        .map(([key, value]) => [key, String(value).replaceAll('+', " ")])
        .map(([key, value]) => [key, decodeURIComponent(value)])
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {});
    }

    /* ======================== ROUTE HANDLERS ========================== */
    // Phase 1: GET /
    if(req.method === 'GET' && req.url === '/') {
      const resBody = fs.readFileSync('./views/new-player.html', 'utf-8').replace('#{availableRooms}', world.availableRoomsToString())

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.write(resBody)
      return res.end()
    }

    // Phase 2: POST /player
    if(req.method === 'POST' && req.url === '/player') {
      const {name, roomId} = req.body
      player = new Player(name, world.rooms[Number(roomId)])
      res.writeHead(301, {
        location: `/rooms/${roomId}`
      })
      return res.end()
    }

    // Phase 3: GET /rooms/:roomId
    if(req.method === 'GET' && req.url.startsWith('/rooms')) {
      if(!player) {
        redirect('/')
      } else {
        let vals = req.url.split('/')
        if(vals.length === 3) {
          let id = Number(vals[2])
          let room = world.rooms[id]
          let resBody = fs.readFileSync('./views/room.html', 'utf-8')
            .replaceAll('#{roomName}', room.name)
            .replace('#{inventory}', player.inventoryToString())
            .replace('#{roomItems}', room.itemsToString())
            .replace('#{exits}', room.exitsToString())

          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          res.write(resBody)
          return res.end()
        }

        // Phase 4: GET /rooms/:roomId/:direction
        if(vals.length === 4) {
          let room = player.move(vals[3][0])
          redirect(`/rooms/${room.id}`)
        }
      }
    }

    // Phase 5: POST /items/:itemId/:action
    if(req.method === 'POST' && req.url.startsWith('/items')) {
      let vals = req.url.split('/')
      if(vals.length === 4) {
        let id = Number(vals[2])
        let action = vals[3]

        try {
          switch(action) {
            case 'eat':
              player.eatItem(id)
              break
            case 'take':
              player.takeItem(id)
              break
            case 'drop':
              player.dropItem(id)
              break
          }

          redirect(`/rooms/${player.currentRoom.id}`)

        } catch(error) {
          console.log(error)
          res.statusCode = 404
          req.error = error
          // let resBody = fs.readFileSync('./views/error.html', 'utf-8')
          //   .replace('#{errorMessage}', error)
          //   .replace('#{roomId}', player.currentRoom.id)
          // res.statusCode = 400
          // res.setHeader('Content-Type', 'text/html')
          // res.write(resBody)
          // return res.end()
        }

      }
    }

    // Phase 6: Redirect if no matching route handlers
    // res.statusCode = 200
    // res.setHeader('Content-Type', 'text/html')
    // redirect('/')

    if(res.statusCode === '404') {
      let resBody = fs.readFileSync('./views/error.html', 'utf-8')
        .replace('#{errorMessage}', req.error)
        .replace('#{roomId}', player.currentRoom.id)

      res.setHeader('Content-Type', 'text/html')
      res.write(resBody)
      return res.end()
    } else {
      redirect('/')
    }
  })
});

const port = 5000;

server.listen(port, () => console.log('Server is listening on port', port));
