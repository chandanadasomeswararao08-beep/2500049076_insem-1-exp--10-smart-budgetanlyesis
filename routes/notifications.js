const router = require("express").Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");
const { reconcileUserNotifications } = require("../services/notification-service");
router.use(auth);

router.get("/", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notifications").lean();
    if (!user || !user.notifications) return res.json({ notifications: [], unreadCount: 0, enabled: false });
    const notifications = await reconcileUserNotifications(req.user.id);
    const unreadCount = notifications.filter(item => !item.readAt).length;
    res.json({ notifications, unreadCount, enabled: true });
  } catch (error) { res.status(500).json({ message: "Could not load notifications." }); }
});

router.put("/read-all", async (req, res) => {
  try {
    const result = await Notification.updateMany({ user: req.user.id, dismissedAt: null, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ message: "All active notifications marked as read.", updatedCount: result.modifiedCount });
  } catch (error) { res.status(500).json({ message: "Could not update notifications." }); }
});
router.put("/:id/read", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Notification not found." });
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id, dismissedAt: null }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    res.json({ notification });
  } catch (error) { res.status(500).json({ message: "Could not update notification." }); }
});
router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Notification not found." });
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id, dismissedAt: null }, { $set: { dismissedAt: new Date() } }, { new: true });
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    res.json({ message: "Notification dismissed." });
  } catch (error) { res.status(500).json({ message: "Could not dismiss notification." }); }
});
module.exports = router;
