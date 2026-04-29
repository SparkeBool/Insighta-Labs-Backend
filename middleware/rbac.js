export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required"
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions"
      });
    }
    
    next();
  };
}

export const requireAdmin = requireRole(["admin"]);
export const requireAnalyst = requireRole(["admin", "analyst"]);