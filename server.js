import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

console.log("Gemini Key 是否读取成功：", !!process.env.GEMINI_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");
const projectsFile = path.join(__dirname, "projects.json");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(projectsFile)) {
  fs.writeFileSync(projectsFile, "[]", "utf-8");
}

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY?.trim(),
});

const projectOrganizerAgent = `
你是一个「设计项目内容整理 Agent」。

你的任务是：根据用户上传或输入的项目内容，自动将零散的项目信息整理成适合项目管理网页展示的结构化内容。

你需要完成以下 5 件事：

1. 自动生成一个专业、简洁、适合展示的项目标题
2. 判断项目所属分类
3. 生成 3-6 个项目标签
4. 生成一句话项目简介
5. 输出标准 JSON 格式，方便前端页面直接读取和展示

可选分类范围如下：
- 运营设计
- AI视觉
- 车载HMI
- 地图动效
- 交互
- 音乐
- 播客
- 包装设计
- IP角色
- AI钩子
- 其他

分类判断规则：
- 如果内容与活动页、营销视觉、banner、KV、促销、运营活动、商业化视觉、活动落地页相关，归类为「运营设计」
- 如果内容与 AI 生图、提示词、视觉合成、AIGC、风格探索、AI视觉生成、AI图片生成相关，归类为「AI视觉」
- 如果内容与车载屏、智能座舱、车机界面、行程、导航、HMI、车载场景相关，归类为「车载HMI」
- 如果内容与地图、路径、小车移动、飞行轨迹、路线展示、导航路线、轨迹动画相关，归类为「地图动效」
- 如果内容与交互页面、前端 Demo、HTML 原型、Web 交互、Three.js、WebGL、3D模型、空间交互、动态页面、互动体验、交互实验相关，归类为「交互」
- 如果内容与音乐节奏、音频响应、音频可视化、频谱、节奏动效、音乐播放器、声音互动、音乐播放、音频驱动视觉相关，归类为「音乐」
- 如果内容与播客、Podcast、电台、音频节目、节目列表、声音内容、Feed流、音频卡片、音频播放、播客推荐、播客详情页相关，归类为「播客」
- 如果内容与礼盒、包装、品牌物料、节日礼盒、周边、粽子包装、产品包装相关，归类为「包装设计」
- 如果内容与 IP 人物、角色形象、贴纸、角色一致性、形象延展、IP视觉、IP周边相关，归类为「IP角色」
- 如果内容与互动游戏、小游戏、抽奖游戏、转盘、答题、点击互动、游戏化运营、游戏化玩法、AI生成钩子、AI互动入口、AI玩法引导、AI活动钩子、钩子模板、AI钩子相关，优先归类为「AI钩子」
- 如果无法判断，归类为「其他」

特别注意：
- 绝对不要输出「Vibe Coding」
- 绝对不要输出「作品集项目」
- 绝对不要输出「面试素材」
- 绝对不要输出「音乐可视化」，统一改为「音乐」
- 绝对不要输出「3D交互」，统一改为「交互」
- 如果项目是 HTML Demo、前端原型、交互实验，优先判断为「交互」
- 如果项目重点是“音乐节奏 / 频谱 / 音频驱动视觉效果”，归类为「音乐」
- 如果项目出现“播客”“Podcast”“电台”“音频节目”“节目推荐”等关键词，不要归类为「音乐」，应该归类为「播客」
- 如果项目出现“互动游戏”“小游戏”“转盘”“点击互动”“抽奖”“答题”“游戏化玩法”“AI钩子”“钩子模板”等关键词，优先归类为「AI钩子」
- 如果项目同时包含车载屏和播客内容，但核心是播客页面 / 播客推荐 / 音频节目展示，优先归类为「播客」
- 如果项目同时包含车载屏和路径 / 地图 / 导航，优先归类为「车载HMI」或「地图动效」
- 如果项目是 3D 页面、Three.js、WebGL、空间动效、模型展示，不要输出「3D交互」，统一归类为「交互」
- 如果项目是互动游戏或游戏化玩法，即使它也是 HTML Demo，也优先归类为「AI钩子」

输出要求：
- 必须只输出 JSON
- 不要输出解释
- 不要使用 Markdown
- 标题要简洁专业，不要太长
- 项目简介控制在 30-70 个中文字符
- 标签要具体，不要太泛
- 如果原始内容很乱，也要根据内容合理推断
- 如果信息不足，可以基于文件名、项目关键词进行合理生成

输出 JSON 格式如下：

{
  "title": "项目标题",
  "category": "项目分类",
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "一句话项目简介"
}
`;

