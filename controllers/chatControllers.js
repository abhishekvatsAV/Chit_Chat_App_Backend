const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Chat = require("../models/chatModel");
const User = require("../models/userModel");

const populateChat = (query) =>
  query
    .populate("users", "-password")
    .populate("groupAdmin", "-password")
    .populate("latestMessage");

const isGroupAdmin = (chat, userId) =>
  chat.isGroupChat &&
  chat.groupAdmin?.toString() === userId.toString();

const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "A valid userId is required" });
  }
  if (userId.toString() === req.user._id.toString()) {
    return res.status(400).json({ message: "You cannot start a chat with yourself" });
  }

  let chats = await populateChat(
    Chat.find({
      isGroupChat: false,
      users: { $all: [req.user._id, userId] },
    })
  );
  chats = await User.populate(chats, {
    path: "latestMessage.sender",
    select: "name pic email",
  });

  if (chats.length) return res.json(chats[0]);

  const otherUser = await User.findById(userId);
  if (!otherUser) return res.status(404).json({ message: "User not found" });

  const createdChat = await Chat.create({
    chatName: otherUser.name,
    isGroupChat: false,
    users: [req.user._id, userId],
  });
  const fullChat = await populateChat(Chat.findById(createdChat._id));
  res.status(201).json(fullChat);
});

const fetchChats = asyncHandler(async (req, res) => {
  let results = await populateChat(
    Chat.find({ users: req.user._id }).sort({ updatedAt: -1 })
  );
  results = await User.populate(results, {
    path: "latestMessage.sender",
    select: "name pic email",
  });
  res.json(results);
});

const createGroupChat = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim() || req.body.users === undefined) {
    return res.status(400).json({ message: "A group name and members are required" });
  }

  let users;
  try {
    users = Array.isArray(req.body.users)
      ? req.body.users
      : JSON.parse(req.body.users);
  } catch {
    return res.status(400).json({ message: "Users must be a valid array" });
  }

  const uniqueIds = [...new Set((users || []).map(String))];
  if (uniqueIds.length < 2) {
    return res.status(400).json({
      message: "At least two other members are required to form a group",
    });
  }
  if (uniqueIds.some((id) => !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ message: "One or more users are invalid" });
  }

  const memberCount = await User.countDocuments({ _id: { $in: uniqueIds } });
  if (memberCount !== uniqueIds.length) {
    return res.status(400).json({ message: "One or more users do not exist" });
  }

  const groupChat = await Chat.create({
    chatName: name.trim(),
    users: [...uniqueIds, req.user._id],
    isGroupChat: true,
    groupAdmin: req.user._id,
  });
  const fullGroupChat = await populateChat(Chat.findById(groupChat._id));
  res.status(201).json(fullGroupChat);
});

const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;
  if (!mongoose.isValidObjectId(chatId) || !chatName?.trim()) {
    return res.status(400).json({ message: "A valid chat and name are required" });
  }
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (!isGroupAdmin(chat, req.user._id)) {
    return res.status(403).json({ message: "Only the group admin can rename this chat" });
  }

  const updatedChat = await populateChat(
    Chat.findByIdAndUpdate(
      chatId,
      { chatName: chatName.trim() },
      { new: true, runValidators: true }
    )
  );
  res.json(updatedChat);
});

const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "A valid chat and user are required" });
  }
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  if (!isGroupAdmin(chat, req.user._id)) {
    return res.status(403).json({ message: "Only the group admin can add members" });
  }
  if (chat.users.some((id) => id.toString() === userId.toString())) {
    return res.status(409).json({ message: "User is already in this group" });
  }
  if (!(await User.exists({ _id: userId }))) {
    return res.status(404).json({ message: "User not found" });
  }

  const added = await populateChat(
    Chat.findByIdAndUpdate(chatId, { $addToSet: { users: userId } }, { new: true })
  );
  res.json(added);
});

const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;
  if (!mongoose.isValidObjectId(chatId) || !mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "A valid chat and user are required" });
  }
  const chat = await Chat.findById(chatId);
  if (!chat) return res.status(404).json({ message: "Chat not found" });

  const isSelf = userId.toString() === req.user._id.toString();
  if (!isGroupAdmin(chat, req.user._id) && !isSelf) {
    return res.status(403).json({ message: "Only the group admin can remove members" });
  }
  if (chat.users.length <= 1) {
    return res.status(400).json({ message: "A group must have at least one member" });
  }

  const removed = await populateChat(
    Chat.findByIdAndUpdate(chatId, { $pull: { users: userId } }, { new: true })
  );
  res.json(removed);
});

module.exports = {
  accessChat,
  fetchChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
};
