import express from "express";
import { Parser } from "json2csv";
import Profile from "../models/Profile.js";
import { authenticate } from "../middleware/auth.js";
import { requireAnalyst } from "../middleware/rbac.js";
import { requireApiVersion } from "../middleware/versioning.js";
import { apiLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// GET /api/profiles/export - CSV Export
router.get("/export",
  requireApiVersion("1"),
  authenticate,
  requireAnalyst,
  apiLimiter,
  async (req, res) => {
    try {
      // Build filter from query params
      const filter = {};
      const { gender, country_id, age_group, min_age, max_age } = req.query;
      
      if (gender && (gender === "male" || gender === "female")) {
        filter.gender = gender;
      }
      
      if (age_group && ["child", "teenager", "adult", "senior"].includes(age_group)) {
        filter.age_group = age_group;
      }
      
      if (country_id) {
        filter.country_id = country_id.toUpperCase();
      }
      
      if (min_age) {
        const val = parseInt(min_age);
        if (!isNaN(val)) {
          filter.age = { ...filter.age, $gte: val };
        }
      }
      
      if (max_age) {
        const val = parseInt(max_age);
        if (!isNaN(val)) {
          filter.age = { ...filter.age, $lte: val };
        }
      }
      
      const profiles = await Profile.find(filter).sort({ created_at: -1 });
      
      // CSV columns in exact order as specified in TRD
      const fields = [
        "id", "name", "gender", "gender_probability",
        "age", "age_group", "country_id", "country_name",
        "country_probability", "created_at"
      ];
      
      const parser = new Parser({ fields });
      const csv = parser.parse(profiles);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `profiles_${timestamp}.csv`;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
      
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({
        status: "error",
        message: "Export failed"
      });
    }
  }
);

export default router;