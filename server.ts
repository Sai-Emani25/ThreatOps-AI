import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Fetch User Activity from external company API
  app.post("/api/fetch-activity", async (req, res) => {
    const { apiUrl, apiKey } = req.body;
    if (!apiUrl || !apiKey) {
      return res.status(400).json({ error: "API URL and Key are required" });
    }

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "X-API-Key": apiKey, // Support common header names
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Error fetching activity:", error.message);
      res.status(500).json({ error: "Failed to fetch activity from company API", details: error.message });
    }
  });

  // API Route: Threat Detection via Databricks LLM
  app.post("/api/detect-threats", async (req, res) => {
    const { databricksUrl, databricksToken, activityData } = req.body;
    
    if (!databricksUrl || !databricksToken || !activityData) {
      return res.status(400).json({ error: "Databricks config and activity data are required" });
    }

    try {
      // Databricks Model Serving API format
      // Expected input: { "dataframe_records": [...] } or { "inputs": [...] }
      const prompt = `Analyze the following user activity logs for cybersecurity threats, niche hacking attempts, or anomalies. 
      Return a JSON array of threat objects with fields: id, type, severity (low, medium, high, critical), description, and timestamp.
      
      Logs:
      ${JSON.stringify(activityData)}
      
      Response format: JSON only.`;

      const response = await axios.post(
        databricksUrl,
        {
          dataframe_records: [
            {
              prompt: prompt,
            },
          ],
        },
        {
          headers: {
            "Authorization": `Bearer ${databricksToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Databricks response parsing depends on the model output format
      // Usually it's in response.data.predictions[0]
      res.json(response.data);
    } catch (error: any) {
      console.error("Error calling Databricks:", error.message);
      res.status(500).json({ error: "Failed to analyze threats via Databricks", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
