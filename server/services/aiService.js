import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const buildFallbackRoadmap = (roadmapData) => {
    const {
        examType = 'NEET',
        currentMarks = 0,
        sectionWiseMarks = {},
        targetScore = 0,
        attemptNumber = 1,
        preferences = [],
        studyStyle = []
    } = roadmapData || {};

    const safeSectionWise = sectionWiseMarks || {};

    const subjectEntries = examType === 'NEET'
        ? [
            { key: 'physics', label: 'Physics', score: Number(safeSectionWise.physics) || 0 },
            { key: 'chemistry', label: 'Chemistry', score: Number(safeSectionWise.chemistry) || 0 },
            { key: 'biology', label: 'Biology', score: Number(safeSectionWise.biology) || 0 }
        ]
        : [
            { key: 'physics', label: 'Physics', score: Number(safeSectionWise.physics) || 0 },
            { key: 'chemistry', label: 'Chemistry', score: Number(safeSectionWise.chemistry) || 0 },
            { key: 'mathematics', label: 'Mathematics', score: Number(safeSectionWise.mathematics) || 0 }
        ];

    const sortedSubjects = [...subjectEntries].sort((a, b) => a.score - b.score);

    const subjectPriority = sortedSubjects.map((s, index) => ({
        subject: s.label,
        priority: index + 1,
        focus: `Focus on strengthening core concepts and practicing high-yield questions in ${s.label}.`
    }));

    const baseHours = 6;
    const totalPriority = subjectPriority.reduce((sum, s) => sum + (subjectPriority.length + 1 - s.priority), 0) || 1;

    const studyTimeAllocation = subjectPriority.map((s) => {
        const weight = subjectPriority.length + 1 - s.priority;
        const hours = Math.max(1, parseFloat((baseHours * weight / totalPriority).toFixed(1)));
        const activities = [
            `Concept revision for ${s.subject}`,
            `Practice MCQs and previous year questions for ${s.subject}`,
            `Timed mock tests focusing on ${s.subject}`
        ];
        return {
            subject: s.subject,
            hoursPerDay: hours,
            activities
        };
    });

    const weeklyFocusCycle = [
        {
            weeks: 'Week 1-4',
            focus: ['Build strong fundamentals in all subjects', 'Identify weak topics through chapter-wise tests']
        },
        {
            weeks: 'Week 5-8',
            focus: ['Intensive practice on weak areas', 'Increase frequency of full-length mock tests']
        },
        {
            weeks: 'Week 9-12',
            focus: ['Full syllabus revision', 'Simulate exam conditions with timed papers']
        }
    ];

    const numericCurrent = Number(currentMarks) || 0;
    const numericTarget = Number(targetScore) || 0;
    const scoreGap = numericTarget - numericCurrent;
    const firstMilestone = numericCurrent + scoreGap * 0.4;
    const secondMilestone = numericCurrent + scoreGap * 0.7;

    const milestoneGoals = [
        {
            timeline: 'After 1 month',
            targetScore: Math.round(firstMilestone)
        },
        {
            timeline: 'After 2 months',
            targetScore: Math.round(secondMilestone)
        },
        {
            timeline: 'Final phase',
            targetScore: targetScore
        }
    ];

    const additionalRecommendations = [
        'Follow a fixed daily routine with clear start and end times for focused study blocks.',
        'After every mock test, analyse mistakes carefully and maintain a revision list of weak topics.',
        'Keep a concise formula and concept notebook for last-minute revision.',
        'Maintain proper sleep, nutrition, and short breaks to avoid burnout and sustain consistency.'
    ];

    return {
        subjectPriority,
        studyTimeAllocation,
        weeklyFocusCycle,
        milestoneGoals,
        additionalRecommendations
    };
};

