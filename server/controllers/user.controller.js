import {User} from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import { deleteMediaFromCloudinary, uploadMedia } from "../utils/cloudinary.js";
import { CourseProgress } from "../models/courseProgress.js";
import { Result } from "../models/result.model.js";
import { Response } from "../models/response.model.js";

export const register = async (req,res) => {
    try {
       
        const {name, email, password, role} = req.body; 
        if(!name || !email || !password || !role){
            return res.status(400).json({
                success:false,
                message:"All fields are required."
            })
        }
        const user = await User.findOne({email});
        if(user){
            return res.status(400).json({
                success:false,
                message:"User already exist with this email."
            })
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const savedUser =  await User.create({
            name,
            email,
            password:hashedPassword,
            role
        });

        generateToken(res, savedUser, `Account created successfully`);
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to register"
        })
    }
}
export const login = async (req,res) => {
    try {
        const {email, password} = req.body;
        if(!email || !password){
            return res.status(400).json({
                success:false,
                message:"All fields are required."
            })
        }
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({
                success:false,
                message:"Incorrect email or password"
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if(!isPasswordMatch){
            return res.status(400).json({
                success:false,
                message:"Incorrect email or password"
            });
        }
        generateToken(res, user, `Welcome back ${user.name}`);

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to login"
        })
    }
}
export const logout = async (_,res) => {
    try {
        const isProd = process.env.NODE_ENV === "production";
        return res
          .status(200)
          .cookie("token", "", {
            maxAge: 0,
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
          })
          .json({
            message:"Logged out successfully.",
            success:true
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to logout"
        }) 
    }
}
export const getUserProfile = async (req,res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId).select("-password").populate("enrolledCourses");
        if(!user){
            return res.status(404).json({
                message:"Profile not found",
                success:false
            })
        }
        return res.status(200).json({
            success:true,
            user
        })
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to load user"
        })
    }
}
export const updateProfile = async (req,res) => {
    try {
        const userId = req.id;
        const {name} = req.body;
        const profilePhoto = req.file;

        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({
                message:"User not found",
                success:false
            }) 
        }
        // extract public id of the old image from the url is it exists;
        if(user.photoUrl){
            const publicId = user.photoUrl.split("/").pop().split(".")[0]; // extract public id
            deleteMediaFromCloudinary(publicId);
        }

        // upload new photo
        const cloudResponse = await uploadMedia(profilePhoto.path);
        const photoUrl = cloudResponse.secure_url;

        const updatedData = {name, photoUrl};
        const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {new:true}).select("-password");

        return res.status(200).json({
            success:true,
            user:updatedUser,
            message:"Profile updated successfully."
        })

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to update profile"
        })
    }
}

