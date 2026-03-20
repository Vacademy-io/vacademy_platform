interface StepIndicatorProps {
    currentStep: number;
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
    return (
        <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
                {[0, 1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step <= currentStep 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-200 text-gray-600'
                        }`}>
                            {step === 0 ? 'R' : step}
                        </div>
                        {step < 4 && (
                            <div className={`w-12 h-0.5 mx-2 ${
                                step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                            }`} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StepIndicator; 