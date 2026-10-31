const Chat = require("../models/chatModel");
const User = require("../models/userModel");

const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const mongoose = require("mongoose");

//@description     Create New Message
//@route           POST /api/message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content?.trim() || !mongoose.isValidObjectId(chatId)) {
    return res.status(400).json({ message: "Invalid data passed into request" });
  }

  const chat = await Chat.findOne({ _id: chatId, users: req.user._id });
  if (!chat) {
    return res.status(403).json({ message: "You are not a member of this chat" });
  }

  let newMessage = {
    sender: req.user._id,
    content: content.trim(),
    chat: chatId,
  };

  try {
    let message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, {
      latestMessage: message,
    });

    res.json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const allMessages = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.chatId)) {
      return res.status(400).json({ message: "Invalid chat id" });
    }
    const chat = await Chat.findOne({
      _id: req.params.chatId,
      users: req.user._id,
    });
    if (!chat) {
      return res.status(403).json({ message: "You are not a member of this chat" });
    }
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");

    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = { sendMessage, allMessages };
