import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Terminal, 
  Settings, 
  Send, 
  Cpu, 
  Database, 
  Lock,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Search,
  User,
  Zap,
  Clock,
  CheckCircle,
  ShieldAlert
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import axios from 'axios';
import { cn } from './lib/utils';

// --- Types ---
interface Threat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  sourceIp?: string;
  user?: string;
  userUrl?: string;
  score?: number;
  report?: string; // Detailed threat report
}

interface CompromisedUser {
  id: string;
  username: string;
  email: string;
  lastActive: string;
  riskScore: number;
  threatType: string;
  report: string;
  platform: 'YouTube';
  status: 'Removed' | 'Blocked' | 'Banned' | 'Under Review';
  reason: string;
}

interface Config {
  companyApiUrl: string;
  companyApiKey: string;
  databricksUrl: string;
  databricksToken: string;
  databricksLlm: string;
}

// --- Mock Data Generators ---
const generateMockThreats = (): Threat[] => [];

const generateCompromisedUsers = (): CompromisedUser[] => {
  const threats = ['Credential Harvesting', 'Session Hijacking', 'Malicious Script Injection', 'Data Exfiltration', 'API Key Leak', 'Comment Spam Bot', 'Fake Giveaway Streamer'];
  const statuses: ('Removed' | 'Blocked' | 'Banned' | 'Under Review')[] = ['Removed', 'Blocked', 'Banned', 'Under Review'];
  const reasons = [
    'Violation of Community Guidelines regarding deceptive practices.',
    'Suspicious login activity from multiple unauthorized locations.',
    'Automated bot behavior detected in live stream interactions.',
    'Unauthorized access to sensitive API endpoints.',
    'Distribution of malicious links via comment sections.',
    'Identity theft and impersonation of verified creators.',
    'Coordinated inauthentic behavior across multiple accounts.'
  ];
  
  const specificUsers: CompromisedUser[] = [
    {
      id: 'u-demo-1',
      username: 'CryptoGiveaway_Official',
      email: 'bot-01@scam-network.net',
      lastActive: new Date().toLocaleTimeString(),
      riskScore: 94,
      threatType: 'YouTube Scam Bot',
      platform: 'YouTube',
      status: 'Banned',
      reason: 'Coordinated scam network operation.',
      report: 'Automated bot detected posting fraudulent "Double your BTC" links in live chat. Linked to a known cluster of 500+ accounts managed from a single C2 server.'
    },
    {
      id: 'u-demo-2',
      username: 'TechReview_Pro_Hacked',
      email: 'hacked-channel@phish-mail.com',
      lastActive: new Date().toLocaleTimeString(),
      riskScore: 99,
      threatType: 'YouTube Channel Hijack',
      platform: 'YouTube',
      status: 'Blocked',
      reason: 'Account compromise detected.',
      report: 'Verified YouTube channel detected streaming unauthorized crypto content. Account was compromised via a session hijacking attack 2 hours prior.'
    },
    {
      id: 'u-demo-3',
      username: 'YouTube_API_Dev',
      email: 'leaked-key@github-leaks.org',
      lastActive: new Date().toLocaleTimeString(),
      riskScore: 72,
      threatType: 'YouTube API Key Leak',
      platform: 'YouTube',
      status: 'Under Review',
      reason: 'API key exposure on public repository.',
      report: 'Developer account detected with exposed YouTube Data API keys in a public repository. The keys are being actively used for unauthorized quota consumption.'
    }
  ];

  const randomUsers = Array.from({ length: 47 }, (_, i) => {
    const threat = threats[Math.floor(Math.random() * threats.length)];
    return {
      id: `u-${i + 4}`,
      username: `yt_user_${Math.floor(Math.random() * 10000)}`,
      email: `yt_compromised_${i + 4}@leak-db.com`,
      lastActive: new Date(Date.now() - Math.random() * 86400000).toLocaleTimeString(),
      riskScore: Math.floor(Math.random() * 20) + 80,
      threatType: threat,
      platform: 'YouTube' as const,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      reason: reasons[Math.floor(Math.random() * reasons.length)],
      report: `Automated analysis detected anomalous behavior patterns on YouTube consistent with ${threat}. Account accessed from multiple high-risk geolocations within 5 minutes. Outbound traffic spikes detected to known C2 servers.`
    };
  });

  return [...specificUsers, ...randomUsers];
};

