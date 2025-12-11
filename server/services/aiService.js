import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export const generateStudyRoadmap = async (roadmapData) => {
  try {
    const {
      examType,
      currentMarks,
      sectionWiseMarks,
      targetScore,
      attemptNumber,
      preferences,
      studyStyle,
    } = roadmapData;

    // Calculate score gap and improvement needed
    const scoreGap = targetScore - currentMarks;
    const subjects =
      examType === "NEET"
        ? ["Physics", "Chemistry", "Biology"]
        : ["Physics", "Chemistry", "Mathematics"];

    // Build the prompt
    const prompt = `You are an expert academic counselor for ${examType} exam preparation in India. Create a personalized study roadmap based on the following student data:

**Current Performance:**
- Overall Score: ${currentMarks}/${examType === "NEET" ? "720" : "300"}
- Physics: ${sectionWiseMarks.physics}
- Chemistry: ${sectionWiseMarks.chemistry}
${
  examType === "NEET"
    ? `- Biology: ${sectionWiseMarks.biology}`
    : `- Mathematics: ${sectionWiseMarks.mathematics}`
}

**Goals:**
- Target Score: ${targetScore}
- Score Improvement Needed: ${scoreGap} marks
- Attempt Number: ${attemptNumber}

**Student Preferences:**
- Favorite Subjects: ${preferences.join(", ")}
- Preferred Study Times: ${studyStyle.join(", ")}

Please provide a structured JSON response with the following format (respond ONLY with valid JSON, no markdown or extra text):

{
  "subjectPriority": [
    {
      "subject": "Subject Name",
      "priority": 1,
      "focus": "Brief description of what needs focus"
    }
  ],
  "studyTimeAllocation": [
    {
      "subject": "Subject Name",
      "hoursPerDay": 2.5,
      "activities": ["Activity 1", "Activity 2"]
    }
  ],
  "weeklyFocusCycle": [
    {
      "weeks": "Week 1-3",
      "focus": ["Focus area 1", "Focus area 2"]
    }
  ],
  "milestoneGoals": [
    {
      "timeline": "After 1 month",
      "targetScore": 250
    }
  ],
  "additionalRecommendations": ["Recommendation 1", "Recommendation 2"]
}

**Important Instructions:**
1. Prioritize subjects based on current weaknesses and improvement potential
2. Allocate realistic daily study hours based on preferred study times
3. Create a 12-week study cycle with clear focus areas
4. Set milestone goals at 1 month, 2 months, and final phase
5. Provide 3-5 actionable recommendations
6. Consider the attempt number - if it's 2nd or 3rd attempt, focus on weak areas more aggressively
7. Respond ONLY with the JSON object, no additional text`;

    // Make API call to Gemini
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Extract the generated text
    const generatedText = response.data.candidates[0].content.parts[0].text;

    // Clean the response - remove markdown code blocks if present
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }

    // Parse JSON response
    const roadmap = JSON.parse(cleanedText);

    return {
      success: true,
      roadmap,
    };
  } catch (error) {
    console.error("Gemini API Error:", error.response?.data || error.message);

    // If JSON parsing fails, return a fallback error
    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: "Failed to parse AI response. Please try again.",
      };
    }

    return {
      success: false,
      error:
        error.response?.data?.error?.message ||
        "Failed to generate roadmap. Please try again.",
    };
  }
};

export const scoreCoursesWithGemini = async (courses, query) => {
  try {
    const courseData = courses.map((course) => ({
      _id: course._id,
      courseTitle: course.courseTitle,
      subTitle: course.subTitle,
      description: course.description,
      category: course.category,
      courseLevel: course.courseLevel,
      creatorName: course.creator ? course.creator.name : "Unknown",
      enrolledCount: course.enrolledCount,
      lectureCount: course.lectureCount,
      searchableText: course.searchableText,
    }));

    const prompt = `You are an AI assistant specialized in scoring and providing insights for online courses based on a user's search query. Here is the search query: "${query}". And here are the courses:
${JSON.stringify(courseData, null, 2)}

Please provide a JSON array of these courses, each with an added 'aiScore' (a number between 0 and 1, where 1 is a perfect match) and a 'relevancePercentage' (rounded to the nearest integer). Also, provide an overall 'insights' object with a 'summary' and 'suggestions' array, and a global 'searchSuggestions' array based on the query and courses. The structure should be as follows (respond ONLY with valid JSON, no markdown or extra text):

{
  "scoredCourses": [
    {
      "_id": "course_id_1",
      "aiScore": 0.95,
      "relevancePercentage": 95
    }
  ],
  "insights": {
    "summary": "Overall summary of search results, e.g., 'Top results focus on [X] and [Y]'.",
    "suggestions": ["Improve query by adding Z", "Explore related topics"]
  },
  "suggestions": ["suggestion 1", "suggestion 2"]
}

Ensure the aiScore and relevancePercentage are calculated accurately based on how well each course's content (title, subtitle, description, category, level, creator name, lecture titles) matches the search query. For insights and suggestions, be creative and helpful, drawing from the course data.`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    let generatedText = response.data.candidates[0].content.parts[0].text;
    if (generatedText.startsWith("```json")) {
      generatedText = generatedText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "");
    } else if (generatedText.startsWith("```")) {
      generatedText = generatedText.replace(/```\n?/g, "");
    }

    const {
      scoredCourses: geminiScoredCourses,
      insights,
      suggestions,
    } = JSON.parse(generatedText);

    const finalScoredCourses = courses.map((course) => {
      const geminiScore = geminiScoredCourses.find(
        (gsc) => gsc._id === course._id.toString()
      );
      return {
        ...course,
        aiScore: geminiScore ? geminiScore.aiScore : 0,
        relevancePercentage: geminiScore ? geminiScore.relevancePercentage : 0,
      };
    });

    return { scoredCourses: finalScoredCourses, insights, suggestions };
  } catch (error) {
    console.error(
      "Gemini Search Scoring Error:",
      error.response?.data || error.message
    );
    return {
      scoredCourses: courses.map((course) => ({
        ...course,
        aiScore: 0,
        relevancePercentage: 0,
      })),
      insights: {
        summary:
          "We're showing relevant courses, but AI-powered insights are temporarily unavailable.",
        suggestions: [
          "Refine your search query to further narrow the results.",
          "Try again in a little while if you need AI-powered recommendations.",
        ],
      },
      suggestions: [],
    };
  }
};
