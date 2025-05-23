import { LongAnswerQuestionPaperTemplatePPTView } from "./LongAnswerType/LongAnswerQuestionPaperTemplatePPTView";
import { QuestionPaperTemplateFormProps } from "./MainViewComponentFactory";

export const PPTComponentFactory = (params: { props: QuestionPaperTemplateFormProps }) => {
    return <LongAnswerQuestionPaperTemplatePPTView {...params.props} />;
};