export const getStudentDashboard = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId)
            .select("name email photoUrl enrolledCourses")
            .populate({
                path: "enrolledCourses",
                populate: { path: "creator", select: "name" },
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const firstName = user.name ? user.name.split(" ")[0] : "Student";
        const courses = user.enrolledCourses || [];
        const courseIds = courses.map((course) => course._id.toString());

        const progressDocs = await CourseProgress.find({
            userId: userId.toString(),
            courseId: { $in: courseIds },
        }).lean();

        const progressMap = {};
        progressDocs.forEach((p) => {
            progressMap[p.courseId] = p;
        });

        let inProgressCount = 0;
        let completedCount = 0;
        const courseSummaries = [];

        courses.forEach((course) => {
            const courseId = course._id.toString();
            const courseProgress = progressMap[courseId];
            const totalLectures = Array.isArray(course.lectures) ? course.lectures.length : 0;
            let viewedCount = 0;
            if (courseProgress && Array.isArray(courseProgress.lectureProgress)) {
                viewedCount = courseProgress.lectureProgress.filter((lp) => lp.viewed).length;
            }
            const progressPercent = totalLectures > 0 ? Math.round((viewedCount * 100) / totalLectures) : 0;

            if (progressPercent === 100) {
                completedCount += 1;
            } else if (progressPercent > 0) {
                inProgressCount += 1;
            }

            courseSummaries.push({
                _id: course._id,
                courseTitle: course.courseTitle,
                courseLevel: course.courseLevel,
                courseThumbnail: course.courseThumbnail,
                creatorName: course.creator && course.creator.name ? course.creator.name : "Instructor",
                progressPercent,
            });
        });

        const results = await Result.find({ studentId: userId }).lean();

        let avgScore = null;
        if (results.length) {
            let sumPercent = 0;
            let count = 0;
            results.forEach((r) => {
                const totalQuestions =
                    (r.correctCount || 0) +
                    (r.incorrectCount || 0) +
                    (r.unattemptedCount || 0);
                if (totalQuestions > 0) {
                    const percent = ((r.correctCount || 0) / totalQuestions) * 100;
                    sumPercent += percent;
                    count += 1;
                }
            });
            if (count > 0) {
                avgScore = Math.round(sumPercent / count);
            }
        }

        const subjectScores = {};
        const subjectTimes = {};

        results.forEach((r) => {
            (r.subjectWiseScore || []).forEach((entry) => {
                if (!entry || !entry.subject) return;
                const key = entry.subject;
                subjectScores[key] = (subjectScores[key] || 0) + (entry.Score || 0);
            });
            (r.subjectWiseTimeSpent || []).forEach((entry) => {
                if (!entry || !entry.subject) return;
                const key = entry.subject;
                subjectTimes[key] = (subjectTimes[key] || 0) + (entry.timeSpent || 0);
            });
        });

        const topicPerformance = Object.entries(subjectScores).map(([subject, score]) => ({
            label: subject,
            value: Math.round(score),
        }));

        const totalStudyTime = Object.values(subjectTimes).reduce(
            (sum, v) => sum + (v || 0),
            0
        );

        const studyDistribution =
            totalStudyTime > 0
                ? Object.entries(subjectTimes).map(([subject, time]) => ({
                      label: subject,
                      value: Math.round(((time || 0) * 100) / totalStudyTime),
                  }))
                : [];

        const now = new Date();
        const weekStart = new Date();
        weekStart.setDate(now.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

        const recentResponses = await Response.find({
            studentId: userId,
            startedAt: { $gte: weekStart },
        }).lean();

        const weeklyActivity = Array(7).fill(0);
        let totalSeconds = 0;

        recentResponses.forEach((resp) => {
            const day = new Date(resp.startedAt || now);
            day.setHours(0, 0, 0, 0);
            const index = Math.floor((day.getTime() - weekStart.getTime()) / 86400000);
            let attemptSeconds = 0;
            (resp.answers || []).forEach((a) => {
                attemptSeconds += a.timeSpent || 0;
            });
            if (index >= 0 && index < 7) {
                weeklyActivity[index] += Math.round(attemptSeconds / 60);
            }
            totalSeconds += attemptSeconds;
        });

        const totalHours = (totalSeconds / 3600).toFixed(1);

        let currentStreak = 0;
        let longestStreak = 0;

        for (let i = 0; i < weeklyActivity.length; i++) {
            if (weeklyActivity[i] > 0) {
                currentStreak += 1;
                if (currentStreak > longestStreak) {
                    longestStreak = currentStreak;
                }
            } else {
                currentStreak = 0;
            }
        }

        const upcomingExams = [];

        return res.status(200).json({
            success: true,
            profile: {
                name: user.name,
                email: user.email,
                photoUrl: user.photoUrl,
                firstName,
            },
            stats: {
                total: courses.length,
                inProgress: inProgressCount,
                completed: completedCount,
                avgScore: avgScore,
                totalHours,
                certificates: completedCount,
            },
            weeklyActivity,
            courses: courseSummaries,
            topicPerformance,
            studyDistribution,
            upcomingExams,
            streak: {
                current: currentStreak,
                longest: longestStreak,
            },
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard",
        });
    }
};

export const googleAuth = async (req, res)=>{
    try{
        const {name, email, role}=req.body;
        let user = await User.findOne({email})
        // console.log("name and email received");
        if(!user){
            user = await User.create({
                name,
                email,
                role
            })
        }
        console.log()
        generateToken(res, user, `Account created successfully`);
    }catch(err){
        return res.status(500).json({message:"Google Auth error"});
    }
}