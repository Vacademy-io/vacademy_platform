export interface AIToolFeatureType {
    key: string;
    heading: string;
    subheading: string;
    description: string[];
    route: string | null;
}

export interface AIToolCardDataType {
    title: string;
    features: AIToolFeatureType[];
}

export const AIToolCardData: AIToolCardDataType[] = [
    {
        title: "Generate Questions form AI",
        features: [
            {
                key: "assessment",
                heading: "Vsmart Upload",
                subheading: "Generate questions by uploading pdf, doc and ppt files",
                description: [
                    "Generate question papers instantly by uploading study materials in PDF, Word, or PowerPoint formats. Vsmart Upload uses AI to analyze your entire file and create relevant, well-structured questions — or lets you paste content manually if preferred. No formatting needed, just plug and go.",
                    "Perfect for educators, exam setters, and corporate trainers who work with existing content like lecture slides, study guides, or course handouts. Whether you're preparing assessments for a classroom, a coaching batch, or a training session — Vsmart Upload saves hours of effort by turning your materials into ready-to-use question papers.",
                ],
                route: "/ai-center/ai-tools/vsmart-upload",
            },
            {
                key: "audio",
                heading: "Vsmart Audio",
                subheading: "Generate questions by uploading audio files",
                description: [
                    "Convert any lecture, meeting, or audio recording into a full question paper. Simply upload MP3, WAV, or other audio formats — Vsmart Audio transcribes your content and uses AI to generate structured, context-aware questions. No manual transcription or editing required.",
                    "Perfect for language labs, podcast-based learning modules, corporate training sessions, and recorded lectures at universities or coaching centers. Trainers and educators can repurpose existing audio resources into quizzes, comprehension tests, or discussion prompts with just a few clicks, enhancing engagement and reinforcing learning outcomes.",
                ],
                route: "/ai-center/ai-tools/vsmart-audio",
            },
            {
                key: "text",
                heading: "Vsmart Topics",
                subheading: "Generate questions by providing topics",
                description: [
                    "Generate custom question papers in seconds by just typing a topic, concept, or instruction. Vsmart Prompt uses advanced AI to understand your input and create a tailored set of questions — covering various difficulty levels, formats, and cognitive skills, all aligned to your needs.",
                    "Perfect for teachers, trainers, and academic heads who want quick assessments on specific topics without uploading any material. Whether it's for an impromptu quiz, concept revision, or rapid-fire session, Vsmart Prompt delivers accurate and varied questions with minimal input.",
                ],
                route: "/ai-center/ai-tools/vsmart-prompt",
            },
            {
                key: "chat",
                heading: "Vsmart Chat",
                subheading: "Generate questions from chats",
                description: [
                    "Turn your files into fully customizable question papers — with the power of conversation. Vsmart Chat allows you to upload PDF, DOC, or PPT files, auto-generates questions, and then lets you chat with AI to refine, rewrite, or improve those questions instantly. Whether you want to change the tone, adjust difficulty, or switch the format — just ask, and it adapts.",
                    "Perfect for teachers, trainers, and academic coordinators who need precision and flexibility. Upload content from any subject, and fine-tune the output using simple chat prompts. No need for complex editing — collaborate with AI like you would with a teaching assistant to get exactly the questions you need.",
                ],
                route: "/ai-center/ai-tools/vsmart-chat",
            },
        ],
    },
    {
        title: "Extract Questions with AI",
        features: [
            {
                key: "question",
                heading: "Vsmart Extract",
                subheading: "Extract questions by uploading pdf, doc and ppt files",
                description: [
                    "Easily extract all existing questions from any PDF document — whether it’s a past exam paper, a practice worksheet, or a question bank. Vsmart Extract scans the entire file, identifies question patterns, and neatly organizes them for easy reuse, editing, or export.",
                    "Ideal for educators and academic teams who work with legacy PDFs, shared resources, or scanned papers. Save time manually copying or retyping questions — Vsmart Extract helps schools, coaching centers, and corporate training departments quickly build digital archives or create updated assessments from old materials.",
                ],
                route: "/ai-center/ai-tools/vsmart-extract",
            },
            {
                key: "image",
                heading: "Vsmart Image",
                subheading: "Extract questions by uploading images",
                description: [
                    "Turn images into questions with ease. Vsmart Image uses advanced OCR and AI to scan photographs, scanned pages, handwritten notes, or screenshots — and extracts structured questions from them. Just upload your image, and let AI do the rest.",
                    "Ideal for teachers, coaching institutes, and trainers who often receive content in the form of handwritten notes, textbook snapshots, or board images. Whether you're digitizing old test papers or pulling questions from printed material — Vsmart Image brings analog content into your digital workflow in seconds.",
                ],
                route: "/ai-center/ai-tools/vsmart-image",
            },
        ],
    },
    {
        title: "Sort topic questions with AI",
        features: [
            {
                key: "sortSplitPdf",
                heading: "Vsmart Organizer",
                subheading: "Sort specific questions from any topics, question numbers or page",
                description: [
                    "Automatically generate and structure question papers topic-by-topic. Vsmart Organizer not only creates questions but intelligently classifies and groups them based on key concepts or chapters — giving you clean, organized sections ready for print or digital use.",
                    "Best suited for curriculum planners, educators, and training professionals who need to align assessments with syllabus breakdowns or learning objectives. Whether you’re creating unit tests, revision modules, or chapter-wise assignments, Vsmart Organizer keeps everything neat, focused, and ready to deploy.",
                ],
                route: "/ai-center/ai-tools/vsmart-organizer",
            },
            {
                key: "sortTopicsPdf",
                heading: "Vsmart Sorter",
                subheading: "Get all the questions sorted by their topics",
                description: [
                    "Generate and organize topic-wise question papers with precision. Vsmart Sorter automatically extracts questions from your uploaded file (PDF, PPT, or DOC), groups them based on topics, and gives you the control to reorder questions within those topics to match your teaching flow or focus areas.",
                    "Ideal for educators, content designers, or exam moderators who want AI-generated content, but also need flexibility in how it's arranged. Whether you're creating chapter-wise assessments or tailoring question papers to fit specific classroom needs, Vsmart Sorter gives structure with control — letting you decide the question flow.",
                ],
                route: "/ai-center/ai-tools/vsmart-sorter",
            },
        ],
    },
    {
        title: "Lecture support with AI",
        features: [
            {
                key: "planLecture",
                heading: "Vsmart Lecturer",
                subheading: "Generate structured, time-based lectures with just a prompt",
                description: [
                    "Create custom lecture plans effortlessly. With Vsmart Lecturer, all you need to do is enter what topics you want to cover, the academic level (e.g., 8th standard), your preferred teaching method, the language (English or Hindi), and total lecture duration. You can also choose whether to include questions during the session or assignments at the end. Based on your inputs, Vsmart Lecturer generates a well-structured, AI-powered lecture flow — ready to deliver.",
                    "Ideal for educators, trainers, and facilitators who want to design purposeful and interactive lectures without starting from scratch. Whether you're preparing a short 30-minute lesson or a detailed 90-minute workshop, just enter your preferences — from time splits and teaching style to language and student engagement activities — and instantly receive a full, downloadable lecture blueprint tailored to your needs.",
                ],
                route: "/ai-center/ai-tools/vsmart-lecture",
            },
            {
                key: "evaluateLecture",
                heading: "Vsmart Feedback",
                subheading: "Get feedback reports on your lecture performance",
                description: [
                    "Upload your lecture recording and let AI evaluate your performance. Vsmart Lecturer listens to your audio file and generates a comprehensive report — scoring you on clarity, content delivery, engagement, structure, and pacing. Get instant feedback on what you did well and what could be improved.",
                    "Designed for educators, trainers, and presenters who want to refine their speaking and teaching style. Whether you're preparing for a classroom session, webinar, or workshop — just upload a WAV, MP3, FLAC, AAC, or M4A file and receive a detailed, actionable evaluation of your lecture.",
                ],
                route: "/ai-center/ai-tools/vsmart-feedback",
            },
        ],
    },
];
