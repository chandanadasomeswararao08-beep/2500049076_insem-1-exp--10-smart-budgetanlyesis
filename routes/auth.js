const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/security");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { createResetToken, hashResetToken, isValidResetToken, isValidNewPassword } = require("../utils/password-reset");
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7*24*60*60*1000 });

router.post("/register", authLimiter, [
  body("name").trim().isLength({min:2,max:70}),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({min:8}).withMessage("Password must contain at least 8 characters.")
], async (req,res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({message: errors.array()[0].msg});
  try {
    const {name,email,password} = req.body;
    if (await User.findOne({email})) return res.status(409).json({message:"An account with this email already exists."});
    const user = await User.create({name,email,password:await bcrypt.hash(password,12)});
    const token = jwt.sign({id:user._id}, process.env.JWT_SECRET, {expiresIn:"7d"});
    res.cookie("bm_token",token,cookieOptions()).status(201).json({user:{name:user.name,email:user.email,currency:user.currency}});
  } catch(e) { res.status(500).json({message:"Could not create account."}); }
});
router.post("/login", authLimiter, async (req,res) => {
  const email = String(req.body.email || "").toLowerCase().trim();
  const user = await User.findOne({email});
  if (!user || !(await bcrypt.compare(String(req.body.password || ""),user.password))) return res.status(401).json({message:"Email or password is incorrect."});
  const token = jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"7d"});
  res.cookie("bm_token",token,cookieOptions()).json({user:{name:user.name,email:user.email,currency:user.currency}});
});
// Always return the same public response so callers cannot discover registered emails.
router.post("/forgot-password", authLimiter, async (req, res) => {
  const generic = { message: "If an account exists for that email, password reset instructions will be sent shortly." };
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json(generic);
  try {
    const user = await User.findOne({ email });
    if (user) {
      const reset = createResetToken();
      user.passwordResetTokenHash = reset.tokenHash;
      user.passwordResetExpires = reset.expiresAt;
      await user.save();
      const baseUrl = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
      const resetUrl = `${baseUrl}/?resetToken=${reset.token}`;
      try {
        const sendEmail = req.app.locals.sendPasswordResetEmail || sendPasswordResetEmail;
        await sendEmail({ to: user.email, resetUrl });
      } catch (mailError) {
        // Do not log reset URLs or tokens. Clear the unusable token if delivery failed.
        user.passwordResetTokenHash = null;
        user.passwordResetExpires = null;
        await user.save();
        console.error("Password reset email delivery failed:", mailError.message);
      }
    }
    return res.json(generic);
  } catch (error) {
    console.error("Password reset request failed:", error.message);
    return res.json(generic);
  }
});

router.post("/reset-password", authLimiter, async (req, res) => {
  const token = String(req.body.token || "");
  const newPassword = String(req.body.newPassword || "");
  if (!isValidResetToken(token) || !isValidNewPassword(newPassword)) {
    return res.status(400).json({ message: "This reset link is invalid or expired. Request a new one." });
  }
  const tokenHash = hashResetToken(token);
  const user = await User.findOne({ passwordResetTokenHash: tokenHash, passwordResetExpires: { $gt: new Date() } }).select("+passwordResetTokenHash +passwordResetExpires");
  if (!user) return res.status(400).json({ message: "This reset link is invalid or expired. Request a new one." });
  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  await user.save();
  return res.json({ message: "Password reset successfully. You can now sign in with your new password." });
});

router.post("/logout",(req,res)=>{res.clearCookie("bm_token",{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}).json({message:"Signed out."});});
router.get("/me",auth,async(req,res)=>{const u=await User.findById(req.user.id).select("name email currency notifications"); if(!u)return res.status(404).json({message:"User not found"});res.json({user:u});});
router.put("/profile",auth,async(req,res)=>{const u=await User.findByIdAndUpdate(req.user.id,{name:String(req.body.name||"").trim(),currency:req.body.currency,notifications:!!req.body.notifications},{new:true,runValidators:true}).select("name email currency notifications");res.json({user:u});});
router.put("/password",auth,async(req,res)=>{if(!req.body.currentPassword||String(req.body.newPassword||"").length<8)return res.status(400).json({message:"Enter your current password and a new password of at least 8 characters."});const u=await User.findById(req.user.id);if(!await bcrypt.compare(req.body.currentPassword,u.password))return res.status(400).json({message:"Current password is incorrect."});u.password=await bcrypt.hash(req.body.newPassword,12);await u.save();res.json({message:"Password updated."});});
router.delete("/account",auth,async(req,res)=>{const Transaction=require("../models/Transaction"),Budget=require("../models/Budget"),Goal=require("../models/SavingsGoal"),Notification=require("../models/Notification");await Promise.all([Transaction.deleteMany({user:req.user.id}),Budget.deleteMany({user:req.user.id}),Goal.deleteMany({user:req.user.id}),Notification.deleteMany({user:req.user.id}),User.findByIdAndDelete(req.user.id)]);res.clearCookie("bm_token").json({message:"Account deleted."});});
module.exports=router;
