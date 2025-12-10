import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import apiClient from "@/api/axios";
import { Button } from "@/components/ui/button";

const AIExaminerResult = () => {
  const { submissionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [evaluation, setEvaluation] = useState(null);
  const [detectedMarks, setDetectedMarks] = useState([]);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const response = await apiClient.get(
          `/examiner/exam/result/${submissionId}`
        );
        if (response.data?.success) {
          setEvaluation(response.data.evaluation);
          setDetectedMarks(response.data.detectedMarks || []);
        } else {
          toast.error(
            response.data?.message || "Failed to fetch exam result"
          );
        }
      } catch (error) {
        toast.error(
          error?.response?.data?.message || "Failed to fetch exam result"
        );
      } finally {
        setLoading(false);
      }
    };

    if (submissionId) {
      fetchResult();
    }
  }, [submissionId]);

  const physicsMarks = evaluation?.physicsMarks ?? 0;
  const chemistryMarks = evaluation?.chemistryMarks ?? 0;
  const biologyMarks = evaluation?.biologyMarks ?? 0;
  const totalMarks = evaluation?.totalMarks ?? 0;
  const wrongQuestions = evaluation?.wrongQuestions || [];

  return (
    <div className="flex flex-col justify-center items-center mt-20 p-4">
      <div className="w-full dark:bg-white bg-gray-800 max-w-3xl rounded-xl shadow-xl text-center">
        <h1 className="text-3xl font-bold text-white dark:text-gray-800 mb-4">
          AI Examiner Result
        </h1>
        {loading ? (
          <p className="text-white dark:text-gray-800 p-6">Loading result...</p>
        ) : !evaluation ? (
          <p className="text-white dark:text-gray-800 p-6">
            Result is not available yet. Please try again later.
          </p>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-md mx-6 mb-6 p-4 text-left">
              <h2 className="text-xl font-semibold mb-2">Detected Marks (from ML)</h2>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <div className="grid grid-cols-3 font-semibold border-b px-3 py-2 text-sm">
                  <div>Question</div>
                  <div>Selected Option</div>
                  <div>Confidence</div>
                </div>
                {detectedMarks.map((mark, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 text-sm border-b px-3 py-1"
                  >
                    <div>{mark.questionNumber}</div>
                    <div>{mark.selectedOption}</div>
                    <div>{mark.confidence?.toFixed(2)}</div>
                  </div>
                ))}
                {detectedMarks.length === 0 && (
                  <p className="text-xs px-3 py-2">
                    No detected marks available for this submission.
                  </p>
                )}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-md mx-6 mb-6 p-4 text-left">
              <h2 className="text-xl font-semibold mb-2">Marks Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="font-semibold">Physics</div>
                <div>{physicsMarks}</div>
                <div className="font-semibold">Chemistry</div>
                <div>{chemistryMarks}</div>
                <div className="font-semibold">Biology</div>
                <div>{biologyMarks}</div>
              </div>
              <div className="mt-4 text-lg font-bold">
                Total: {totalMarks}/720
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-md mx-6 mb-6 p-4 text-left">
              <h2 className="text-xl font-semibold mb-2">Wrong Answers</h2>
              <div className="max-h-48 overflow-y-auto border rounded-md">
                <div className="grid grid-cols-4 font-semibold border-b px-3 py-2 text-sm">
                  <div>Q No.</div>
                  <div>Subject</div>
                  <div>Your Answer</div>
                  <div>Correct Answer</div>
                </div>
                {wrongQuestions.map((q, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-4 text-sm border-b px-3 py-1"
                  >
                    <div>{q.questionNumber}</div>
                    <div>{q.subject}</div>
                    <div>{q.selectedOption}</div>
                    <div>{q.correctOption}</div>
                  </div>
                ))}
                {wrongQuestions.length === 0 && (
                  <p className="text-xs px-3 py-2">
                    No wrong answers recorded for this submission.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AIExaminerResult;