export const generateStudyRoadmap = async (roadmapData) => {
    try {
        const {
            examType,
            currentMarks,
            sectionWiseMarks,
            targetScore,
            attemptNumber,
            preferences,
            studyStyle
        } = roadmapData;

        // Calculate score gap and improvement needed
        const scoreGap = targetScore - currentMarks;
        const subjects = examType === 'NEET' 
            ? ['Physics', 'Chemistry', 'Biology']
            : ['Physics', 'Chemistry', 'Mathematics'];

        // Build the prompt
        const prompt = `You are an expert academic counselor for ${examType} exam preparation in India. Create a personalized study roadmap based on the following student data:

**Current Performance:**
- Overall Score: ${currentMarks}/${examType === 'NEET' ? '720' : '300'}
- Physics: ${sectionWiseMarks.physics}
- Chemistry: ${sectionWiseMarks.chemistry}
${examType === 'NEET' ? `- Biology: ${sectionWiseMarks.biology}` : `- Mathematics: ${sectionWiseMarks.mathematics}`}

**Goals:**
- Target Score: ${targetScore}
- Score Improvement Needed: ${scoreGap} marks
- Attempt Number: ${attemptNumber}

**Student Preferences:**
- Favorite Subjects: ${preferences.join(', ')}
- Preferred Study Times: ${studyStyle.join(', ')}

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
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    responseJsonSchema: {
                        type: 'object',
                        properties: {
                            subjectPriority: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        subject: { type: 'string' },
                                        priority: { type: 'integer' },
                                        focus: { type: 'string' }
                                    },
                                    required: ['subject', 'priority', 'focus']
                                }
                            },
                            studyTimeAllocation: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        subject: { type: 'string' },
                                        hoursPerDay: { type: 'number' },
                                        activities: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        }
                                    },
                                    required: ['subject', 'hoursPerDay', 'activities']
                                }
                            },
                            weeklyFocusCycle: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        weeks: { type: 'string' },
                                        focus: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        }
                                    },
                                    required: ['weeks', 'focus']
                                }
                            },
                            milestoneGoals: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        timeline: { type: 'string' },
                                        targetScore: { type: 'number' }
                                    },
                                    required: ['timeline', 'targetScore']
                                }
                            },
                            additionalRecommendations: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        },
                        required: [
                            'subjectPriority',
                            'studyTimeAllocation',
                            'weeklyFocusCycle',
                            'milestoneGoals',
                            'additionalRecommendations'
                        ]
                    }
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the generated text
        const generatedText = response.data.candidates[0].content.parts[0].text;
        
        // Clean the response - remove markdown code blocks if present
        let cleanedText = generatedText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '');
        }

        const jsonStart = cleanedText.indexOf('{');
        const jsonEnd = cleanedText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanedText = cleanedText.slice(jsonStart, jsonEnd + 1);
        }

        // Parse JSON response
        const roadmap = JSON.parse(cleanedText);

        return {
            success: true,
            roadmap
        };

    } catch (error) {
        if (error instanceof SyntaxError) {
            console.warn('Gemini JSON parse failed, using fallback roadmap:', error.message);
        } else {
            console.error('Gemini API Error:', error.response?.data || error.message);
        }

        try {
            const fallbackRoadmap = buildFallbackRoadmap(roadmapData);
            return {
                success: true,
                roadmap: fallbackRoadmap
            };
        } catch (fallbackError) {
            console.error('Fallback roadmap generation error:', fallbackError);
            return {
                success: false,
                error: 'Failed to parse AI response. Please try again.'
            };
        }
    }
};
const computeLocalCourseScores = (courses, query) => {
    const normalizedQuery = (query || '').toLowerCase().trim();
    const terms = normalizedQuery ? normalizedQuery.split(/\s+/).filter(Boolean) : [];

    const scoredCourses = courses.map(course => {
        const textParts = [
            course.courseTitle,
            course.subTitle,
            course.description,
            course.category,
            course.courseLevel,
            course.creator?.name,
            course.searchableText,
        ].filter(Boolean);

        const fullText = textParts.join(' ').toLowerCase();

        let matchCount = 0;
        const matchedTerms = [];
        for (const term of terms) {
            if (fullText.includes(term)) {
                matchCount++;
                matchedTerms.push(term);
            }
        }

        const aiScore = terms.length > 0 ? matchCount / terms.length : 0;
        const relevancePercentage = Math.round(aiScore * 100);

        return {
            ...course,
            aiScore,
            relevancePercentage,
            matchedTerms: Array.from(new Set(matchedTerms)),
        };
    });

    const bestCourse = scoredCourses.reduce((best, curr) => {
        if (!best) return curr;
        return (curr.aiScore || 0) > (best.aiScore || 0) ? curr : best;
    }, null);

    const insights = {
        summary: bestCourse && bestCourse.courseTitle
            ? `Top results focus on "${normalizedQuery}" in courses like "${bestCourse.courseTitle}".`
            : (normalizedQuery ? `Results related to "${normalizedQuery}".` : 'Showing available courses.'),
        suggestions: [
            'Try adding more specific keywords if results feel broad.',
            'Use filters (category, price) to narrow down the course list.',
        ],
    };

    const suggestions = Array.from(new Set(
        scoredCourses
            .map(c => c.category)
            .filter(Boolean)
    ));

    return {
        scoredCourses,
        insights,
        suggestions,
    };
};

export const scoreCoursesWithGemini = async (courses, query) => {
    const localResult = computeLocalCourseScores(courses, query);

    // If no API key is configured, fall back to local scoring only
    if (!GEMINI_API_KEY) {
        return localResult;
    }

    try {
        const courseData = courses.map(course => ({
            _id: course._id,
            courseTitle: course.courseTitle,
            subTitle: course.subTitle,
            description: course.description,
            category: course.category,
            courseLevel: course.courseLevel,
            creatorName: course.creator ? course.creator.name : 'Unknown',
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
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: 'application/json',
                    responseJsonSchema: {
                        type: 'object',
                        properties: {
                            scoredCourses: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        _id: { type: 'string' },
                                        aiScore: { type: 'number' },
                                        relevancePercentage: { type: 'integer' },
                                    },
                                    required: ['_id', 'aiScore', 'relevancePercentage'],
                                },
                            },
                            insights: {
                                type: 'object',
                                properties: {
                                    summary: { type: 'string' },
                                    suggestions: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                },
                                required: ['summary', 'suggestions'],
                            },
                            suggestions: {
                                type: 'array',
                                items: { type: 'string' },
                            },
                        },
                        required: ['scoredCourses', 'insights', 'suggestions'],
                    },
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        let generatedText = response.data.candidates[0].content.parts[0].text || '';
        if (generatedText.startsWith('```json')) {
            generatedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (generatedText.startsWith('```')) {
            generatedText = generatedText.replace(/```\n?/g, '');
        }

        const jsonStartScore = generatedText.indexOf('{');
        const jsonEndScore = generatedText.lastIndexOf('}');
        if (jsonStartScore !== -1 && jsonEndScore !== -1 && jsonEndScore > jsonStartScore) {
            generatedText = generatedText.slice(jsonStartScore, jsonEndScore + 1);
        }

        let parsed;
        try {
            parsed = JSON.parse(generatedText);
        } catch (parseError) {
            console.warn('Gemini search JSON parse failed, using local scoring:', parseError.message);
            return localResult;
        }

        const { scoredCourses: geminiScoredCourses, insights, suggestions } = parsed || {};

        const finalScoredCourses = localResult.scoredCourses.map(course => {
            const geminiScore = Array.isArray(geminiScoredCourses)
                ? geminiScoredCourses.find(gsc => gsc._id === course._id.toString())
                : null;
            return {
                ...course,
                aiScore: geminiScore && typeof geminiScore.aiScore === 'number' ? geminiScore.aiScore : course.aiScore,
                relevancePercentage: geminiScore && typeof geminiScore.relevancePercentage === 'number'
                    ? geminiScore.relevancePercentage
                    : course.relevancePercentage,
            };
        });

        return {
            scoredCourses: finalScoredCourses,
            insights: insights || localResult.insights,
            suggestions: suggestions || localResult.suggestions,
        };

    } catch (error) {
        console.error('Gemini Search Scoring API Error:', error.response?.data || error.message);
        return localResult;
    }
};
