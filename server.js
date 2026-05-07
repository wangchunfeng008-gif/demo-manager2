import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

console.log("Gemini Key 是否读取成功：", !!process.env.GEMINI_API_KEY);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.static("public"));

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
- Vibe Coding
- 车载HMI
- 地图动效
- 3D交互
- 音乐可视化
- 包装设计
- IP角色
- 作品集项目
- 面试素材
- 其他

判断规则：
- 如果内容与活动页、营销视觉、banner、KV、促销相关，归类为「运营设计」
- 如果内容与 AI 生图、提示词、视觉合成、风格探索相关，归类为「AI视觉」
- 如果内容与 HTML demo、前端原型、Claude/Codex 生成代码相关，归类为「Vibe Coding」
- 如果内容与车载屏、座舱、路线、行程、导航、HMI 相关，归类为「车载HMI」
- 如果内容与地图、路径、小车移动、飞行轨迹、导航路线相关，归类为「地图动效」
- 如果内容与 Three.js、3D模型、空间交互、立体场景相关，归类为「3D交互」
- 如果内容与音乐节奏、音频响应、小球跳动、可视化相关，归类为「音乐可视化」
- 如果内容与礼盒、包装、粽子、品牌物料、周边相关，归类为「包装设计」
- 如果内容与 IP 人物、贴纸、角色一致性、形象延展相关，归类为「IP角色」
- 如果内容明显适合用于求职展示，归类为「作品集项目」
- 如果内容与面试回答、JD分析、HRBP、作品集讲解相关，归类为「面试素材」
- 如果无法判断，归类为「其他」

输出要求：
- 必须只输出 JSON
- 不要输出解释
- 不要使用 Markdown
- 标题要简洁专业，不要太长
- 项目简介控制在 30-60 个中文字符
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

app.post("/api/organize-project", async (req, res) => {
  try {
    const { fileName, projectContent } = req.body;

    if (!fileName && !projectContent) {
      return res.status(400).json({
        error: "请至少提供文件名或项目内容",
      });
    }

    const prompt = `
${projectOrganizerAgent}

以下是用户上传或输入的项目信息：

文件名：
${fileName || "未提供"}

项目内容：
${projectContent || "未提供"}

请严格按照 JSON 格式输出。
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let text = response.text || "";

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(text);

    res.json(result);
  } catch (error) {
    console.error("Gemini API 调用失败：", error);

    res.status(500).json({
      error: "项目整理失败，请检查 Gemini API Key、模型名称或额度。",
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});