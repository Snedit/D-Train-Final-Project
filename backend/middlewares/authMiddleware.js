import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader)
      return res.status(401).json({ message: "No token provided." });

    // Expecting: "Bearer <token>"
    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(401).json({ message: "Invalid token format." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach to req for further use
    req.user = {
      userId: decoded.payload.userId,
      role: decoded.payload.role,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    return res.status(401).json({ message: "Unauthorized." });
  }
};

export default authMiddleware;
