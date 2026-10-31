require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middlewares/errorMiddleware");
const cors = require("cors");

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");

const helmet = require("helmet");
const { jwtVerify } = require("jose");
const Chat = require("./models/chatModel");
const Message = require("./models/messageModel");
const User = require("./models/userModel");
// const rateLimit = require("express-rate-limit");

connectDB();
//express app
const app = express();

// Security Middleware
app.use(helmet());

// Rate Limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
//   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
// });
// app.use(limiter);

//cors
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  })
);

// middleware & static files
app.use(express.json()); // to accept JSON data

// routes
app.get("/", function (req, res) {
  res.send("Api is Running.");
});

app.get("/ping", function (req, res) {
  res.json({ message: "pong" });
});

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

app.use(notFound);
app.use(errorHandler);

// listen for requests
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log("Server started on " + PORT);
});

const io = require("socket.io")(server, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  },
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Not authorized"));

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const user = await User.findById(payload.id).select("_id");
    if (!user) return next(new Error("Not authorized"));

    socket.userId = user._id.toString();
    next();
  } catch {
    next(new Error("Not authorized"));
  }
});

io.on("connection", (socket) => {
  socket.join(socket.userId);
  socket.emit("connected");

  socket.on("setup", () => {
    socket.emit("connected");
  });

  socket.on("join chat", async (room) => {
    try {
      const isMember = await Chat.exists({ _id: room, users: socket.userId });
      if (isMember) socket.join(room);
    } catch {
      // Ignore invalid or unauthorized room requests.
    }
  });

  socket.on("new message", async (newMessageReceived) => {
    try {
      const message = await Message.findOne({
        _id: newMessageReceived?._id,
        sender: socket.userId,
      })
        .populate("sender", "name pic email")
        .populate("chat");

      if (!message) return;

      const chat = await Chat.findOne({
        _id: message.chat._id,
        users: socket.userId,
      });
      if (!chat) return;

      const populatedMessage = await Message.populate(message, {
        path: "chat.users",
        select: "name pic email",
      });

      chat.users.forEach((userId) => {
        if (userId.toString() !== socket.userId) {
          socket.to(userId.toString()).emit("message recieved", populatedMessage);
        }
      });
    } catch {
      // Ignore forged or malformed message events.
    }
  });

  // now for typing functionality
  socket.on("typing", (room) => {
    if (socket.rooms.has(room)) socket.in(room).emit("typing");
  });

  socket.on("stop typing", (room) => {
    if (socket.rooms.has(room)) socket.in(room).emit("stop typing");
  });

  socket.on("disconnect", () => {
    // console.log("user disconnected");
    // Note: userData might not be available here, so we handle disconnect differently
  });
});
