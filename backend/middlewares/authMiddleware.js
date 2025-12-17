import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided." });
    }

    // Expecting: "Bearer <token>"
    const token = authHeader.split(" ")[1];

    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ message: "Invalid token format." });
    }

    // Verify token - decoded IS the payload directly
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Correct: Access properties directly from decoded
    req.user = {
      userId: decoded.userId, // Not decoded.payload.userId
      role: decoded.role, // Not decoded.payload.role
    };

    next();
  } catch (err) {
    console.error("Auth error:", err.message);

    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token." });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired." });
    }

    return res.status(401).json({ message: "Unauthorized." });
  }
};

export default authMiddleware;
