// import mongoose from "mongoose";

// const answerSchema = new mongoose.Schema({
//     questionNumber: {type: Number, required:true},
//     correctOption: {type:String, enum: ['A','B','C','D'], required:true}
// });

// export const ExaminerAnswer = mongoose.model("ExaminerAnswer",answerSchema);

import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questionPaper: {
      url: String,
      publicId: String,
    },
    answerKey: {
      url: String,
      publicId: String,
    },
    omrSheet: {
      url: String,
      publicId: String,
    },
  },
  { timestamps: true }
);

const examSubmissionSchenma = new mongoose.Schema(
  {
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filledOmr: {
      url: String,
      publicId: String,
    },
    detectedMarks: [
      {
        questionNumber: Number,
        selectedOption: String,
        centerX: Number,
        centerY: Number,
        confidence: Number,
      },
    ],
    evaluation: {
      physicsMarks: Number,
      chemistryMarks: Number,
      biologyMarks: Number,
      totalMarks: Number,
      correctCount: Number,
      incorrectCount: Number,
      unattemptedCount: Number,
      wrongQuestions: [
        {
          questionNumber: Number,
          subject: String,
          selectedOption: String,
          correctOption: String,
        },
      ],
    },
  },
  { timestamps: true }
);

// examSubmissionSchenma.index({ exam: 1, student: 1 }, { unique: true });

export const Exam = mongoose.model("AIExam", examSchema);
export const ExamSubmission = mongoose.model(
  "AIExamSubmission",
  examSubmissionSchenma
);
