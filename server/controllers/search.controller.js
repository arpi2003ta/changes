import { Course } from "../models/course.model.js";
import { scoreCoursesWithGemini } from "../services/aiService.js";

// Advanced AI Search Algorithm with multiple scoring mechanisms
export const aiSearchCourses = async (req, res) => {
    try {
        const { query, category, level, minPrice, maxPrice, sortBy = 'relevance' } = req.query;

        if (!query || query.trim().length < 1) {
            return res.status(400).json({
                success: false,
                message: "Search query must be at least 2 characters long"
            });
        }

        // Build search pipeline
        const searchPipeline = buildSearchPipeline(query, {
            category,
            level,
            minPrice: minPrice ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice) : undefined
        });

        // Execute search with aggregation pipeline
        let courses = await Course.aggregate(searchPipeline);

        // Handle empty results
        if (!courses || courses.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No courses found matching your search criteria",
                data: {
                    courses: [],
                    totalResults: 0,
                    searchQuery: query,
                    insights: {
                        summary: "No courses found matching your search criteria",
                        suggestions: [
                            "Try using broader search terms",
                            "Check your spelling",
                            "Remove filters to see more results"
                        ]
                    },
                    suggestions: []
                }
            });
        }

        // Apply Gemini-powered relevance scoring and generate insights/suggestions
        const { scoredCourses, insights, suggestions } = await scoreCoursesWithGemini(courses, query);

        // Sort results based on preference (using Gemini score if relevance is chosen)
        const sortedCourses = sortResults(scoredCourses, sortBy);

        return res.status(200).json({
            success: true,
            message: `Found ${sortedCourses.length} courses matching your search`,
            data: {
                courses: sortedCourses,
                totalResults: sortedCourses.length,
                searchQuery: query,
                insights,
                suggestions,
            }
        });

    } catch (error) {
        console.error("AI Search Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to perform AI search"
        });
    }
};

// Build MongoDB aggregation pipeline for initial search
const buildSearchPipeline = (query, filters) => {
    const pipeline = [];
    const normalizedQuery = query && query.trim();

    // Match only published courses and apply basic filters
    const matchStage = {
        isPublished: true
    };

    // Add category filter
    if (filters.category) {
        matchStage.category = { $regex: filters.category, $options: 'i' };
    }

    // Add level filter
    if (filters.level) {
        matchStage.courseLevel = filters.level;
    }

    // Add price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        matchStage.coursePrice = {};
        if (filters.minPrice !== undefined) matchStage.coursePrice.$gte = filters.minPrice;
        if (filters.maxPrice !== undefined) matchStage.coursePrice.$lte = filters.maxPrice;
    }

    pipeline.push({ $match: matchStage });

    // Populate creator and lectures
    pipeline.push(
        {
            $lookup: {
                from: 'users',
                localField: 'creator',
                foreignField: '_id',
                as: 'creator',
                pipeline: [{ $project: { name: 1, photoUrl: 1 } }]
            }
        },
        {
            $lookup: {
                from: 'lectures',
                localField: 'lectures',
                foreignField: '_id',
                as: 'lectures',
                pipeline: [{ $project: { lectureTitle: 1, isPreviewFree: 1 } }]
            }
        },
        {
            $unwind: {
                path: '$creator',
                preserveNullAndEmptyArrays: true
            }
        }
    );

    // Add searchableText field for Gemini to analyze
    pipeline.push({
        $addFields: {
            searchableText: {
                $concat: [
                    { $ifNull: ['$courseTitle', ''] }, ' ',
                    { $ifNull: ['$subTitle', ''] }, ' ',
                    { $ifNull: ['$description', ''] }, ' ',
                    { $ifNull: ['$category', ''] }, ' ',
                    { $ifNull: ['$courseLevel', ''] }, ' ',
                    { $ifNull: ['$creator.name', ''] }, ' ',
                    {
                        $reduce: {
                            input: '$lectures',
                            initialValue: '',
                            in: { $concat: ['$$value', ' ', '$$this.lectureTitle'] }
                        }
                    }
                ]
            },
            enrolledCount: { $size: { $ifNull: ['$enrolledStudents', []] } },
            lectureCount: { $size: { $ifNull: ['$lectures', []] } }
        }
    });

    // Apply text filter using the aggregated searchableText field
    if (normalizedQuery) {
        pipeline.push({
            $match: {
                searchableText: { $regex: normalizedQuery, $options: 'i' }
            }
        });
    }

    return pipeline;
};

const sortResults = (courses, sortBy) => {
    if (!courses || courses.length === 0) return [];

    switch (sortBy) {
        case 'price_low':
            return courses.sort((a, b) => (a.coursePrice || 0) - (b.coursePrice || 0));
        case 'price_high':
            return courses.sort((a, b) => (b.coursePrice || 0) - (a.coursePrice || 0));
        case 'popularity':
            return courses.sort((a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0));
        case 'newest':
            return courses.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                return dateB - dateA;
            });
        case 'relevance':
        default:
            return courses.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
    }
};

// Auto-complete search suggestions
export const getSearchSuggestions = async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(200).json({
                success: true,
                suggestions: []
            });
        }

        // Get suggestions from course titles, categories, and descriptions
        const suggestions = await Course.aggregate([
            {
                $match: {
                    isPublished: true,
                    $or: [
                        { courseTitle: { $regex: q, $options: 'i' } },
                        { category: { $regex: q, $options: 'i' } },
                        { description: { $regex: q, $options: 'i' } }
                    ]
                }
            },
            {
                $project: {
                    courseTitle: 1,
                    category: 1,
                    _id: 0
                }
            },
            { $limit: 10 }
        ]);

        const uniqueSuggestions = [...new Set([
            ...suggestions.map(s => s.courseTitle).filter(Boolean),
            ...suggestions.map(s => s.category).filter(Boolean)
        ])].filter(suggestion => suggestion && suggestion.length > 0).slice(0, 8);

        return res.status(200).json({
            success: true,
            suggestions: uniqueSuggestions
        });

    } catch (error) {
        console.error("Suggestion Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get suggestions"
        });
    }
};

// Search analytics endpoint
export const getSearchAnalytics = async (req, res) => {
    try {
        const analytics = await Course.aggregate([
            {
                $match: { isPublished: true }
            },
            {
                $group: {
                    _id: "$category",
                    courseCount: { $sum: 1 },
                    averagePrice: { $avg: "$coursePrice" },
                    totalEnrollments: { $sum: { $size: "$enrolledStudents" } }
                }
            },
            { $sort: { courseCount: -1 } }
        ]);

        return res.status(200).json({
            success: true,
            analytics
        });

    } catch (error) {
        console.error("Analytics Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get analytics"
        });
    }
};