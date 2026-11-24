const jwt = require("jsonwebtoken");
module.exports = (req, res, next) => {
  const token = req.cookies.bm_token;
  if (!token) return res.status(401).json({ message: "Please sign in." });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie("bm_token");
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
};
