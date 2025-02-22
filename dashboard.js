"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const generateCareerRoadmap = async (skills, experience, careerGoal, interests) => {
  const prompt = `
    You are a career advisor. Given the user's details below, generate a structured career roadmap in ONLY the following JSON format:
    {
      "milestones": [
        { "step": "string", "description": "string", "estimatedTimeMonths": number }
      ],
      "requiredSkills": ["skill1", "skill2"],
      "recommendedCertifications": ["cert1", "cert2"],
      "jobOpportunities": ["role1", "role2"]
    }

    User details:
    - Current skills: ${skills}
    - Experience: ${experience}
    - Career Goal: ${careerGoal}
    - Interests: ${interests}

    IMPORTANT: Return ONLY the JSON. No additional text or markdown.
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

  return JSON.parse(cleanedText);
};

export async function getCareerRoadmap() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: {
      careerRoadmap: true,
    },
  });

  if (!user) throw new Error("User not found");

  if (!user.careerRoadmap) {
    const roadmap = await generateCareerRoadmap(
      user.skills,
      user.experience,
      user.careerGoal,
      user.interests
    );

    const careerRoadmap = await db.careerRoadmap.create({
      data: {
        userId: user.id,
        ...roadmap,
        nextUpdate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Update every month
      },
    });

    return careerRoadmap;
  }

  return user.careerRoadmap;
}
