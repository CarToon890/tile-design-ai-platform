import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    // 1. ส่งคำสั่งไปต่อคิวสร้างรูปที่ Leonardo
    const generateOptions = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.LEONARDO_API_KEY}`
      },
      body: JSON.stringify({
        prompt: prompt,
        modelId: '6bef9f1b-29cb-40c7-b9df-32b51c1f67d3', // Model สำหรับกระเบื้อง/หินอ่อน
        width: 1024,
        height: 1024,
        num_images: 1
      })
    };

    const generateRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', generateOptions);
    const generateData = await generateRes.json();
    
    // ดึง "รหัสคิวงาน" มา
    const generationId = generateData?.sdGenerationJob?.generationId;

    if (!generationId) {
      throw new Error("ไม่สามารถสร้างรหัสคิวงานจาก Leonardo ได้");
    }

    // 2. สร้างระบบรอรูปภาพ (Polling) 
    // วนลูปเช็คสถานะทุกๆ 2 วินาที จนกว่ารูปจะเสร็จ (เช็คสูงสุด 15 ครั้ง)
    let finalImageUrl = null;
    
    for (let i = 0; i < 15; i++) {
      // สั่งให้โปรแกรมหยุดรอ 2 วินาที ก่อนเช็คสถานะใหม่
      await new Promise(resolve => setTimeout(resolve, 2000));

      const checkRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${process.env.LEONARDO_API_KEY}`
        }
      });
      
      const checkData = await checkRes.json();
      const generationInfo = checkData.generations_by_pk;

      // ถ้าระบบ Leonardo บอกว่า "COMPLETE" (วาดเสร็จแล้ว) ให้ดึงลิงก์รูปมา
      if (generationInfo && generationInfo.status === 'COMPLETE') {
        if (generationInfo.generated_images && generationInfo.generated_images.length > 0) {
          finalImageUrl = generationInfo.generated_images[0].url;
          break; // ออกจากลูปการรอ
        }
      } else if (generationInfo && generationInfo.status === 'FAILED') {
        throw new Error("Leonardo สร้างรูปภาพล้มเหลว");
      }
    }

    // 3. ส่งลิงก์รูปภาพของจริงกลับไปให้หน้าเว็บแสดงผล
    if (finalImageUrl) {
      return NextResponse.json({ imageUrl: finalImageUrl });
    } else {
      return NextResponse.json({ error: "รอนานเกินไป รูปอาจจะยังไม่เสร็จ" }, { status: 504 });
    }

  } catch (error) {
    console.error("Leonardo Backend Error:", error);
    return NextResponse.json({ error: "เกิดข้อผิดพลาดที่ระบบสร้างภาพ" }, { status: 500 });
  }
}