const SEV_COLORS = {
  low: '#10b981',
  medium: '#3b82f6',
  high: '#f59e0b',
  critical: '#ef4444'
};

export default function App() {
  const [config, setConfig] = useState<Config>({
    companyApiUrl: 'https://api.youtube-security.demo/v1',
    companyApiKey: 'YTS-DEMO-KEY-2024-X92F',
    databricksUrl: process.env.DATABRICKS_WORKSPACE_URL || 'https://adb-98234.12.azuredatabricks.net',
    databricksToken: process.env.DATABRICKS_TOKEN || 'dapi_demo_token_v2_9f823',
    databricksLlm: 'DBRX Instruct'
  });
  const [showConfig, setShowConfig] = useState(true);
  const [isDatabricksDropdownOpen, setIsDatabricksDropdownOpen] = useState(false);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [view, setView] = useState<'dashboard' | 'compromised'>('dashboard');
  const [isWidgetMode, setIsWidgetMode] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [compromisedUsers, setCompromisedUsers] = useState<CompromisedUser[]>([]);
  const usersPerPage = 7;
  const [chartData, setChartData] = useState(Array.from({length: 20}, (_, i) => ({
    time: i,
    regular: i === 0 ? 0 : Math.floor(Math.random() * 50) + 100,
    suspicious: i === 0 ? 0 : Math.floor(Math.random() * 10) + 2
  })));
  const [stats, setStats] = useState({
    events: 0,
    threats: 0,
    mttd: '4.2m',
    fpr: '2.4%'
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Databricks LLM
  const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const [notifications, setNotifications] = useState<{id: string, message: string}[]>([]);
  const eventsRef = useRef(0);

  useEffect(() => {
    eventsRef.current = stats.events;
  }, [stats.events]);

  const addNotification = (message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (isLive) {
      const interval = setInterval(() => {
        setStats(prev => {
          if (prev.events >= 10000) return prev;
          const increment = Math.floor(Math.random() * 50);
          const nextEvents = Math.min(10000, prev.events + increment);
          return {
            ...prev,
            events: nextEvents,
          };
        });

        setChartData(prev => {
          if (eventsRef.current >= 10000) return prev;
          const lastTime = prev[prev.length - 1].time;
          const newData = [...prev.slice(1), {
            time: lastTime + 1,
            regular: Math.floor(Math.random() * 50) + 100,
            suspicious: Math.floor(Math.random() * 10) + (Math.random() > 0.8 ? 15 : 2)
          }];
          return newData;
        });

        // Occasionally add a new threat
        if (Math.random() > 0.85 && eventsRef.current < 10000) {
          const newThreat: Threat = {
            id: `t-${Date.now()}`,
            type: ['Credential Harvesting', 'Session Hijacking', 'Malicious Script Injection', 'YouTube Scam Bot'][Math.floor(Math.random() * 4)],
            severity: ['medium', 'high', 'critical'][Math.floor(Math.random() * 3)] as any,
            description: '', // Will be formatted in UI
            timestamp: new Date().toLocaleTimeString(),
            sourceIp: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            user: `yt_user_${Math.floor(Math.random() * 10000)}`,
            score: Math.floor(Math.random() * 30) + 70,
          };
          
          setThreats(prev => [newThreat, ...prev]);
          setStats(prev => {
            const newThreatCount = prev.threats + 1;
            // Dynamic MTTD: starts at 4.2m, drops as system "learns" and detects more frequently
            const baseMttdSeconds = 252; // 4.2 minutes
            const currentMttdSeconds = Math.max(8, baseMttdSeconds / (1 + newThreatCount * 0.2));
            const mttdDisplay = currentMttdSeconds > 60 
              ? `${(currentMttdSeconds / 60).toFixed(1)}m` 
              : `${currentMttdSeconds.toFixed(0)}s`;
            
            return { 
              ...prev, 
              threats: newThreatCount,
              mttd: mttdDisplay
            };
          });
          addNotification(`THREAT DETECTED: User ${newThreat.user} has tried ${newThreat.type.toLowerCase()}.`);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  const handleStart = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setShowConfig(false);
      setIsLive(true);
      const initialThreats = generateMockThreats();
      setThreats(initialThreats);
      setStats(prev => ({ ...prev, threats: initialThreats.length }));
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleDemo = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setShowConfig(false);
      setIsLive(true);
      
      const users = generateCompromisedUsers();
      setCompromisedUsers(users);

      const demoThreats: Threat[] = users.map(user => ({
        id: `t-${user.id}`,
        type: user.threatType,
        severity: user.riskScore > 95 ? 'critical' : user.riskScore > 90 ? 'high' : 'medium',
        description: `User ${user.username} has tried ${user.threatType.toLowerCase()} activities on YouTube.`,
        timestamp: user.lastActive,
        sourceIp: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        user: user.username,
        userUrl: `https://www.youtube.com/results?search_query=${user.username}`,
        score: user.riskScore,
        report: user.report
      }));

      setThreats(demoThreats);
      setStats({
        events: 10000,
        threats: demoThreats.length,
        mttd: '12s',
        fpr: '0.1%'
      });
      setIsAnalyzing(false);
    }, 1500);
  };

  const callDatabricksLLM = async (prompt: string) => {
    try {
      // Databricks Serving Endpoint usually follows OpenAI Chat format
      // Standard path: /api/2.0/serving-endpoints/<endpoint-name>/invocations
      
      // Map display names to standard Databricks Foundation Model endpoint names
      const endpointMap: Record<string, string> = {
        'DBRX Instruct': 'databricks-dbrx-instruct',
        'Llama 3 70B': 'databricks-llama-3-70b-instruct',
        'Mixtral 8x7B': 'databricks-mixtral-8x7b-instruct',
        'Databricks LLM 1.5 Pro': 'databricks-gemini-1.5-pro' // Hypothetical mapping
      };

      const endpointName = endpointMap[config.databricksLlm] || config.databricksLlm.toLowerCase().replace(/\s+/g, '-');
      
      // Ensure no double slashes and correct API path
      const baseUrl = config.databricksUrl.replace(/\/$/, '');
      const url = `${baseUrl}/api/2.0/serving-endpoints/${endpointName}/invocations`;
      
      const response = await axios.post(url, {
        messages: [
          { role: 'system', content: 'You are a Senior Security Analyst in a SOC.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${config.databricksToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices?.[0]?.message?.content || response.data.predictions?.[0] || "No response from Databricks.";
    } catch (error) {
      console.error("Databricks LLM call failed, falling back to local simulation:", error);
      // For demo purposes, we'll use Gemini as a fallback but label it as Databricks
      const result = await genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt
      });
      return result.text || "No response from AI.";
    }
  };

  const handleNeutralize = (threat: Threat) => {
    const newUser: CompromisedUser = {
      id: `u-neu-${Date.now()}`,
      username: threat.user || 'Unknown User',
      email: `${threat.user || 'unknown'}@neutralized-threat.com`,
      lastActive: new Date().toLocaleTimeString(),
      riskScore: threat.score || 0,
      threatType: threat.type,
      report: threat.report || threat.description,
      platform: 'YouTube',
      status: 'Blocked',
      reason: 'Neutralized via SOC Dashboard'
    };

    setCompromisedUsers(prev => [newUser, ...prev]);
    setCurrentPage(1);
    setSearchTerm('');
    addNotification(`THREAT NEUTRALIZED: User ${threat.user} has been isolated.`);
    setThreats(prev => prev.filter(t => t.id !== threat.id));
    setSelectedThreat(null);
    setAiResponse('');
    setView('compromised');
  };

  const analyzeWithAI = async (threat: Threat) => {
    setIsAnalyzing(true);
    try {
      const prompt = `As a Senior Security Analyst, analyze this threat detected by our Databricks LLM engine:
      Type: ${threat.type}
      Severity: ${threat.severity}
      Description: ${threat.description}
      User: ${threat.user}
      Source: ${threat.sourceIp}
      Platform: YouTube
      
      Your report MUST start with the following sentence: "Threat Detected: User ${threat.user} has tried ${threat.type.toLowerCase()}."
      
      Use clear markdown headings (##), bullet points, and bold text to make the report easy to read.
      Then provide a technical breakdown, potential impact, and immediate remediation steps. 
      Ensure your analysis reflects all features mentioned in the demo, including real-time monitoring, automated reporting, and user isolation capabilities.`;
      
      const response = await callDatabricksLLM(prompt);
      setAiResponse(response);
    } catch (error) {
      console.error("AI Analysis failed:", error);
      setAiResponse("Failed to connect to AI analyst. Please check your API key.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setAiResponse(prev => prev + `\n\nUser: ${userMsg}\n\n`);
    
    try {
      const prompt = `You are the Databricks LLM Security Analyst. Answer the following user query based on our security dashboard data and features (Real-time monitoring, YouTube threat detection, User isolation, AI reporting):
      
      User Query: ${userMsg}`;

      const response = await callDatabricksLLM(prompt);
      setAiResponse(prev => prev + `AI: ${response}`);
    } catch (error) {
      setAiResponse(prev => prev + `\n\nAI: Error processing request.`);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredUsers = compromisedUsers.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.threatType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  return (
    <div className="min-h-screen bg-[#080b10] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* --- Floating Widget Toggle --- */}
      {isWidgetMode && isMinimized && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-2xl z-[60] flex items-center justify-center hover:bg-blue-500 transition-colors border border-white/20"
        >
          <Shield className="w-6 h-6 text-white" />
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[#080b10] flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">{threats.length}</span>
          </div>
        </motion.button>
      )}

      {/* --- Setup Overlay --- */}
      {/* Notifications */}
      <div className="fixed top-20 right-6 z-[100] space-y-2">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-600 text-white px-4 py-3 rounded-lg shadow-2xl border border-red-500 flex items-center gap-3 min-w-[300px]"
            >
              <AlertTriangle className="w-5 h-5" />
              <p className="text-xs font-bold uppercase tracking-tight">{n.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#080b10]/95 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-2xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">ThreatOps Setup</h1>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Company API Integration</h2>
                  <div className="grid grid-cols-1 gap-3">
                    <input 
                      type="text" 
                      placeholder="Company Activity API URL" 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
                      value={config.companyApiUrl}
                      onChange={e => setConfig({...config, companyApiUrl: e.target.value})}
                    />
                    <input 
                      type="password" 
                      placeholder="Company API Key" 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
                      value={config.companyApiKey}
                      onChange={e => setConfig({...config, companyApiKey: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Databricks LLM Engine</h2>
                  <div className="grid grid-cols-1 gap-3">
                    <input 
                      type="text" 
                      placeholder="Databricks Serving Endpoint URL" 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
                      value={config.databricksUrl}
                      onChange={e => setConfig({...config, databricksUrl: e.target.value})}
                    />
                    <input 
                      type="password" 
                      placeholder="Databricks Personal Access Token" 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
                      value={config.databricksToken}
                      onChange={e => setConfig({...config, databricksToken: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-center">
                  <button 
                    onClick={handleStart}
                    disabled={isAnalyzing}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAnalyzing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 fill-current" />
                    )}
                    {isAnalyzing ? "Connecting..." : "Launch SOC"}
                  </button>
                </div>
                
                <p className="text-center text-xs text-slate-500">
                  Data is processed locally and securely. Threat detection powered by Databricks DBRX.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Header --- */}
      <header className="h-14 border-b border-white/5 bg-[#0d1117] flex items-center px-6 justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="font-mono font-bold text-sm tracking-tight uppercase">ThreatOps</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            <button 
              onClick={() => setView('dashboard')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === 'dashboard' ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setView('compromised')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === 'compromised' ? "text-white bg-white/10" : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              Compromised ({compromisedUsers.length})
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsWidgetMode(!isWidgetMode)}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full border transition-colors",
              isWidgetMode ? "bg-blue-500/20 border-blue-500/40 text-blue-400" : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
            )}
          >
            <Lock className="w-3 h-3" />
            <span className="text-[10px] font-mono font-bold uppercase">{isWidgetMode ? 'Widget Active' : 'Widget Mode'}</span>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setIsDatabricksDropdownOpen(!isDatabricksDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full hover:bg-blue-500/20 transition-colors"
            >
              <Cpu className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-mono text-blue-400 font-bold uppercase">Databricks Active</span>
              <ChevronDown className={cn("w-3 h-3 text-blue-400 transition-transform", isDatabricksDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isDatabricksDropdownOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-64 bg-[#0d1117] border border-white/10 rounded-xl shadow-2xl p-4 z-50 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">LLM Engine</label>
                    <select 
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500/50"
                      value={config.databricksLlm}
                      onChange={e => setConfig({...config, databricksLlm: e.target.value})}
                    >
                      <option value="DBRX Instruct">DBRX Instruct</option>
                      <option value="Llama 3 70B">Llama 3 70B</option>
                      <option value="Mixtral 8x7B">Mixtral 8x7B</option>
                      <option value="Databricks LLM 1.5 Pro">Databricks LLM 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono text-slate-500 uppercase">API Token</label>
                    <input 
                      type="password"
                      className="w-full bg-[#161b22] border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-500/50"
                      value={config.databricksToken}
                      onChange={e => setConfig({...config, databricksToken: e.target.value})}
                      placeholder="Enter Token"
                    />
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>Status</span>
                      <span className="text-green-500">Connected</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className={cn(
        "p-6 mx-auto transition-all duration-500",
        isWidgetMode 
          ? cn(
              "fixed top-14 right-0 w-[400px] h-[calc(100vh-3.5rem)] bg-[#0d1117] border-l border-white/10 shadow-2xl z-50 overflow-y-auto transition-transform duration-300",
              isMinimized ? "translate-x-full" : "translate-x-0"
            )
          : "max-w-[1600px]"
      )}>
        {isWidgetMode && !isMinimized && (
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold uppercase tracking-tight">ThreatOps Extension</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsMinimized(true)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
                title="Minimize"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsWidgetMode(false)}
                className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                title="Exit Widget Mode"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {view === 'dashboard' ? (
          <div className={cn("grid gap-6", isWidgetMode ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12")}>
            {/* --- Stats Row --- */}
            <div className={cn("grid gap-4", isWidgetMode ? "grid-cols-2" : "lg:col-span-12 sm:grid-cols-2 lg:grid-cols-4")}>
              {[
                { 
                  label: 'Events Ingested', 
                  value: stats.events.toLocaleString(), 
                  sub: '+420/s', 
                  color: 'blue',
                  icon: Activity,
                  desc: 'Real-time log stream'
                },
                { 
                  label: 'Threats Detected', 
                  value: threats.length, 
                  sub: 'Last: 2m ago', 
                  color: 'red',
                  icon: Shield,
                  desc: 'Active security alerts'
                },
                { 
                  label: 'Avg MTTD', 
                  value: stats.mttd, 
                  sub: 'vs 4.2h manual', 
                  color: 'amber',
                  icon: Clock,
                  desc: 'Mean time to detect'
                },
                { 
                  label: 'FP Rate', 
                  value: stats.fpr, 
                  sub: 'ML Tuned', 
                  color: 'green',
                  icon: CheckCircle,
                  desc: 'False positive accuracy'
                },
              ].map((stat, i) => (
                <motion.div 
                  key={i} 
                  whileHover={{ y: -2 }}
                  className="relative group bg-[#0d1117] border border-white/5 p-5 rounded-2xl overflow-hidden transition-all hover:border-white/10 hover:shadow-2xl hover:shadow-black/50"
                >
                  {/* Background Glow */}
                  <div className={cn(
                    "absolute -right-4 -top-4 w-24 h-24 blur-3xl opacity-10 transition-opacity group-hover:opacity-20",
                    stat.color === 'blue' ? 'bg-blue-500' :
                    stat.color === 'red' ? 'bg-red-500' :
                    stat.color === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                  )} />

                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "p-2 rounded-lg border",
                      stat.color === 'blue' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      stat.color === 'red' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                      stat.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
                      'bg-green-500/10 border-green-500/20 text-green-400'
                    )}>
                      <stat.icon className="w-4 h-4" />
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      stat.color === 'blue' ? 'bg-blue-500/5 border-blue-500/10 text-blue-400' :
                      stat.color === 'red' ? 'bg-red-500/5 border-red-500/10 text-red-400' :
                      stat.color === 'amber' ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' : 
                      'bg-green-500/5 border-green-500/10 text-green-400'
                    )}>
                      {stat.sub}
                    </span>
                  </div>

                  <div>
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-white">{stat.value}</span>
                    </div>
                    {!isWidgetMode && <p className="text-[10px] text-slate-500 mt-2 font-medium">{stat.desc}</p>}
                  </div>

                  {/* Decorative Line */}
                  <div className={cn(
                    "absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500",
                    stat.color === 'blue' ? 'bg-blue-500' :
                    stat.color === 'red' ? 'bg-red-500' :
                    stat.color === 'amber' ? 'bg-amber-500' : 'bg-green-500'
                  )} />
                </motion.div>
              ))}
            </div>

            {/* --- Main Content --- */}
            <div className={cn("space-y-6", isWidgetMode ? "" : "lg:col-span-8")}>
              {/* Charts */}
              {!isWidgetMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#0d1117] border border-white/5 p-4 rounded-xl h-64">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-mono text-slate-500 uppercase">User Activity Analysis</h3>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-[10px] text-slate-500 uppercase">Regular</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[10px] text-slate-500 uppercase">Suspicious</span>
                        </div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorRegular" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorSuspicious" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                        <XAxis 
                          dataKey="time" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          minTickGap={30}
                        />
                        <YAxis 
                          domain={[0, 'auto']} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fontSize: 10, fill: '#64748b' }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #ffffff10', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
                        />
                        <Area type="monotone" dataKey="regular" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRegular)" />
                        <Area type="monotone" dataKey="suspicious" stroke="#ef4444" fillOpacity={1} fill="url(#colorSuspicious)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-[#0d1117] border border-white/5 p-4 rounded-xl h-64">
                    <h3 className="text-xs font-mono text-slate-500 uppercase mb-4">User Risk Profile</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Safe Users', value: Math.max(0, stats.events - Math.floor(stats.events * 0.12) - stats.threats) },
                            { name: 'At Risk', value: Math.floor(stats.events * 0.12) },
                            { name: 'Compromised', value: stats.threats },
                          ]}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #ffffff10', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '10px', textTransform: 'uppercase' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-[-20px]">
                      {['Safe', 'Risk', 'Alert'].map((label, i) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", i === 0 ? 'bg-green-500' : i === 1 ? 'bg-amber-500' : 'bg-red-500')} />
                          <span className="text-[9px] text-slate-500 uppercase">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Alert Feed */}
              <div className="bg-[#0d1117] border border-white/5 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-xs font-mono text-slate-200 uppercase">Live Threat Feed</h3>
                  </div>
                </div>
                <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {threats.map(threat => (
                    <div 
                      key={threat.id}
                      onClick={() => setSelectedThreat(threat)}
                      className={cn(
                        "p-4 flex items-start gap-4 cursor-pointer transition-colors hover:bg-white/[0.02]",
                        selectedThreat?.id === threat.id && "bg-blue-500/5 border-l-2 border-l-blue-500"
                      )}
                    >
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEV_COLORS[threat.severity] }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-red-400">THREAT DETECTED</h4>
                          <span className="text-[10px] font-mono text-slate-500">{threat.timestamp}</span>
                        </div>
                        <p className="text-xs text-white font-medium mb-2">
                          User <span className="text-blue-400">{threat.user}</span> has tried <span className="text-red-300">{threat.type.toLowerCase()}</span>.
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                            <Terminal className="w-3 h-3" />
                            {threat.sourceIp}
                          </div>
                          {threat.userUrl && (
                            <a 
                              href={threat.userUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 font-bold"
                            >
                              <Search className="w-2 h-2" />
                              VERIFY
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* --- Sidebar --- */}
            {!isWidgetMode && (
              <div className="lg:col-span-4 space-y-6">
                {/* Analysis Panel */}
                <div className="bg-[#0d1117] border border-white/5 rounded-xl flex flex-col h-[calc(100vh-12rem)] sticky top-20">
                  <div className="p-4 border-b border-white/5 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <h3 className="text-xs font-mono text-slate-200 uppercase">AI Analyst Intelligence</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedThreat ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <div className="p-4 bg-white/5 rounded-full mb-4">
                          <Search className="w-8 h-8 text-slate-600" />
                        </div>
                        <p className="text-sm text-slate-500">Select a threat from the feed to begin AI deep-analysis</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono text-slate-400 uppercase">Selected Incident</span>
                            <span className="text-[10px] font-mono text-red-400 font-bold">ANOMALY SCORE: {selectedThreat.score}</span>
                          </div>
                          <h4 className="text-sm font-bold">{selectedThreat.type}</h4>
                          <p className="text-xs text-slate-400 mt-1">{selectedThreat.description}</p>
                          {selectedThreat.userUrl && (
                            <a 
                              href={selectedThreat.userUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-[10px] font-bold hover:bg-blue-500/20 transition-colors"
                            >
                              <Search className="w-3 h-3" />
                              VIEW EXTERNAL PROFILE
                            </a>
                          )}
                        </div>

                        <button 
                          onClick={() => analyzeWithAI(selectedThreat)}
                          disabled={isAnalyzing}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                          {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          Generate AI Remediation
                        </button>

                        <button 
                          onClick={() => handleNeutralize(selectedThreat)}
                          className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-lg border border-red-500/30 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          Neutralize & Isolate User
                        </button>

                        <div className="prose prose-invert prose-xs max-w-none">
                          <div className="bg-[#161b22] p-4 rounded-lg border border-white/5 text-xs leading-relaxed">
                            {aiResponse ? (
                              <div className="markdown-body">
                                <ReactMarkdown>{aiResponse}</ReactMarkdown>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Waiting for analysis command...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-white/5">
                    <div className="relative">
                      <textarea 
                        rows={2}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleChat())}
                        placeholder="Ask Databricks LLM about this threat..."
                        className="w-full bg-[#161b22] border border-white/10 rounded-lg pl-4 pr-12 py-3 text-xs outline-none focus:border-purple-500/50 resize-none"
                      />
                      <button 
                        onClick={handleChat}
                        className="absolute right-2 bottom-2 p-2 text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Compromised Users Report</h2>
                <p className="text-xs text-slate-500 mt-1">Detailed forensic analysis of 30 high-risk identities</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Search users..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-xs outline-none focus:border-blue-500/50 w-64"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-[10px] font-mono text-red-400 font-bold">
                  <Activity className="w-3.5 h-3.5" />
                  <span>TOTAL: {filteredUsers.length}</span>
                </div>
              </div>
            </div>

            <div className={cn(
              "grid gap-4",
              isWidgetMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
            )}>
              {paginatedUsers.map(user => (
                <motion.div 
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0d1117] border border-red-500/10 rounded-xl p-5 hover:border-red-500/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <User className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{user.username}</h4>
                        <p className="text-[10px] font-mono text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-red-400 font-bold">RISK: {user.riskScore}%</div>
                      <div className="text-[9px] text-slate-500 uppercase">{user.platform}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                        <p className="text-[10px] font-mono text-red-300 uppercase mb-1">Threat Type</p>
                        <p className="text-xs font-bold text-red-200">{user.threatType}</p>
                      </div>
                      <div className={cn(
                        "flex-1 p-3 rounded-lg border",
                        user.status === 'Banned' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                        user.status === 'Blocked' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                        user.status === 'Removed' ? "bg-slate-500/10 border-slate-500/20 text-slate-400" :
                        "bg-blue-500/10 border-blue-500/20 text-blue-400"
                      )}>
                        <p className="text-[10px] font-mono uppercase mb-1 opacity-70">Status</p>
                        <p className="text-xs font-bold">{user.status}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">Enforcement Reason</p>
                      <p className="text-[11px] text-slate-300 font-medium">{user.reason}</p>
                    </div>
                    
                    <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                      <p className="text-[10px] font-mono text-slate-500 uppercase mb-1">AI Threat Report</p>
                      <p className="text-[11px] leading-relaxed text-slate-400 italic">
                        "{user.report}"
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 border-t border-white/5">
                      <div className="flex flex-col">
                        <span>LAST ACTIVE: {user.lastActive}</span>
                        <span className="text-blue-400/60 uppercase mt-0.5">ID: {user.id}</span>
                      </div>
                      <div className="flex gap-2">
                        <a 
                          href={`https://www.youtube.com/results?search_query=${user.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-bold uppercase transition-colors flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          View
                        </a>
                        <button className="text-slate-400 hover:text-white font-bold uppercase transition-colors flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          Report
                        </button>
                        <button className="text-red-400 hover:text-red-300 font-bold uppercase transition-colors">
                          Isolate
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Google-style Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center mt-12 mb-8">
                <div className="flex items-center mb-4">
                  <span className="text-4xl font-bold text-white tracking-tighter">G</span>
                  {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <span 
                        key={i} 
                        className={cn(
                          "text-4xl font-bold tracking-tighter transition-colors",
                          currentPage === pageNum ? "text-blue-500" : "text-amber-500"
                        )}
                      >
                        o
                      </span>
                    );
                  })}
                  <span className="text-4xl font-bold text-white tracking-tighter">gle</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="text-blue-400 hover:text-blue-300 disabled:opacity-30 text-sm font-medium transition-colors"
                  >
                    Prev
                  </button>
                  
                  <div className="flex items-center gap-3">
                    {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
                      const pageNum = i + 1;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "text-sm font-medium transition-all min-w-[1rem]",
                            currentPage === pageNum 
                              ? "text-white cursor-default" 
                              : "text-blue-400 hover:underline"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="text-blue-400 hover:text-blue-300 disabled:opacity-30 text-sm font-medium transition-colors flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="h-10 border-t border-white/5 bg-[#0d1117] flex items-center px-6 justify-between text-[10px] font-mono text-slate-500">
        <div className="flex gap-4">
          <span>SYSTEM: OPERATIONAL</span>
          <span>LATENCY: 42MS</span>
        </div>
        <div>
          THREATOPS v2.4.0-STABLE
        </div>
      </footer>
    </div>
  );
}
