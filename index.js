const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// Map to keep track of connected users
// Key: username or user ID, Value: socket.id
const connectedUsers = new Map();

// 🔒 JWT verification middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication error"));
  try {
    const decoded = jwt.verify(token, "jxgEQeXHuPq8VdbyYFNkANdudQ53YUn4");
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  const username = socket.user.username || socket.user.sub;
  connectedUsers.set(username, socket.id);
  io.emit("userOnline", Array.from(connectedUsers.keys()));

  console.log("✅ Client connected:", username, socket.id);

  // Private messages
  socket.on("sendMessage", ({ to, text, image }) => {
    const msg = {
      fromUser: username,
      to,
      text,
      image: image || null,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const recipientSocketId = connectedUsers.get(to);
    if (recipientSocketId) io.to(recipientSocketId).emit("receiveMessage", msg);
    socket.emit("receiveMessage", msg); // sender also sees it
  });

  // Video call signaling
  socket.on("callUser", ({ to, offer, from }) => {
    const recipientSocketId = connectedUsers.get(to);
    if (recipientSocketId) io.to(recipientSocketId).emit("incomingCall", { from, offer });
  });

  socket.on("answerCall", ({ to, answer }) => {
    const recipientSocketId = connectedUsers.get(to);
    if (recipientSocketId) io.to(recipientSocketId).emit("callAnswered", { answer });
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const recipientSocketId = connectedUsers.get(to);
    if (recipientSocketId) io.to(recipientSocketId).emit("iceCandidate", { candidate });
  });

  // Disconnect
  socket.on("disconnect", () => {
    connectedUsers.delete(username);
    io.emit("userOffline", username);
    console.log("Client disconnected:", username);
  });
});

server.listen(3001, () => console.log("Socket.IO server listening on :3001"));
