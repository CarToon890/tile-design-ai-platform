import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, systemInstruction } = body;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const contents = [
      ...history,
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: contents,
      config: { systemInstruction: systemInstruction }
    });

    return NextResponse.json({ text: response.text });
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดในการเชื่อมต่อ AI" }, { status: 500 });
  }
}