import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { QUESTION_TYPES } from "@/types/assessment";
import { useAssessmentStore } from "@/stores/assessment-store";
import { MyInput } from "@/components/design-system/input";

export function NumericInputWithKeypad() {
  const { currentQuestion, answers, setAnswer } = useAssessmentStore();
  const [numericValue, setNumericValue] = useState("");
  const [isDecimal, setIsDecimal] = useState(false);
  const [maxDecimals, setMaxDecimals] = useState(0);

  // Initialize the component based on current question settings
  useEffect(() => {
    if (
      !currentQuestion ||
      currentQuestion.question_type !== QUESTION_TYPES.NUMERIC
    ) {
      return;
    }

    // Get current answer if exists
    if (answers[currentQuestion.question_id]?.[0]) {
      setNumericValue(answers[currentQuestion.question_id][0]);
    } else {
      setNumericValue("");
    }
    const options_json = {
      numeric_type: "INTEGER",
      decimals: 0,
      min_value: 0,
      max_value: 1000,
      units: "days",
    };
    // Parse options to determine numeric type and decimal places
    try {
      //   if (currentQuestion.options_json) {
      if (options_json) {
        // const options = JSON.parse(currentQuestion.options_json);
        const options = options_json;
        setIsDecimal(options.numeric_type === "DECIMAL");
        setMaxDecimals(options.decimals || 0);
      }
    } catch (error) {
      console.error("Error parsing options_json:", error);
    }
  }, [currentQuestion, answers]);

  // Handle keypad button press
  const handleKeyPress = (key: string) => {
    if (key === "backspace") {
      setNumericValue((prev) => prev.slice(0, -1));
    } else if (key === "clear") {
      setNumericValue("");
      // Clear the answer in the store
      if (currentQuestion) {
        setAnswer(currentQuestion.question_id, []);
      }
    } else if (key === "." && isDecimal && !numericValue.includes(".")) {
      setNumericValue((prev) => prev + ".");
    } else if (key === "save") {
      if (numericValue.trim() !== "" && currentQuestion) {
        setAnswer(currentQuestion.question_id, [numericValue]);
      }
    } else if (/[0-9]/.test(key)) {
      setNumericValue((prev) => {
        // If there's a decimal point, check we don't exceed max decimal places
        if (prev.includes(".")) {
          const parts = prev.split(".");
          if (parts[1].length >= maxDecimals) {
            return prev;
          }
        }
        return prev + key;
      });
    }
  };

  // Handle direct input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // Validate input based on the question type (INTEGER or DECIMAL)
    if (isDecimal) {
      if (/^-?\d*\.?\d*$/.test(value)) {
        // Check decimal places don't exceed max
        if (value.includes(".")) {
          const parts = value.split(".");
          if (parts[1].length <= maxDecimals) {
            setNumericValue(value);
          }
        } else {
          setNumericValue(value);
        }
      }
    } else {
      // Integer only
      if (/^-?\d*$/.test(value)) {
        setNumericValue(value);
      }
    }
  };

  // Handle blur to save the answer
  const handleBlur = () => {
    if (numericValue.trim() !== "" && currentQuestion) {
      setAnswer(currentQuestion.question_id, [numericValue]);
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
          onBlur={handleBlur}
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

          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              variant="outline"
              className="h-14"
              onClick={() => handleKeyPress("clear")}
            >
              Clear
            </Button>
            <Button
              variant="default"
              className="h-14 text-white bg-primary-500 hover:bg-primary-600"
              onClick={() => handleKeyPress("save")}
              disabled={numericValue.trim() === ""}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
