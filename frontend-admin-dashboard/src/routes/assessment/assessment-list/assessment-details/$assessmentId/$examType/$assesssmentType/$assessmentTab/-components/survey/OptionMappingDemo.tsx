import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Example data showing the mapping process
const exampleData = {
  response: {
    questionId: "3170a913-5ec9-4418-b7c0-f4f09173a89c",
    responseData: {
      type: "MCQS",
      optionIds: ["90697e0b-3923-4712-8652-6b2fed62e39a"]
    }
  },
  questionData: {
    questionContent: "hello survey",
    questionOrder: 1,
    questionType: "MCQS",
    optionsMap: new Map([
      ["90697e0b-3923-4712-8652-6b2fed62e39a", "hii"],
      ["4ddcdad9-c041-4de0-89aa-250532137b6f", "hhhhhh"],
      ["ff0ef9cf-faf6-45f8-9bf4-7d84979ad0c0", "jj"],
      ["91162e42-77bb-40d1-8357-7d034d0ee1d0", "hh"]
    ])
  }
};

export const OptionMappingDemo: React.FC = () => {
  const { response, questionData } = exampleData;

  // Simulate the parsing process
  const selectedOptionIds = response.responseData.optionIds;
  const selectedOptions = selectedOptionIds.map(optionId =>
    questionData.optionsMap.get(optionId) || optionId
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Option ID Mapping Demo</h2>
        <p className="text-gray-600">How option IDs are mapped to human-readable content</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Before - Raw IDs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-red-700">
              ❌ Before (Raw Option IDs)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Question:</div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">{questionData.questionContent}</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Response:</div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm font-mono text-red-800">
                    Selected options: {selectedOptionIds.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* After - Mapped Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-green-700">
              ✅ After (Mapped Content)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Question:</div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">{questionData.questionContent}</p>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Response:</div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">
                    Selected: {selectedOptions.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Options Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">All Available Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from(questionData.optionsMap.entries()).map(([optionId, optionContent], index) => (
              <div
                key={optionId}
                className={`p-3 rounded-lg border text-sm ${
                  selectedOptionIds.includes(optionId)
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{optionContent}</span>
                    <span className="text-xs text-gray-500 ml-2">({optionId})</span>
                  </div>
                  {selectedOptionIds.includes(optionId) && (
                    <Badge variant="outline" className="text-xs">
                      Selected
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Process Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">🔄 Mapping Process:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li><strong>Fetch Questions API:</strong> Get questions with options from the backend</li>
          <li><strong>Create Options Map:</strong> Map option IDs to their content text</li>
          <li><strong>Parse Response:</strong> Extract selected option IDs from user response</li>
          <li><strong>Map IDs to Content:</strong> Replace option IDs with human-readable text</li>
          <li><strong>Display Enhanced UI:</strong> Show actual question content and selected options</li>
        </ol>
      </div>
    </div>
  );
};
