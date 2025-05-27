import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QUESTION_TYPES } from "@/types/assessment";
import { useAssessmentStore } from "@/stores/assessment-store";
import { MyInput } from "@/components/design-system/input";

export function NumericInputWithKeypad() {
  const { currentQuestion, answers, setAnswer, setQuestionState } =
    useAssessmentStore();
  const [numericValue, setNumericValue] = useState("");
  const [isDecimal, setIsDecimal] = useState(false);
  const [maxDecimals, setMaxDecimals] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize component state based on question settings
  useEffect(() => {
    if (
      !currentQuestion ||
      currentQuestion.question_type !== QUESTION_TYPES.NUMERIC
    ) {
      return;
    }

    // Load existing answer
    if (answers[currentQuestion.question_id]?.[0]) {
      setNumericValue(answers[currentQuestion.question_id][0]);
    } else {
      setNumericValue("");
    }

    // Set numeric type and decimals (for now, hardcoded options_json)
    const options_json = {
      numeric_type: "INTEGER",
      decimals: 0,
      min_value: 0,
      max_value: 1000,
      units: "days",
    };

    try {
      const options = options_json;
      setIsDecimal(options.numeric_type === "DECIMAL");
      setMaxDecimals(options.decimals || 0);
    } catch (error) {
      console.error("Error parsing options_json:", error);
    }
  }, [currentQuestion, answers]);

  // Auto-focus input on load
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentQuestion]);

  // Handle keypad button press
  const handleKeyPress = (key: string) => {
    if (!currentQuestion) return;

    let updated = numericValue;

    if (key === "backspace") {
      updated = numericValue.slice(0, -1);
    } else if (key === "." && isDecimal && !numericValue.includes(".")) {
      updated = numericValue + ".";
    } else if (/[0-9]/.test(key)) {
      if (numericValue.includes(".")) {
        const parts = numericValue.split(".");
        if (parts[1].length >= maxDecimals) {
          return;
        }
      }
      updated = numericValue + key;
    }

    setNumericValue(updated);
    setAnswer(currentQuestion.question_id, [updated]);

    // Update question state
    setQuestionState(currentQuestion.question_id, {
      isVisited: true,
      isAnswered: updated.trim() !== "",
    });
  };

  // Handle direct input changes

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (isDecimal) {
      if (/^-?\d*\.?\d*$/.test(value)) {
        if (value.includes(".")) {
          const parts = value.split(".");
          if (parts[1].length > maxDecimals) return;
        }
        setNumericValue(value);
        if (currentQuestion) {
          setAnswer(currentQuestion.question_id, [value]);
          setQuestionState(currentQuestion.question_id, {
            isVisited: true,
            isAnswered: value.trim() !== "",
          });
        }
      }
    } else {
      if (/^-?\d*$/.test(value)) {
        setNumericValue(value);
        if (currentQuestion) {
          setAnswer(currentQuestion.question_id, [value]);
          setQuestionState(currentQuestion.question_id, {
            isVisited: true,
            isAnswered: value.trim() !== "",
          });
        }
      }
    }
  };

  if (
    !currentQuestion ||
    currentQuestion.question_type !== QUESTION_TYPES.NUMERIC
  ) {
    return null;
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex justify-center">
        <MyInput
          inputType="text"
          input={numericValue}
          onChangeFunction={handleInputChange}
          inputPlaceholder={
            isDecimal ? "Enter decimal value" : "Enter integer value"
          }
          inputMode="numeric"
          className="text-xl py-4 font-medium w-full"
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onPaste={(e) => e.preventDefault()}
        />
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-14 text-xl font-medium"
                onClick={() => handleKeyPress(num.toString())}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-14 text-xl font-medium"
              onClick={() => handleKeyPress("0")}
            >
              0
            </Button>
            {isDecimal && (
              <Button
                variant="outline"
                className="h-14 text-xl font-medium"
                onClick={() => handleKeyPress(".")}
                disabled={numericValue.includes(".")}
              >
                .
              </Button>
            )}
            <Button
              variant="outline"
              className="h-14 text-xl font-medium"
              onClick={() => handleKeyPress("backspace")}
            >
              ←
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
