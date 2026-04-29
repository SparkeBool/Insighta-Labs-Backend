export function requireApiVersion(version) {
  return (req, res, next) => {
    const apiVersion = req.headers["x-api-version"];
    
    if (!apiVersion) {
      return res.status(400).json({
        status: "error",
        message: "API version header required"
      });
    }
    
    if (apiVersion !== version) {
      return res.status(400).json({
        status: "error",
        message: "Unsupported API version"
      });
    }
    
    next();
  };
}