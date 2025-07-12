const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const ACTIONS = require("./Actions");
const cors = require("cors");
const axios = require("axios");
const server = http.createServer(app);
const mongoose = require("mongoose");
const disconnectTimeouts = {};
require("dotenv").config();

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error(err));

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Example of a protected route
const auth = require('./middleware/auth');
app.get('/api/protected', auth, (req, res) => {
  res.json({ msg: `Hello, ${req.user.username}. This is a protected route.` });
});

const languageConfig = {
  python3: { versionIndex: "3" },
  java: { versionIndex: "3" },
  cpp: { versionIndex: "4" },
  nodejs: { versionIndex: "3" },
  c: { versionIndex: "4" },
  ruby: { versionIndex: "3" },
  go: { versionIndex: "3" },
  scala: { versionIndex: "3" },
  bash: { versionIndex: "3" },
  sql: { versionIndex: "3" },
  pascal: { versionIndex: "2" },
  csharp: { versionIndex: "3" },
  php: { versionIndex: "3" },
  swift: { versionIndex: "3" },
  rust: { versionIndex: "3" },
  r: { versionIndex: "3" },
};

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const userSocketMap = {};
const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || [])
    .map(socketId => ({
      socketId,
      username: userSocketMap[socketId],
    }))
    .filter(client => !!client.username); // filter out undefined usernames
};

io.on("connection", (socket) => {
  // Listen for chat messages
  socket.on("chat-message", ({ roomId, username, message }) => {
    if (disconnectTimeouts[socket.id]) {
      clearTimeout(disconnectTimeouts[socket.id]);
      delete disconnectTimeouts[socket.id];
    }
    io.to(roomId).emit("chat-message", {
      username,
      message,
      timestamp: new Date(),
    });
  });

  // Only use one join event!
  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    if (!username || typeof username !== 'string' || !username.trim()) {
      // Optionally, disconnect the socket
      socket.disconnect(true);
      return;
    }
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    // Clear disconnect timeout if user reconnects
    if (disconnectTimeouts[socket.id]) {
      clearTimeout(disconnectTimeouts[socket.id]);
      delete disconnectTimeouts[socket.id];
    }

    const clients = getAllConnectedClients(roomId);
    clients.forEach(({ socketId }) => {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username,
        socketId: socket.id,
      });
    });

    // Optionally, announce in chat
    socket.to(roomId).emit("chat-message", {
      username: "System",
      message: `${username} joined the chat.`,
      timestamp: new Date(),
      system: true,
    });
  });

  // sync the code
  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  // Graceful disconnect with timeout
  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    const username = userSocketMap[socket.id];
    disconnectTimeouts[socket.id] = setTimeout(() => {
      rooms.forEach((roomId) => {
        socket.to(roomId).emit("chat-message", {
          username: "System",
          message: `${username} left the chat.`,
          timestamp: new Date(),
          system: true,
        });
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
          socketId: socket.id,
          username,
        });
      });
      delete userSocketMap[socket.id];
    }, 10000); // 10 seconds
  });
});

app.post("/compile", async (req, res) => {
  const { code, language } = req.body;
  try {
    const response = await axios.post("https://api.jdoodle.com/v1/execute", {
      script: code,
      language: language,
      versionIndex: languageConfig[language].versionIndex,
      clientId: process.env.JD_CLIENT_ID,
      clientSecret: process.env.JD_CLIENT_SECRET,
    });
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to compile code" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
