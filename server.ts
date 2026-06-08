import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client (Lazy initialization)
let aiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. Gemini chat assistant will run in fallback simulation mode.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// System instructions that guide the AI of Ceflot's capabilities, roles, permissions and commands
const SYSTEM_INSTRUCTION = `
You are the Ceflot AI Assistant, a smart AI chat agent built for Ceflot (Construction Easy Flow Lifecycle Operations Tool).
You operate in two contexts depending on the user environment:
1. Mobile/Field Site App ("mobile-site") - specifically handles daily logs, progress reporting steps, material usage, manpower logs, alerts, trade guides.
2. Web Portal Dashboard ("global-portal") - manages the entire construction ERP containing multiple panels/modules (Budget, BOQ, Planning, Logistics, Procurement, Warehouse, Schedule, Project Setup, Governance, Permissions, User Management, etc.), active projects, and themes.

Your task is to understand user commands and questions, and respond in a helpful, concise manner, following role-based permission constraints strictly.

Capabilities of Ceflot Site App (mobile-site mode):
1. "Log Daily Progress" Report Wizard: Consists of 7 steps:
   - Step 1: Weather (Sunny, Rainy, Cold, Humid), Shift, Remarks.
   - Step 2: Executor selector (Subcontractor or Daily Basis labor).
   - Step 3: BOQ Activity selection.
   - Step 4: Material usage logger.
   - Step 5: Manpower crew logger.
   - Step 6: Equipment runtime logger.
   - Step 7: Summary and submission.
2. "Warehouse Inventory" Storekeeping Panel:
   - Goods Receipt Notes (GRN): Incoming materials tracking.
   - Material Transfer Records (MTR): Outgoing materials issuance.
   - Stock ledger/audit.
3. "Alert & Flagging":
   - Severity: Moderate (Yellow), High (Orange), Critical (Red).
   - Categories: Severe Weather Delay, Material Shortage, Machinery Breakdown, Design Conflict, Safeties Hazard.

Capabilities of Ceflot Web Portal (global-portal mode):
1. Modules/Panels: "home", "dashboard" (Director Dashboard), "intelligence" (AI reports), "client-portal", "project-selection", "projects", "schedule" (milestones), "planning" (manpower planning), "project-setup" (setup checklists), "governance" (approvals), "budget", "operations-hub", "field-app" (site field app preview), "procurement", "warehouse" (full stock ledger), "library" (resource templates), "approvals", "alerts", "approval-config", "variations" (contract variation orders), "subcontractors" (subcontractor contract management), "users" (user directories), "profile", "permissions", "help", "guide", "audit", "god" (platform super admin).
2. Project switching, theme controls (dark, light), and administrative emulations.

Your instructions:
- First, check if the user is asking to do something that is a command.
- Command Actions for Mobile Site context:
  - Setting weather: "Set weather to rainy" -> action: "SET_WEATHER" (Params: weather: 'sunny' | 'rainy' | 'cold' | 'humid')
  - Setting remarks: "Set report remarks to: concrete pouring completed" -> action: "SET_REMARKS" (Params: remarks: "text")
  - Setting progress step: "Go to step 4" -> action: "SET_STEP" (Params: step: number)
  - Navigate to tabs: "Go to storeman", "Navigate to Alerts", "Open dashboard" -> action: "SWITCH_TAB" (Params: tab: 'dashboard' | 'report' | 'trade_guide' | 'store' | 'alerts' | 'history' | 'notifications')
  - Simulating a role switch: "Switch active role to Storeman" -> action: "SIMULATE_ROLE_SWITCH" (Params: role: "site_encoder" | "storeman" | "procurement" | "tenant_admin")
  - Filing an alert: "File a critical alert for material shortage of steel" -> action: "FILE_ALERT" (Params: alertType: "Material Shortage", severity: "Critical", alertRemarks: "text")
  - Log a material usage: "We used 10 bags of cement" -> action: "ADD_MATERIAL_LOG" (Params: material: "cement", quantity: number)
  - Log a manpower crew: "Add 5 carpenters for 8 hours" -> action: "ADD_MANPOWER_LOG" (Params: labourGrade: "carpenter", headcount: number, hours: number)
  - Changing / Updating current selected activity details: "Change activity quantity to 15" or "Update selected activity quantity to 25 cubic meters" or "Set active activity remarks to concrete set" -> action: "UPDATE_ACTIVITY_INFO" (Params: executedQty: number, remarks: "string")
  - Changing / Updating a drafted material item's quantity: "Change concrete material to 30 bags" or "Set steel qty to 150 kg" or "update cement log to 40" -> action: "UPDATE_DRAFT_MATERIAL" (Params: material: "string", quantity: number)
  - Changing / Updating a drafted manpower labor item's count: "Change carpentry headcount to 6" or "set carpenter count to 10" or "update steel fixer count to 4" -> action: "UPDATE_DRAFT_LABOR" (Params: labourGrade: "string", headcount: number)

- Command Actions for Global Web Portal context:
  - Setting Active Panel: "Open the budget module", "Go to variation management", "Navigate to scheduling" -> action: "SET_PANEL" (Params: panel: "home" | "dashboard" | "intelligence" | "client-portal" | "project-selection" | "projects" | "schedule" | "planning" | "project-setup" | "governance" | "budget" | "operations-hub" | "field-app" | "procurement" | "warehouse" | "library" | "approvals" | "alerts" | "approval-config" | "variations" | "subcontractors" | "users" | "profile" | "permissions" | "help" | "guide" | "audit" | "god")
  - Selecting/Switching active project: "Switch active project to Central Plaza" -> action: "SET_PROJECT" (Params: projectName: "string")
  - Set Web Theme: "Change theme to light layout", "Set theme to dark" -> action: "SET_THEME" (Params: theme: "dark" | "light")
  - Role emulation: "Emulate tenant_admin" -> action: "SIMULATE_ROLE_SWITCH" (Params: role: "site_encoder" | "storeman" | "procurement" | "tenant_admin")

- Role-based checking:
  - Check if the active role is permitted to perform this command.
  - If they are NOT permitted:
    - Set isAuthorized = false
    - Do NOT include the command block in your output, or set it to null.
    - Explain politely in the text response that their current active role is not authorized for this, and they should switch view or ask an admin.
  - If they ARE permitted:
    - Set isAuthorized = true
    - Return the JSON with the appropriate command structure.

- Always output a valid JSON matching this schema:
{
  "response": "Your friendly, concise, professional reply. Highlight the command initiated or explain the status.",
  "command": {
    "action": "SET_WEATHER" | "SET_REMARKS" | "SET_STEP" | "FILE_ALERT" | "SIMULATE_ROLE_SWITCH" | "SWITCH_TAB" | "ADD_MATERIAL_LOG" | "ADD_MANPOWER_LOG" | "CLEAR_CHAT" | "SET_PANEL" | "SET_PROJECT" | "SET_THEME" | "UPDATE_ACTIVITY_INFO" | "UPDATE_DRAFT_MATERIAL" | "UPDATE_DRAFT_LABOR" | null,
    "params": {
      "weather": "sunny" | "rainy" | "cold" | "humid",
      "remarks": "string",
      "step": number,
      "tab": "dashboard" | "report" | "trade_guide" | "store" | "alerts" | "history" | "notifications",
      "panel": "string",
      "projectName": "string",
      "theme": "dark" | "light",
      "role": "site_encoder" | "storeman" | "procurement" | "tenant_admin",
      "alertType": "Severe Weather Delay" | "Material Shortage" | "Machinery Breakdown" | "Design Conflict" | "Safeties Hazard",
      "severity": "Moderate" | "High" | "Critical",
      "alertRemarks": "string",
      "material": "string",
      "quantity": number,
      "labourGrade": "string",
      "headcount": number,
      "hours": number,
      "executedQty": number
    }
  },
  "isAuthorized": boolean
}

Make sure output matches this JSON format strictly. Never output codeblocks, markdown boxes, or text outside of this JSON packet.
`;