function readProjects() {
  try {
    const data = fs.readFileSync(projectsFile, "utf-8");
    const parsed = JSON.parse(data || "[]");

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.projects)) {
      return parsed.projects;
    }

    return [];
  } catch (error) {
    console.error("读取 projects.json 失败：", error);
    return [];
  }
}

function saveProjects(projects) {
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), "utf-8");
}

function formatFileSize(bytes = 0) {
  if (bytes < 1024) {
    return `${bytes} 字节`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(date = new Date()) {
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function repairFileName(fileName = "demo.html") {
  let name = fileName;

  const looksLikeMojibake =
    /Ã|Â|Ä|Å|Æ|Ç|È|É|Ê|Ë|Ì|Í|Î|Ï|Ð|Ñ|Ò|Ó|Ô|Õ|Ö|Ù|Ú|Û|Ü|Ý|ä|å|æ|ç|è|é|ê|ë|ì|í|î|ï|ð|ñ|ò|ó|ô|õ|ö|ù|ú|û|ü|ý|þ|å|ã|â|Â|�/.test(
      name
    );

  if (looksLikeMojibake) {
    try {
      const repaired = Buffer.from(name, "latin1").toString("utf8");
      if (repaired && !repaired.includes("�")) {
        name = repaired;
      }
    } catch (error) {
      name = fileName;
    }
  }

  return name;
}

function makeSafeStoredFileName(originalName = "demo.html") {
  const repairedName = repairFileName(originalName);
  const ext = path.extname(repairedName) || ".html";
  const baseName = path.basename(repairedName, ext);

  const safeBaseName = baseName
    .replace(/\s+/g, "-")
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9._-]/g, "")
    .slice(0, 80);

  return {
    displayName: repairedName,
    storedName: `${Date.now()}-${safeBaseName || "demo"}${ext}`,
  };
}

function extractJsonFromText(text = "") {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw error;
  }
}

