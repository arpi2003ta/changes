export const evaluateNeetOMR = ({ answerKey, studentAnswers }) => {
  const answerKeyMap = new Map();
  for (const item of answerKey) {
    const questionNumber = Number(item.questionNumber);
    if (!Number.isFinite(questionNumber)) {
      continue;
    }
    const correctOption =
      item.correctOption != null
        ? String(item.correctOption).toUpperCase()
        : null;
    if (!correctOption) {
      continue;
    }
    answerKeyMap.set(questionNumber, correctOption);
  }

  const studentMap = new Map();
  for (const item of studentAnswers) {
    const questionNumber = Number(item.questionNumber);
    if (!Number.isFinite(questionNumber)) {
      continue;
    }
    const selectedOption =
      item.selectedOption != null
        ? String(item.selectedOption).toUpperCase()
        : null;
    studentMap.set(questionNumber, { ...item, questionNumber, selectedOption });
  }

  let physicsMarks = 0;
  let chemistryMarks = 0;
  let biologyMarks = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  const wrongQuestions = [];

  for (const [questionNumber, correctOption] of answerKeyMap.entries()) {
    const subject = getSubject(questionNumber);
    const studentEntry = studentMap.get(questionNumber);

    if (!studentEntry || !studentEntry.selectedOption) {
      unattemptedCount += 1;
      continue;
    }

    if (studentEntry.selectedOption === correctOption) {
      correctCount += 1;
      totalMarks += 4;
      if (subject === "Physics") {
        physicsMarks += 4;
      } else if (subject === "Chemistry") {
        chemistryMarks += 4;
      } else if (subject === "Biology") {
        biologyMarks += 4;
      }
    } else {
      incorrectCount += 1;
      totalMarks -= 1;
      if (subject === "Physics") {
        physicsMarks -= 1;
      } else if (subject === "Chemistry") {
        chemistryMarks -= 1;
      } else if (subject === "Biology") {
        biologyMarks -= 1;
      }

      wrongQuestions.push({
        questionNumber,
        subject,
        selectedOption: studentEntry.selectedOption,
        correctOption,
      });
    }
  }

  return {
    physicsMarks,
    chemistryMarks,
    biologyMarks,
    totalMarks,
    correctCount,
    incorrectCount,
    unattemptedCount,
    wrongQuestions,
  };
};

function getSubject(questionNumber) {
  if (questionNumber >= 1 && questionNumber <= 50) {
    return "Physics";
  }
  if (questionNumber >= 51 && questionNumber <= 100) {
    return "Chemistry";
  }
  return "Biology";
}
