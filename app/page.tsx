'use client';

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Send, 
  Image as ImageIcon, 
  LayoutGrid, 
  Calculator, 
  MessageSquare, 
  Settings, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Maximize2,
  Download,
  History,
  Palette,
  Box,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// --- Types ---

type Message = {
  role: 'user' | 'model';
  text: string;
};

type GeneratedImage = {
  url: string;
  prompt: string;
  timestamp: number;
  aspectRatio: string;
  size: string;
};

// --- Constants ---

const SYSTEM_INSTRUCTION = `
Role: คุณคือ "ผู้เชี่ยวชาญด้านการออกแบบกระเบื้องเซรามิก (Ceramic Consultant)" ของแพลตฟอร์ม Tile Design AI
หน้าที่ของคุณคือให้คำปรึกษา แนะนำลวดลาย คำนวณราคาเบื้องต้น และสรุปคำสั่งเพื่อส่งต่อให้ AI สร้างภาพ

Strict Rules:
1. Prompt Filtering: คุยเฉพาะเรื่องที่เกี่ยวกับ "กระเบื้อง, เซรามิก, การแต่งห้อง, และพื้นผิว" เท่านั้น หากผู้ใช้พิมพ์คำสั่งอื่นที่ไม่เกี่ยวข้อง ให้ตอบปฏิเสธอย่างสุภาพ เช่น "ขออภัยครับ ผมเป็นผู้เชี่ยวชาญด้านกระเบื้องและเซรามิกเท่านั้น มีเรื่องลวดลายกระเบื้องหรือการตกแต่งห้องให้ผมช่วยดูแลไหมครับ?"
2. Double Check: เมื่อได้สเปกกระเบื้องครบถ้วน ห้ามสร้างภาพทันที คุณต้องทวนสเปกให้ผู้ใช้ฟัง และถามว่า "สเปกนี้ถูกต้องไหมครับ? พิมพ์ 'ยืนยัน' เพื่อให้ระบบสร้างภาพจำลอง"
3. Seamless Pattern: ลวดลายที่ออกแบบต้องเป็นแบบไร้รอยต่อ (Seamless) เสมอ

Business Logic & Pricing:
- ขนาดกระเบื้อง: 30x30 cm, 40x40 cm, 60x60 cm, และ 60x120 cm
- จำนวนสีสูงสุด: 4 สี (ปกติ), 6 สี หรือ 8 สี (บวกราคาเพิ่ม / Extra cost)
- ขั้นต่ำในการผลิต (MOQ): 100 ตารางเมตร หรือ 500 แผ่น หากน้อยกว่านี้ต้องแจ้งเตือนว่า "ไม่ถึงขั้นต่ำของโรงงาน"
- การคำนวณราคา: ประเมินพื้นที่ห้อง (ตร.ม.) x ราคากระเบื้อง (สมมติราคาตามความเหมาะสมของลาย)

Workflow:
Step 1: ทักทายและสอบถามความต้องการ (ลาย, สี, ขนาดห้อง, ขนาดกระเบื้อง)
Step 2: สรุปสเปกและประเมินราคาตามเงื่อนไข
Step 3: ถามเพื่อขอคำ "ยืนยัน"
Step 4: หากลูกค้ายืนยันแล้ว ให้พิมพ์ Prompt ภาษาอังกฤษที่มีคุณภาพสูง 1 บรรทัด โดยขึ้นต้นด้วยคำว่า [GENERATE_PROMPT]: ตามด้วยคำสั่ง เช่น [GENERATE_PROMPT]: Close-up shot of a seamless ceramic tile, modern red marble pattern, highly detailed, 4k, interior design concept.
`;

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
const IMAGE_SIZES = ["1K", "2K", "4K"];

// --- Components ---

