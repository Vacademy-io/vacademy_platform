import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Helper functions to parse response data (same as in SurveyIndividualRespondentsTab)
const formatMcqAnswer = (responseData: any): string => {
  if (responseData.optionIds && responseData.optionIds.length > 0) {
    return `Selected options: ${responseData.optionIds.join(', ')}`;
  }
  return 'No options selected';
};

const formatNumericAnswer = (responseData: any): string => {
  if (responseData.validAnswer !== null && responseData.validAnswer !== undefined) {
    return `Answer: ${responseData.validAnswer}`;
  }
  return 'No numeric answer provided';
};

const formatTextAnswer = (responseData: any): string => {
  if (responseData.answer && responseData.answer.trim() !== '') {
    return responseData.answer;
  }
  return 'No text answer provided';
};

const formatAnswerByType = (responseData: any): string => {
  switch (responseData.type) {
    case 'MCQS':
    case 'MCQM':
    case 'TRUE_FALSE':
      return formatMcqAnswer(responseData);
    case 'NUMERIC':
      return formatNumericAnswer(responseData);
    case 'ONE_WORD':
    case 'LONG_ANSWER':
      return formatTextAnswer(responseData);
    default:
      return 'Unknown response type';
  }
};

const parseResponseData = (responseString: string) => {
  try {
    const response = JSON.parse(responseString);
    const responseData = response.responseData || {};

    const formattedAnswer = formatAnswerByType(responseData);

    return createParsedResponse(response, responseData, formattedAnswer);
  } catch (error) {
    return createErrorResponse(responseString);
  }
};

const createParsedResponse = (response: any, responseData: any, formattedAnswer: string) => ({
  questionId: response.questionId || 'Unknown',
  questionType: responseData.type || 'Unknown',
  formattedAnswer,
  timeTaken: response.timeTakenInSeconds || 0,
  durationLeft: response.questionDurationLeftInSeconds || 0,
  isVisited: response.isVisited || false,
  isMarkedForReview: response.isMarkedForReview || false,
  rawResponse: response,
});

const createErrorResponse = (responseString: string) => ({
  questionId: 'Unknown',
  questionType: 'Unknown',
  formattedAnswer: 'Error parsing response data',
  timeTaken: 0,
  durationLeft: 0,
  isVisited: false,
  isMarkedForReview: false,
  rawResponse: responseString,
});

// Example responses from your data
const exampleResponses = [
  {
    id: 'response-1',
    answer: '{"questionId":"3e34603c-711b-4c26-ad44-0d4063fab7d4","questionDurationLeftInSeconds":0,"timeTakenInSeconds":0,"isMarkedForReview":false,"isVisited":false,"responseData":{"type":"MCQS","optionIds":[]}}'
  },
  {
    id: 'response-2',
    answer: '{"questionId":"9861fe20-cd6d-4260-8fd3-6963e18d86df","questionDurationLeftInSeconds":0,"timeTakenInSeconds":3,"isMarkedForReview":false,"isVisited":true,"responseData":{"type":"NUMERIC","validAnswer":6}}'
  },
  {
    id: 'response-3',
    answer: '{"questionId":"0b7a6fe4-10f3-4997-bb0e-40677b544ab9","questionDurationLeftInSeconds":0,"timeTakenInSeconds":2,"isMarkedForReview":false,"isVisited":true,"responseData":{"type":"MCQM","optionIds":["69db8300-af8b-4df5-b977-e5e9ac01629c"]}}'
  },
  {
    id: 'response-4',
    answer: '{"questionId":"9540a63f-0986-4cd6-8dbf-5cd879e684a5","questionDurationLeftInSeconds":0,"timeTakenInSeconds":3,"isMarkedForReview":false,"isVisited":true,"responseData":{"type":"TRUE_FALSE","optionIds":["6a3303e0-1f32-4c47-af67-494c77fae470"]}}'
  },
  {
    id: 'response-5',
    answer: '{"questionId":"5b086385-1961-4111-aad8-e65051b485da","questionDurationLeftInSeconds":0,"timeTakenInSeconds":0,"isMarkedForReview":false,"isVisited":false,"responseData":{"type":"ONE_WORD","answer":""}}'
  }
];

export const ResponseParsingDemo: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Response Parsing Demo</h2>
        <p className="text-gray-600">Before vs After: How responses are now displayed</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {exampleResponses.map((response, index) => {
          const parsedResponse = parseResponseData(response.answer);

          return (
            <Card key={response.id} className="h-fit">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-semibold flex-1">
                    Q{index + 1}. Survey Question {index + 1}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary-100 text-primary-800 border-primary-200">
                      {parsedResponse.questionType}
                    </Badge>
                    {parsedResponse.isVisited && (
                      <Badge variant="outline" className="text-xs">
                        Visited
                      </Badge>
                    )}
                    {parsedResponse.isMarkedForReview && (
                      <Badge variant="outline" className="text-xs">
                        Marked for Review
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Before - Raw JSON */}
                  <div>
                    <div className="text-sm font-medium text-red-700 mb-2">❌ Before (Raw JSON):</div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="text-xs font-mono text-red-800 break-all">
                        {response.answer}
                      </p>
                    </div>
                  </div>

                  {/* After - Parsed Response */}
                  <div>
                    <div className="text-sm font-medium text-green-700 mb-2">✅ After (Parsed):</div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-medium text-green-800">
                        {parsedResponse.formattedAnswer}
                      </p>
                    </div>
                  </div>

                  {/* Response Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                    <div className="flex items-center gap-4">
                      <span>Time Taken: {parsedResponse.timeTaken}s</span>
                      <span>Duration Left: {parsedResponse.durationLeft}s</span>
                    </div>
                    <span>Question ID: {parsedResponse.questionId}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">✨ Key Improvements:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Human-readable responses</strong> instead of raw JSON</li>
          <li>• <strong>Question type badges</strong> for easy identification</li>
          <li>• <strong>Response status indicators</strong> (Visited, Marked for Review)</li>
          <li>• <strong>Time tracking</strong> (Time Taken, Duration Left)</li>
          <li>• <strong>Question ID reference</strong> for debugging</li>
          <li>• <strong>Survey-specific handling</strong> (no correct answers needed)</li>
        </ul>
      </div>
    </div>
  );
};
