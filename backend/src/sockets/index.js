const { Server } = require('socket.io');
const env = require('../config/env');

let io = null;

/**
 * Initialize Socket.IO on the HTTP server.
 * Sets up the /kitchen namespace with location-based rooms.
 */
function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ---------------------------------------------------------------------------
  // /kitchen namespace — staff connects here per location
  // ---------------------------------------------------------------------------
  const kitchenNsp = io.of('/kitchen');

  kitchenNsp.on('connection', (socket) => {
    const locationId = socket.handshake.query.location_id;

    if (locationId) {
      const room = `location_${locationId}`;
      socket.join(room);
      console.log(`[Socket] Kitchen client joined ${room} (${socket.id})`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket] Kitchen client disconnected (${socket.id})`);
    });
  });

  console.log('[Socket] Socket.IO initialized');
  return io;
}

/**
 * Get the Socket.IO instance for emitting events from services.
 */
function getIO() {
  return io;
}

module.exports = { initSocketIO, getIO };