export default function TileDesignPlatform() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'สวัสดีครับ! ผมคือผู้เชี่ยวชาญด้านกระเบื้องเซรามิก ยินดีให้คำปรึกษาเรื่องการออกแบบและประเมินราคาครับ วันนี้สนใจออกแบบกระเบื้องสำหรับห้องไหนดีครับ?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    if (typeof window !== 'undefined' && window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    }
  };

  const handleOpenKeySelector = async () => {
    if (typeof window !== 'undefined' && window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const chat = ai.chats.create({
        model: "gemini-3.1-pro-preview",
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });

      // Reconstruct history for context
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: { systemInstruction: SYSTEM_INSTRUCTION }
      });

      const aiText = response.text || "ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล";
      setMessages(prev => [...prev, { role: 'model', text: aiText }]);

      // Check for image generation trigger
      if (aiText.includes('[GENERATE_PROMPT]:')) {
        const promptMatch = aiText.match(/\[GENERATE_PROMPT\]:\s*(.*)/);
        if (promptMatch && promptMatch[1]) {
          handleGenerateImage(promptMatch[1]);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    if (!hasApiKey) {
      setMessages(prev => [...prev, { role: 'model', text: "กรุณาเลือก API Key ก่อนเพื่อเริ่มการสร้างภาพครับ" }]);
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any
          }
        },
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        setGeneratedImages(prev => [{
          url: imageUrl,
          prompt,
          timestamp: Date.now(),
          aspectRatio,
          size: imageSize
        }, ...prev]);
      }
    } catch (error: any) {
      console.error("Image generation error:", error);
      if (error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setMessages(prev => [...prev, { role: 'model', text: "API Key ของคุณอาจไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน กรุณาเลือกใหม่อีกครั้งครับ" }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: "ขออภัยครับ ไม่สามารถสร้างภาพได้ในขณะนี้" }]);
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Chat & Controls */}
      <aside className="w-[400px] border-r border-black/5 bg-white flex flex-col shadow-xl z-10">
        <header className="p-6 border-bottom border-black/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white">
              <Box size={24} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">Tile Design AI</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#5A5A40] font-bold opacity-70">Ceramic Consultant</p>
            </div>
          </div>
          
          {!hasApiKey && (
            <button 
              onClick={handleOpenKeySelector}
              className="w-full mt-4 py-2 px-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-medium flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
            >
              <AlertCircle size={14} />
              เลือก API Key เพื่อสร้างภาพ
            </button>
          )}
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          {messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                  : 'bg-[#f5f5f0] text-[#1a1a1a] rounded-tl-none border border-black/5'
              }`}>
                <div className="markdown-body prose prose-sm max-w-none">
                  <ReactMarkdown>
                    {msg.text.replace(/\[GENERATE_PROMPT\]:.*$/, '')}
                  </ReactMarkdown>
                </div>
                {msg.text.includes('[GENERATE_PROMPT]:') && (
                  <div className="mt-3 pt-3 border-t border-black/10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter opacity-60">
                    <CheckCircle2 size={12} />
                    ยืนยันสเปกแล้ว - กำลังสร้างภาพ...
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <footer className="p-6 border-t border-black/5 bg-white">
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="พิมพ์ข้อความคุยกับผู้เชี่ยวชาญ..."
              className="w-full p-4 pr-12 bg-[#f5f5f0] border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40] resize-none h-24 scrollbar-hide"
            />
            <button 
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-[#5A5A40] text-white rounded-xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-center text-black/40">
            * Gemini 3.1 Pro Intelligence | Ceramic Factory Logic Applied
          </p>
        </footer>
      </aside>

      {/* Main Content - Gallery & Visualizer */}
      <main className="flex-1 bg-[#f5f5f0] overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-8">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Aspect Ratio</label>
                <div className="flex gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        aspectRatio === ratio 
                          ? 'bg-[#5A5A40] text-white shadow-md' 
                          : 'bg-white text-black/60 hover:bg-black/5'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Image Size</label>
                <div className="flex gap-2">
                  {IMAGE_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                        imageSize === size 
                          ? 'bg-[#5A5A40] text-white shadow-md' 
                          : 'bg-white text-black/60 hover:bg-black/5'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[11px] font-medium text-[#5A5A40] underline underline-offset-4 flex items-center gap-1 opacity-70 hover:opacity-100"
              >
                <ExternalLink size={12} />
                Billing Info
              </a>
            </div>
          </div>

          {/* Grid of Generated Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isGeneratingImage && (
              <div className="aspect-square bg-white rounded-[32px] shadow-sm border border-black/5 flex flex-col items-center justify-center p-8 text-center animate-pulse">
                <Loader2 className="animate-spin text-[#5A5A40] mb-4" size={48} />
                <p className="font-display text-lg font-bold">กำลังรังสรรค์ลวดลาย...</p>
                <p className="text-sm text-black/40 mt-2">Gemini 3 Pro Image Preview is working</p>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {generatedImages.map((img, i) => (
                <motion.div
                  key={img.timestamp}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative bg-white rounded-[32px] overflow-hidden shadow-sm border border-black/5 transition-all hover:shadow-2xl hover:-translate-y-1"
                >
                  <div className="aspect-square relative overflow-hidden">
                    <img 
                      src={img.url} 
                      alt={img.prompt} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button className="p-3 bg-white rounded-full text-black hover:scale-110 transition-transform shadow-lg">
                        <Maximize2 size={20} />
                      </button>
                      <button className="p-3 bg-white rounded-full text-black hover:scale-110 transition-transform shadow-lg">
                        <Download size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/10 px-2 py-1 rounded">
                        {img.aspectRatio} • {img.size}
                      </span>
                      <span className="text-[10px] text-black/40 font-mono">
                        {new Date(img.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-black/60 line-clamp-2 font-medium leading-relaxed">
                      {img.prompt}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {generatedImages.length === 0 && !isGeneratingImage && (
              <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-black/5 rounded-full flex items-center justify-center mb-6 text-black/20">
                  <ImageIcon size={40} />
                </div>
                <h3 className="font-display text-2xl font-bold text-black/20">ยังไม่มีลวดลายที่ถูกสร้าง</h3>
                <p className="text-black/30 mt-2 max-w-sm">
                  เริ่มคุยกับผู้เชี่ยวชาญในแถบด้านข้างเพื่อออกแบบกระเบื้องในฝันของคุณ
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