async function organizeProjectWithAI(fileName, projectContent) {
  const slicedContent = String(projectContent || "").slice(0, 9000);

  const prompt = `
${projectOrganizerAgent}

以下是用户上传或输入的项目信息：

文件名：
${fileName || "未提供"}

项目内容：
${slicedContent || "未提供"}

请严格按照 JSON 格式输出。
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text || "";
  return extractJsonFromText(text);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const fixed = makeSafeStoredFileName(file.originalname || "demo.html");

    file.fixedOriginalName = fixed.displayName;
    file.storedFileName = fixed.storedName;

    cb(null, fixed.storedName);
  },
});

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    const lowerName = String(file.originalname || "").toLowerCase();

    const isHtml =
      file.mimetype === "text/html" ||
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm");

    if (isHtml) {
      cb(null, true);
    } else {
      cb(new Error("只支持上传 HTML 文件"));
    }
  },
});

// 获取项目列表
app.get("/api/projects", (req, res) => {
  const projects = readProjects();

  res.json({
    projects,
  });
});

// 上传单个 HTML，并自动 AI 整理
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "没有收到 HTML 文件",
      });
    }

    const filePath = req.file.path;
    const storedFileName = req.file.filename;
    const originalName =
      req.file.fixedOriginalName ||
      repairFileName(req.file.originalname || storedFileName);

    const htmlContent = fs.readFileSync(filePath, "utf-8");

    const aiResult = await organizeProjectWithAI(
      originalName || storedFileName,
      htmlContent
    );

    const projects = readProjects();

    const now = new Date();

    const newProject = {
      id: Date.now().toString(),

      title: aiResult.title || originalName || storedFileName,
      summary: aiResult.summary || "暂无简介",

      name: aiResult.title || originalName || storedFileName,
      fileName: originalName || storedFileName,
      storedFileName,
      category: aiResult.category || "其他",
      tags: Array.isArray(aiResult.tags) ? aiResult.tags : [],
      uploadTime: formatTime(now),
      fileSize: formatFileSize(req.file.size),
      previewUrl: `/uploads/${storedFileName}`,

      url: `/uploads/${storedFileName}`,
      createdAt: now.toISOString(),
    };

    projects.unshift(newProject);
    saveProjects(projects);

    res.json({
      success: true,
      project: newProject,
      projects,
      uploaded: [newProject],
    });
  } catch (error) {
    console.error("上传并整理失败：", error);

    res.status(500).json({
      error: "上传并整理失败",
      detail: error?.message || String(error),
      code: error?.code || error?.status || "UNKNOWN",
    });
  }
});

// 兼容旧前端：如果旧页面调用 /api/projects POST，也能上传
app.post("/api/projects", upload.array("files"), async (req, res) => {
  try {
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({
        error: "没有收到 HTML 文件",
      });
    }

    const projects = readProjects();
    const uploaded = [];

    for (const file of files) {
      const filePath = file.path;
      const storedFileName = file.filename;
      const originalName =
        file.fixedOriginalName ||
        repairFileName(file.originalname || storedFileName);
      const htmlContent = fs.readFileSync(filePath, "utf-8");

      const aiResult = await organizeProjectWithAI(
        originalName || storedFileName,
        htmlContent
      );

      const now = new Date();

      const newProject = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: aiResult.title || originalName || storedFileName,
        summary: aiResult.summary || "暂无简介",
        name: aiResult.title || originalName || storedFileName,
        fileName: originalName || storedFileName,
        storedFileName,
        category: aiResult.category || "其他",
        tags: Array.isArray(aiResult.tags) ? aiResult.tags : [],
        uploadTime: formatTime(now),
        fileSize: formatFileSize(file.size),
        previewUrl: `/uploads/${storedFileName}`,
        url: `/uploads/${storedFileName}`,
        createdAt: now.toISOString(),
      };

      projects.unshift(newProject);
      uploaded.push(newProject);
    }

    saveProjects(projects);

    res.json({
      success: true,
      projects,
      uploaded,
      zipCount: 0,
    });
  } catch (error) {
    console.error("批量上传并整理失败：", error);

    res.status(500).json({
      error: "批量上传并整理失败",
      detail: error?.message || String(error),
      code: error?.code || error?.status || "UNKNOWN",
    });
  }
});

// 删除项目
app.delete("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const projects = readProjects();

    const targetProject = projects.find((project) => project.id === id);

    if (!targetProject) {
      return res.status(404).json({
        error: "未找到该项目",
      });
    }

    const nextProjects = projects.filter((project) => project.id !== id);

    const fileNameToDelete = targetProject.storedFileName || targetProject.fileName;

    if (fileNameToDelete) {
      const targetFilePath = path.join(uploadsDir, fileNameToDelete);

      if (fs.existsSync(targetFilePath)) {
        fs.unlinkSync(targetFilePath);
      }
    }

    saveProjects(nextProjects);

    res.json({
      success: true,
      projects: nextProjects,
    });
  } catch (error) {
    console.error("删除项目失败：", error);

    res.status(500).json({
      error: "删除项目失败",
      detail: error?.message || String(error),
      code: error?.code || error?.status || "UNKNOWN",
    });
  }
});

// 保留测试接口
app.post("/api/organize-project", async (req, res) => {
  try {
    const { fileName, projectContent } = req.body;

    if (!fileName && !projectContent) {
      return res.status(400).json({
        error: "请至少提供文件名或项目内容",
      });
    }

    const result = await organizeProjectWithAI(fileName, projectContent || "");

    res.json(result);
  } catch (error) {
    console.error("Gemini API 调用失败：", error);

    res.status(500).json({
      error: "项目整理失败",
      detail: error?.message || String(error),
      code: error?.code || error?.status || "UNKNOWN",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});