// API routes
app.post("/api/chat", async (req, res) => {
  const { message, chatHistory = [], context = {} } = req.body;
  const userRole = context.role || "site_encoder";
  const userName = context.userName || "Field Operator";
  const projectName = context.projectName || "Central Project";
  const activeWeather = context.weather || "sunny";
  const activeRemarks = context.remarks || "";
  const currentStep = context.step || 1;
  const activeTab = context.activeTab || "dashboard";
  const activePanel = context.activePanel || "home";
  const appMode = context.appMode || "mobile-site"; // "mobile-site" or "global-portal"

  try {
    const ai = getGeminiClient();
    if (!ai) {
      // Fallback local rules-based simulation response if GEMINI_API_KEY is not set
      let responseText = `Hello ${userName}, I'm running in local Ceflot Assistant simulator mode.`;
      let command: any = null;
      let isAuthorized = true;

      const lowerMsg = message.toLowerCase();

      // Check global vs site context actions
      if (appMode === "global-portal") {
        if (lowerMsg.includes("theme") || lowerMsg.includes("dark mode") || lowerMsg.includes("light mode")) {
          const targetTheme = lowerMsg.includes("light") ? "light" : "dark";
          responseText = `Switching active UI presentation mode to ${targetTheme}.`;
          command = { action: "SET_THEME", params: { theme: targetTheme } };
        } else if (lowerMsg.includes("navigate") || lowerMsg.includes("go to") || lowerMsg.includes("open") || lowerMsg.includes("show")) {
          let destPanel = "home";
          if (lowerMsg.includes("budget")) destPanel = "budget";
          else if (lowerMsg.includes("boq") || lowerMsg.includes("bill")) destPanel = "budget";
          else if (lowerMsg.includes("schedule") || lowerMsg.includes("milestone")) destPanel = "schedule";
          else if (lowerMsg.includes("planning") || lowerMsg.includes("forecast")) destPanel = "planning";
          else if (lowerMsg.includes("setup") || lowerMsg.includes("checklist")) destPanel = "project-setup";
          else if (lowerMsg.includes("governance") || lowerMsg.includes("complain") || lowerMsg.includes("compliance")) destPanel = "governance";
          else if (lowerMsg.includes("procurement") || lowerMsg.includes("purchase")) destPanel = "procurement";
          else if (lowerMsg.includes("warehouse") || lowerMsg.includes("stock") || lowerMsg.includes("inventory")) destPanel = "warehouse";
          else if (lowerMsg.includes("library") || lowerMsg.includes("temp")) destPanel = "library";
          else if (lowerMsg.includes("approval")) destPanel = "approvals";
          else if (lowerMsg.includes("alert") || lowerMsg.includes("flag")) destPanel = "alerts";
          else if (lowerMsg.includes("variation") || lowerMsg.includes("change order")) destPanel = "variations";
          else if (lowerMsg.includes("subcon") || lowerMsg.includes("contract")) destPanel = "subcontractors";
          else if (lowerMsg.includes("user")) destPanel = "users";
          else if (lowerMsg.includes("permission") || lowerMsg.includes("role")) destPanel = "permissions";
          else if (lowerMsg.includes("field") || lowerMsg.includes("site app")) destPanel = "field-app";

          responseText = `Navigating master workspace panel directly to: '${destPanel}'.`;
          command = { action: "SET_PANEL", params: { panel: destPanel } };
        } else if (lowerMsg.includes("project")) {
          // Mock project name matching
          responseText = `Looking up matching company project parameters and setting workspace scope window...`;
          command = { action: "SET_PROJECT", params: { projectName: message } };
        } else {
          responseText = `Hi ${userName}, I am your corporate ERP concierge. Ask me to 'open budget', 'view scheduler', 'go to role permissions', 'switch theme to light', or consult active project boundaries!`;
        }
      } else {
        // Mobile Site App Mode
        if (lowerMsg.includes("weather")) {
          if (["site_encoder", "tenant_admin"].includes(userRole)) {
            let weatherVal: "sunny"|"rainy"|"cold"|"humid" = "sunny";
            if (lowerMsg.includes("rainy") || lowerMsg.includes("rain")) weatherVal = "rainy";
            else if (lowerMsg.includes("cold") || lowerMsg.includes("chill")) weatherVal = "cold";
            else if (lowerMsg.includes("humid") || lowerMsg.includes("hot")) weatherVal = "humid";

            responseText = `Setting weather to ${weatherVal} for today's report on behalf of ${userName}.`;
            command = { action: "SET_WEATHER", params: { weather: weatherVal } };
          } else {
            isAuthorized = false;
            responseText = `Access Denied: Role '${userRole}' lacks permission to modify project daily weather logs. Only Encoders or Admins can do so.`;
          }
        } else if (lowerMsg.includes("navigate") || lowerMsg.includes("go to") || lowerMsg.includes("open")) {
          let destTab: any = "dashboard";
          if (lowerMsg.includes("store") || lowerMsg.includes("warehouse")) destTab = "store";
          else if (lowerMsg.includes("alert")) destTab = "alerts";
          else if (lowerMsg.includes("guide") || lowerMsg.includes("reference")) destTab = "trade_guide";
          else if (lowerMsg.includes("report") || lowerMsg.includes("wizard")) destTab = "report";
          else if (lowerMsg.includes("history")) destTab = "history";
          else if (lowerMsg.includes("notif")) destTab = "notifications";

          responseText = `Navigating to the '${destTab}' module now.`;
          command = { action: "SWITCH_TAB", params: { tab: destTab } };
        } else if (lowerMsg.includes("alert")) {
          if (["site_encoder", "storeman", "tenant_admin"].includes(userRole)) {
            let typeVal = "Material Shortage";
            if (lowerMsg.includes("weather")) typeVal = "Severe Weather Delay";
            else if (lowerMsg.includes("machinery") || lowerMsg.includes("breakdown")) typeVal = "Machinery Breakdown";
            else if (lowerMsg.includes("hazard") || lowerMsg.includes("safety")) typeVal = "Safeties Hazard";

            let sevVal = "Moderate";
            if (lowerMsg.includes("critical") || lowerMsg.includes("stopper")) sevVal = "Critical";
            else if (lowerMsg.includes("high")) sevVal = "High";

            responseText = `Filing a new ${sevVal} alert classified as '${typeVal}' regarding: '${message}'.`;
            command = {
              action: "FILE_ALERT",
              params: {
                alertType: typeVal,
                severity: sevVal,
                alertRemarks: message
              }
            };
          } else {
            isAuthorized = false;
            responseText = `Access Denied: Role '${userRole}' does not hold clearance level to post project flags or safety alerts.`;
          }
        } else if (lowerMsg.includes("role") || lowerMsg.includes("switch to")) {
          if (context.isPlatformGod || userRole === "tenant_admin") {
            let targetRole = "site_encoder";
            if (lowerMsg.includes("store")) targetRole = "storeman";
            else if (lowerMsg.includes("procurement")) targetRole = "procurement";
            else if (lowerMsg.includes("admin") || lowerMsg.includes("super")) targetRole = "tenant_admin";

            responseText = `Emulating client view role switch to '${targetRole}'.`;
            command = { action: "SIMULATE_ROLE_SWITCH", params: { role: targetRole } };
          } else {
            isAuthorized = false;
            responseText = `Security Overreach: Role persona emulations are restricted to Platform God or Tenant Administrator levels.`;
          }
        } else if (lowerMsg.includes("activity") || lowerMsg.includes("quantity") || lowerMsg.includes("qty")) {
          // Parse dynamic numbers for simulation
          const nums = lowerMsg.match(/\d+/);
          const val = nums ? parseInt(nums[0], 10) : 25;
          responseText = `Proposing agentic update for selected BOQ activity info parameters.`;
          command = {
            action: "UPDATE_ACTIVITY_INFO",
            params: {
              executedQty: val,
              remarks: "Updated via AI agent request"
            }
          };
        } else if (lowerMsg.includes("cement") || lowerMsg.includes("steel") || lowerMsg.includes("material") || lowerMsg.includes("sand") || lowerMsg.includes("bag")) {
          const nums = lowerMsg.match(/\d+/);
          const val = nums ? parseInt(nums[0], 10) : 10;
          let mat = "cement";
          if (lowerMsg.includes("steel")) mat = "steel";
          else if (lowerMsg.includes("sand")) mat = "sand";
          responseText = `Proposing update to the logged quantity for material item "${mat}".`;
          command = {
            action: "UPDATE_DRAFT_MATERIAL",
            params: {
              material: mat,
              quantity: val
            }
          };
        } else if (lowerMsg.includes("carpenter") || lowerMsg.includes("mason") || lowerMsg.includes("manpower") || lowerMsg.includes("labor") || lowerMsg.includes("fixer")) {
          const nums = lowerMsg.match(/\d+/);
          const val = nums ? parseInt(nums[0], 10) : 5;
          let grade = "carpenter";
          if (lowerMsg.includes("mason")) grade = "mason";
          else if (lowerMsg.includes("fixer")) grade = "steel fixer";
          responseText = `Proposing adjustment to headcount parameters for labour grade "${grade}".`;
          command = {
            action: "UPDATE_DRAFT_LABOR",
            params: {
              labourGrade: grade,
              headcount: val
            }
          };
        } else {
          responseText = `Hi ${userName}, I understand you are logged in as '${userRole?.replace(/_/g, " ")}' on Project '${projectName}'. Ceflot is ready to capture your daily logs, inventory ledger ins/outs, or raise safety alerts. Ask me to 'navigate to store', 'change weather to rainy', or 'file alert' to act on your instruction!`;
        }
      }

      return res.json({ response: responseText, command, isAuthorized });
    }

    // Build context-rich prompt for Gemini
    const assistantPrompt = `
Context details:
- Environment App Mode Context: "${appMode}"
- User Name: "${userName}"
- User Role: "${userRole}"
- Project Name: "${projectName}"
- Current Weather of Draft: "${activeWeather}"
- Current Report Remarks: "${activeRemarks}"
- Report Step: ${currentStep}
- Current Active Tab UI: "${activeTab}"
- Current Web Dashboard Panel: "${activePanel}"

Conversation history:
${chatHistory.map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}

New User Instruction: "${message}"

Process the request under mode "${appMode}". Determine if the instruction constitutes a command, verify permission authorization for the role "${userRole}", and respond exclusively in the requested JSON format.
`;

    const chatResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: assistantPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["response", "isAuthorized"],
          properties: {
            response: { type: Type.STRING, description: "Text reply to the user" },
            isAuthorized: { type: Type.BOOLEAN, description: "Whether the action is permitted under user roles" },
            command: {
              type: Type.OBJECT,
              description: "Optional action command",
              properties: {
                action: { type: Type.STRING },
                params: {
                  type: Type.OBJECT,
                  properties: {
                    weather: { type: Type.STRING },
                    remarks: { type: Type.STRING },
                    step: { type: Type.NUMBER },
                    tab: { type: Type.STRING },
                    panel: { type: Type.STRING },
                    projectName: { type: Type.STRING },
                    theme: { type: Type.STRING },
                    role: { type: Type.STRING },
                    alertType: { type: Type.STRING },
                    severity: { type: Type.STRING },
                    alertRemarks: { type: Type.STRING },
                    material: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    labourGrade: { type: Type.STRING },
                    headcount: { type: Type.NUMBER },
                    hours: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      }
    });

    const bodyText = chatResponse.text?.trim() || "{}";
    const resultObj = JSON.parse(bodyText);
    res.json(resultObj);

  } catch (error: any) {
    console.error("Error in /api/chat endpoint:", error);
    res.status(500).json({
      response: `I apologize, I encountered an internal communication error: ${error.message || error}`,
      isAuthorized: true,
      command: null
    });
  }
});

// Serve static assets in production, setup Vite middleware in development
async function bootstrap() {
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
    console.log(`Server launched on port ${PORT}`);
  });
}

bootstrap();
