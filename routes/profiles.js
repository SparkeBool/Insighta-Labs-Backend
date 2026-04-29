import express from "express";
import { v7 as uuidv7 } from "uuid";
import Profile from "../models/Profile.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin, requireAnalyst } from "../middleware/rbac.js";
import { requireApiVersion } from "../middleware/versioning.js";
import { apiLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

function buildFilter(req) {
  const filter = {};
  const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability } = req.query;
  
  if (gender && (gender === "male" || gender === "female")) filter.gender = gender;
  if (age_group && ["child", "teenager", "adult", "senior"].includes(age_group)) filter.age_group = age_group;
  if (country_id && country_id.length >= 2) filter.country_id = country_id.toUpperCase();
  
  if (min_age) {
    const val = parseInt(min_age);
    if (!isNaN(val)) filter.age = { ...filter.age, $gte: val };
  }
  
  if (max_age) {
    const val = parseInt(max_age);
    if (!isNaN(val)) filter.age = { ...filter.age, $lte: val };
  }
  
  if (min_gender_probability) {
    const val = parseFloat(min_gender_probability);
    if (!isNaN(val) && val >= 0 && val <= 1) filter.gender_probability = { $gte: val };
  }
  
  if (min_country_probability) {
    const val = parseFloat(min_country_probability);
    if (!isNaN(val) && val >= 0 && val <= 1) filter.country_probability = { $gte: val };
  }
  
  return filter;
}

// Helper: Build pagination response with links
function buildPaginationResponse(req, page, limit, total, data) {
  const totalPages = Math.ceil(total / limit);
  const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
  
  const buildUrl = (p) => {
    const params = new URLSearchParams(req.query);
    params.set("page", p);
    params.set("limit", limit);
    return `${baseUrl}?${params.toString()}`;
  };
  
  return {
    status: "success",
    page: page,
    limit: limit,
    total: total,
    total_pages: totalPages,
    links: {
      self: buildUrl(page),
      next: page < totalPages ? buildUrl(page + 1) : null,
      prev: page > 1 ? buildUrl(page - 1) : null
    },
    data: data
  };
}

// GET /api/profiles
router.get("/",
  requireApiVersion("1"),
  authenticate,
  requireAnalyst,
  apiLimiter,
  async (req, res) => {
    try {
      const filter = buildFilter(req);
      
      const sort_by = req.query.sort_by;
      const order = req.query.order;
      let sortObj = { created_at: -1 };
      
      if (sort_by === "age") sortObj = { age: order === "asc" ? 1 : -1 };
      else if (sort_by === "created_at") sortObj = { created_at: order === "asc" ? 1 : -1 };
      else if (sort_by === "gender_probability") sortObj = { gender_probability: order === "asc" ? 1 : -1 };
      
      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      if (limit > 50) limit = 50;
      
      const skip = (page - 1) * limit;
      const total = await Profile.countDocuments(filter);
      const profiles = await Profile.find(filter).sort(sortObj).skip(skip).limit(limit);
      
      const data = profiles.map(p => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        age: p.age,
        age_group: p.age_group,
        country_id: p.country_id,
        created_at: p.created_at,
        gender_probability: p.gender_probability
      }));
      
      res.json(buildPaginationResponse(req, page, limit, total, data));
      
    } catch (error) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
);

// GET /api/profiles/search
router.get("/search",
  requireApiVersion("1"),
  authenticate,
  requireAnalyst,
  apiLimiter,
  async (req, res) => {
    try {
      const q = req.query.q;
      
      if (!q || q.trim() === "") {
        return res.status(400).json({ status: "error", message: "Query parameter 'q' is required" });
      }
      
      const query = q.toLowerCase().trim();
      const filter = {};
      
      if (query.includes("male") || query.includes("men")) filter.gender = "male";
      if (query.includes("female") || query.includes("women")) filter.gender = "female";
      
      if (query.includes("child")) filter.age_group = "child";
      if (query.includes("teen")) filter.age_group = "teenager";
      if (query.includes("adult")) filter.age_group = "adult";
      if (query.includes("senior")) filter.age_group = "senior";
      
      if (query.includes("young")) filter.age = { $gte: 16, $lte: 24 };
      
      const aboveMatch = query.match(/(?:above|over|older than)\s+(\d+)/);
      if (aboveMatch) filter.age = { ...filter.age, $gte: parseInt(aboveMatch[1]) };
      
      const belowMatch = query.match(/(?:below|under|younger than)\s+(\d+)/);
      if (belowMatch) filter.age = { ...filter.age, $lte: parseInt(belowMatch[1]) };
      
      const countries = {
        "nigeria": "NG", "kenya": "KE", "south africa": "ZA",
        "ghana": "GH", "usa": "US", "uk": "GB", "canada": "CA"
      };
      
      for (const [name, code] of Object.entries(countries)) {
        if (query.includes(name)) {
          filter.country_id = code;
          break;
        }
      }
      
      if (Object.keys(filter).length === 0) {
        return res.status(400).json({ status: "error", message: "Unable to interpret query" });
      }
      
      let page = parseInt(req.query.page);
      let limit = parseInt(req.query.limit);
      if (isNaN(page) || page < 1) page = 1;
      if (isNaN(limit) || limit < 1) limit = 10;
      if (limit > 50) limit = 50;
      
      const skip = (page - 1) * limit;
      const total = await Profile.countDocuments(filter);
      const profiles = await Profile.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit);
      
      const data = profiles.map(p => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        age: p.age,
        age_group: p.age_group,
        country_id: p.country_id
      }));
      
      res.json(buildPaginationResponse(req, page, limit, total, data));
      
    } catch (error) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
);

// GET /api/profiles/:id
router.get("/:id",
  requireApiVersion("1"),
  authenticate,
  requireAnalyst,
  apiLimiter,
  async (req, res) => {
    try {
      const profile = await Profile.findOne({ id: req.params.id });
      if (!profile) {
        return res.status(404).json({ status: "error", message: "Profile not found" });
      }
      res.json({ status: "success", data: profile });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
);

// POST /api/profiles (Admin only)
router.post("/",
  requireApiVersion("1"),
  authenticate,
  requireAdmin,
  apiLimiter,
  async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ status: "error", message: "Name is required" });
      }
      
      const normalizedName = name.toLowerCase().trim();
      const existing = await Profile.findOne({ name: normalizedName });
      
      if (existing) {
        return res.status(200).json({
          status: "success",
          message: "Profile already exists",
          data: existing
        });
      }
      
      const profile = new Profile({
        id: uuidv7(),
        name: normalizedName,
        gender: req.body.gender,
        gender_probability: req.body.gender_probability,
        age: req.body.age,
        age_group: req.body.age_group,
        country_id: req.body.country_id,
        country_name: req.body.country_name,
        country_probability: req.body.country_probability,
        created_at: new Date()
      });
      
      await profile.save();
      res.status(201).json({ status: "success", data: profile });
      
    } catch (error) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
);

// DELETE /api/profiles/:id (Admin only)
router.delete("/:id",
  requireApiVersion("1"),
  authenticate,
  requireAdmin,
  apiLimiter,
  async (req, res) => {
    try {
      const result = await Profile.findOneAndDelete({ id: req.params.id });
      if (!result) {
        return res.status(404).json({ status: "error", message: "Profile not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ status: "error", message: "Internal server error" });
    }
  }
);

export default router;