import React, { useEffect, useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import DownloadButton from "@/components/ui/downloadButton";
import { useNavigate } from 'react-router-dom';
import apiClient from "@/api/axios";

const AIExaminer = () => {
  const navigate = useNavigate();

  const [omrFile, setOmrFile] = useState(null);
  const [loading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [examData, setExamData] = useState(null); 

  const getDownloadUrl = (url) => {
    if (!url) return "#";
    return url.replace('/upload/', '/upload/fl_attachment/');
  };

  useEffect(()=>{
    const fetchExamDetais= async()=>{
      try{
        const response = await apiClient.get("/examiner/exam/getExam");
        if(response.data.success){
          setExamData(response.data.examDetail)
        }
      }catch(err){
        toast.error("failed to get exam details");
      }
    };
    fetchExamDetais();
  },[])


  const handleOMRUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setOmrFile(e.target.files[0]);
      setUploaded(true);
    }
  };

  const handleSubmit= async ()=>{
    try{

      const formData = new FormData();
      if(omrFile){
        formData.append("filledOMR",omrFile);
      }

      const response = await apiClient.post("/examiner/exam/submitOmr", formData);
      if(response.data.success){
        toast.success(response.data.message);
        const submissionId = response.data?.submission?._id;
        if(submissionId){
          navigate(`/ai-examiner/result/${submissionId}`);
        }
      }
    }catch(err){
      toast.error(err.response?.data?.message || "failed to submit exman")
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 my-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-bold text-2xl">AI Examiner</h1>
        <Button variant="outline"> <Link to="colleges">Your Colleges</Link>{" "}</Button>
      </div>
      <div className="my-8">
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1 pt-2">
              <Label htmlFor="QuestionPaper">Your Question Paper</Label>
              <div className="pt-1">
                {examData?.questionPaperUrl ?(
                  <a href={getDownloadUrl(examData.questionPaperUrl)} download className="w-full block">
                    <DownloadButton/>
                  </a>
                ):(
                  <Button disabled variant="outline" className="w-full justify-start opacity-50 cursor-not-allowed">
                     {examData ? "No Paper Available" : "Loading Paper..."}
                  </Button>
                )}
              </div>
              
            </div>
            <div className="space-y-1 pt-2">
              <Label htmlFor="blankOmr" >Your Blank OMR</Label>
              {examData?.omrSheetUrl ? (
                <a href={getDownloadUrl(examData.omrSheetUrl)} download className="w-full block">
                  <DownloadButton/>
                </a>
              ):(
                <Button disabled variant="outline" className="w-full justify-start opacity-50 cursor-not-allowed">
                  {examData ? "No Paper Available" : "Loading Paper..."}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="omr">Upload OMR Image</Label>
              <Input
                id="omr"
                type="file"
                accept="image/*"
                onChange={handleOMRUpload}
                disabled={uploaded}
              />
              {omrFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {omrFile.name}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter>
            <Button onClick={handleSubmit} disabled={loading || !uploaded}>
              {loading ? "Uploading..." : uploaded ? "Upload" : "Upload"}
            </Button>
          </CardFooter>
        </Card>
      </div>

    </div>
  );
};

export default AIExaminer;
