const { Server: WebSocketServer } = require('ws');
const { generateId, hash } = require('./utils');

const appSecret = hash('unelap');

const wss = new WebSocketServer({ port: 9000 });

const users = new Map();
const rooms = new Map();

//when a user connects to our sever
wss.on('connection', function(connection) {
  console.log('User connected');

  //when server gets a message from a connected user
  connection.on('message', function(message) {
    let data;
    //accepting only JSON messages
    try {
      data = JSON.parse(message);
      console.log(`${data.type} request: secret is ${data.secret}`);
    } catch (e) {
      console.log('Invalid JSON');
      data = {};
    }

    //switching type of the user message
    switch (data.type) {
      //when a user tries to login

      case 'login':
        {
          const { secret, password } = data;
          const token = hash(`${secret}${password}${appSecret}`);

          if (users.has(secret)) {
            if (users.get(secret) === password) {
              const room = rooms.get(token);
              rooms.set(token, [...room, connection]);
            } else {
              sendTo(connection, {
                type: 'login',
                error: 'wrong password',
                success: false
              });
              return;
            }
          } else {
            users.set(secret, password);
            rooms.set(token, [connection]);
          }

          sendTo(connection, {
            type: 'login',
            token
          });
        }
        break;

      case 'offer':
        {
          const { token } = data;

          const room = rooms.get(token);
          const otherConnection = room.find(conn => conn !== connection);
          console.log('Sending offer to: ', otherConnection);

          if (otherConnection != null) {
            sendTo(otherConnection, {
              type: 'offer',
              offer: data.offer
            });
          }
        }
        break;

      case 'answer':
        {
          const { token } = data;

          const room = rooms.get(token);
          const otherConnection = room.find(conn => conn !== connection);
          console.log('Sending answer to: ', otherConnection);

          if (otherConnection != null) {
            sendTo(otherConnection, {
              type: 'answer',
              answer: data.answer
            });
          }
        }
        break;

      case 'candidate':
        {
          const { token } = data;

          const room = rooms.get(token);
          const otherConnection = room.find(conn => conn !== connection);
          console.log('Sending candidate to:', otherConnection);

          if (otherConnection != null) {
            sendTo(otherConnection, {
              type: 'candidate',
              candidate: data.candidate
            });
          }
        }
        break;

      case 'leave':
        {
          const { token } = data;

          const room = rooms.get(token);
          const otherConnection = room.find(conn => conn !== connection);
          console.log('Disconnecting from', otherConnection);

          if (otherConnection != null) {
            sendTo(otherConnection, {
              type: 'leave'
            });
          }
        }
        break;

      default:
        sendTo(connection, {
          type: 'error',
          message: 'Command not found: ' + data.type
        });

        break;
    }
  });

  //when user exits, for example closes a browser window
  //this may help if we are still in "offer","answer" or "candidate" state
  connection.on('close', function() {
    if (connection.name) {
      delete users[connection.name];

      if (connection.otherName) {
        console.log('Disconnecting from ', connection.otherName);
        let conn = users[connection.otherName];
        conn.otherName = null;

        if (conn != null) {
          sendTo(conn, {
            type: 'leave'
          });
        }
      }
    }
  });
});

function sendTo(connection, message) {
  connection.send(JSON.stringify(message));
}
