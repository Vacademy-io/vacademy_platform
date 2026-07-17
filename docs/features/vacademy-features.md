# Vacademy — Complete Feature Catalog

> Vacademy unifies LMS, assessments, live classrooms, CRM & admissions, marketing, communication, finance, HR and a full AI studio — so coaching institutes, schools and edtech companies can run everything from one place, under their own brand.

**15 products · 265 features · 1993 capabilities** · Last updated: 2026-07-17

This document is maintained in parallel with `vacademy-features.html` (interactive explorer). When you add or change a feature, update **both** files — the HTML embeds the same content in its `DATA` object.

---

## Products

| # | Product | What it covers | Features |
|---|---------|----------------|----------|
| 1 | [Learning Management (LMS)](#learning-management-lms) | Author rich courses and deliver them beautifully on every device | 21 |
| 2 | [Assessments & Evaluation](#assessments-evaluation) | Every exam format — online, offline, OMR — with manual and AI grading | 19 |
| 3 | [Live Classroom](#live-classroom) | Schedule, teach and engage live — built-in classroom or Zoom/Meet | 15 |
| 4 | [CRM, Sales & Admissions](#crm-sales-admissions) | Capture every lead, empower counsellors, convert admissions | 22 |
| 5 | [Marketing & Website](#marketing-website) | Websites, campaigns, coupons and referrals that fill your funnel | 16 |
| 6 | [Communication Suite](#communication-suite) | Announcements, email, WhatsApp, push and chat — one hub | 15 |
| 7 | [Voice & AI Calling](#voice-ai-calling) | Cloud telephony, IVR and AI agents that call for you | 17 |
| 8 | [Vacademy AI](#vacademy-ai) | AI that builds courses, coaches teachers and tutors learners | 17 |
| 9 | [AI Video Studio (Vimotion)](#ai-video-studio-vimotion) | Prompt-to-video studio: avatars, voiceovers, editing, reels | 27 |
| 10 | [Automation & Workflows](#automation-workflows) | Visual workflows and one-click automations across the platform | 6 |
| 11 | [Finance & Payments](#finance-payments) | Fees, invoices, subscriptions and 6+ payment gateways | 14 |
| 12 | [Institute ERP, HR & Operations](#institute-erp-hr-operations) | Enrollment, batches, branches, staff and payroll — run the institute | 28 |
| 13 | [Analytics & Reports](#analytics-reports) | Dashboards and reports for learning, sales, fees and engagement | 15 |
| 14 | [Community & Gamification](#community-gamification) | Shared question banks, leaderboards, XP and badges | 8 |
| 15 | [Platform, Apps & White-Label](#platform-apps-white-label) | Your brand, your domain, your apps — on enterprise-grade rails | 25 |

> **Note on terminology:** Every term below (Course, Level, Session, Batch, Learner, …) is configurable per institute via Settings → Naming Settings — your clients can rename them to match their own vocabulary (e.g. "Course" → "Program", "Learner" → "Student").

---

## Learning Management (LMS)

*Author rich courses and deliver them beautifully on every device*

Vacademy's Learning Management pillar covers everything from building a course to a learner finishing it: a full course library, flexible 2-to-5 level hierarchies, and a slide-based editor supporting more than a dozen content types including video, PDFs, quizzes, code labs, Jupyter notebooks and SCORM. Content can be dripped, reused across batches, put through editorial approval, and protected against leaks — while learners consume it in a distraction-free player with true progress tracking, a personalized home dashboard, and automatically issued completion certificates.

### Course Builder & Course Library

*Create, organize and sell every course from one library*

A central library where your team creates and manages every offering — classic courses, memberships, products or services — all on the same engine. Each course carries rich, marketing-ready details: description, learning outcomes, target audience, tags, preview image, banner and promo media. Search, filters, sorting and pagination keep even the largest catalogs manageable, and teaching teams are set up from day one with instructor invitations.

**For:** Admin, Teacher · **Where:** Admin Web

- **Guided course creation wizard** — Step-by-step setup for name, description, learning outcomes, about section, target audience, tags, preview image, banner and promo media (image, uploaded video or YouTube link) with built-in image cropping.
- **Four offering types** — Create each offering as a Course, Membership, Product or Service — the same engine sells classic courses, recurring memberships or one-off services.
- **Bulk course creation** — Create many courses in a single operation instead of one at a time.
- **Course cards with live stats** — Library cards show ratings, instructors with photos, tags and optionally the count of actively enrolled learners per course.
- **Search, filter and sort** — Find courses by keyword, level, tag or owning staff member; sort results and page through large catalogs.
- **Edit and delete with safeguards** — Update course details anytime; deletion asks for confirmation and supports removing multiple courses at once.
- **Faculty-scoped views** — Teachers with restricted access see only their own courses, with irrelevant filters hidden automatically.
- **Instructor invitations** — Invite co-instructors onto a course while creating it, so teaching teams are in place from the start.

### Flexible Course Hierarchy

*2-to-5 level course structures that match how you teach*

Structure courses with 2, 3, 4 or 5 levels of depth — from a simple chapter list up to full Level → Session → Subject → Module → Chapter trees — instead of being forced into a flat lesson list. Every layer can be added, renamed, reordered by drag-and-drop, copied, moved and deleted. Academic sessions (year or semester) and levels (class or grade) are optional and switch on or off per institute.

**For:** Admin, Teacher · **Where:** Admin Web

- **Selectable course depth** — Choose a 2, 3, 4 or 5-level structure per course, or fix a default depth institute-wide so all courses stay consistent.
- **Levels management** — Add, update and delete levels (e.g. Class 9, Beginner/Advanced) with durations and thumbnails.
- **Academic sessions** — Create, edit and delete academic sessions (e.g. 2026-27) and map level/session combinations into batches.
- **Session-to-session content rollover** — Roll a whole session's content forward into a new academic session in one action — no rebuilding each year.
- **Subjects and modules** — Add, update, reorder and delete subjects and their modules, each with names and thumbnails.
- **Chapters with copy and move** — Create and edit chapters, drag to reorder, and copy or move a chapter with all its slides to another module, course or batch.
- **Outline vs structure view** — Choose whether learners and staff see a course as a flat outline or a nested structure, with sections expanded or collapsed by default.

### Slide-Based Content Authoring

*Every lesson is a slide — 12+ content types, one editor*

Chapters are built from slides — individual learning units that can be a video, PDF, rich document, quiz, question, assignment, assessment, audio track, SCORM package, code editor, Jupyter notebook, Scratch project or interactive presentation. Authors work in a single editor with a chapter sidebar, adding, reordering, renaming, copying and moving slides freely, with full version history and engagement stats on every slide.

**For:** Admin, Teacher · **Where:** Admin Web

- **12+ slide types from one menu** — Add PDF, PPT presentation, rich document, video (upload, YouTube or Vimeo), question, quiz, assignment, assessment, presentation, Jupyter notebook, Scratch project, audio, code editor and SCORM slides from a single add menu.
- **Draft / publish lifecycle** — Slides are authored as drafts and explicitly published; draft and published content are stored separately so edits never leak early, and slides can be unpublished again.
- **Drag-and-drop reordering** — Reorder slides in the chapter sidebar with drag-and-drop; the new order saves instantly.
- **Copy and move slides** — Copy or move any slide to a different chapter, module, subject or course — ideal for reusing lessons across batches.
- **Version history and restore** — Every save is captured in a content history timeline; authors can view past versions of a slide and restore any of them with one click.
- **Slide-level engagement stats** — An activity panel shows which learners viewed or submitted on each slide, flags late submissions, and exports all submissions to CSV.
- **In-context doubt resolution** — Learner doubts raised on a slide appear in a sidebar where staff can reply, assign a teacher, mark resolved or delete.
- **Read-time analytics by content type** — Slide counts and estimated read time per content type help gauge course length at a glance.

### Interactive Course Player

*One player for video, documents, quizzes, code and more*

Learners consume content slide by slide in a distraction-free player with a full course-tree sidebar. The player natively renders more than a dozen content types — video, rich documents, PDFs, slide decks, audio, quizzes, assignments, code editors, notebooks, Scratch, SCORM and whiteboards — and always remembers exactly where the learner left off, down to the video second or PDF page.

**For:** Learner · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **Every slide type, natively rendered** — Videos, documents, PDFs, presentation decks, audio, questions, quizzes, assignments, code editors, Jupyter notebooks, Scratch projects, SCORM packages and whiteboard slides all play inside one consistent player.
- **Course tree navigation** — A collapsible sidebar shows the full Subject → Module → Chapter → Slide tree with per-item completion indicators and free navigation.
- **Resume where you left off** — Every slide records progress, so learners resume at the exact video second or document page they left — on any device.
- **Custom video player** — Plays YouTube, Vimeo and institute-uploaded videos with speed control and watch-position tracking.
- **Rich documents with math and diagrams** — Rich-text lesson pages render cleanly, including math formulas and diagrams, in a focused reading view.
- **PDF viewer with page tracking** — The in-app PDF viewer tracks pages read, so completion reflects how much of a document was actually studied.
- **AI-generated video lessons** — Plays AI-produced lesson videos with synchronized visuals and narration, including a live progress display while a video is still generating.
- **Animated interactive lessons** — Animated HTML lessons can embed live code editors, Scratch projects or Jupyter notebooks directly inside the lesson.
- **Embedded assessments** — Full assessments can be launched from within a course chapter without leaving the learning flow.
- **End-of-course feedback slide** — An automatic feedback step at the end of a course collects the learner's rating and comments.

### Video Lessons with In-Video Questions

*Videos that check understanding, not just play*

Add video lessons by uploading files or linking YouTube, Vimeo or Google Drive videos. Authors drop questions at exact timestamps so playback pauses and learners must answer before continuing — turning passive watching into active learning. Behind the scenes the platform tracks genuine watch time, pauses and skips, giving you trustworthy engagement data instead of simple view counts.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Multiple video sources** — Upload video files to secure cloud storage or link YouTube, Vimeo and Google Drive videos.
- **Timestamped question authoring** — Insert questions at any point in the timeline, edit each question's time frame, preview it, and manage the full question list per video.
- **Pause-and-answer playback** — The video pauses at preset moments and shows a question the learner answers in place before playback resumes.
- **True watch-time tracking** — Records actual watched intervals, pause counts and jumps — not just 'opened the video' — for accurate completion data.
- **Video + notes split screen** — Pair a video with a side-by-side document or whiteboard for follow-along notes.
- **Per-slide activity logs** — Every learning interaction — video watched, PDF page read, quiz attempted — is logged and powers learner progress reports and engagement insights.

### Quiz, Question & Survey Slides

*Auto-graded practice woven into every chapter*

Drop standalone questions, multi-question quizzes or surveys directly between lessons. Question types include single-choice, multiple-choice, true/false, numeric, one-word and long-answer — including comprehension variants built on a shared passage. Objective questions grade themselves instantly, scores feed into learner progress, and question slides can also run as surveys to collect feedback inside the course.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Six question types** — MCQ single answer, MCQ multiple answers, true/false, numeric, one-word and long answer — plus comprehension versions of MCQ and numeric questions built on a passage.
- **Automatic evaluation** — Objective types are auto-graded against configured correct answers; long answers can be collected for manual review.
- **Marks and negative marking** — Set marks per question with optional negative marking, and allow or block skipping per question.
- **Explanations and media** — Attach an explanation shown after answering and add images and media to questions and options.
- **Survey mode** — Run question slides as surveys with no right answer to collect learner feedback inside the course.
- **Preview as a learner** — Preview the full quiz exactly as a learner will see it before publishing.
- **Learner quiz experience** — Quizzes run with timers, attempt limits, instant feedback, scorecards and a review mode inside the course player.

### Assignments & Homework

*Deadline-driven homework with submissions, marks and reports*

Assignment slides give learners homework with a go-live date, deadline, total and passing marks, reference attachments and structured questions. Learners submit file uploads directly inside the course within precisely enforced submission windows, with configurable re-attempts. Staff review every submission per slide, spot late work, and export everything to CSV, while grades flow back to the learner's homework area.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Scheduling and live deadlines** — Set a go-live date and due date per assignment; submission windows are enforced against server time with a live countdown, and late submissions are flagged.
- **Re-attempt policy** — Allow a configurable number of resubmissions per learner; the app tracks attempts used and blocks further submissions once exhausted.
- **Marks and passing criteria** — Define total and passing marks; learners see their graded marks and pass/fail outcome once evaluated.
- **Attachments and structured questions** — Attach reference files and add structured questions with typed answers and options.
- **File-upload submissions** — Learners upload one or more files as their submission, with allowed file types configurable by the teacher.
- **Submission review and CSV export** — See every learner's submission in an activity sidebar and download all submissions as a CSV.
- **Homework list and reports** — A dedicated homework area lists all pending and completed homework across courses, with report views summarizing submissions and outcomes over time.

### Documents, PDFs & Presentation Decks

*Rich docs, PDFs and animated slide decks learners love*

Written content comes in every flavor: upload PDFs, convert Word documents into editable pages, author rich documents in a modern block editor, or let AI write the lesson for you. PowerPoint decks convert automatically — either into polished PDFs or into smooth animated web slideshows that replay build steps — so presentations look as good online as they did in class.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **PDF slides** — Upload PDFs with an in-app viewer; page counts are tracked so learner progress can be measured page by page.
- **Rich document editor** — Create documents in a modern block-based editor with headings, lists, media and formatting; existing Word docs upload and convert to editable content.
- **AI-written documents** — Ask AI to author or rewrite a document slide from a prompt — content arrives as a polished lesson you can keep refining with AI.
- **Animated PPT decks** — Upload a .pptx and it becomes a web slideshow that preserves build-step animations as elegant cross-fades, played in an in-course deck player.
- **PowerPoint-to-PDF conversion** — Classic .ppt and modern .pptx decks convert to PDFs through a professional-grade conversion engine with standard and high-quality modes; very large decks upload straight to cloud storage and convert by reference, sidestepping size limits.
- **Embedded URL slides** — Embed any external web page or tool directly inside a chapter as its own slide.

### Coding & STEM Slides

*Runnable code, Jupyter notebooks and Scratch inside lessons*

Teach programming inside the course itself. Code editor slides give learners an in-browser editor where they write and run code against the lesson's starter files; Jupyter notebook and Scratch project slides embed full interactive STEM environments. Every learner code submission is stored and reviewable by staff.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **In-browser code editor slides** — Author coding exercises with starter code; learners write and execute code in the browser with real language runtimes.
- **Jupyter notebook slides** — Embed interactive Jupyter notebooks as lessons for data science and Python teaching.
- **Scratch project slides** — Embed Scratch projects for block-based coding, ideal for younger learners.
- **Coding submission review** — Every learner code submission is saved; staff can list submissions per slide and open any individual submission.

### Quick Add & Bulk Content Upload

*Publish a whole course of files in minutes*

Two accelerators for content migration. Quick Add lets authors drop many files and links into a chapter at once — PDFs, docs, videos, audio, YouTube links, web links, code editors, notebooks and presentations — all published in one go. The Bulk Content Upload wizard ingests an entire zip or CSV manifest whose folder structure maps to Subjects, Modules and Chapters, previews the resulting course tree, then creates everything automatically — even across multiple courses in one upload.

**For:** Admin, Teacher · **Where:** Admin Web

- **Quick Add for chapters** — Drag in multiple files and links; each becomes a correctly-typed, auto-titled, instantly published slide.
- **Zip-based course import** — Upload a zip whose folders mirror your course depth (Subject/Module/Chapter); files inside become slides in the right place.
- **CSV manifest import** — Alternatively drive the import from a CSV listing titles, types and URLs, with built-in validation results and help.
- **Multi-course upload** — One zip can carry several courses at once, each in its own top-level folder.
- **Video-link list files** — Plain text files of YouTube or video URLs expand into individual video slides with sensible titles.
- **Preview and issue checking** — A preview tree shows exactly what will be created, with warnings for misplaced or skipped files before you commit.
- **Progress and results report** — Watch the import run step by step and get a results summary of everything created.
- **Sample zip download** — Download a sample zip that demonstrates the expected folder conventions.

### Drip Content & Prerequisites

*Unlock content by date, progress or prerequisites*

Control exactly when learners can access content. Drip rules apply at course, chapter or individual-slide level and unlock content on a calendar date, after completion thresholds, after specific prerequisite chapters or slides, or strictly in sequence. Learners see locked items with clear unlock requirements, guiding them through a structured path that unlocks automatically as they progress.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Date-based unlock** — Release a chapter or slide automatically on a chosen date and time.
- **Completion-based unlock** — Unlock content when a learner reaches a completion threshold, including averages over the last N items.
- **Prerequisite rules** — Require specific chapters or slides to be finished to a threshold before new content opens.
- **Sequential learning** — Force learners to complete the previous item before moving on.
- **Three levels of control** — Configure drip at whole-course, chapter or individual-slide level, each with its own dialog and enable toggle.
- **Locked badges and unlock requirements** — Locked items show a lock indicator in the course tree, and learners see exactly what they must complete to unlock the next piece of content.

### Certificates: Designer, Auto-Issue & Bulk Generation

*Design once — certificates issue themselves*

Design completion certificates visually with no designer needed: start from a template gallery, customize in a drag-and-drop editor or drop to HTML for full control, or upload your own PDF design and place data fields exactly where they belong. Certificates then issue automatically the moment a learner crosses the completion threshold — celebrated in-app with confetti, downloadable from the course page, and emailed with the PDF attached. Bulk generation personalizes hundreds of certificates at once from a batch or CSV.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Template gallery** — Start from professionally designed built-in certificate templates.
- **Visual drag-and-drop editor** — Design text, images and layout in a visual editor with a customization panel.
- **HTML mode** — Drop to full HTML editing for pixel-perfect branded certificates.
- **Upload your own PDF design** — Use an existing certificate design as the template by uploading it as a PDF.
- **Drag-and-drop field placement** — Place name, email and any custom CSV column onto the exact spot on the certificate with a visual field palette.
- **Student data from batch or CSV** — Pull learners from an enrolled batch or upload a CSV (with a downloadable template) and get validation results before generating.
- **Live per-student preview** — Preview exactly how any individual learner's certificate will look before generation.
- **Bulk generation and download** — Generate personalized certificates for a whole batch at once and download the PDFs plus a generation summary.
- **Auto-issue on course completion** — Certificates generate automatically with the learner's name and course details once completion passes the institute-set threshold.
- **In-app celebration, view and download** — A completion banner with confetti celebrates the milestone, and learners view and download their certificate from the course page.
- **Automatic certificate emails** — Every issued certificate is recorded and delivered to the learner by branded email with the PDF attached.

### Learner Home Dashboard

*Everything a learner needs on one personalized screen*

The learner's landing page brings together courses, live classes, tests, progress, attendance and announcements in one place. Institutes control exactly which widgets appear, so every brand shapes its own home experience — including a gamified 'Play' theme for younger audiences.

**For:** Learner, Admin · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **Continue Learning card** — One-tap resume that takes the learner straight back to the exact lesson slide they last studied.
- **Learning stats cards** — At-a-glance counters for enrolled courses, assigned tests and upcoming live sessions.
- **Upcoming live classes widget** — Today's and upcoming live sessions with join buttons, all converted to the learner's own timezone.
- **Weekly attendance widget** — The learner's live-class attendance for the week (present / absent / pending) right on the home screen.
- **Past learning insights** — A 7-day activity view with charts showing how much the learner studied recently.
- **Pinned announcements panel** — Institute announcements pinned by admins appear at the top of the dashboard.
- **Raise a query card** — Learners can raise a support query to the institute directly from the dashboard.
- **Gamification panel** — Streak counter, XP display, level progress ring and achievement badges appear when gamification is enabled.
- **Membership, books and orders widgets** — Optional widgets showing the learner's active membership, purchased books and materials, and order history.
- **Institute-configurable widget layout** — Admins choose per institute which dashboard widgets learners see, including alternative hero styles and a kid-friendly Play theme.
- **Terms acceptance prompt** — A first-login modal captures the learner's acceptance of the institute's terms and conditions.
- **Notifications preview** — Recent notifications listed on the dashboard with a link to the full notification center.

### Course Approval Workflow

*Teachers author, admins approve — quality stays controlled*

Require editorial review before courses go live. Teachers author courses or create an editable copy of a live course, submit for review, and can withdraw a submission. Admins get a pending-review dashboard where they approve or reject with full course history and an approval summary — so published content is always vetted, and the live version stays untouched until approval.

**For:** Admin, Teacher · **Where:** Admin Web

- **Teacher-authored courses** — Teachers create their own courses and track them in an authored-courses tab with detailed status.
- **Editable copies of live courses** — Teachers edit a safe copy of a published course; the live version stays untouched until approval.
- **Submit and withdraw for review** — Send a course for review or pull it back; an edit-permission check tells teachers when a course is locked.
- **Admin approval dashboard** — Admins see all courses pending review, open full review details, and approve or reject with reasons.
- **Approval history and summary** — Every course keeps an approval history, and a summary view shows the institute's review pipeline at a glance.
- **In-review protection** — Slides under review are guarded against conflicting edits.

### Content Copy & Reuse Across Batches

*Build once, reuse everywhere — with lineage tracking*

Copy whole course content between batches, sessions and courses, so new intakes start from proven material. The platform records copy lineage, showing where a batch's content originally came from, and copy or move is available at every level: course, session, subject, module, chapter and slide.

**For:** Admin, Teacher · **Where:** Admin Web

- **Copy whole course content** — Duplicate a batch's full content tree into another batch or course in one operation.
- **Copy lineage badge** — See the ancestry of copied content — which batch it was copied from — right on the course page.
- **Granular copy and move** — Copy or move individual subjects, chapters and slides between any location in the library.
- **Copy content during course creation** — Start a new course by copying content from an existing one via a guided dialog.

### SCORM Course Import

*Your existing SCORM e-learning works out of the box*

Institutes with existing e-learning content can upload SCORM packages as slides. The platform hosts and plays each package and records learner progress and completion back into the course, so legacy content plugs straight into the modern LMS.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web

- **SCORM package upload** — Upload a SCORM zip; it is unpacked, hosted and playable as a slide.
- **Progress tracking** — Learner sessions record SCORM tracking data, so scores and completion flow into course progress.
- **SCORM preview** — Authors preview the package inside the editor before publishing.

### Audio Lessons

*Podcast-style audio as first-class course content*

Upload audio files as slides for language drills, lectures or podcast-style lessons. Audio plays in a dedicated in-course player with progress tracked like any other slide, and follows the same draft-and-publish lifecycle as all content.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Audio upload and player** — Upload audio files which learners play in an in-course audio player with progress tracking.
- **Draft and publish for audio** — Audio slides follow the same draft/publish lifecycle as other content.

### Interactive Presentation & Whiteboard Slides

*Draw, present and teach on an infinite canvas*

Presentation slides open an infinite whiteboard canvas where teachers sketch diagrams, drawings and full slide decks. The same presentations can be used live through the presentation client, bridging course content and classroom teaching.

**For:** Admin, Teacher · **Where:** Admin Web, Engage Client

- **Whiteboard-style presentation editor** — Create presentation slides on a freeform drawing canvas with shapes, text and sketches.
- **Create presentations from the library** — Spin up a new interactive presentation directly from the study library for use in live teaching.

### Study Material File Library

*Organized folders of study docs with audience control*

Beyond courses, staff maintain a folder-based library of standalone study documents. Upload files or create study docs in-app, organize them into folders, and control whether each document is visible to learners, staff only, or both.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web

- **Folders** — Create, list and delete folders to organize study materials.
- **Upload or create study docs** — Upload existing files or author new study documents directly in the app, singly or in bulk.
- **Audience-based access** — Set each document's visibility to Learner, Admin or Both.

### Course Settings & Authoring Policies

*Institute-wide rules for how courses get built*

Define how course creation behaves across the institute: which detail fields are required, the default and fixed course depth, whether sessions and levels are used, default view mode, and how finished courses reach the public catalogue. Per-course settings panels add workflow automation triggers, sub-organization sharing, offer pricing defaults and external LMS connections.

**For:** Admin, Teacher · **Where:** Admin Web

- **Required-field policies** — Choose which course information fields are mandatory or enabled, from descriptions to banner images and promo media.
- **Structure defaults** — Set the default course depth, lock it institute-wide, enable or disable sessions and levels, and set the default view mode and outline state.
- **Catalogue publishing mode** — Decide whether finished courses go to the public catalogue automatically, manually, or with a prompt each time.
- **Learner creation permissions** — Optionally allow learners to create courses, and control whether payment, discount and referral options can be changed per course.
- **Per-course settings editor** — Override institute defaults for a single course through a dedicated settings panel.
- **Workflow triggers per course** — Attach automation workflows to course events (e.g. on enrollment) and manage the triggers from the course settings panel.
- **Sub-organization sharing** — Associate a course's batches with sub-organizations for franchise or multi-branch setups.
- **External LMS connections** — Connect a course to an external LMS — LearnDash, Moodle or any custom LMS — with a saved connection library and one-click connection tests; Vacademy's built-in LMS needs no setup.
- **Offer pricing and rounding defaults** — Configure offer pricing with automatic rounding rules for clean price points.

### Content Protection

*Keep your paid content from walking out the door*

Per-role content protection controls make it harder to copy or leak your study material. Configure protections separately for Admins, Teachers and Learners, control who may download slides and documents role by role, and rely on in-viewer protection plus a mobile privacy screen against screenshots.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Per-role protection profiles** — Enable protection rules separately for Admin, Teacher, Learner and other roles.
- **In-viewer copy protection** — Protect slide content from copying inside the study viewer.
- **Slide download control** — Decide role by role who may download slides and documents.
- **Mobile privacy screen** — The mobile app adds a privacy screen that guards content against screenshots.

---

## Assessments & Evaluation

*Every exam format — online, offline, OMR — with manual and AI grading*

A complete examination engine that takes institutes from question authoring to published results — online exams, mock tests, practice papers, homework, surveys and pen-and-paper tests all run on the same platform. Staff build papers from a rich question-type library or import them from Word, control exactly who takes each test, monitor exams live, and grade with manual tools or AI that evaluates handwritten answer sheets in minutes. Learners get a resilient exam experience on web, mobile and desktop, followed by detailed report cards with peer comparison and leaderboards.

### Assessment Creation Wizard

*Build any exam in four guided steps*

A step-by-step wizard walks staff through creating an assessment: basic details, questions and sections, participants, and access control. It supports multiple assessment types — Exam, Mock, Practice, Survey and Manual-Upload exams where learners submit files instead of answering on screen — each with tailored options. Assessments stay in draft until published, so nothing goes live by accident.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web

- **Five assessment types** — Choose between Exam, Mock test, Practice test, Survey, and Manual-Upload exam where learners submit PDFs, files or videos instead of answering on screen.
- **Basic details and instructions** — Name the assessment, link it to a subject, and write rich-text instructions participants see before starting.
- **Live date window** — Define the start and end date/time between which participants can begin and must finish.
- **Timed preview window** — Optionally give participants a timed preview to read the paper before the clock starts.
- **Automatic or manual evaluation** — Pick instant machine grading, or manual evaluation where teachers grade answer sheets.
- **Submission modes** — Choose auto-submit when time expires or manual submit by the learner; manual-upload exams accept PDF, file, live-recorded video or uploaded video submissions.
- **Result release policy** — Release results automatically after the exam ends, after each submission, or hold them for manual release.
- **Re-attempt settings** — Set a default re-attempt count and optionally let learners raise re-attempt requests for admin approval.
- **Extra-time requests** — Optionally let learners request more time during the exam, granted with admin consent.
- **Section switching control** — Allow or block participants from moving back and forth between sections during the attempt.
- **OMR mode** — Enable OMR-style answering for pen-and-paper tests whose responses are entered later.
- **Duration distribution** — Apply the time limit at whole-assessment level, per section, or per question.
- **Draft / publish lifecycle** — Assessments stay in draft while being built and publish only when ready; each wizard step tracks its own complete/incomplete status.
- **Public or private visibility** — Mark an assessment public (open to anyone via link) or private (restricted to selected learners).

### Rich Question Type Library

*Nine question types, from MCQ to live coding*

Author questions in a wide range of formats: single-correct MCQ, multiple-correct MCQ, true/false, one-word answer, long answer, fill-in-the-blank, match-the-following, numeric answer, and coding questions graded in the browser against test cases. Comprehension passages group related questions under one shared text, and every question supports formatted text, images and mathematical formulas.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web

- **MCQ — single correct** — Classic multiple choice with one correct answer.
- **MCQ — multiple correct** — Multiple-select questions with support for partial credit.
- **True / False** — Quick binary questions.
- **One-word answer** — Short free-text answers auto-checked against accepted words.
- **Long answer** — Essay-style subjective questions with an answer key for evaluators, graded manually or by AI.
- **Numeric answer** — Numeric questions with validation modes: single digit, any integer, positive integer, or decimal.
- **Fill in the blank** — Sentence-completion questions with inline blanks.
- **Match the following** — Pair items across two columns.
- **Coding questions** — Learners write source code in an in-exam editor; submissions run against test cases and return a verdict with per-test-case results.
- **Comprehension groups** — Attach a shared passage to sets of single-correct, multiple-correct or numeric questions.
- **Rich content everywhere** — Question text, options and explanations support formatted text, images and mathematical formulas.
- **Per-question evaluation mode** — Each question is marked for automatic or manual evaluation, so mixed papers grade the objective part instantly.

### AI Answer-Sheet Evaluation

*AI grades whole batches of answer sheets in minutes*

Upload scanned answer sheets and let AI do the grading: the system reads each PDF — including handwriting and math — extracts every answer, applies your marking rubric, and awards question-wise marks with written feedback. Evaluate one learner or a whole classroom in a single run, watch progress live, and review or override any AI mark before results go out. Evaluation time drops from days to minutes while teachers keep the final say.

**For:** Admin, Teacher, Evaluator · **Where:** Admin Web

- **Rubric management** — Create, edit and delete a marking rubric per assessment, down to individual questions, so the AI grades to your standard.
- **AI-drafted criteria and templates** — Ask AI to draft evaluation criteria automatically, or manage a library of reusable criteria templates.
- **Batch evaluation** — Select individual students or evaluate many at once, with live per-student status from pending through processing to completed.
- **Handwriting and math reading** — The AI reads scanned PDFs including handwritten answers and mathematical notation, rendering math properly in the review view.
- **Live progress tracking** — Watch each stage — PDF processing, answer extraction, criteria generation, grading, saving — with per-question statuses while evaluation runs.
- **Annotated answer sheets** — The reviewed PDF shows AI annotations and margin notes anchored to the learner's actual writing.
- **Per-student summaries with remarks** — Each student gets a consolidated score breakdown and written evaluation summary; evaluators can add their own remarks.
- **Human review and override** — Teachers review each AI-graded question and adjust marks before release; a badge flags answers graded before a rubric change.
- **Stop, retry and run history** — Stop a running evaluation, retry failures, and browse a history of every AI evaluation run per attempt with its status.
- **Evaluator AI quick portal** — A focused portal for teachers who just want papers checked: a trimmed two-step builder for subjective papers, a student roster, batch evaluation and a guided first-time tour.

### Manual Evaluation & Answer-Sheet Checking

*Grade answer sheets on screen, attempt by attempt*

A dedicated evaluation area lists every assessment awaiting grading and walks evaluators through attempts one learner at a time. Evaluators upload or view scanned answer sheets, annotate PDFs directly in the browser, award marks per question, and save partial work as drafts before final submission — with a built-in calculator and progress tracking along the way.

**For:** Admin, Teacher, Evaluator · **Where:** Admin Web

- **Evaluation queue** — Live, upcoming and past tabs of assessments with a participant sidebar showing who still needs grading.
- **Answer sheet upload** — Upload a learner's scanned answer sheet against their attempt for evaluation.
- **PDF annotation editor** — Mark up scanned answer sheets directly in the browser, with the ability to reset annotations before confirming.
- **Per-question marks entry** — Award marks question-by-question against the answer key and maximum marks, with totals computed automatically.
- **Built-in calculator** — A calculator overlay for totalling marks without leaving the sheet.
- **Evaluation drafts** — Save grading progress as a draft, resume later, or discard it.
- **Update marks and attempts** — Correct previously submitted marks at question or attempt level.
- **All-attempts view** — See every attempt of an assessment with its evaluation status in one list.
- **Evaluator progress tracking** — See pages reviewed, questions not yet visited, total marks awarded and time spent on each evaluation.
- **Quick checking setup** — Spin up a lightweight assessment with sections purely for answer-sheet checking, with AI-assisted publishing.

### Learner Exam Experience

*A serious exam hall on any device*

Learners take scheduled and practice assessments in a purpose-built exam interface with sections, multi-level timers, a question palette and auto-submission. Answers stream continuously to the server, so crashes and flaky networks lose nothing, and interrupted attempts can be resumed. The same experience runs on web, mobile and desktop apps.

**For:** Learner · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **Exam catalog with tabs** — Assessment lists organized into live, upcoming, past and attempted tabs, with search and pull-to-refresh.
- **Instructions and timed preview** — Learners see exam details, duration, marking information and instructions before starting; where enabled, a timed preview lets them read the paper before the attempt clock starts.
- **Question navigator and list view** — A palette showing answered, unanswered and marked questions with one-tap jumps, plus a scrollable full-paper list view.
- **Timers at every level** — Assessment-level, section-level and per-question countdowns with automatic submission at expiry.
- **Controlled section switching** — Multi-section papers where the institute decides whether learners may move between sections.
- **Autosave and network resilience** — Answers and time state stream to the server throughout the attempt, with a live network status indicator protecting learners on unstable connections.
- **Resume interrupted attempts** — If the app closes mid-exam, learners rejoin the running attempt and continue exactly where they were.
- **In-exam announcements** — Admin broadcasts reach learners mid-exam without interrupting the attempt.
- **Homework and file submissions** — Manual-upload assessments accept file, PDF or video submissions that learners mark complete.
- **Re-attempt and extra-time requests** — Where allowed, learners request another attempt or more time and admins approve from the monitoring console.
- **Attention tracking** — The exam screen records tab-switch and visibility events as part of the attempt data available to the institute.

### Live Exam Monitoring & Submissions Console

*Watch, extend, close and manage attempts in real time*

While an exam runs, staff see participants grouped into Attempted, Ongoing and Pending tabs with live counters, search and filters. Individual and bulk actions cover the whole exam-day toolkit: extend time, force-close submissions, remove participants, send reminders, grant re-attempts and release results.

**For:** Admin, Teacher · **Where:** Admin Web

- **Attempt status tabs** — Participants split into Attempted, Ongoing and Pending lists with a live summary strip and counters.
- **Increase time** — Add extra minutes to ongoing attempts, individually or in bulk.
- **Close submissions** — Force-submit ongoing attempts, individually or in bulk.
- **Grant re-attempts** — Give selected learners another attempt after they have submitted.
- **Remove participants** — Take pending participants off the exam roster in bulk.
- **Send reminders** — Nudge pending participants who have not started yet.
- **Release results** — Release results per learner, in bulk, or for the entire assessment when set to manual release.
- **Search and filters** — Find participants by name and filter each tab before applying bulk actions.

### Question Paper Bank

*A searchable, taggable library of reusable papers*

Every question paper lives in a central bank where staff can search, filter, favourite and reuse it across assessments. Papers are organised by level, subject and tags, and a public community bank lets institutes pull shared papers into their private collection with one click — protecting institute IP while making reuse effortless.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web

- **Create and edit papers** — Author papers question-by-question in the editor, edit titles and metadata later, and preview the full paper at any time.
- **Filters and search** — Filter the bank by level, subject and tags, search by name, and narrow by creation date range.
- **Favourites** — Star frequently used papers into a separate Favourites view.
- **Question tags** — Tag questions and papers for topic-wise organisation and retrieval.
- **Public question bank** — Browse a public community bank of shared question papers with the same filters.
- **Copy public papers to private** — One click imports a public paper into the institute's private bank for editing and use.
- **Archive papers** — Remove outdated papers from the active bank without touching past assessments.
- **Question selector** — Pick individual questions from existing papers when assembling a new assessment section.

### Word / DOCX Question Import

*Turn a Word file into a digital question paper*

Upload a question paper written in Microsoft Word and the platform converts it into structured digital questions automatically — options, correct answers, explanations, tags, images and mathematical formulas included. Simple markers tell the importer where questions, options and answers begin, comprehension passages come across intact, and a diagnostics view flags anything that could not be parsed.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web, API

- **One-click DOCX conversion** — Upload a .docx file and get back fully structured questions with options, answers and explanations, including multi-line question stems.
- **Configurable markers** — Tell the importer which identifiers your paper uses for questions, options and answers so almost any format can be parsed.
- **Question type auto-detection** — Based on the answer given, each question is classified automatically: single-choice MCQ, multiple-correct MCQ, numeric, one-word, or long-answer.
- **Comprehension passages** — Passage-based sets with sub-questions are imported with the passage attached to every sub-question.
- **Auto-marking setup** — Correct answers from the document become auto-evaluation rules, so imported papers are instantly auto-gradable.
- **Topic tags from the document** — Tag lines around a question are captured as subject tags on that question, deduplicated automatically.
- **Images and formulas preserved** — Embedded pictures, diagrams and equation images — including legacy Word formats — are converted to web-friendly formats and hosted so they render on any device.
- **Diagnostics and error reporting** — Questions that break the expected format are flagged with a specific reason, so staff fix problems before saving instead of silently corrupting the paper.
- **Preview before save** — Review and edit every imported question before the paper is added to the bank.
- **Downloadable format templates** — A library of template files shows the exact document format to follow before uploading.

### Sections & Marking Schemes

*Flexible sections with fine-grained marking rules*

Split any assessment into multiple sections, each with its own description, duration and marking rules. Marking is highly configurable — per-question marks, negative marking, partial credit, cutoff marks and question shuffling can all be set per section, with total marks calculated live as the paper is built.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web

- **Multiple sections** — Add, reorder, describe and delete sections; attach a different question paper or question set to each.
- **Marks per question** — Set default marks per question for a section, then fine-tune question-by-question with adaptive marking.
- **Negative marking** — Switch on negative marking per section and set how many marks are deducted for wrong answers.
- **Partial marking** — Award partial credit on multi-select questions where the learner gets some options right.
- **Cutoff marks** — Define a per-section cutoff score for pass and qualification decisions.
- **Question randomization** — Shuffle question order per participant to deter copying.
- **Section-wise duration** — Give each section its own time budget when duration is distributed by section or question.
- **Live total-marks calculation** — The builder totals marks across sections in real time so the paper always adds up.

### Participant Management & Open Registration

*Closed batch exams or open public tests*

Decide exactly who can take each assessment. Closed tests are assigned to selected batches or individual learners; open tests get a shareable public link and QR code with a custom registration form, so anyone can sign up — ideal for scholarship tests and lead-generation exams. Registration windows, form fields and participant lists are all under staff control.

**For:** Admin, Teacher, Counsellor, Learner, Parent · **Where:** Admin Web, Public Web

- **Closed tests by batch** — Assign the assessment to one or more batches so every enrolled learner is pre-registered.
- **Closed tests by learner** — Hand-pick individual learners from the institute roster.
- **Bulk batch registration** — Register whole batches to an assessment in one operation.
- **Open public tests with link and QR** — Generate a public join link and downloadable QR code so anyone can register and take the test.
- **Custom registration form** — Build the open-registration form with text and dropdown fields, mark fields required, and drag to reorder them.
- **Registration window** — Set registration open and close dates independently of the exam window, plus registration instructions.
- **Public assessment page** — Every open assessment gets a shareable page, addressed by a short code, showing the exam name, schedule and instructions where prospects self-register instantly.
- **Participant status check** — Registrants can look up whether their registration and attempt are confirmed.
- **Registered participants list** — View, filter and export everyone registered, including their registration source: admin pre-registration, batch, or open link.
- **Expected participants** — Record expected participant counts for planning open tests.

### Learner Results & Report Cards

*Rich post-exam reports learners can download*

After results release, learners get a detailed report: score breakdown, peer comparison, leaderboard position, and how the rest of the cohort answered each question. Reports download as formatted PDFs, or as AI-narrated report cards with written feedback on the attempt.

**For:** Learner, Parent · **Where:** Learner Web, Learner Mobile App

- **Report list and detail** — Learners see all their assessment reports and open question-wise detail for any attempt.
- **Peer comparison** — Compare personal performance against batch averages and toppers.
- **Leaderboard** — Where enabled by the institute, learners view the assessment leaderboard.
- **Option distribution** — See what percentage of peers picked each option on every question.
- **PDF report download** — Download the report as a formatted PDF.
- **AI report card** — Generate an AI-written PDF report with narrative feedback on the attempt.

### Re-evaluation Engine

*Regrade anything after marking-scheme changes*

If an answer key or marking rule changes after the exam, staff trigger re-evaluation at any granularity: the entire assessment, selected participants, or specific participants on specific questions. Every evaluation change is recorded in an audit log for accountability.

**For:** Admin, Teacher, Evaluator · **Where:** Admin Web

- **Full assessment re-evaluation** — Regrade every attempt of the assessment in one action.
- **Participant-level re-evaluation** — Regrade only the selected learners' attempts.
- **Question-wise re-evaluation** — Regrade chosen questions for chosen participants — ideal after an answer-key correction.
- **Evaluation audit log** — A per-assessment log records manual evaluation and regrade events for accountability.

### Offline / OMR Response Entry

*Digitise pen-and-paper exam responses fast*

For exams conducted on paper, staff enter learner responses into the platform afterwards and get the full digital stack — grading, leaderboards and reports — as if the exam were online. Entry works question-by-question or in a fast spreadsheet-style table view.

**For:** Admin, Teacher · **Where:** Admin Web

- **Create offline attempts** — Pick a learner and create an attempt on their behalf for the offline exam.
- **Question-by-question entry** — A question navigator with a response form for careful data entry, rendering the original rich question content.
- **Table entry mode** — A spreadsheet-like grid to enter many responses quickly.
- **One-shot create-and-submit** — Create the attempt and submit all responses in a single step.
- **Automatic grading of entered data** — Entered responses are graded by the same engine, feeding results, ranks and analytics.
- **Institute-level offline entry setting** — Turn manual marks entry for offline and paper assessments on or off across the institute.

### Surveys & Feedback Forms

*Collect and analyse responses like a survey pro*

The same builder powers unscored surveys: send questionnaires to batches or the public and analyse results in a dedicated dashboard. Staff view aggregate distributions per question, drill into individual respondents, and export the respondent list.

**For:** Admin, Teacher, Counsellor, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Survey builder** — Create surveys with the standard question types, sections, open or closed distribution and custom registration forms — with marking hidden since surveys are unscored.
- **Survey overview analytics** — Per-question response distributions with charts and completion metrics.
- **Question-wise responses** — Inspect all answers to a single question across respondents.
- **Respondent-wise view** — Open one respondent and read their entire submission.
- **Respondent exports** — Export the respondent list as CSV or PDF.
- **Survey access control** — Separate staff access lists for survey creation, live notifications, submissions and reports.

### Question Paper Export & Printing

*Print-ready papers with your formatting rules*

Export any question paper or assessment as a print-ready PDF for offline exams. Layout, typography and answer-space options are configurable, and multiple paper sets can be produced for anti-cheating distribution in exam halls.

**For:** Admin, Teacher · **Where:** Admin Web

- **Print settings** — Control layout, font size and whether images keep their aspect ratio.
- **Custom header fields** — Add custom input fields such as name and roll number, plus an optional question-set code, to the printed paper.
- **Answer spacing** — Configure blank answer space under each question for written exams.
- **Multiple paper sets** — Generate several sets of the same paper for anti-cheating distribution in exam halls.
- **Preview and export** — Preview the final formatted paper on screen before downloading the PDF.

### Exam Notifications & Reminders

*Automatic alerts to learners and parents*

The platform notifies participants — and optionally their parents — at every stage of an assessment: when it is created, shortly before it goes live, the moment it starts, and when reports are ready. Scheduled jobs send these automatically across email, WhatsApp and push, and staff can fire manual reminders to learners who have not attempted yet.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Learner notifications** — Opt-in notifications when the assessment is created, before it goes live with a configurable lead time, when it goes live, and when the report is generated.
- **Parent notifications** — The same notification set can be sent to parents independently of learners.
- **Automated scheduling** — An hourly scheduler sends upcoming and started notifications without any manual work.
- **Manual reminders** — Select pending participants who have not attempted and send them a reminder in bulk.
- **Multi-channel delivery** — Notifications go out over email, WhatsApp and push notifications.
- **Result notification recipients** — Configure which recipients — learner, parents, staff — are notified when results release.

### Assessment Access Control & Collaboration

*Decide which staff can create, watch and grade*

Per-assessment permissions let institutes split duties across the team. Separate access lists control who can edit the assessment, who gets live-exam alerts, who can see submissions and reports, and who participates in evaluation — assigned by role or by inviting individual staff.

**For:** Admin, Teacher, Evaluator · **Where:** Admin Web

- **Creation access** — Grant specific roles or users the right to edit the assessment setup.
- **Live notification access** — Choose who is alerted while the exam is running.
- **Submission and report access** — Control who can open submissions and analytics for each assessment.
- **Evaluation access** — Assign the evaluators allowed to grade answer sheets.
- **Invite institute users** — Search existing staff by role and add them to any access list; filter and revoke invitations.

### Assessments & Quizzes Inside Courses

*Full tests and instant quizzes in the course flow*

Embed a complete test from the assessment engine into any course chapter — link an existing assessment or create a new one without leaving the course editor — and review learner submissions right beside the content. Chapter quizzes give learners timers, attempt limits, instant scorecards and a full answer-review mode.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Link existing assessment** — Place any assessment already built in the institute as a slide in the course.
- **Create assessment in place** — Open a create-assessment form from within the course editor and attach the new test immediately.
- **Submissions panel** — Review learner attempts and results for the embedded assessment directly from the slide view.
- **Quiz timer with warnings** — Countdown timer with an on-screen warning; the quiz auto-submits when time expires.
- **Attempt limits** — Cap re-attempts per quiz; once attempts are exhausted the learner moves to review mode.
- **Instant scorecard** — A score summary appears immediately after submission.
- **Answer review mode** — Learners revisit each question to see their answer, the correct answer and explanations.
- **Attempt history** — Past attempts are stored and viewable, so learners can track improvement.

### Assessment & Homework Organization

*Every test and homework organised by status at a glance*

The assessments home organises everything into Live, Upcoming, Previous and Draft tabs with search, filters and per-row quick actions. A dedicated homework area gives the same status-based view for homework tests, with creation running through the standard wizard pre-set to homework mode.

**For:** Admin, Teacher · **Where:** Admin Web

- **Status tabs** — Live, Upcoming, Previous and Draft tabs keep the assessment list manageable.
- **Filters and search** — Filter by batch, subject and other attributes; search assessments by name.
- **Quick actions menu** — Per-assessment menu for editing, viewing details and submissions, exporting the paper, and deleting.
- **Detail tabs** — Each assessment opens into Basic Info, Questions, Participants, Access Control and Submissions tabs, including a learner-view preview of the paper.
- **Homework list with status tabs** — Browse homework tests split into upcoming, live and past states with per-tab counts, search and filter chips.
- **Create homework via wizard** — Launch the multi-step assessment creation flow pre-set to homework mode, with schedule details and quick actions on every item.

---

## Live Classroom

*Schedule, teach and engage live — built-in classroom or Zoom/Meet*

Everything an institute needs to run live teaching at scale: schedule one-time or recurring classes in minutes, host them on the built-in classroom or the platforms you already use (Zoom, Google Meet, Zoho, YouTube, custom links), and keep learners inside your branded app from waiting room to replay. Volt, the built-in live presentation studio, turns every lecture into an interactive show with polls, leaderboards, whiteboards and an AI co-pilot. Attendance, recordings and post-class feedback are captured automatically, so nothing about a class needs manual follow-up.

### Live Class Scheduling

*One-time or recurring live classes, scheduled in minutes*

A guided two-step wizard schedules live classes across batches — one-time sessions or weekly recurring series with per-day timings, subjects, rich descriptions and cover images. Classes can be bulk-imported, saved as drafts, previewed exactly as learners will see them, and rescheduled or cancelled with automatic learner notifications.

**For:** Admin, Teacher · **Where:** Admin Web

- **Two-step scheduling wizard** — Step one sets class basics — title, subject, description, platform and timing; step two adds participants, registration options and notifications before publishing.
- **One-time and weekly recurring classes** — Schedule a single class or a weekly repeating series with an end date; each weekday can carry multiple sessions with its own start time, duration and link.
- **Per-day class configuration** — In recurring schedules, each day of the week can have its own class link, name, thumbnail and custom learner action button.
- **Timezone-aware scheduling** — Every class is scheduled in an explicit timezone, so institutes with learners in multiple regions always see correct local times.
- **Bulk scheduling via CSV import** — Upload a spreadsheet to create many classes at once, with a validation grid to review and fix rows before submitting.
- **Draft classes** — Save partially configured classes as drafts and finish them later from a dedicated Drafts tab.
- **Live / Upcoming / Past / Drafts session list** — One list of all classes filtered by state, with search and pagination.
- **Calendar view** — See every scheduled class on a calendar for quick visual planning.
- **Class preview** — Preview exactly what learners will see for a scheduled class before it goes live.
- **Custom learner action button** — Add a fully branded button — custom text, URL and colors — to the learner's class card, such as 'Download worksheet' or 'Join WhatsApp group'.
- **Cancel with learner notification** — Delete single occurrences or whole series and optionally notify enrolled learners automatically.
- **Class cover, thumbnail and waiting-room music** — Attach a cover image, thumbnail and background audio track that plays in the waiting room for a polished pre-class experience.
- **Search and audit trail** — Search across all sessions, and review each class's log of actions — created, starting, started, rescheduled — for accountability.

### Meeting Platform Integrations

*Zoom, Google Meet, Zoho, YouTube or any link — your choice*

Connect the video platforms your institute already uses and let Vacademy create meetings automatically. Zoom (with multiple accounts), Google Meet, Zoho Meeting, YouTube live streams and any custom meeting link are all supported, and entire recurring series are provisioned in the background with retry protection. Recordings and attendance flow back automatically via provider webhooks.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, API

- **Multi-account Zoom** — Connect several Zoom accounts, set a default, test each connection, and pick which account hosts each class.
- **Full Zoom meeting controls from inside Vacademy** — Configure waiting room, join-before-host, required Zoom login, registration approval, alternative hosts, mute on entry, host and participant video, audio mode (computer, telephony or both), automatic cloud or local recording, breakout rooms, focus mode, multi-device join and identity watermark — all while scheduling.
- **Google Meet integration** — Connect one or more Google Workspace accounts via secure Google sign-in, set a default, test the connection and auto-create Meet links for classes; disconnect access at any time.
- **Zoho Meeting integration** — Connect Zoho via secure sign-in; meetings, attendance and recordings sync automatically on a schedule.
- **YouTube live and custom links** — Paste a YouTube live URL or any meeting link — Teams, Webex and more — when you prefer to manage meetings yourself.
- **Automatic meeting provisioning for series** — When a recurring class is created, meetings for every occurrence are created in the background, with a provisioning status view, a manual 'provision now' action and automatic retry.
- **Host and participant links kept separate** — Presenter-only start URLs are stored apart from learner join URLs, so hosts always get host privileges and learners never do.
- **Personalized participant join links** — Join links tied to each participant's real name give you accurate in-meeting rosters and attendance.
- **Schedule conflict check** — Before scheduling, check whether a host account is already booked at the requested time — for a single slot or across a whole recurring series.
- **Provider webhooks** — Zoom and Google Meet events such as meeting ended and recording ready flow back into Vacademy automatically, keeping recordings and attendance current.

### Built-in Video Classroom

*A full virtual classroom with zero external accounts*

Vacademy ships its own hosted virtual classroom, so institutes can run live classes without buying Zoom or Meet licenses. Rooms are created automatically at class time with whiteboard, webcam, screen share and recording, and Vacademy manages the classroom servers behind the scenes for reliability.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **One-click rooms, no account needed** — Choose the built-in classroom when scheduling and the room is created automatically — no license, link pasting or setup.
- **Recording controls** — Per-class toggles to record the session and to auto-start recording the moment class begins.
- **Moderator controls** — Mute all participants on join, restrict webcams so only the host is on camera, and set a guest policy — always accept, ask moderator, or always deny.
- **Personalized learner join** — Learners join with their real name and identity so the in-class roster and attendance are accurate; guests get their own supervised join flow.
- **Automatic attendance from the classroom** — When class ends, the classroom reports who attended and for how long, and attendance is recorded automatically.
- **Recordings archived to your library** — Classroom recordings are processed and uploaded to secure cloud storage so learners can rewatch them later.
- **Managed classroom server fleet** — Vacademy operates a pool of classroom servers with capacity and scaling controls, so classes stay smooth even at peak hours.

### Volt — Live Presentation Studio

*Build interactive presentations with AI in minutes*

Volt is Vacademy's built-in presentation tool for teachers. Create decks on an infinite whiteboard-style editor, import existing PowerPoint files with layouts intact, or have AI generate a complete presentation — slides plus quiz questions — from just a topic. Every deck can then be presented live to an interactive audience.

**For:** Admin, Teacher · **Where:** Admin Web, Engage Client

- **Presentation library** — Create, search, edit, duplicate and delete presentations, each with its own title, description and cover.
- **Whiteboard-style slide editor** — Slides are drawn on a free-form canvas — freehand drawing, shapes, text, images and diagrams — with a slide list for reordering.
- **Rich slide types** — Title, text, blank canvas, text-plus-media, fullscreen media, web link, quiz, feedback and interactive-video slides in one deck.
- **Quiz and feedback slides** — Embed live questions directly into the deck — single and multi-select multiple choice, true/false, one-word, numeric and long-answer formats — plus open feedback prompts.
- **AI presentation generation** — Type a topic, pick a language and AI model, and get a complete deck of designed slides with auto-generated quiz questions, ready to edit.
- **AI slide regeneration** — Regenerate any individual slide with AI when it needs a fresh take.
- **PowerPoint import** — Import existing PPT and PPTX files; each slide becomes its own fully editable whiteboard scene, keeping deck order and per-slide backgrounds.
- **High-fidelity slide conversion** — Shapes, text boxes, images, tables, connectors and grouped objects are recreated as native editable elements, with fonts, colors, alignment and positions carried over.
- **Public share link** — Share a read-only public link so anyone can flip through a presentation without logging in.
- **Session history per deck** — Every live run of a presentation is kept in history with its participants and results, available long after the session ends.

### Volt Live Sessions — Presenter Cockpit

*Present live with polls, leaderboards and an AI co-pilot*

Start any Volt deck as a live session and the audience joins instantly from any browser with a short code — no account or install required. Slides sync to every participant's screen in real time, responses stream into the presenter's dashboard as they arrive, and an AI co-pilot suggests slides based on what the teacher is actually saying. Sessions run reliably for hours with automatic reconnection, built for audiences of hundreds.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Engage Client, Public Web

- **Start live with a join code** — One click generates a short invite code; enrolled learners and guests alike join from any browser by entering the code and a name — codes auto-uppercase and Enter submits, so entry takes seconds.
- **Session rules and gamification settings** — Per-session switches for joining mid-session, showing results on the last slide, learner hand-raise, chat, session recording, default seconds per question, attempts allowed per learner, points per correct answer and negative marking with a configurable penalty.
- **Real-time slide control and sync** — Move forward, back or jump to any slide and every participant's screen follows instantly, with heartbeats and automatic reconnection keeping late joiners and flaky networks in step.
- **Waiting room** — Participants who join early sit in a waiting room and are pulled in automatically the moment the presenter begins.
- **Live participant roster** — See who is in the room in real time, with heartbeat-based presence so drop-offs are immediately visible.
- **Live response views** — Watch answers arrive as an overlay, open a response-distribution chart per question, view text answers as a word cloud, and drill into a per-slide list of every participant's response with correctness.
- **Live leaderboard with CSV export** — A points leaderboard updates throughout the session, can be shown to the room, and exports to CSV afterwards.
- **Quick question on the fly** — Fire an instant poll or quiz question mid-session without leaving the presentation — AI helps prepare it in seconds.
- **Insert and annotate slides mid-session** — Drop a new slide — including a new question — into a running session at any position, and draw over the current slide with a live annotation overlay; changes appear for all participants immediately.
- **Automatic answer checking** — Objective answers are evaluated against the answer key the moment they arrive; open-ended answers are flagged for review.
- **AI-assisted evaluation** — AI can help evaluate free-text responses that a simple answer key cannot judge.
- **Session audio recording** — Record the presenter's audio with pause and resume, a live duration indicator, and download as WebM or MP3.
- **AI slide recommendations from speech** — The AI listens to what is being taught and periodically suggests ready-made summary slides and a feedback question the presenter can insert with one click.
- **Live transcript** — A transcript of the class audio is generated in the background and can be viewed during or after the session.
- **AI summary email on finish** — On ending, optionally transcribe the recording, generate a session summary and email each participant a personalized report including every question and the answer they gave.
- **Marathon-length sessions** — Sessions support hours of continuous streaming and are built for hundreds of simultaneous participants.

### Engage — Live Polls, Quizzes & Leaderboards

*Turn passive listeners into active competitors*

Polls, graded MCQs, speed quizzes, word clouds and real-time leaderboards embed directly into live-class slides, with every response scored the moment it arrives. Engage runs natively in the browser or layers on top of an existing Zoom, Google Meet or built-in classroom call, and pushes all scores into learner report cards automatically.

**For:** Admin, Teacher, Learner · **Where:** Engage Client, Learner Web, Learner Mobile App

- **Polls, MCQs and short answers as slide types** — Quick opinion polls, graded single and multi-select MCQs, one-word, numeric and short-answer questions live inside the deck, so lecture and assessment mix without breaking flow.
- **Speed-quiz mode** — Time-boxed questions where answering faster earns bonus points.
- **Per-question timers** — Mix quick speed rounds, longer thoughtful MCQs and untimed polls within a single deck.
- **Real-time leaderboard** — Ranks update after every question with animated position changes; names can be hidden for privacy or shown for gamification, and standings can persist across the week or month.
- **Word cloud and sentiment polls** — Open-text answers render as a live word cloud for recaps, brainstorms and sentiment checks.
- **Auto-grading with report-card push** — In-class scores flow into learner report cards and analytics, and can trigger automations such as remedial content, top-performer cohorts or parent digests after class.
- **Hand-raise and moderated chat** — Configurable raise-hand, public chat and a private mentor channel let moderators surface the best questions.
- **Layer on Zoom, Meet or the built-in classroom** — Run slides and interactions on top of an existing video call — no platform migration needed.
- **Reconnect-safe session state** — The current slide, timers and scores live on the server, so refreshes, network blips and mobile suspends lose nothing.

### Interactive Whiteboard

*Sketch, annotate and teach together in real time*

A shared infinite canvas inside every live class for diagrams, math, brainstorms and slide annotation. Multiple participants can draw together with live cursors, the board survives disconnects, and the finished canvas can be saved straight back into the course for replay.

**For:** Teacher, Learner · **Where:** Engage Client, Learner Web

- **Infinite canvas toolkit** — Shapes, text, freehand pen, arrows, images, sticky notes, frames and group selection on an unbounded canvas.
- **Multi-user drawing with presence** — Multiple participants draw with live cursors; choose teacher-only mode, full collaboration, or invite specific learners to the board.
- **LaTeX and code blocks** — Live-rendered math formulas, syntax-highlighted code and chemistry diagrams — built for real subjects.
- **Annotate any slide** — Drop the whiteboard layer onto any slide; replays show exactly what was drawn over what.
- **Save back into the course** — One click converts the end-of-class canvas into a new slide attached to the chapter.
- **Reconnect-safe server state** — Network blips, mobile suspends and refreshes reconnect everyone to the exact same canvas.

### In-App Class Experience

*Learners attend class inside your branded app*

Classes open embedded inside the learner app instead of bouncing learners to another website. YouTube streams play in a distraction-free player with institute-controlled playback rules, Zoom classes run in-browser without the Zoom app, and teachers can host Zoom right from the admin portal.

**For:** Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Embed or redirect, per class** — Choose whether each class opens inside the app or redirects to the meeting platform.
- **Embedded YouTube live player** — YouTube live streams play in-app with institute-controlled restrictions — allow or block pausing and rewinding to keep everyone at the live edge.
- **Zoom in-browser player for learners** — Learners join Zoom classes directly in the browser or app with no Zoom install, and the meeting passcode is handled automatically.
- **Host Zoom from the admin portal** — Teachers start and run their Zoom class as host from a dedicated full-screen page inside the admin dashboard.
- **Zoho embedded player and Google Meet launcher** — Zoho classes embed in-app, and Google Meet classes open through a streamlined launcher.
- **Simulated live (pre-recorded) classes** — Schedule a pre-recorded video to 'go live' at a set time — learners experience it as a live class, with play, pause and rewind rules enforced by the institute.

### Learner Live Class Hub

*Every class, recording and reminder in one place*

Learners get a dedicated live-class home showing today's and upcoming classes grouped by date, with times auto-converted to their timezone and one-tap join buttons that route them correctly to the waiting room, embedded player or external platform. Past classes appear in list and calendar views with recordings ready to replay, and public sessions welcome guests too.

**For:** Learner, Parent · **Where:** Learner Web, Learner Mobile App, Learner Desktop App, Public Web

- **Date-grouped schedule in local time** — What's live now and what's coming next, with class cards showing time, subject and thumbnail — times auto-converted to the learner's timezone.
- **One-tap multi-provider join** — Join buttons route learners correctly — waiting room, embedded player or external platform — for Zoom, Google Meet, Zoho, YouTube live and the built-in classroom.
- **Past classes with recordings** — Browse past sessions in a list or calendar view and replay their recordings in the in-app player.
- **Default class link cards** — Recurring classes surface the day's default class card, so learners always know where today's class happens.
- **Custom action buttons** — Institute-configured buttons — worksheets, WhatsApp groups and more — appear on class cards where enabled.
- **Post-class feedback prompts** — After class, learners are guided to the feedback form when the institute has enabled it.
- **Guest join links** — Non-enrolled guests join open sessions via public links, with an embed mode for external websites and their own waiting room.
- **Public live-class registration pages** — Shareable registration pages for open live classes with a registration form, email verification and a session countdown — a lead-generation tool for webinars.

### Waiting Room & Pre-Join

*A branded countdown lobby before every class*

Learners who arrive early land in a branded waiting room with a live countdown, class details and background music, then flow into class the moment it opens. Institutes control how early the room opens, can set a last-entry cutoff, or switch to a direct pre-join mode that skips the lobby entirely.

**For:** Learner · **Where:** Learner Web, Learner Mobile App

- **Configurable open time** — Set how many minutes before the start time the waiting room opens for each class.
- **Live countdown timer** — A real-time countdown to class start keeps early arrivals informed and engaged.
- **Background music** — Play an institute-selected background score in the waiting room; custom waiting-room media can be set per schedule.
- **Waiting room or direct pre-join** — Choose between a classic waiting-room screen or a pre-join mode where learners enter the live class directly during the pre-class window.
- **Last-entry cutoff** — Optionally set a last entry time after which late learners can no longer join the class.
- **Attendance from the lobby** — Joining from the waiting room automatically marks the learner present and logs the join.

### Attendance Tracking & Reports

*Live classes record their own attendance*

Attendance is captured automatically the moment learners join, enriched with join and dwell data synced from Zoom, Zoho and the built-in classroom, and backed by manual and bulk marking for corrections. Rich reports break attendance down by session, batch and individual learner over any date range, and attendance events can trigger notifications and automations.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Automatic attendance on join** — Learners are marked present the moment they join a class from the app, including guests on public sessions.
- **Sync from meeting platforms** — Zoom participant reports, Zoho session data and built-in classroom analytics are pulled automatically to record who attended and for how long.
- **Threshold-based marking rules** — Grace periods, dwell time and join rules mark learners present, late or absent automatically, including across recurring cohorts.
- **Manual and bulk marking by staff** — Teachers mark or correct attendance for individuals or whole lists in one action from an attendance-marking table.
- **Per-occurrence attendance for recurring classes** — Recurring series can count attendance per occurrence, so every class day is tracked separately.
- **Session-wise and batch-wise reports** — View attendance for one session or across a batch, with filters, pagination and date ranges.
- **Individual learner report** — Pull one learner's attendance across a batch for any date range — ideal for parent conversations.
- **Guest attendance tracking** — Public-session guests have their attendance recorded against their registration for follow-up.
- **Attendance notifications and summaries** — Optionally notify learners and parents when attendance is marked, with customizable messages and branded WhatsApp, email or dashboard summaries — no exports needed.
- **Attendance-triggered automations** — Fire WhatsApp nudges on missed-class streaks, alert mentors, unlock assessments at an attendance threshold, or start CRM workflows on drop-off.
- **Audit-ready records** — Versioned attendance records with timestamps and device information support accreditations and compliance reviews.

### Class Recordings Hub

*Every class recorded, archived and replayable*

Recordings from Zoom, Google Meet, Zoho and the built-in classroom are collected automatically after each class and archived to the institute's secure cloud storage, safe from provider retention limits. Learners replay past classes from their app, while admins control retention, cleanup and re-sync.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Automatic recording sync** — Zoom cloud, Google Meet and Zoho recordings are pulled automatically on a schedule and attached to the right class occurrence.
- **Archive to institute cloud storage** — Recordings are copied from the meeting provider into Vacademy's storage so they survive provider retention limits, with a manual sync-to-storage action available.
- **Built-in classroom recording upload** — Recordings from the built-in classroom are processed and uploaded automatically after class ends.
- **Learner replay** — Learners browse past sessions in list and calendar views and play recordings in an in-app player.
- **Recording expiry and cleanup** — Per-recording expiry dates with automatic cleanup keep storage costs controlled.
- **On-demand re-sync** — Admins trigger an immediate recordings sync for any class if a recording hasn't appeared yet.

### Post-Class Feedback

*Structured learner feedback after every class*

Configure a feedback form per class and learners are prompted to rate the session the moment it ends. Institutes choose the questions, star scales and whether feedback is skippable, then review every response in a searchable inbox with statistics and CSV export.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Configurable feedback forms** — Enable feedback per class and compose questions — star ratings with custom scales and optional half-stars, plus text answers — each optional or mandatory.
- **Compulsory or skippable** — Decide whether learners can skip the form or must submit feedback before moving on.
- **Learner feedback page** — A clean, mobile-friendly form with star ratings and comments shown to learners after class.
- **Feedback inbox with search and filters** — Browse all feedback with search, date-range presets, subject filters and multi-select filtering.
- **Feedback statistics** — Per-session statistics summarize ratings so teaching-quality trends are visible at a glance.
- **CSV export** — Export feedback data to CSV for further analysis or reporting.
- **Institute-wide defaults** — Set default feedback questions and behavior once in settings; new classes inherit them.

### Live Class Settings & Defaults

*Set your live-class policies once, apply everywhere*

An institute-level settings panel defines the rules every new live class inherits — allowed platforms, waiting-room and registration policy, Zoom and built-in classroom presets, recording and transcription behavior, reminder timings and notification channels. It also controls exactly which recording and material features learners see.

**For:** Admin, Teacher · **Where:** Admin Web

- **Allowed streaming platforms** — Control which platforms — Zoom, Google Meet, Zoho, YouTube embeds, the built-in classroom — teachers can schedule classes on.
- **Waiting room and registration policy** — Choose always accept, manually approve, automatically approve or always deny guests — or require no registration at all.
- **Scheduling and recurring defaults** — Defaults for weekly recurring schedules, per-day default class links, daily attendance counting and the class description field.
- **Zoom presets** — Institute defaults for recording destination (cloud, local or off), audio mode, waiting room, join-before-host, required login, entry muting, video states, breakout rooms, focus mode, multi-device join and watermark.
- **Built-in classroom presets** — Defaults for recording, auto-start recording, mute on join and host-only webcams.
- **Recording transcription** — Automatically transcribe class recordings.
- **Class reminder timing** — Pick reminder timing — 5, 10, 30 minutes or 1 hour before class, or none.
- **Notification channel defaults** — Default channels (email, WhatsApp, push, in-app) and moments (on create, on live, on attendance) for class notifications.
- **Feedback defaults** — Enable feedback forms and compulsory feedback by default, with institute-wide default questions.
- **Default custom action button** — Add your own call-to-action button on the class screen by default, such as 'Download worksheet'.
- **Learner display controls** — Toggle what learners see — the custom action button card, recording processing options, adding recordings to courses, and the class materials section.
- **Class description and course connection** — Standardize class descriptions and connect live sessions to course content.
- **Default timezone** — One institute timezone applied to all new live-class schedules.

### Volt Public Site & Self-Serve Signup

*Volt sells itself — landing, pricing and signup built in*

Volt ships with its own polished public presence: an animated landing page with live feature demos, a transparent multi-currency pricing page, and a self-serve signup funnel that takes a visitor from first look to a working workspace in minutes. Anyone with a session code can also jump straight into a live session from these pages — no account or install required.

**For:** Admin, Teacher, Counsellor, Learner, Parent · **Where:** Public Web, Admin Web, Engage Client

- **Animated product landing page** — A responsive, animation-rich page that walks visitors from a bold hero pitch through features and use cases to a closing sign-up banner, with a sticky navigation header and footer quick links.
- **Live animated feature demos** — Eight self-playing demos show Volt working before signup — audience quizzing from a phone, AI deck generation from a prompt, live analytics and leaderboards, audio transcription, real-time recommendations, the whiteboard editor, PowerPoint import and auto-sent session summaries.
- **Use-case storytelling for educators and trainers** — A tabbed section pitches Volt separately to educators — live polls, formative checks, flipped classrooms — and to corporate trainers — energized workshops, onboarding comprehension checks, instant all-hands feedback.
- **Join a live session by code** — A front-and-center join box and a compact header popover let anyone enter a session code — auto-uppercased, Enter to submit — and land in the live participant experience with no login or download.
- **Three-tier pricing lineup** — Free, Pro and Business plans compared side by side with per-plan feature checklists, a highlighted Most Popular tier, and tier-appropriate calls-to-action from Start for Free to Contact Sales.
- **Monthly / yearly billing toggle** — Flip all plan prices between monthly and yearly rates, with yearly savings flagged and the effective billed-per-year total shown under each paid plan.
- **Multi-currency price display** — A currency selector instantly re-renders all prices in US Dollars, Indian Rupees, Euros or British Pounds with the correct symbol.
- **Self-serve signup funnel** — Every call-to-action drops visitors into the guided signup and onboarding wizard with learning and assessment modules pre-enabled, while a persistent Sign In shortcut serves returning users.

---

## CRM, Sales & Admissions

*Capture every lead, empower counsellors, convert admissions*

An education-native CRM that takes every enquiry from first click to enrolled student. Capture leads from your website, ads, forms, walk-ins and spreadsheets into one auto-scored, auto-routed pipeline; give counsellors a focused workbench with SLA clocks, follow-up queues and complete lead histories; and run enquiries, applications, admissions and bookings on the same platform that teaches your students. Built for institutes — parents and children, demo classes, batches and counsellor pools come standard, not as workarounds.

### Lead Capture Campaigns & Forms

*Capture every lead from every source into one pipeline*

Build lead-capture campaigns with custom forms in minutes and share them anywhere — as public links, website embeds, QR-friendly pages or API endpoints. Leads from website forms, ad platforms, form vendors, walk-ins and staff entries all land in one pipeline, deduplicated automatically, with each campaign keeping its own response list. Confirmation emails and team notifications fire the moment a lead arrives.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web, API

- **Campaign builder** — Create campaigns with a name, type (Website, Google Ads, Social Media or custom), objective (lead generation, event registration, course inquiry, demo request, newsletter, webinar, contact-us or custom), start/end dates and status.
- **Custom form fields** — Attach any set of custom fields to a campaign's form, rendered in your chosen order and grouping with required-field validation. Every field becomes a filterable column in the lead list.
- **Shareable public form link** — Every active campaign has a no-login public form showing the campaign's name and context — ideal for ads, WhatsApp, QR codes and social bios. Submissions become leads instantly.
- **Website embed widget** — Generate embed code as a customizable button-plus-popup (text, colors, border radius, popup title) or a direct iframe with configurable size, with live preview.
- **API integration kit** — A built-in dialog generates ready-to-use API commands and documentation so Zapier, Make or custom apps can push leads into any campaign.
- **Ad-platform and form-vendor intake** — Bring in leads from Meta (Facebook/Instagram) Lead Ads, Google Lead Form Extensions and third-party form tools alongside your own forms, so every source feeds the same pipeline.
- **Lead deduplication** — Match incoming leads by phone or email — scoped to selected lead lists or institute-wide — so the same person never becomes two leads.
- **Confirmation emails and team alerts** — Optionally auto-email each respondent a confirmation on submission and notify chosen staff whenever a response arrives.
- **Add response on behalf** — Staff can fill and submit the campaign form for a walk-in or phone prospect without using the public link.
- **Per-campaign lead table** — Each campaign has a detailed responses table with dynamic columns from its custom fields, fast pagination and CSV export.
- **Quick automations** — From a campaign card, set an instant confirmation message or a follow-up that goes out N days later — and see which workflows are attached to the campaign — without opening the full workflow builder.
- **Campaign lifecycle and search** — Campaigns move through Active, Paused, Completed and Archived states (only active campaigns accept leads), with search by name and filters by status and dates.
- **Audience surveys** — Public survey pages with dynamic question sets collect structured responses from audiences and feed survey reports.

### Website Lead Capture

*Turn website visitors into enquiries automatically*

Built-in lead collection on your course catalogue website: gate browsing behind a lead form or keep it optional, style it as a single page or multi-step wizard, and route every submission straight into your CRM. An enquiry mode lets visitors raise their hand for a course without paying first.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **Site-wide lead collection form** — Enable a lead form across your site, choose whether it's mandatory before browsing, and connect it to an enrollment invite link so leads flow into the platform.
- **Single-page or multi-step forms** — Choose a one-shot form or a multi-step wizard with a progress indicator (bar, dots or steps) and slide/fade transitions.
- **Custom form fields** — Define exactly which fields the website form collects.
- **Enquiry mode** — Let visitors submit an enquiry for a course instead of (or in addition to) paying — built for high-touch sales.
- **Contact and newsletter widgets** — Drop-in contact forms with required-field control and newsletter signup sections anywhere on the site.
- **Lead-focused hero sections** — Hero buttons can open the lead-collection form directly ('Talk to Us') alongside browse calls-to-action.

### Bulk Lead Import

*Upload hundreds of leads from a spreadsheet*

Import leads in bulk from a CSV file into any campaign. The importer generates a template from the campaign's own form fields, understands natural column names, and reports per-row results so you can fix and retry failures — nothing fails silently.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **CSV template download** — Download a ready-made template whose columns match the campaign's custom fields, including optional Lead Owner and Lead Status columns.
- **Smart column matching** — Column headers are matched flexibly — 'Counsellor', 'Lead Owner Email' or 'Status' all work — and email, phone and name are auto-extracted from mapped fields.
- **Owner and stage on import** — Assign each imported lead to a counsellor and place it on a pipeline stage directly from columns in the file.
- **Phone-only rows supported** — Rows without an email are still imported, so phone-first lead lists never lose records.
- **Per-row results** — The import reports exactly which rows succeeded and which failed with reasons, so partial imports are always visible.

### Multi-Center Lead Attribution

*Every captured lead stamped with the right branch*

For multi-center institutes: map each lead-capture connector to a physical center with defaults like center name and manager contact, so every lead arrives pre-attributed to the right branch alongside its campaign.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Connector-to-center mapping** — Assign center name, center manager name and manager mobile as default values on each lead connector.
- **Multi-vendor support** — Works across Zoho Forms, Meta Lead Ads, Google Lead Ads, Google Forms and Microsoft Forms connectors.
- **Campaign linkage** — Center defaults combine with campaign lists so lead attribution includes both campaign and center.

### Lead Inbox & Lead List

*Every lead, filterable, actionable, in one table*

A central workspace showing leads across all campaigns with rich filtering, bulk actions and one-click calling. Open any lead in a side panel to see their full profile, form answers, notes and journey without leaving the list — built to keep counsellors working leads, not switching tabs.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Powerful filters** — Filter by campaign, lead tier, pipeline status, assigned counsellor (including unassigned), converted state, active/deleted state, date presets or custom ranges, and by any custom form field's values.
- **Action-deadline filters** — One click shows every lead whose first-contact or follow-up deadline is due or missed.
- **Lead detail side panel** — Click a lead to open a full profile drawer — contact info, form responses, notes, status, score and timeline — without losing your place in the list.
- **Bulk assign and unassign** — Select many leads and assign them to a counsellor, or remove the owner, in one action.
- **Click-to-call and AI call** — Place a phone call or an AI agent call to a lead directly from its row (see the Voice & AI Calling pillar for the full calling suite).
- **Tier tagging** — Mark leads hot, warm or cold inline from the table.
- **Quick notes** — Add a note to any lead straight from the table row.
- **Soft delete and restore** — Remove leads from view without losing data and restore them later; both actions are recorded on the lead's timeline.
- **Lead profile editing** — Edit a lead's profile details after capture, with every change logged.
- **Configurable CSV export** — Export leads with a column picker, including an optional lead-journey column that flattens every status change, note and call into the export.
- **Fast at any scale** — Server-side sorting and pagination keep the table responsive even with very large lead databases.

### Automatic Lead Scoring

*Know which leads deserve attention first*

Every lead gets a 0–100 score computed in real time from source quality, profile completeness, recency and engagement, plus a percentile rank refreshed every 15 minutes. Tune the weights to match how your institute sells, and override any score by hand when your team knows better.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Four-factor scoring** — Scores combine source quality (e.g. ad leads and walk-ins rank above manual entries), profile completeness, how recent the lead is, and how much activity it has generated.
- **Configurable weights and decay** — Adjust how much each factor contributes and set a recency-decay factor so fresh engagement counts more.
- **Percentile ranking** — Leads are ranked against each other so you always see the top slice of your pipeline, recalculated automatically every 15 minutes.
- **Manual score override** — Set a score by hand; the old and new score, and who changed it, are recorded on the lead's timeline.
- **Campaign-wide recalculation** — Recalculate scores for an entire campaign on demand.
- **Score change history** — Every automatic or manual score update is logged as a journey event on the lead.
- **Score badge visibility** — Choose whether lead-score badges are shown to the team.

### Custom Sales Pipeline

*Your funnel, your stages, your labels*

Define your own pipeline stages — a sensible starter set is created automatically — and move leads through them from the lead list or in bulk. Every stage change is time-stamped and kept as history, powering funnel reports and the lead journey view. Conversion outcomes are tracked independently of the working stage.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Custom stage editor** — Create, rename, reorder and delete pipeline stages per institute; stages feed filters, reports and automations.
- **One-click stage changes** — Set a lead's current stage straight from the lead table or detail drawer.
- **Bulk stage updates** — Update the stage of many leads or enquiries at once.
- **Full stage history** — Every from-to stage movement is stored and shown on the lead's journey timeline.
- **Conversion tracking** — Converted and lost outcomes are tracked separately from the working stage, feeding conversion reports.
- **Analytics definitions** — Set the report timezone and define which call statuses count as 'connected' and which lead statuses count as 'interested' in analytics.

### Lead Response SLAs & Alerts

*Never let a lead go cold again*

Set service-level rules for how fast your team must make first contact with a new lead and how quickly follow-ups must be completed. The platform reminds the right roles before deadlines hit and flags overdue leads across the CRM, so no enquiry sits unanswered.

**For:** Admin, Counsellor · **Where:** Admin Web

- **First-contact turnaround time** — Set a first-contact deadline in hours for every new lead, with multiple 'remind me N minutes before' warning windows.
- **Follow-up SLA** — A separate deadline for completing follow-ups, with its own pre-deadline reminder window.
- **Role-based notifications** — Choose which roles — counsellors, admins, managers — get notified for each SLA reminder.
- **Overdue visibility everywhere** — Leads that missed first contact or follow-up are filterable in the lead list and surfaced on dashboards.
- **Automation-ready events** — Reminder and overdue events can trigger notifications and workflows, so escalations run themselves.

### Follow-up Task Management

*Today's call list, ready when you log in*

Counsellors schedule follow-ups against leads and land on a focused task view that buckets everything into Pending, Today, Upcoming and All. A calendar view shows the month's follow-up load, and managers can drill into any rep's queue.

**For:** Counsellor, Admin · **Where:** Admin Web

- **Schedule follow-ups** — Create dated follow-up tasks on any lead; tasks move through pending, ongoing, overdue and completed states.
- **Bucketed task view** — Stat tiles for Pending / Today / Upcoming / All drive the page, so a counsellor instantly sees today's workload.
- **Calendar view** — Switch to a month calendar of follow-ups and click any day to see that day's list.
- **Complete with outcome** — Close a follow-up in place with a completion note, optionally scheduling the next touch in the same step.
- **My-queue by default** — Counsellors automatically see only their own assigned leads; admins can switch to any counsellor's queue.
- **Quick actions inline** — Call, note, counsellor assignment and tier updates are available directly from each follow-up row.

### Counsellor Pools & Auto-Assignment

*New leads route themselves to the right rep*

Group counsellors into pools attached to specific campaigns and let the system assign each incoming lead automatically — round-robin, by shift schedule, or by performance and load. Weekly shift rosters, per-rep monthly targets and safe deactivation with lead handover are built in, so every lead lands with the right person at the right time.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Pool management** — Create pools, attach one or more campaigns to each, and add or remove counsellors; changes apply all-or-nothing so pools never end up half-configured.
- **Assignment modes** — Choose per pool: Manual (leads wait for a human), Round-Robin (rotate through members in order), or Time-Based (only reps currently on shift receive leads). New assignees are notified instantly.
- **Advanced distribution strategies** — The routing engine also supports weighted rotation, performance-based routing (send leads to the best converter) and least-loaded routing (send to the rep with fewest active leads).
- **Rotation order control** — Drag to set the exact rotation order of counsellors — one order for all campaigns or a separate order per campaign.
- **Weekly shift scheduler** — Author shifts per day or apply the same hours to all seven days, with multiple shift blocks per day; the system validates full coverage before saving so no lead ever arrives with nobody on duty.
- **Monthly target matrix** — Set a monthly lead target per counsellor per campaign in a simple grid.
- **Safe deactivation with handover** — Mark a rep inactive in one or many pools at once, name a backup, and optionally reassign their existing leads — every handover is logged with the right actor.
- **Workflow triggers from pools** — Fire an automation workflow for pool events straight from the pool screen.

### Counsellor Workbench

*Manage your sales team and their pipelines*

A team-management hub listing every counsellor with their open leads, activity, calls, performance and targets. Managers see their own reporting line; admins see the whole institute. Reassign entire books of leads between reps with a safe preview step before anything changes.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Counsellor roster** — Card or list view of all counsellors with open-lead counts, active status, rating badges and search; managers automatically see only the reps in their reporting line.
- **Per-counsellor drawer** — Open any counsellor to tabs for their Leads, Activity feed, Calls, AI Coaching, Performance and Targets.
- **Assign leads with preview** — Assign unowned leads to a counsellor, with a dry-run preview showing exactly what will change before you commit.
- **Bulk reassign between reps** — Move some or all of one counsellor's leads to another — again with preview-then-apply.
- **Lead transfer history** — Expand any lead to see its full chain of counsellor handovers, oldest first.
- **Mark counsellor inactive** — Flip a counsellor to inactive (e.g. on leave) and hand their leads to a backup in the same step.
- **Activity feed** — A per-counsellor feed of recent actions — status changes, notes, calls and assignments.
- **Hierarchy-aware permissions** — What each manager can see and reassign is scoped by their team hierarchy; admins see institute-wide.

### Counsellor Targets

*Set goals, track them live*

Give each counsellor measurable targets — conversions closed, leads handled or calls made — for a week, a month or a custom date range. Progress is computed live from actual CRM and call data and shown as target-vs-achieved everywhere the counsellor appears.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Three target metrics** — Target conversions closed, leads assigned, or calls made — each measured automatically from real activity.
- **Flexible periods** — Recurring weekly or monthly targets that auto-apply to the current period, or one-off targets bound to a custom date range.
- **Bulk apply to a team** — Set the same target across many counsellors in one action.
- **Live progress tracking** — Target-vs-completed progress bars per counsellor, with a period selector to review past windows.

### Counsellor Ratings & Leaderboard

*Objective rep ratings, computed from results*

Each counsellor carries a rating computed automatically from their conversion ratio and how fast they convert, refreshed on a schedule. Pick a preset strategy or tune the formula, switch any rep to a manual rating when circumstances warrant, and rank the whole team on a leaderboard.

**For:** Admin · **Where:** Admin Web

- **Auto-computed ratings** — A strategy-based score derived from each rep's conversion ratio and time-to-convert, refreshed on a schedule.
- **Preset strategies** — One-click presets: Balanced, Reward closers, or Reward fast callers.
- **Fine-grained tuning** — Set the conversion-vs-speed weighting, ideal and worst response-time thresholds, starting score, minimum activity before a rep is rated, and how many days of history the rating considers.
- **Manual override** — Switch any counsellor to a hand-set rating when needed.
- **Team leaderboard** — A ranked leaderboard of counsellors by rating, also surfaced as a widget on the sales dashboard.
- **On-demand recompute** — Trigger a recalculation any time, in addition to the scheduled refresh.
- **Rating badges** — Ratings appear as badges throughout the workbench and dashboards.

### Lead Timeline & Journey

*The complete story of every prospect*

Every lead carries a unified timeline mixing automatic lifecycle events with manual notes, call logs and meetings — from first form submission through assignment, stage changes, scoring, conversion, payment and enrollment. Notes can be pinned to the top, and the whole journey can be exported.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Automatic journey events** — System-logged milestones: lead submitted, duplicate merged, deleted/restored, counsellor assigned or unassigned, status changed, follow-up, outreach, score updated, converted, lost, payment received and enrollment completed.
- **Manual activity logging** — Staff add notes, call logs, follow-ups and meeting records against any lead.
- **Pinned notes** — Pin the most important note so it always appears first for the next person who opens the lead.
- **Cross-stage timeline** — One continuous timeline follows the person across enquiry, application and enrollment — not just one stage.
- **Latest-note previews** — Lead tables show each lead's most recent note and note count inline.
- **Journey export** — Flatten a lead's entire journey — status changes, notes, calls — into an export column for offline analysis.

### Contact Communication Timeline

*Every message ever exchanged with a contact, in order*

Open any lead or learner and see a unified chronological timeline of every email, WhatsApp message, push notification and SMS — outbound and inbound — with per-message delivery status. Perfect for a counsellor resuming a conversation or support resolving a dispute.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **All-channel timeline** — Email, WhatsApp, push and SMS for a contact merged into one time-ordered view, filterable by channel.
- **Direction and status** — Each entry shows outbound/inbound direction and a chronological status trail — pending, sent, delivered, read, failed, bounced.
- **Message preview and full body** — See a preview of each message inline and expand to the full content.
- **Source attribution** — Every entry records which feature produced it — an announcement, chatbot flow, OTP or campaign — with a link back to the source.

### Enquiry Management

*Track every admission enquiry to a decision*

A structured enquiry desk for schools and institutes: capture enquiries with fee expectations, transport needs and parent details, score interest, work a checklist, and move each enquiry through stages from New to Admitted. Counsellors can be linked to enquiries for clear ownership.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **Rich enquiry records** — Each enquiry captures reference source, mode, fee-range expectation, transport requirement, parent's relation to the child, interest score, notes and a tracking ID.
- **Enquiry stages** — Move enquiries through New, Contacted, Not Eligible, Qualified, Follow up, Closed, Converted and Admitted.
- **Built-in checklist** — A per-enquiry checklist tracks required steps — documents, visits, calls — toward admission.
- **In-app entry and public link** — Front-desk staff create enquiries in-app, or share a public enquiry form link; a kiosk mode suits reception desks.
- **Walk-in registration** — Register walk-in visitors as a lead plus an enquiry in a single submission.
- **Counsellor linking** — Link a counsellor to an enquiry source so ownership and performance tracking are clear.
- **Bulk status updates** — Update many enquiries' statuses in one action with per-item results.
- **Filters and search** — Filter enquiries by date presets, status and source type, with name search.

### Online Applications & Applicant Pipeline

*Online applications with a staged admissions workflow*

Accept applications through a public online form and move each applicant through configurable stages — Form, Payment, Test, Verification, Admission. Application fees can be collected online, parents and children stay linked, and bulk imports migrate existing applicant lists.

**For:** Admin, Counsellor, Parent · **Where:** Admin Web, Public Web

- **Public application form** — Prospective families submit applications online with child and parent details; a printable application template is generated.
- **Configurable stage pipeline** — Define application stages of type Form, Payment, Test, Verification and Admission, and advance each applicant stage by stage.
- **Application fee payment** — Initiate online payment for the application fee directly from the applicant record.
- **Parent-child records** — One parent account can hold multiple child applicants, viewable together.
- **Enquiry lookup and linking** — Search existing enquiries while creating an application so prior history carries over instead of duplicating the family.
- **Bulk application import** — Import many applications from a file with per-row success and failure results.
- **Applicant list with filters** — A filterable, paginated applicant list with a full applicant profile side panel.
- **Staff-side onboarding** — Admins can onboard an applicant directly without the public form.

### Admissions Desk

*From application to enrolled student, end-to-end*

Process admissions through a guided form wizard or in bulk, review each admission with statuses like Under Review, Approved, Waitlisted or Rejected, and enroll approved students into their batch in one step. A full online-application workflow and a quick manual-admission workflow run in parallel and feed the same pipeline.

**For:** Admin · **Where:** Admin Web

- **Admission form wizard** — A step-by-step wizard collects the complete admission form, with a printable admission template.
- **Two admission workflows** — Online Application (application first, then admission) and Manual Admission (direct entry) both feed the same pipeline.
- **Admission review statuses** — Each admission carries a status: Pending, Under Review, Approved, Rejected, Waitlisted or Cancelled.
- **Bulk admission import** — Submit many admissions from a spreadsheet with row-level results.
- **Responses list and detail** — Browse all admission submissions with filters and open a full detail view of any one.
- **One-step enrollment** — Convert an approved admission into an enrolled student, with payment details, in a single step.
- **Custom application stages** — Add and label the stages applications move through, with display text per stage.
- **UPI payment collection** — Attach a payment QR code with payee name and UPI ID (VPA) to collect application fees.
- **Counsellor auto-assignment** — Auto-assign counsellors to applications with a selectable assignment strategy and a chosen counsellor pool.

### Enrollment Invites & Self-Registration

*One link that sells, collects payment, and enrolls*

Create shareable enrollment links for any course batch that carry the enrollment form, pricing and payment options, and optional referral rewards. Prospects open the link, see a course preview, fill the form, pay and get enrolled — no staff involvement required. Open self-signup and partner registration wizards cover every other path onboard.

**For:** Admin, Learner, Parent, Counsellor · **Where:** Admin Web, Public Web, Learner Web, Learner Mobile App

- **Invite link builder** — Create invites tied to one or more course batches, with validity dates, currency, learner access duration and a short URL for sharing.
- **Payment options per batch** — Attach one or several payment plans to each batch on the invite so the prospect chooses how to pay.
- **Custom enrollment form** — Configure the fields prospects fill during enrollment; submissions are stored with the enrollee.
- **Course preview page** — The invite renders a public course preview so prospects see what they're buying before enrolling.
- **Referral rewards on invites** — Link referral programs to an invite's payment plans so enrollees can earn or give referral benefits.
- **Bundled course invites** — One invite can cover a bundle of multiple batches or courses.
- **Default invite per batch** — Each batch keeps a default enrollment invite whose configuration can be updated centrally.
- **Invite management** — Search, filter, update and delete invites; look up invites by learner or payment plan.
- **Open self-signup** — Open registration pages let new learners create accounts directly, with institute-defined registration questions rendered dynamically; invitees land in the right batch automatically.
- **Partner (sub-organization) registration wizard** — A reusable open link takes partner organizations through a multi-step wizard — details, custom fields, OTP verification, KYC, terms acceptance and payment — and mints a new sub-organization with its own admin and learner invites.

### Bookings & Appointments

*Schedule visits, demos and counselling on a calendar*

Define your own booking types — school visits, counselling sessions, demo classes, enquiry meetings — and manage bookings in list or calendar view. Each booking carries a schedule, participants, an optional meeting link and recurrence, with availability checks that prevent double-booking staff.

**For:** Admin, Counsellor, Teacher · **Where:** Admin Web

- **Custom booking types** — Use global defaults like School Visit or Enquiry Meeting, or create institute-specific types with a name, unique code and description.
- **Create bookings** — Schedule an event with title, subject, rich description, date, start/end times, timezone, recurrence and an optional meeting link.
- **Participants and attendees** — Add individual users — leads, parents, learners — or whole batches as participants on a booking.
- **Availability check** — Check whether a time slot is free before confirming, avoiding double-booked staff.
- **Reschedule and cancel** — Move a booking to a new time or cancel it, with status tracking through draft, live, completed and cancelled.
- **Calendar and list views** — Browse bookings on a month calendar with day drill-down, or as a filterable list of upcoming, live and past events.
- **Linked pipeline records** — Bookings can reference a source record — a lead or enquiry — so appointments stay connected to the pipeline.

### Contacts Directory

*Everyone you know, in one searchable place*

A unified directory combining enrolled users and campaign respondents into one contact list. Search by name; filter by campaign, region, gender, enrollment status, batch or payment status; and see each contact's custom-field data at a glance.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Unified contact list** — Toggle inclusion of institute users and lead-form respondents to see students, prospects or both in one table.
- **Rich filtering** — Filter by campaign, campaign status/type/dates, email, phone, region, gender, enrollment status, batch, payment status and organization type.
- **Search and sort** — Name search with server-side sorting and pagination for large databases.
- **Custom fields on contacts** — Each contact row carries its captured custom-field values and flags whether the person is an enrolled user, a lead respondent, or both.

### User Tags & Segmentation

*Label anyone, then act on the whole segment*

Create tags and apply them to any set of users — by picking users, pasting IDs or uploading a CSV. Tags power segmentation across the platform: count and list tagged users, feed messaging and workflows, and even bulk-assign courses to everyone carrying selected tags.

**For:** Admin · **Where:** Admin Web

- **Tag library** — Create institute tags with name and description alongside platform defaults; deactivate tags you no longer need.
- **Bulk tagging** — Add one or many tags to many users at once — by user list, by tag name (missing tags are auto-created), or by CSV upload with validation and a failed-rows download.
- **Tag statistics** — See user counts per tag and pull detailed lists of users carrying any tag combination.
- **Untagging** — Deactivate tags on selected users without deleting history.
- **Courses by tag** — A wizard assigns course batches to every user holding selected tags — select courses, configure enrollment, preview, then apply with results.
- **Segments for automation** — Fetch all users behind a tag or tag set to power downstream messaging and workflows.

---

## Marketing & Website

*Websites, campaigns, coupons and referrals that fill your funnel*

Everything an institute needs to attract, capture and convert learners — without hiring a web agency or stitching together five tools. Build a branded website and course storefront with a drag-and-drop editor, run sales pages with built-in checkout, pull ad leads straight from Meta and Google, and grow through email campaigns, coupons, referrals and shareable branded links. Every touchpoint runs on your own domain and feeds directly into your CRM.

### Website & Course Catalogue Builder

*Build your institute's website with drag-and-drop, no developer needed*

An Elementor-style visual builder for creating your institute's public website and course catalogue. Assemble multi-page sites from a library of 40+ ready-made sections, watch a pixel-accurate live preview as you edit, and publish when ready. Every site is drafted, versioned and role-permissioned, so your team can work safely before anything goes live.

**For:** Admin · **Where:** Admin Web, Public Web

- **Multiple websites per institute** — Create and manage several independent sites, each with its own name and Active/Draft/Archived status — for example a main site plus campaign microsites.
- **Multi-page sites with clean URLs** — Add unlimited pages such as /about, /pricing and /policy, each with its own auto-sanitized URL slug, page title and publish toggle. Rename, duplicate, reorder or delete pages at any time.
- **Drag-and-drop canvas with live preview** — Arrange sections on a canvas while a real, pixel-accurate preview of the live site renders alongside; clicking a section highlights it in the preview.
- **Desktop, tablet and mobile preview** — Switch the preview between desktop, tablet and mobile widths to check responsiveness before publishing.
- **40+ ready-made section widgets** — Header with navigation and CTA, hero, course catalogue grid, footer, media showcase, stats, testimonials, FAQ accordion, video embed, CTA banner, pricing table, contact form, team, announcement feed, image gallery, tabs, logo cloud, trust chips, map embed, countdown timer, feature grid, newsletter signup, steps, scrolling marquee, custom HTML block and more.
- **Bookstore widgets** — Dedicated book catalogue, book details, cart and buy/rent sections plus a policy renderer — enough to run a small book store on the same site.
- **Multi-column layout containers** — 2, 3 and 4 column layouts (including asymmetric splits) that nest other widgets inside, with adjustable gaps, vertical alignment and automatic stacking on mobile.
- **Section layout variants** — Each widget ships multiple style presets — switch a hero from Split to Centered to Full-Width, or a catalogue from grid to list, without losing content.
- **Page and section templates** — Start from full page templates (Landing Page, Course Landing, About Page, Book Store) or drop in pre-built section combos like Social Proof or Course Showcase.
- **Live course catalogue section** — The catalogue widget pulls your real courses automatically, with configurable filters, card fields, grid or list layout and hover effects — no manual updates when courses change.
- **Per-page SEO settings** — Set meta title, meta description and a social-share (Open Graph) image on every page so it looks right in search results and link previews.
- **Rich text, images and link picker** — Edit copy with a rich-text editor, upload images directly into any section, and pick link targets — pages, external URLs or in-page anchors — from a link picker.
- **Anchor links and conditional visibility** — Give any section an anchor ID so navigation buttons smooth-scroll to it, and enable, disable or conditionally show any section.
- **Undo/redo and layers panel** — Full edit history with keyboard shortcuts, plus a structural tree of every section on the page for quick selection and reordering.
- **Draft-to-publish workflow** — Save work as a draft visitors never see, then publish the exact version live in one click; discard a draft to fall back to the published site.
- **Version history and one-click restore** — Browse every saved draft and published revision, restore any old version into the editor, and re-publish it.
- **Role-based editing permissions** — Read, write, delete and publish rights are gated by role — admins can publish and delete while other staff are limited to editing.
- **Sticky header and back-to-top** — Optional site-wide sticky navigation header and a floating back-to-top button.

### Website Themes & Design Studio

*Agency-grade design: themes, fonts, gradients and animation*

Deep design controls make institute sites look professionally designed rather than templated. Pick from named color themes or set your own brand color, choose typography pairings from a curated font library, and layer in modern effects like glassmorphism, gradients and scroll-in animations — all without touching code.

**For:** Admin · **Where:** Admin Web, Public Web

- **9 color themes plus custom brand color** — Default, Ocean, Forest, Sunset, Midnight, Rose, Violet, Amber and Slate presets, or override with any custom primary color — with light and dark site modes.
- **Curated Google Fonts library** — 17 hand-picked typefaces with separate body and heading fonts, so you can pair a display serif over a clean sans.
- **Typography scale controls** — Heading size scale (compact to display), body font-size override, and site-wide compactness settings.
- **Corner style** — Sharp, rounded or pill corner radius applied consistently across the whole site.
- **Page atmosphere backgrounds** — Whole-page canvas treatments — flat, soft, mesh or aurora — with adjustable intensity for a premium, non-flat look.
- **Layered backgrounds and gradients** — Per-section background stacks: linear and radial gradients, solid layers, and background images with legibility overlays.
- **Glassmorphism, glow and gradient borders** — Frosted-glass panels, soft brand-colored glow shadows, and gradient border effects on any section.
- **Entrance animations** — Scroll-in animations per section with cascading stagger across child items, and a site-wide motion personality that scales all animation from calm to dynamic.
- **Decorative ornaments** — Placeable background ornaments — blobs, rings, dot fields, grids and glow orbs — positioned freely behind content.
- **Section shape dividers** — Wave, angle and curve dividers on the top or bottom edge of any section for smooth transitions between blocks.
- **Section width presets** — Content-column width presets per section, including full-bleed, with custom max-width override.
- **What you design is what visitors see** — The editor and the live site share one style engine, so the published page matches the design exactly.
- **Audience mode** — Tune the site's presentation for children, adults or all audiences.

### Sales & Product Pages with Checkout

*Landing pages that sell courses and take payment*

Purpose-built sales pages: pick the courses and payment plans to sell, design the page with the same visual builder, attach coupons and custom form fields, and share a short branded link. Every detail of the funnel — starting step, terms acceptance, invoices, upsells and redirects — is configurable per page.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **Course and plan bundling** — Map any combination of courses and payment plans onto one page, mark items preselected, and control display order.
- **Visual page design** — Design the sales page with the full widget library — header, hero, product course grid, footer and any other section — in a dedicated design tab.
- **Page-specific coupon codes** — Create coupons scoped to the page with percentage or fixed discounts and an optional cap, and toggle whether the coupon box shows at checkout.
- **Custom checkout fields** — Add or remove custom fields collected from buyers during checkout on that page.
- **Funnel start step** — Choose whether visitors land on the catalog, the cart, or straight on payment.
- **'People also buy' upsells** — Configure suggested-course cross-sells per offering, with a custom heading, shown on the cart, the checkout form, or both.
- **Terms and conditions gate** — Require acceptance of inline terms or an external terms URL before purchase.
- **Automatic invoices** — Send purchase invoices automatically by email and/or WhatsApp.
- **Branded short link** — Every page gets an auto-generated short URL on your own domain, with one-click copy for sharing.
- **Post-purchase behaviour** — Custom success-page content, an after-payment redirect URL, an optional login button, back-navigation control during checkout, and allow/disallow deselecting bundled courses.
- **Draft status and buyer preview** — Keep pages in draft, preview them exactly as buyers will see them, and activate when ready.

### Lead Ads & Form Connectors

*Every ad and form lead lands in your CRM automatically*

Connect Facebook/Instagram Lead Ads, Google lead forms and third-party form tools so every lead flows straight into your campaigns and audience lists — no CSV exports. A guided Meta sign-in picks the page and form, field mapping shapes each lead to your custom fields, and health monitoring plus backup polling keep leads arriving even when an ad platform hiccups.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web, API

- **Guided Meta connection** — One-click sign-in with Meta that lists the Pages you manage, warns when your account lacks full control of a Page, and returns you to your own white-label admin domain. Add several connectors in one session without repeating sign-in.
- **Lead form and field mapping** — Browse each Page's lead forms, see their exact fields, and map every ad-form field to your campaign's custom fields — with auto-matching by name and unmapped fields kept under their original names.
- **Real-time lead delivery** — Once connected, new leads from Meta ads land in your lead list within seconds via push delivery.
- **Backup polling and manual sync** — A scheduled poller keeps re-fetching leads even if Meta's push delivery breaks, and a 'Sync leads now' button pulls the last 24 hours on demand — so nothing is lost.
- **Connector health monitoring** — Per-connector health checks with diagnostics, last-lead-received time, automatic token refresh and a one-click re-subscribe fix — broken connectors surface honestly instead of silently dropping leads.
- **Google Lead Form connector** — Generate a webhook URL and unique key to paste into Google Ads lead form extensions — no sign-in needed — routing submissions into a chosen campaign.
- **Third-party form webhooks** — Receive submissions from Zoho Forms, Google Forms, Microsoft Forms or any generic webhook, with field mapping into your campaign's custom fields.
- **Public campaign response forms** — Each marketing campaign gets a shareable public form — branded with your logo and colors, built from your own custom fields with validation — that captures respondents as leads with no login required.
- **Routing and per-connector defaults** — Choose which audience list or campaign each connector feeds, and attach default values (like a branch or center name) so every lead is auto-tagged at capture.
- **Connector lifecycle management** — List all active connectors with Meta/Google platform badges, edit, deactivate and copy webhook URLs from one place.
- **Source tracking and deduplication** — Every lead is stamped with its source — website, Google Ads, Meta ads, manual entry and more — and repeat submissions from the same person are merged into the existing lead with the merge recorded on its timeline.
- **Website enquiry capture** — Enquiries submitted from your public course catalogue pages are captured as leads automatically.
- **Encrypted credential storage** — All connected-account tokens are encrypted at rest and never leave the server.

### Email Campaigns

*Design, target, schedule and send email blasts*

A dedicated email campaigning workspace for marketing and engagement emails. Start from a designed template or write your own, target precise audiences — including lead lists captured from your campaigns, not just enrolled users — and send now or on a schedule. Big blasts are rate-controlled automatically, and scheduled campaigns stay editable until they go out.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Campaign composer** — Separate internal campaign name and customer-facing subject line, rich-text or raw-HTML body, and hidden inbox preview text that appears next to the subject in recipients' inboxes.
- **Template re-use** — Start a campaign from any saved email template — its subject auto-fills and stays editable — instead of designing from scratch.
- **From-address and email classification** — Choose which configured sender address and display name the campaign goes out from; emails are classified as marketing, transactional or notification, each with its own deliverability treatment.
- **Audience targeting with estimates** — Target by role, specific users, batches, tags, custom fields or captured lead lists, and see estimated recipient counts before sending.
- **Exclusions** — Exclude specific people, batches or tags from any audience selection.
- **Send now or schedule** — Immediate, one-time or recurring sends with timezone selection and quick picks like 'in 1 hour', 'tomorrow 9 AM' or 'next Monday 9 AM'.
- **Review step and device preview** — A final review summarizes audience, schedule and content before confirming, with the rendered email previewable at mobile, tablet and laptop widths.
- **Edit, reschedule and resend** — Open any not-yet-sent campaign back in the editor and change anything until its start time passes, or reopen a past campaign to adapt and send again.
- **Bulk sending with rate control** — Large sends are processed as background batches with a configurable send rate, so big blasts don't trip provider limits.
- **Attachments** — Emails can carry file attachments, including automatically generated documents like invoices.

### Drag-and-Drop Template Designer

*Build branded message templates without touching code*

A visual, block-based designer for creating reusable message templates. Drag in text, images, buttons and layout sections, insert personalisation variables from a picker, and save templates that then power announcements, campaigns and automated notifications.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Visual block editor** — Compose emails from drag-and-drop blocks — headings, text, images, buttons and sections — on a canvas with a formatting toolbar.
- **Personalisation variables** — Insert merge fields like learner name or payment link from a picker; they're filled automatically per recipient at send time.
- **Image uploads** — Upload and embed images directly inside the template editor.
- **Template library with editing** — Create new templates and reopen any saved template later to edit it.
- **Multi-channel template store** — The template library supports Email, WhatsApp, SMS and Push template types, each with its own variable list.

### Course Catalog & Discovery

*A branded storefront where learners browse and enroll*

A public course storefront where learners and anonymous visitors browse, search and filter your catalog and open rich course detail pages before enrolling. Build any number of curated catalogues — including tag-based collections that stay current automatically — edit them safely as drafts with full revision history, and serve everything on your own custom domain.

**For:** Admin, Learner, Parent · **Where:** Admin Web, Public Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Public course catalog** — A browsable storefront of published courses with hero section, course cards, instructor call-to-action and supporter sections.
- **Search, sort and filters** — Full-text course search with sorting, a filter panel (level, session, tags, price and more) and pagination.
- **Multiple and tag-based catalogues** — Create any number of catalogues including a default one, plus shareable tag-scoped pages (like /jee or /neet) so campaigns can point buyers at a curated list that updates itself.
- **Draft, publish and revision history** — Edit catalogues safely in a draft, publish atomically, discard drafts, and browse or restore from full revision history.
- **Rich course detail pages** — Banner media, description, what-you-learn sections, the full curriculum structure — subjects, modules, chapters and slide counts — plus instructor info and stats, all viewable before enrolling.
- **Ratings and reviews** — Average rating, rating distribution and learner reviews shown on the course page; enrolled learners can submit their own.
- **Course leaderboard preview** — Course pages can showcase the batch leaderboard to build competitive excitement.
- **Live seat availability** — Batch listings can reflect real-time seat availability from the seat inventory system.
- **White-label catalog on your domain** — Domain-aware routing serves the catalog under the institute's own web domain with the institute's logo, colors and terminology.
- **App-store compliant purchasing** — On iOS the app automatically adjusts paid-purchase UI where required, keeping the mobile app store-compliant.

### Discount Coupons

*Targeted promo codes with limits, scopes and expiry*

Create promotional codes that apply percentage or flat discounts at checkout. Control exactly who can use each code, on which courses, how many times and for how long — and the code is validated live on the public checkout before payment.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Percentage or flat discounts** — Each coupon applies either a percentage (with an optional maximum discount cap) or a fixed amount in a chosen currency.
- **Redemption window** — Set a start and end date; codes outside the window are rejected automatically.
- **Usage limits** — Cap total redemptions per code or leave it unlimited.
- **Email-restricted coupons** — Restrict a code to a specific list of email addresses for private offers.
- **Course and batch scoping** — Limit a coupon to specific batches or enrollment invites so it only works where intended.
- **Live validation at checkout** — The public checkout verifies the code instantly and shows the exact discounted amount before the learner pays.
- **Coupon lifecycle management** — Create, edit, activate, deactivate and delete coupons; every applied discount is recorded against the payment for auditing.
- **System-issued codes** — Coupons can also originate from registration flows, product pages or referral programs, not just manual creation.

### Referral Programs

*Turn learners into your best acquisition channel*

Run configurable refer-a-friend programs where both the referrer and the new learner earn rewards. Choose from five benefit types, stack them into reward tiers, protect payouts with vesting, and deliver bonus content automatically by email or WhatsApp when a referral converts. Learners share and track everything from a referral screen in their app.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Five reward types** — Percentage discount, flat discount, bonus content (a file or link), free membership days, and reward points — configurable separately for the referrer and the referee.
- **Reward tiers and thresholds** — Create tiered programs — for example bigger rewards after 5 referrals — with per-tier benefits, qualification rules, and points-per-referral thresholds.
- **Vesting period** — Referrer rewards can vest only after a set number of days, protecting against refunds and fake signups.
- **Offer stacking control** — Decide whether referral benefits can combine with other discounts or must apply alone.
- **Automated reward delivery** — Bonus content and benefits are delivered automatically via email or WhatsApp using selectable message templates.
- **Learner referral page** — Learners get an in-app screen with their copyable referral code and invite links, a table of who joined through them, and their earned rewards and points.
- **Program templates and default** — Start from ready-made program templates, run multiple programs at once, and mark one as the institute default.
- **Referral tracking and logs** — Every referral mapping and benefit payout is logged with status, beneficiary and timestamps; admins can query points balances per learner.

### Branded Short Links

*Short, trackable links on your own domain*

The platform automatically mints short, human-readable links for everything you share — sales pages, enrollment invites, learner invitations, coupons and notification links — and serves them from your own custom domain. Destinations can be updated later, so links people already have never break.

**For:** Admin, Counsellor, Learner · **Where:** Admin Web, Public Web, Learner Web, API

- **Automatic short links everywhere** — Sales pages, enrollment invites, learner invitations and coupon share links all get compact short codes automatically.
- **Readable link slugs** — Short codes are generated from the content's name (like 'compiler-design') rather than random characters, with automatic suffixes when a name is taken.
- **Your domain, not ours** — Short links resolve on the institute's own registered domain, keeping every shared URL on-brand.
- **Self-healing destinations** — When the underlying page or invite changes, the short link updates in place — shared links never break, and deleted items clean up their links.
- **One link per item, forever** — Requesting a link for the same course or invite always returns the same short URL — no duplicate links floating around.
- **Instant redirect with info lookup** — Visiting a short link redirects immediately; an info mode also lets apps look up where a link points without redirecting.
- **Usage logging and deactivation** — Each link records when it was last opened, and links can be deactivated so they stop resolving.
- **Short links in messages** — Outbound notifications embed the short form of long deep links for cleaner SMS, WhatsApp and email content.

### YouTube Channel Publishing

*Class recordings upload themselves to your YouTube channel*

Connect the institute's YouTube channel once and publish platform videos to it — including automatic publishing of live-class recordings. Set institute-wide upload defaults, trigger manual uploads, retry failures with one click, and audit the full upload history.

**For:** Admin, Teacher · **Where:** Admin Web

- **One-time channel connection** — Securely connect the institute's YouTube account with clear status states (connected, needs reconnect, not connected) and check health anytime; disconnecting is admin-only.
- **Upload defaults** — Set default privacy (Public, Unlisted, Private), category, license, language, tags and an optional default playlist applied to every upload.
- **Automatic recording publishing** — Class recordings can be published to the channel automatically, with each upload traceable back to the live-class schedule it came from.
- **Manual upload and retry** — Trigger an upload on demand and retry any failed job with one click.
- **Upload history** — Track every video through Uploading, Uploaded, Failed or Cancelled states in a full history view.

### Public Webinars & Guest Registration

*Run open demo classes that capture every registrant*

Make any live class public and share it as a registration link — perfect for demo classes, webinars and open houses. Visitors register through a custom form, verify their email, and join as guests without creating an account, while the institute captures every registrant's details as a ready-made follow-up list.

**For:** Admin, Counsellor, Learner · **Where:** Admin Web, Public Web

- **Public or private access per class** — Mark a class private (enrolled batches only) or public, where anyone with the registration link can sign up.
- **Custom registration forms** — Build the registration form from many field types — text, dropdown, number, email, URL, phone, date, long text, checkbox, radio and file upload — each optional or required.
- **Email verification and duplicate check** — Registrants verify their email, and the system detects when an email is already registered for the session.
- **Branded registration page with countdown** — The public page shows class details, institute branding, session status and a live countdown to start time.
- **Guest join without an account** — Registered guests join through their own guest flow — including the built-in classroom, waiting room and in-page viewing — with attendance recorded separately.
- **Registrant data for follow-up** — Admins can view all registration responses per session — a ready-made lead list for counsellors to work.

### Public Onboarding & Instant Demo Workspaces

*Prospects go from a link to a live demo in minutes*

Shareable onboarding links let prospects answer a short qualification form — or skip it entirely — and drop straight into a live demo workspace matched to their organization type: school, distance learning, corporate or university. Every submission lands in a sales pipeline with instant alerts to your team.

**For:** Admin · **Where:** Public Web, Admin Web

- **Three link styles** — General links ask the full question set, custom links show hand-picked questions with prefilled answers, and direct-demo links skip questions entirely and go straight to the demo.
- **Question form builder** — Links are assembled from a question catalogue supporting text, email, phone, long text, URL, single-select, multi-select, yes/no and even brand-color picker fields.
- **Demos matched to institute type** — Four seeded demo environments — School, Distance Learning, Corporate and University — so every prospect sees a workspace that looks like their world.
- **Instant demo handoff** — On submitting, the prospect is handed demo credentials and taken into the product immediately.
- **Submission pipeline** — Submissions move through New, Viewed, Contacted, Won and Lost, with per-stage counts and filters by institute type.
- **Instant team alerts** — A managed recipient list gets an email the moment a new prospect submits, so follow-up starts immediately.
- **Link and demo management** — Create, edit and retire links with unique slugs, and update the demo accounts behind each institute type centrally without breaking existing links.

### Conversion Tracking (GTM & UTM)

*Measure ad ROI end-to-end without engineering help*

Wire your own analytics and ad pixels into every enrollment touchpoint. Add a Google Tag Manager container institute-wide or per sales page so GA4, Meta Pixel and remarketing tags fire on your pages, and generate UTM-tagged share links straight from the editor for clean campaign attribution.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **GTM container per institute** — Paste a Container ID once and every tag you manage in GTM — GA4, Meta Pixel, remarketing — goes live on your platform pages.
- **GTM per sales page** — Attach a separate GTM container to an individual sales page for campaign-specific conversion tracking.
- **UTM tracking link generator** — Generate share links with utm_source, medium, campaign, term and content baked in, straight from the page editor toolbar.

### Shareable Media Links

*Send a video or file as a simple expiring link*

Share individual videos and documents as short public links that open in a lightweight viewer — optionally tied to a recipient's phone number and auto-expiring after a set period. Ideal for WhatsApp distribution of sample lectures and notices.

**For:** Admin, Learner, Parent · **Where:** Public Web

- **Public media viewer** — A clean viewer page for shared videos (including YouTube embeds) and files — no login required.
- **Phone-personalized links** — Links can embed the recipient's phone number for tracking and personalization.
- **Auto-expiring links** — Shared links expire automatically after a set period to keep content controlled.

### Vertical Solutions & Switching Support

*Purpose-built for every kind of education business*

Vacademy is packaged and positioned for specific education verticals, with dedicated solution configurations for exam coaching, schools, corporate training and more — plus free migration from existing tools and rapid go-live support. Localized presence spans India, the GCC, Australia and New Zealand.

**For:** Admin · **Where:** Public Web

- **Exam-coaching solutions** — Tailored configurations for IELTS (module-wise mocks, teacher-reviewed Writing and Speaking), NEET (auto-graded test series, PYQ banks, subject-wise reports) and UPSC (Prelims and Mains test series, daily current-affairs practice, AI-assisted answer evaluation).
- **Studio and wellness solutions** — Yoga and fitness studio setup with trial cohorts, membership and renewal handling, drip nurture and a white-label member platform.
- **Schools, STEM, corporate and distance learning** — Dedicated positioning and setups for schools, STEM and robotics education companies scaling across schools, corporate L&D, and fully-online academies.
- **Localized global reach** — Country- and city-specific presence across India, GCC (with Arabic-language options), Australia and New Zealand, a marketing site in 20 languages, and multi-currency pricing.
- **Free migration and fast go-live** — Free migration from existing tools with go-live support in about 48 hours.
- **Comparison and switching resources** — Head-to-head comparison guides against 65+ platforms — from Moodle and Canvas to Classplus, Graphy, Teachable and Docebo — with feature matrices, migration steps and switching stories to support an informed move.

---

## Communication Suite

*Announcements, email, WhatsApp, push and chat — one hub*

The Communication Suite gives your institute one place to reach — and hear back from — every learner, parent, teacher and lead. Broadcast rich announcements across email, WhatsApp, push and nine in-app surfaces; run two-way email and WhatsApp inboxes; resolve learner doubts to completion; and keep every message on-brand with reusable templates. Precise targeting, scheduling, approvals and deliverability protection are built in, so the right message reaches the right people at the right time.

### Announcement Center

*One announcement, delivered to every screen and channel*

Compose a rich announcement once and deliver it simultaneously over push notification, email and WhatsApp — and inside the apps as alerts, pins, popups, messages, posts or tasks. Announcements carry rich content, attachments and priority, move through a full lifecycle from draft to expired, and every send is tracked with delivery and read statistics.

**For:** Admin, Teacher, Counsellor · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, API

- **Rich content composer** — Write announcements in a rich-text editor or switch to raw HTML source view. Content can be text, HTML, video or image, including full HTML email documents.
- **Three delivery channels in one send** — Push notification, email and WhatsApp go out together, each with its own configuration — email subject and from-address, WhatsApp template with variable mapping, push title and body with character guidance.
- **Email campaigning** — Full email sends with subject line, inbox preview text, template selection and campaign settings.
- **Device preview** — Preview the announcement exactly as it will look on mobile, tablet and laptop before sending.
- **Auto-fill push from content** — Push title and body populate automatically from the announcement, with a toggle to write them manually.
- **Priority levels** — Mark each announcement Low, Normal, High or Urgent so critical notices stand out to recipients.
- **Attachments and resources** — Attach documents, videos, links, images, audio and presentations so recipients get the materials with the message.
- **Full announcement lifecycle** — Announcements move through Draft, Pending Approval, Scheduled, Active, Inactive and Expired states, with controls to activate or deactivate at any time.
- **Delivery and read analytics** — Per-announcement stats show delivered, read, dismissed counts and dismiss rate, down to per-recipient delivery status with seen and dismissed timestamps.
- **Edit, duplicate and re-deliver** — Update or duplicate any announcement, trigger delivery again on demand, and restart failed deliveries with recovery tracking.
- **Planned and past views** — Separate history and schedule screens with search, status and date-range filters keep teams on top of what is queued and what already went out.

### In-App Announcement Channels

*Nine in-app surfaces, from popups to pinned dashboards*

Beyond email and WhatsApp, announcements appear inside the learner and admin apps in purpose-built ways: urgent alerts, dashboard pins, direct messages, class streams, a resources area, community posts, task assignments and full-screen overlays. Each surface has its own behaviour settings, and everything streams to open apps in real time.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **System alerts** — High-visibility alerts in users' alert trays with configurable auto-dismiss timing and priority handling.
- **Dashboard pins** — Pin an announcement prominently on users' home dashboards for a set duration and position.
- **Broadcast direct messages** — Deliver the announcement into each recipient's personal message inbox, with optional threaded replies.
- **Class streams** — Post into a batch's stream, typed as General, Assignment, Live Class, Announcement, Discussion or Q&A.
- **Resources feed** — Publish study materials into a resources area organised by folder, category and content type — document, video, link, image, audio or presentation.
- **Community posts** — Publish to community spaces typed General, Q&A, Discussion, Study Group, Announcements, Events or Help & Support, with tags and replies.
- **Announcement-as-task** — Turn an announcement into real work: linked slides, go-live and deadline times, estimated duration, attempts, mandatory flag and automatic deadline reminders, tracked through Live, Completed and Overdue states.
- **Full-screen app overlays** — Show an unmissable dismissible popup on app open — ideal for exam notices, fee reminders and policy updates.
- **Real-time delivery** — New announcements, pins, alerts and task status changes stream to open apps instantly over a live connection — no refresh needed.
- **Unified message feed** — Every user gets a consolidated messages view with unread counts, per-channel feeds and mark-as-read or dismiss actions.
- **Engagement tracking** — The platform records who read, dismissed, clicked, liked or shared each message, feeding delivery statistics.

### Smart Audience Targeting

*Target exactly who should hear it — nobody else*

Pick recipients by role, individual user, batch, tag, custom-field filter or marketing campaign audience, then layer exclusions on top. A live estimate shows how many people will receive the message before you send it.

**For:** Admin, Teacher, Counsellor · **Where:** Admin Web, API

- **Seven recipient types** — Address whole roles (all learners, all teachers), specific users, entire batches, batches restricted to certain org roles, tags, custom-field filters, or campaign audiences — mixed freely across multiple rows.
- **Custom-field filters** — Narrow any audience with equals, contains, starts-with and ends-with filters on custom profile fields — for example, only learners whose city equals Pune.
- **Per-row exclusions** — Exclude specific roles, users, batches or tags from any recipient row — for example, all learners except Batch X.
- **Tag-based audiences** — Select one or many user tags as an audience, each with its own reach estimate.
- **Campaign audiences** — Reach leads captured through marketing campaign forms directly from the announcement composer.
- **Live reach estimate** — See the estimated recipient count for the whole announcement and per audience row before sending.
- **Sub-organisation targeting** — For sub-org batches, choose whether the message goes to the batch's admins or its learners.

### Scheduling & Recurring Broadcasts

*Send now, later, or on a repeating schedule*

Announcements go out immediately, at a chosen future time, or on a repeating schedule such as every Monday at 9am. Everything is timezone-aware, visible on a schedule calendar, and executed by a reliable background scheduler.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Immediate send** — Deliver to the full resolved audience the moment the announcement is submitted.
- **One-time scheduling** — Pick a future date and time in any timezone, with quick picks like 'in 1 hour', 'tomorrow 9 AM' or 'next Monday 9 AM'.
- **Recurring schedules** — Define daily, weekly or custom repeat rules with optional start and end dates — perfect for weekly digests and fee reminders.
- **Schedule calendar and queue management** — A schedule view lists upcoming one-time and recurring sends as calendar items, with edit, delete and a 'Deliver now' action to fire a scheduled announcement immediately.
- **Reliable background delivery** — Scheduled sends run in the background with recovery — interrupted deliveries are detected and restarted without duplicating messages.

### Doubts & Help Queries

*Learners ask, the right teacher answers — tracked to resolution*

Learners raise doubts anchored to the exact spot in a lesson — even a specific moment in a video — and teachers answer in threaded conversations. A separate help-desk flow handles non-academic queries like payment or technical issues, with configurable types, automatic routing to the right staff, and tracking through resolution. Even logged-out website visitors can submit questions.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, Public Web

- **Content-anchored doubts** — Doubts capture the exact content position — a video timestamp chip jumps anyone reading the doubt to that moment — so teachers see precisely what the learner was viewing.
- **In-slide doubt sidebar** — Learners ask and teachers answer right next to the slide the doubt refers to, keeping the conversation in context.
- **Threaded replies** — Every doubt is a conversation: replies, history and follow-ups stay together in one thread.
- **Central doubts inbox** — Admins and teachers triage every doubt across courses in a filterable inbox — by batch, status, type and assignee.
- **Automatic assignment rules** — Route new queries to the subject teacher, batch teacher, everyone in a role, or specific staff, with a fallback when no one matches — or keep assignment manual.
- **Configurable query types** — Built-in types (Doubt, Payment Issue, Technical Issue) plus custom types with institute-defined labels and per-type routing.
- **Guest queries** — Logged-out visitors submit questions with their name and email from public pages; replies and resolution notices are emailed to them directly.
- **Learner query tracking** — Learners see all their raised queries with status and institute responses, and can mark their own doubts resolved.
- **Resolution workflow** — Doubts move through Active and Resolved states with raised and resolved timestamps, keeping accountability clear.
- **Instant staff alerts** — Device push notifications tell assigned staff the moment a new doubt arrives.

### WhatsApp Business Messaging

*Official WhatsApp messaging at institute scale*

Send WhatsApp messages to learners and leads through official WhatsApp Business channels, connecting via your choice of provider — Meta's Cloud API, WATI or Combot. Bulk template sends personalise per recipient, delivery is confirmed end-to-end, and inbound replies flow back into the platform automatically.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Multi-provider support** — Connect through Meta's official Cloud API, WATI or Combot with credentials stored securely; the platform routes messages through whichever provider the channel uses.
- **Guided webhook setup** — Copy-paste webhook configuration so inbound messages and delivery statuses flow back into the platform out of the box.
- **Bulk template sending** — Send pre-approved templates with per-recipient variables to precisely targeted audiences.
- **Rich media messages** — Messages support text, images, video, documents, audio, locations, contacts, buttons and interactive lists.
- **Media headers and dynamic buttons** — Attach an image, video or document header to template sends and inject per-recipient URLs into buttons — for example, personal payment links.
- **End-to-end delivery receipts** — Every message is tracked as sent, delivered, read or failed via provider webhooks, visible across analytics and contact timelines.
- **Multiple numbers per institute** — Register one or more WhatsApp numbers against the institute, with webhook registration and verification handled in-product.
- **Incoming message capture** — Replies and inbound messages are received, logged and routed to inboxes and chatbot flows automatically.
- **Template-to-event mapping** — Map approved templates to system messages, such as which template is used for invoice notices or transactional updates.

### WhatsApp Team Inbox

*Two-way WhatsApp conversations, right in the dashboard*

A shared WhatsApp inbox where staff see every conversation with learners and leads, reply in real time, and stay compliant with WhatsApp's rules automatically. When a conversation's 24-hour reply window has closed, agents send an approved template to re-open it.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Conversation list with unread counts** — All WhatsApp threads sorted by recency, showing sender name, last message and unread badge, with search and pagination.
- **Full message history** — Scroll through the complete inbound and outbound history per contact, including delivery states on every message.
- **Free-text replies** — Reply directly within WhatsApp's 24-hour customer-service window, with a clear notice when the window has expired.
- **Template replies for expired windows** — Search and send any approved template — with variable prompts — to re-engage contacts outside the 24-hour window.
- **Linked identities** — Conversations tie back to platform users wherever the phone number matches, so staff know exactly who they are talking to.

### WhatsApp Template Studio

*Build and get Meta-approved templates without leaving the platform*

Create official WhatsApp Business message templates in-app: compose header, body, footer and buttons, add numbered variables with sample values, preview the message live, and submit straight to Meta for approval. Already-approved templates sync in from your provider so they are immediately usable in campaigns and flows.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Full template composer** — Header, body text, footer and action buttons — matching Meta's template anatomy exactly.
- **Marketing and utility categories** — Choose the Meta category that governs each template's pricing and rules.
- **13 languages** — Author templates in English, English (US), Hindi, Spanish, Portuguese (BR), Arabic, French, German, Indonesian, Italian, Japanese, Korean and Chinese (Simplified).
- **Numbered variables with samples** — Insert {{1}}, {{2}}-style placeholders with one click; the builder tracks the count, requires a sample value for each (needed for Meta review), and lets you name variables for later mapping.
- **Media headers** — Add a text header or an image, video or document header with a sample for Meta review.
- **Live preview** — See the rendered message with sample values substituted as you type.
- **Draft, submit and track approval** — Save drafts, edit them, submit to Meta from the template list, and monitor approval status and date per template.
- **Provider sync** — Pull already-approved templates from your connected provider into the platform library, with last-synced status per template.

### Communication Hub & Email Inbox

*One dashboard for all outbound and inbound email*

A command center for institute communications: at-a-glance email and WhatsApp performance stats, a cross-channel activity feed, and a shared two-way email inbox. When contacts reply to your emails, the replies land in per-contact conversation threads that staff answer without leaving the platform.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Channel stats overview** — Email and WhatsApp delivery statistics with per-batch breakdowns over a selectable window, shown as stat cards.
- **Recent activity feed** — A cross-channel timeline of recent email and WhatsApp sends.
- **Threaded email conversations** — Inbound and outbound emails group into per-contact conversation threads with a conversation list, filters and full thread view.
- **Reply from the dashboard** — Compose and send email replies directly from the inbox, choosing which verified sender address to reply from.
- **Inbox search** — Search conversations across the inbox to find a contact's thread quickly.
- **Inbound setup status** — A status view shows whether inbound email receiving is configured and healthy for the institute.

### Message Template Studio

*On-brand email and message templates, reusable everywhere*

A visual drag-and-drop designer for reusable branded templates — email, WhatsApp, invoice email and invoice PDF layout — categorized as marketing, utility or transactional. Drop in blocks, style them visually, and insert personalization variables that auto-fill per recipient at send time. Saved templates are picked up across campaigns, announcements, automations and invoices.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Visual drag-and-drop editor** — Compose with header, hero, two-column, button and footer blocks built for email-safe layout, with visual controls for alignment and widths.
- **Style manager with HTML access** — Edit colors, spacing and typography on any element without writing HTML — while full HTML access remains available for power users.
- **Personalization variables** — A variables dialog lists all merge fields by category with click-to-insert; values like learner name or course fill per recipient automatically, and used variables are detected as you write.
- **Four template types** — One studio covers Email, WhatsApp, Invoice and Invoice-Email templates, tagged as marketing, utility or transactional.
- **Subject line and inbox preview** — Set template name, type, category, email subject and inbox preview text right from the editor.
- **Shared image and font library** — Upload images once to cloud hosting and reuse them across every template; choose from 14 fonts including Roboto, Poppins, Montserrat and Georgia.
- **Invoice templates** — Dedicated templates for the invoice email and the invoice PDF layout keep billing communication on-brand.
- **Default templates and sample packs** — Mark a template as the default for its type so automations pick it up without configuration, and start from ready-made samples like welcome emails and reminders.
- **Organized, searchable library** — Search, filter by type and provider, duplicate, delete, and rely on duplicate-name guards and per-type counts to keep the library tidy.

### Email Deliverability & Bounce Protection

*Automatic suppression keeps your sender reputation clean*

Send from multiple verified institute addresses while the platform protects your deliverability automatically: addresses that hard-bounce or complain are suppressed from future sends, admins review and manage the list, and recipients can opt out instantly via one-click unsubscribe links.

**For:** Admin, Learner · **Where:** Admin Web, Public Web, API

- **Verified sender addresses** — Add multiple sending addresses with display names and purposes — announcements, marketing, receipts, chat and community — each with its own verification status.
- **Automatic suppression** — Bounced and complained addresses are captured from the email provider and blocked from future sends automatically.
- **Suppression list management** — Search and browse all blocked addresses with details of why and when they bounced; unblock a corrected address or re-block one with instant effect.
- **Bounce statistics** — A stats view summarises bounce volume and types across the institute.
- **Pre-send batch checking** — Check a whole recipient list against the suppression list in one call before a bulk send.
- **One-click unsubscribe** — Public per-channel unsubscribe links honor opt-outs instantly.

### Transactional Email & OTP Delivery

*Reliable system emails: OTPs, invites and receipts*

The same messaging engine powers critical system emails — one-time login codes, new-user invitations and automated receipts — sent through the institute's verified senders with the same tracking and bounce protection as campaigns.

**For:** Admin, Teacher, Learner · **Where:** Learner Web, Learner Mobile App, API

- **Email OTP** — One-time verification codes are generated and emailed for secure login and identity verification.
- **New user invitations** — Invitation emails onboard newly added users with their access details.
- **Full delivery logging** — System emails carry the same status tracking as all other communication and appear in the contact timeline.

### Push & In-App Notifications

*In-app inbox plus real push to phones and desktops*

A notification center collects everything users need to act on, while native push notifications reach Android and iOS devices even when the app is closed. Institutes connect their own Firebase project in minutes, and learners control exactly which notifications they receive.

**For:** Admin, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Notification center** — A full-page list of all notifications with read states, plus a dashboard preview of the latest.
- **Mobile and web push** — Firebase-powered push to Android, iOS and web for classes, tests, announcements and messages — delivered even when the app is closed.
- **Self-serve push setup** — Enable push for your institute by pasting your Firebase configuration — no engineering work required.
- **Personal notification preferences** — A settings panel where each user chooses which notification types they receive.

### Messaging & Batch Chat

*Direct messages and batch group chats inside the learning app*

Learners message teachers and peers one-to-one, participate in batch group chats, and follow community channels — all without leaving the app or exposing anyone's personal phone number. Institute-defined rules keep community spaces safe.

**For:** Learner, Teacher · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **One-to-one messages** — Start direct conversations from a new-chat modal and continue them in a threaded view.
- **Batch group chat** — A chat panel scoped to the learner's batch for class-wide discussion.
- **Conversation inbox** — A conversation list showing all active threads with unread indicators.
- **Community rules panel** — Institute-defined rules displayed within community chat spaces.

### Permissions, Moderation & Approval Workflow

*Control who can announce what, with maker-checker approval*

Decide per role who may send each type of communication — teachers can post to streams while only admins send system alerts, for example. Messages from restricted roles enter a pending-approval queue before anything goes out, and per-channel policies govern moderation, limits and retention across the whole suite.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, API

- **Per-channel role permissions** — For every in-app channel — community, pins, alerts, DMs, streams, resources, overlays — configure independently whether learners, teachers and admins can send.
- **Approval queue** — A dedicated approvals screen lists announcements pending review; approvers approve or reject each one with a reason, and creators submit drafts for approval.
- **Learner-to-learner DM control** — An explicit switch governs whether learners may direct-message other learners.
- **Moderation controls** — Approval-required toggles, banned keyword lists, automatic moderation actions, daily announcement caps and per-channel reply on/off switches.
- **Channel behaviour policies** — Auto-dismiss timing for alerts, pin limits and durations per user, stream tags and retention days, and a maximum file size for shared resources.
- **Community guidelines** — Set a guidelines title and list of rules shown to your community.
- **Institute defaults with restore** — All communication settings live in one per-institute configuration with sensible defaults, a default timezone for scheduled sends, validation and restore-to-defaults.
- **Personal notification preferences** — Each user has their own preference profile controlling how they receive communications.

---

## Voice & AI Calling

*Cloud telephony, IVR and AI agents that call for you*

Vacademy turns your admissions phone line into a complete calling operation: an AI voice agent that phones every enquiry within about a minute in natural Hindi, English or Hinglish, plus a full cloud-calling desk for your human counsellors — click-to-call, recordings, dispositions, IVR menus and smart inbound routing. Use Vacademy's own built-in telephony with no telecom setup, or plug in your existing Exotel, Plivo or Airtel IQ account. Every conversation is logged, transcribed and AI-scored, so managers coach from evidence and billing stays transparent, per minute.

### Vacademy AI Voice Agent

*An AI that phones your leads and sounds human*

A first-party AI calling agent that holds natural phone conversations with leads — greeting, qualifying, answering questions and handling objections — in Hindi, English or mixed Hinglish. New enquiries are dialled within about 60 seconds, and every call ends with the outcome, a lead rating and the answers you asked for written straight onto the lead record. Institutes author their own agent personas with custom scripts, voices and goals, and the agent hands the call to a human counsellor whenever the conversation warrants it.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **Custom agent personas** — Create any number of named AI agents, each with its own opening line, conversation instructions, language, voice, direction (outbound, inbound or both) and enable/disable switch.
- **Hindi, English and Hinglish** — The agent converses naturally in Hindi, English or mixed Hinglish and follows callers who switch mid-sentence — the way parents and students actually talk. Callers can interrupt it and it keeps up.
- **37 natural Indian voices** — Pick from a catalog of 37 male and female Indian voices, with per-agent speaking pace (0.5–2.0x) and expressiveness controls, plus a voice tester in settings.
- **Calls every lead in about 60 seconds** — New enquiries are dialled within about a minute of arriving, and imported lead lists are worked through automatically.
- **Question extraction onto the lead** — Define the questions each agent should get answered — class, budget, timeline and more — and the extracted answers are written straight onto the lead record after the call.
- **Automatic disposition and lead rating** — After each call the outcome and a lead rating land on the lead record, so counsellors pick up ready, pre-qualified leads.
- **Custom dispositions per agent** — Each agent can carry its own list of allowed call outcomes, or inherit the institute's defaults.
- **Mid-call human handoff** — The agent transfers the live call to configured human numbers when the caller asks for a person or the conversation warrants it, with voicemail as the final fallback.
- **Call-length cap** — A per-agent maximum call duration keeps AI conversations — and their cost — bounded.
- **Try it live before you buy** — Prospects can talk to the AI agent from the public website in Hindi, English or Hinglish, and listen to a real sample recording.
- **Runs on Vacademy's own telephony** — AI calls are carried on the institute's Vacademy Voice numbers — no third-party AI-calling vendor or extra account required.

### Vacademy Voice (Built-in Cloud Telephony)

*Business calling that works out of the box*

A first-party phone system: Vacademy provisions the numbers, carries the calls and bills per minute, so institutes get professional calling without opening their own telecom account or buying SIMs. It includes outbound click-to-call, inbound IVR, recording, and a built-in India-compliance layer covering calling hours, DND scrubbing and disclosures. Sold as simple published plans starting at ₹3,499/month.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web

- **Managed business numbers** — Vacademy provisions each institute's business numbers in its own isolated carrier subaccount, with a configurable default caller-ID for outbound calls.
- **No telecom setup required** — No own telephony account or SIM needed — everything runs on Vacademy's telephony. DLT/PE registration is handled separately as Indian telecom regulation requires.
- **India compliance guardrails** — Enforced before every dial: DND/NCPR number scrubbing, a configurable calling window (default 9 AM–9 PM in the institute's timezone), recording-consent and automated-call disclosures, and a DLT-registration gate for promotional campaigns.
- **Concurrent-channel plans** — Plans define how many simultaneous calls the institute can run, with the purchased channel count acting as a hard dial cap.
- **Recording and timezone controls** — A per-institute toggle records all inbound and outbound calls, and a timezone setting drives both the compliance window and reporting.
- **Human handoff numbers** — Live calls can be transferred to configured human numbers, including mid-call handoff from the AI agent to a counsellor.
- **Published plans from ₹3,499/month** — Voice Basic (₹3,499/mo, ₹3.99/min with ~850+ minutes included), Voice Pro (₹6,999/mo, ~1,750 minutes, adds direct calling and the full voice dashboard), and CRM + Voice monthly (₹8,999/mo). Recordings and full call history are included on every plan.
- **Annual pay-per-use plan** — The flagship CRM + Voice annual plan (₹19,999/yr) charges a flat ₹3.49/min from minute one with no monthly minute minimum — built for seasonal admissions, with ₹0 minute charges in quiet months.

### AI Calling Automation & Guardrails

*Set the rules once — the AI works every lead within them*

Govern exactly how AI calling behaves for your institute: which AI provider to use, when the bot may dial, how many times it retries, and what happens after each outcome. Interested leads are auto-assigned to counsellors, and hard daily dial caps make a runaway campaign impossible.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Choice of AI provider** — Choose the AI voice provider per institute — Vacademy's own AI agent or an integrated third party (Aavtaar) — with credential management and no change to workflows or buttons.
- **Campaign and agent registry** — Create named AI agents and campaigns (e.g. 'Class Feedback'), tagged inbound or outbound, plus a default campaign for ad-hoc calls — so every AI-call report is classified correctly and displays a friendly name.
- **Calling shifts** — Define one or more daily time windows (e.g. 09:00–13:00 and 16:00–20:00, in the institute's timezone) in which the AI may dial; leads outside the window are automatically deferred and re-checked.
- **Retry policy** — Set max retries per lead, minutes between retries, max AI calls per lead per day, and the minimum connect time that counts a call as answered.
- **Institute-wide daily dial cap** — A hard ceiling on total AI dials in any rolling 24 hours — across every lead, campaign and manual click — as the ultimate runaway-spend guardrail.
- **Outcome-to-action rules** — Map each call outcome to what happens next — assign a counsellor, stop retrying, or a custom outcome you define (e.g. 'Wrong Number'). Choose which dispositions are terminal and whether leads that exhaust all retries still reach a human.
- **Counsellor assignment modes** — After an AI call, assign the lead to a counsellor manually, round-robin, or only to counsellors currently on shift.
- **AI calls inside automation workflows** — Drop a 'Call with AI' step into any automation — for example, dial every new enquiry within about 60 seconds of it arriving — picking the agent by name.
- **Lead-list button toggle** — Independently show or hide the manual 'AI call' button in lead lists without turning off workflow-driven AI calling.

### One-Click & Bulk AI Calling

*AI-call one lead or a whole list, with a safe dry run*

Trigger an AI call on any single lead with one click, choosing which agent speaks and which number it calls from. For whole audiences, a 'Call all with AI' action first runs a dry run that counts eligible leads without dialing, then paces the calls in the background while outcomes and counsellor assignments land automatically.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Per-lead AI call button** — One click on any lead row places an immediate AI call, with the acting counsellor recorded as the call's owner.
- **Agent and caller-ID chooser** — When the institute has multiple agents or numbers, a chooser lets the caller pick which persona speaks and which caller-ID is used — otherwise sensible defaults apply.
- **Bulk campaign with dry run** — 'Call all with AI' on an audience list first reports total vs eligible leads without dialing, then on confirmation dispatches paced background calls to every eligible lead.
- **Automatic outcome processing** — Each call's end-of-call report drives the next step automatically — retry later, stop, or assign a counsellor — so no one has to babysit the campaign.
- **Attempt tracking** — Each lead's AI calls display the true attempt number (Attempt 1, 2, 3...) so the retry sequence reads correctly in the call history.

### Inbound AI Receptionist & Auto Lead Capture

*Your AI answers the phone and turns callers into leads*

The AI agent can answer your inbound line — as a menu option or the whole line — and hold a real qualification conversation. When an unknown number calls in, the system can automatically create a lead for the caller, de-duplicated by phone number, so every inbound enquiry becomes followable in the CRM.

**For:** Admin, Counsellor · **Where:** Admin Web

- **AI-answered inbound line** — Route inbound calls — directly or via an IVR menu choice — to an AI agent that greets, answers questions and qualifies the caller.
- **Opt-in auto lead creation** — An explicit per-institute toggle: when on, unknown inbound callers are created (or matched) as leads by phone number, so no inbound interest is ever lost.
- **Known-caller matching** — Inbound calls from existing leads are matched by phone number and attached to the right lead record automatically.
- **Inbound/outbound classification** — AI-call reports are labelled inbound vs outbound, so dashboards cleanly separate 'they called us' from 'we called them'.

### Call Intelligence (AI Transcripts & Scoring)

*Every call transcribed, scored and summarized by AI*

Recordings of human and AI calls are automatically transcribed — Hindi, English and mixed speech — and analyzed by AI into a structured report: summary, outcome, ratings, objections, action items and coaching tips. You define the scoring rubric and the conversion goal, and the analysis attaches to the call and the lead, giving managers x-ray vision into thousands of conversations without listening to them.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Automatic transcription with translation** — Calls are transcribed in the spoken language (Hindi/English/Hinglish, auto-detected) plus an English translation pass, both stored against the call.
- **AI summary and call type** — Each call gets a plain-language summary, an inferred call objective, and a type classification such as sales outreach, follow-up, demo booking, objection handling, payment or support.
- **Dual scoring with conversion likelihood** — Two 0–10 scores per call — how effectively the counsellor advanced their objective and how strong the outcome was from the lead's perspective — plus a high/medium/low conversion-likelihood estimate.
- **Custom scoring rubric and goal** — Define your own weighted quality metrics (defaults: rapport, needs discovery, objection handling, next step secured) and state the conversion goal — e.g. 'book a campus demo' — so every call is measured against what you actually want.
- **Objection and sentiment analysis** — The AI lists each objection raised, whether and how it was handled, and reads the lead's overall sentiment.
- **Action items, coaching tips and highlights** — Concrete follow-up action items, personalized coaching tips for the caller, a talk-time ratio, and verbatim highlight quotes from the conversation.
- **Normalized outcome status** — Every call gets a normalized status — connected positive/neutral/negative, callback requested and more — that powers dashboards and filters.
- **Choose which calls get analysed** — Select the sources — telephony calls, AI-agent calls and/or manual uploads — that flow through analysis.
- **Analyze or re-analyze on demand** — Any call — old, skipped or failed — can be queued for analysis from its call-log entry with one click.
- **Per-lead intelligence history** — All analyzed calls for a lead in one view, across counsellors and attempts, so anyone picking up the lead has full context.
- **On/off switch with cost control** — Call Intelligence is a per-institute setting, metered against credits, with minimum-duration gates and clear skip reasons so money isn't spent analysing empty calls.

### Counsellor Coaching & Team Call Analytics

*Know exactly what each counsellor should improve*

Roll-ups over the AI call analysis turn thousands of conversations into coaching: each counsellor's weakest skills, recurring improvement tips and the objections they face most, with the calls behind them one click away. A comparison-first team view shows KPIs with deltas against the previous period, and every view is automatically scoped to the manager's own reporting line.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Team insights with trend deltas** — Whole-team KPIs — analyzed calls, average quality ratings, positive-sentiment share — each shown with its change versus the immediately preceding equal-length window.
- **Per-counsellor breakdown** — One row per rep with analyzed calls, both quality ratings, call-status and sentiment distributions, leads dispositioned and calling reach — each with its own vs-previous delta.
- **Personal coaching insights** — For each counsellor: their weakest rubric qualities, recurring coaching tips and the most common objections in their calls, with drill-down into the calls behind them.
- **Team coaching insights** — The same coaching view aggregated across a manager's entire reporting line, highlighting top objections, top coaching tips and which counsellors need help on which skill.
- **Counsellor profile tabs** — Each counsellor's profile includes Calls and Insights tabs showing their call history and intelligence-driven performance view.
- **Manager-scoped visibility** — Every view is automatically scoped by the reporting hierarchy — managers see only their own reps.
- **Flexible date windows** — 7/30/90-day presets or custom ranges, with the comparison window computed automatically.

### Click-to-Call from the CRM

*Dial any lead in one click, straight from their record*

Counsellors call leads directly from lead lists, the enquiry side view and the counsellor workbench — no separate dialer app. The system bridges the counsellor and the lead through the institute's telephony provider, picks the right caller-ID automatically, and logs everything against the lead. A one-click confirmation step prevents accidental dials from burning calling credit.

**For:** Admin, Counsellor, Teacher · **Where:** Admin Web

- **One-click bridged calling** — Click the phone icon on a lead and the system rings the counsellor first, then connects the lead — no numbers to type or copy.
- **Caller-ID picker with smart recommendation** — Before dialing, a popover shows every available outbound number with the recommended one pre-selected — doubling as a confirm step so a stray click never places a paid call.
- **Automatic number-selection strategies** — Choose how the outbound caller-ID is picked per institute: Sticky-per-Lead (the lead always sees the same number), Round Robin, or Region Match.
- **Live call status** — Real-time call progress streams onto the screen — Queued, Counsellor Ringing, In Progress, Completed, No Answer, Busy and more — so the counsellor always knows where the call is.
- **Calls panel on the lead record** — Every call — human and AI, inbound and outbound — appears in the lead's side-view call history with status, duration, attempt number and outcome.
- **Call from the counsellor workbench** — Team leads reviewing a counsellor can open that counsellor's full call history in a coaching drawer.

### Unified Call Log & Calling Dashboard

*Every call across the team, filterable and exportable*

One central Call Log shows every call the organisation makes or receives — human and AI, inbound and outbound, across all connected providers — with headline KPIs and deep filters. Managers see their whole team's calls while each counsellor sees their own, based on the reporting hierarchy, and the filtered list exports to CSV or Excel in one click.

**For:** Admin, Counsellor · **Where:** Admin Web

- **KPI strip** — Headline numbers for the selected period: total calls, connected calls with connect rate, total talk time, and unique leads reached.
- **Worklist chips** — One-tap chips surface actionable calls — Missed Inbound (call these back) and Callbacks Due (promised follow-ups whose time has come) — each with a live count badge.
- **Deep filtering** — Filter by lead name, phone number, direction, call type (human/AI), provider, call status, disposition, counsellor and date range, with quick 7/30/90-day presets.
- **CSV / Excel export** — Export the filtered call list (up to 25,000 rows) as CSV or XLSX for offline analysis or audits.
- **Hierarchy-scoped visibility** — Access is automatically scoped by the reporting line: a counsellor sees their own calls, a team head their team's, leadership everything.
- **Phone-number privacy control** — Lead phone numbers are masked by default; only staff granted a specific 'view call numbers' permission see unmasked numbers, on screen and in exports.
- **AI outcome enrichment** — AI calls in the log show their AI-determined disposition and the true attempt number, so retry sequences read correctly.

### Call Recordings & Playback

*Every conversation recorded, stored and replayable*

Calls are automatically recorded and attached to the lead they belong to, so anyone with access can replay the exact conversation to audit quality or settle a dispute. Recording can be switched off per institute for organisations that prefer not to record.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Automatic recording** — Outbound and inbound calls are recorded automatically across providers — recordings are fetched and stored even when the provider only makes them available after the call ends.
- **In-app playback** — Play any recording directly inside the admin dashboard from the call log or the lead's call history — no downloads needed.
- **Recording stored per lead** — Each recording lives against the specific lead and call attempt, so the full audio trail of a lead's journey is browsable in one place.
- **Recording on/off switch** — A per-institute setting disables recording entirely for organisations that opt out.

### Call Dispositions & Callback Scheduling

*Log every outcome and never miss a promised callback*

After each call, counsellors pick an outcome from the institute's disposition catalog, add notes, and optionally schedule a callback. Outcomes can automatically move the lead to the matching pipeline stage, keeping the CRM in sync without extra data entry.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Disposition catalog** — A per-institute catalog of call outcomes — each with a label, colour and category — powers both the after-call picker and the dashboard's disposition filter.
- **Post-call disposition sheet** — A quick after-call panel lets the counsellor set the outcome, add free-text notes and schedule a callback date/time in seconds.
- **Automatic lead-stage sync** — When a disposition maps to a pipeline status (e.g. 'Interested'), saving it automatically updates the lead's status in the CRM.
- **Callbacks worklist** — Scheduled callbacks surface in the Call Log's 'Callbacks Due' chip so promised follow-ups actually happen.
- **Edit dispositions later** — Outcomes can be set or corrected from the call log after the fact, not just immediately post-call.

### Smart Inbound Call Routing

*Callers reach the right counsellor automatically*

When a lead calls back, the system answers instantly and routes them intelligently — by default to the counsellor who last spoke to them, falling back to a voicemail number if nobody is available. Every inbound call, answered or missed, is logged against the lead so no callback opportunity is lost.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Last-counsellor routing** — An inbound caller is automatically connected to the counsellor who most recently spoke with them, preserving relationship continuity.
- **Voicemail fallback** — If no matching counsellor is reachable, the call diverts to the institute's configured voicemail number instead of ringing out.
- **Missed-call capture** — Missed and unanswered inbound calls are logged with the caller identified by phone number, and surface in the Call Log's 'Missed Inbound' worklist for callback.
- **Instant answer decisions** — Routing decisions happen in a fraction of a second while the provider holds the caller, so callers hear ringing rather than dead air.

### IVR Builder (Multi-Level Phone Menus)

*Build 'Press 1 for admissions' menus visually*

Design the phone menus callers hear when they dial your numbers, in a visual tree editor — no telecom vendor required. Combine spoken prompts, key-press menus of any depth, call forwarding, voicemail and even an AI agent that talks to the caller, then attach a menu to each phone number and it goes live immediately.

**For:** Admin · **Where:** Admin Web

- **Visual menu tree editor** — Create, edit and delete complete multi-level IVR menus in a tree editor inside Calling settings, with whole menus saved in one action and labels for easy management.
- **Play prompt steps** — Speak a recorded or text-to-speech prompt to the caller, then continue to the next step; prompts are pre-generated so callers never wait for audio.
- **Keypad menus of any depth** — Ask the caller to press a digit and branch to a different sub-tree per key — nested 'Press 1 / Press 2' menus to any level.
- **Forward-to-team steps** — Ring one or more staff numbers (with the conversation recorded) so a menu choice connects the caller to the right counsellor or team.
- **Voicemail steps** — Play a prompt and record the caller's message when no one can pick up.
- **AI-agent steps** — Hand the call to a chosen AI voice agent mid-menu — e.g. 'Press 3 to talk to our admissions assistant'.
- **Graceful hangup steps** — End the call with an optional closing message.
- **Per-number menus** — Assign a default menu to each inbound number, choose where each call starts, and enable or disable menus independently.

### Multi-Provider Telephony Integrations

*Bring your own telephony — Exotel, Plivo, Airtel IQ and more*

Institutes that already have a cloud-telephony account plug it into Vacademy and get click-to-call, recordings and the unified call log on top of it. Connect Exotel, Plivo, Airtel IQ (Vonage), Aavtaar or Vacademy's own voice service — each provider's quirks are absorbed behind one consistent experience, with encrypted credentials and an in-app setup guide showing the exact settings to paste into the provider's console.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Five providers, one experience** — Connect Exotel, Plivo, Airtel IQ/Vonage, Aavtaar or the first-party Vacademy voice service; the settings screen adapts to each provider's capabilities.
- **Exotel integration** — Bridged outbound calls, a shared pool of ExoPhone caller-IDs, real-time call events, recordings, inbound routing and one-click number sync from the provider.
- **Airtel IQ / Vonage integration** — Click-to-dial through Airtel IQ Business Connect with per-counsellor extensions and direct numbers, plus automatic import of the provider's call records so off-platform calls still appear in the log.
- **Aavtaar.ai integration** — Connect an Aavtaar autonomous AI voice-agent account so its AI calls and end-of-call reports flow into the same lead records and call log.
- **Calling on/off and service choice** — Turn calling on or off for the institute and choose which connected service counsellors dial through.
- **Encrypted credential vault** — Provider API keys and secrets are stored encrypted; re-saving settings never wipes stored secrets, and each provider declares exactly the credential fields it needs.
- **Number pool management** — Add phone numbers with nicknames, regions and preference order; enable or disable numbers, set a recommended number, and attach a default IVR menu per number — numbers auto-attach to the inbound call flow.
- **Counsellor extension mapping** — Map each counsellor to their extension, optional dedicated caller-ID/DID and provider user ID so inbound calls reach the right person.
- **Caller-ID and voicemail configuration** — Decide which number leads see when your team calls, plus a voicemail fallback number for unreachable moments.
- **Balance visibility** — The provider wallet balance (e.g. Exotel) and Vacademy calling credits show at the top of Calling settings, so admins spot low credit before it interrupts a live call.
- **Inbound setup guide** — A step-by-step in-app guide renders the exact copy-paste URLs and settings to configure in the provider's console.

### Calling Reports & Heatmaps

*See when your team dials, connects and follows up*

The Reports Center includes dedicated calling analytics: daily dial, connect and talk-time trends, a per-counsellor breakdown with outcome counts, a day-of-week by hour heatmap showing when calls actually connect, and a follow-up aging view. Every report respects each viewer's team scope.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Daily calling series** — Day-by-day dials, connects and talk time over any date range, with a per-counsellor breakdown including outcome counts.
- **Connect-time heatmap** — A day-of-week × hour-of-day grid of dials and connects (in the institute's timezone), revealing the golden hours to call.
- **Follow-up aging report** — See how long overdue follow-ups have been waiting, so managers clear the backlog before leads go cold.
- **Calls-per-day sales widget** — A calls-per-day widget on the sales dashboard keeps daily calling activity in front of the team.
- **Role-scoped reporting** — Every report is automatically scoped: a counsellor sees their own numbers, a team head their team's, leadership the whole institute.

### Off-Platform Call Upload

*Made the call on your own phone? Upload it*

Counsellors who call a lead from a personal phone or another system can upload the recording afterwards. The call joins the universal call record against the right lead — with direction, duration and time — and, if Call Intelligence is on, gets transcribed and analyzed exactly like a platform call.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Recording upload dialog** — Upload an audio file against a lead with optional direction, duration, counterparty number and call time; the uploader becomes the call's counsellor unless another is chosen.
- **Joins the universal call log** — Uploaded calls appear in the same call log, lead history and reports as provider calls — nothing lives in a side spreadsheet.
- **Same AI analysis pipeline** — Uploaded recordings flow through the identical transcription, scoring and coaching analysis as live calls.

### Per-Minute Call Billing & Credit Metering

*Transparent pay-per-minute billing from your credit wallet*

Calls carried on Vacademy's telephony bill by the minute against the institute's credit wallet, with separate meters for human voice minutes and AI conversation minutes, inbound and outbound. Rates can be tailored per institute, every charge is applied exactly once, and an automatic reconciliation sweep guarantees no call is missed or double-billed.

**For:** Admin · **Where:** Admin Web

- **Four independent meters** — Outbound voice, inbound voice, outbound AI-conversation and inbound AI-conversation minutes are metered separately — an outbound AI call pays voice + AI, while an inbound call answered by a human pays voice only.
- **Only Vacademy-carried calls billed** — Calls on the institute's own provider account (Exotel, Airtel) and uploaded recordings are never metered — only minutes on Vacademy-provided lines.
- **Per-institute rate flexibility** — Standard per-minute credit rates with per-institute overrides per meter and a per-call minimum charge; minutes round up.
- **Guaranteed exactly-once charging** — Every charge is applied exactly once, completed calls are stamped when billed, and a reconciliation job retries any charge lost to a transient failure.
- **Channel-day rental support** — The billing model also supports per-channel per-day rental pricing for reserved concurrent-call capacity.

---

## Vacademy AI

*AI that builds courses, coaches teachers and tutors learners*

Vacademy AI puts a full team of AI assistants inside your institute: course builders that turn a single prompt into publish-ready courses, copilots that convert every lecture into notes, quizzes and exam papers, and a branded 24/7 tutor for learners. Everything is governed from one place — choose the AI models that power each job, control exactly where AI appears, and see every credit spent down to the individual conversation.

### AI Course Builder

*From one prompt to a publish-ready course*

Describe the course you want and the AI drafts the whole thing — structure, lesson pages, diagrams, videos, quizzes and homework — ready to review and publish into your study library. Ground the entire course in your own reference PDFs and web pages so content reflects your actual syllabus, and fine-tune everything from chapter count to video voice before generating. What used to take a semester of production ships in an afternoon.

**For:** Admin, Teacher · **Where:** Admin Web

- **Prompt-based course creation** — Type what you want to teach (with clickable example prompts) and get a full course outline plus content. Optional course-goal and learning-outcome fields sharpen the result.
- **Audience targeting** — Set learner age range, skill level and course language so difficulty and tone match your students.
- **Reference material grounding** — Attach reference PDFs and website URLs (with built-in page scraping) so the AI writes from your actual material — including real figures pulled from your PDFs — instead of generic knowledge.
- **Prerequisite files and links** — Add documents and URLs describing what learners should already know, so the course starts at the right level.
- **Structure controls** — Choose the number of subjects, modules and chapters, slides per chapter, chapter length in minutes, and overall course depth on a slider.
- **Content-type toggles** — Switch on diagrams, code snippets (with programming-language choice), practice problems, curated YouTube videos, AI-generated videos, AI slide decks, AI storybooks, quizzes, homework and worked solutions per course.
- **AI model choice and bring-your-own keys** — Pick a specific AI model or leave it on Auto; optionally supply your own OpenAI or Gemini API keys so generation runs on your accounts.
- **Cost preview and confirmation** — See the exact credit cost before you commit, with a confirmation dialog showing current usage.
- **Automatic draft resume** — In-progress course drafts save automatically; resume or discard a saved draft next time you open the builder.

### AI Outline Editor & Copilot

*Review, rearrange and regenerate every AI page before publishing*

Every AI-drafted course lands in a split-view workspace: the full course hierarchy on one side, a live content editor on the other. Rearrange chapters and pages by drag and drop, inspect and refine the AI prompt behind every planned page, rewrite or regenerate anything you're not happy with, and watch the rest of the course generate in the background — then create the real course in one click.

**For:** Admin, Teacher · **Where:** Admin Web

- **One-prompt course outlines** — Generate a structured outline of sessions and pages — objectives, topic explanations, quizzes, homework and solutions — from a plain course description.
- **Interactive outline tree** — Browse the generated course as chapters and pages; rename, delete or regenerate any chapter or individual page inline.
- **Drag-and-drop restructuring** — Reorder chapters and pages by dragging; the final course is created in exactly the order you arrange.
- **Rich page-type palette** — Generated pages span learning objectives, topic pages, documents, PDFs, images, quizzes, assessments, homework, solutions, assignments, videos, AI videos, AI slide decks, AI storybooks, code-explainer videos, live code editors, notebooks and visual coding blocks.
- **Per-page AI prompts** — Every planned page carries an editable generation prompt you can inspect and refine before content is created.
- **In-place content editing** — Edit any page in a rich editor with auto-rendered flowchart diagrams, embedded YouTube players, images and media replacement.
- **Per-page regeneration** — Regenerate a single page — or just its video or code section — with a fresh AI pass.
- **Regenerate with feedback** — Give the AI corrective instructions and regenerate the outline without starting over.
- **Background generation with progress** — Page content generates in the background with per-page and per-chapter progress indicators, so you keep editing while the rest fills in.
- **Course metadata editing** — Adjust course title, description and other details before the course is created.
- **One-click publish to study library** — Turn the approved draft into a real course with subjects, modules, chapters and pages in your study library.

### Learner AI Tutor

*A 24/7 branded tutor that knows what each learner studies*

A built-in AI tutor rides along on every learner screen, aware of the course and lesson currently open. It explains concepts, summarizes lessons, generates practice quizzes with instant feedback, and runs full voice conversations — including AI-led mock interviews and oral tests in the learner's language. Admins design the tutor completely: its name, personality, hard rules, chat modes, voices and exactly which pages it appears on.

**For:** Learner, Admin · **Where:** Learner Web, Learner Mobile App, Learner Desktop App, Public Web, Admin Web

- **Context-aware chat** — The tutor knows the current lesson and offers one-tap quick actions like 'Explain this', 'Summarize', 'Quiz me', 'Hint' and 'Learning path'.
- **Practice quizzes in chat** — Say 'I want to practice' and the tutor generates a timed quiz, grades the submission, and returns per-question feedback, explanations, a scorecard and study recommendations.
- **Voice conversations** — Hands-free voice mode in three formats — voice doubt-solving, AI-led mock interviews and AI oral tests — with language selection and an animated voice avatar.
- **Attachments and math input** — Learners attach images and files to questions and use a math toolbar for proper notation.
- **Offline message queue** — Messages composed offline are queued and sent automatically when connectivity returns.
- **Tutor persona designer** — Name the tutor, set its role (Tutor, Mentor, Guide), institute name, core instruction, hard-rules list, instruction-adherence level and creativity.
- **Six chat mode toggles** — Enable or disable General Chat, Ask Doubt, Practice Quiz, Mock Interview, Voice Doubt and Oral Test modes for learners.
- **Voice selection** — Choose the male and female voices the tutor speaks with in voice modes.
- **Page visibility control** — Decide exactly where the tutor appears: Dashboard, All Courses, Course Details, Study Material — even logged-out catalogue pages.

### Instructor Copilot

*Record a class; get notes, quizzes and homework automatically*

A before, during and after companion for every lecture. Record your class live in the browser (or upload the audio) and the copilot transcribes it and generates classroom-ready material: structured notes, a summary, flashcards, a quiz, slide and video ideas, plus the classwork and homework you assigned in class — all downloadable as polished PDFs within minutes of the session ending.

**For:** Teacher, Admin · **Where:** Admin Web

- **Lecture workflow dashboard** — Guided Before-Lecture, In-Lecture and After-Lecture views organize preparation, capture and follow-up.
- **Live recording or upload** — Record lecture audio directly in the browser or upload a pre-recorded file; automatic speech-to-text transcription follows.
- **Eight generated artifacts per lecture** — Transcription, notes, summary, flashcards, quiz, slide ideas, video ideas, plus homework and classwork — each generated from what was actually taught.
- **Configurable quiz generation** — Set grade level, question type and language before generating, then download a formatted quiz PDF ready to run as homework.
- **Classwork and homework capture** — Tasks and assignments mentioned in class are extracted into numbered lists with completion checkboxes and a due-date field on the homework PDF.
- **Professional PDF downloads** — Every artifact exports as a cleanly formatted, printable PDF — notes, summary, quiz, classwork and homework.
- **Lecture log history** — Every processed lecture is saved as a log you can reopen, rename, regenerate content for, or delete; failed generations can be retried.
- **Built-in audio player** — Replay the lecture recording alongside its generated content.

### Live Class Lecture Intelligence

*Every recorded class becomes notes, quizzes and exam papers*

After a live class is recorded, AI converts it into study assets: a full transcript, polished lecture notes, and complete practice assessments generated from what was actually taught. Export professional printable exam papers with answer keys, or publish everything straight into courses and the assessment center — with your own name, schedule and marking overrides.

**For:** Admin, Teacher, Learner · **Where:** Admin Web

- **Automatic recording transcription** — Kick off transcription for any live-session recording and track its status; stuck jobs are caught and recovered automatically.
- **AI lecture notes** — One click turns the transcript into well-structured study notes with headings and images, with copy, download and regenerate options; the latest version is saved with the recording.
- **Assessment generation with question-type control** — Generate assessments from the lecture with control over question types: MCQ single-correct, MCQ multiple-correct, true/false, one-word and long-answer.
- **Question-type presets** — Ready-made bundles — Only MCQs, MCQs + True/False, MCQs + One Word, Mixed Assessment, Subjective + Objective Mix — for one-click paper composition.
- **Printable exam paper export** — Export generated assessments as professional PDF question papers — student copy and answer-key copy — with optional institute letterhead, title, marks and dated footer.
- **Past papers and notes history** — Every assessment and notes version generated from a recording is kept in a per-class history for reuse.
- **One-click publish with overrides** — Push notes into courses as lesson pages, or publish quizzes to courses or directly to the Assessment Center — as draft or published, with details overridable before going live.
- **Link class materials to chapters** — Attach the recording and materials to one or more course chapters so they appear in the learning library, with duplicate protection and a materials history.

### AI Lesson Planner & Lecture Coach

*Plan lectures with AI, then get coached on delivery*

Tell the planner your lecture title, topics, class level, teaching style, language and time available, and it drafts a structured, minute-by-minute lesson plan you can edit and export. After class, upload a recording of your delivery and receive a scored evaluation report across eight teaching criteria with concrete, constructive suggestions — ideal for teacher training and self-development.

**For:** Teacher, Admin · **Where:** Admin Web, API

- **Minute-by-minute lesson plans** — Generate a time-boxed, topic-wise lecture timeline that fits your stated duration, class level and language (English or Hindi).
- **Teaching-style aware content** — State your preferred method — storytelling, more examples, and so on — and the plan matches that style.
- **Engagement and homework options** — Toggle in mid-lecture questions for engagement and an assignment or homework section at the end.
- **Edit and export** — Refine the draft plan in place and export the finished version.
- **Scored delivery feedback** — Recorded lectures are evaluated across eight criteria — delivery, content quality, student engagement, assessment, inclusivity, classroom management, teaching aids and professionalism — with a total score.
- **Constructive commentary** — Each section carries specific comments and actionable suggestions, plus recognition of strong moments in the lecture.
- **Broad audio support with background processing** — Accepts WAV, FLAC, MP3, AAC and M4A recordings; long files and long generations process in the background with automatic retries.
- **PDF report export** — Download the full evaluation report as a PDF for peer review or records.
- **Model choice** — Pick a preferred AI model or use the institute default, with automatic fallbacks.

### Interactive Content Generator

*One prompt, thirteen kinds of interactive learning content*

One prompt-driven engine produces thirteen kinds of learning content that run right inside the course player — from quizzes and illustrated storybooks to playable games, simulations and code playgrounds. Every format is age-tuned, multilingual, and delivered as ready-to-use interactive material.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, API

- **Quiz** — Auto-generated question sets with options, correct answers, explanations, difficulty rating and passing score.
- **Storybook** — Page-by-page illustrated stories with per-page illustrations, narration text, age range, themes, learning objectives, interactive touch hotspots, and discussion questions and activities at the back.
- **Interactive game** — Self-contained playable games built around the topic, complete with scoring.
- **Puzzle book** — A collection of themed puzzles for practice and engagement.
- **Simulation** — Physics or economics-style interactive sandboxes learners can manipulate.
- **Flashcards** — Spaced-repetition style card decks generated from the topic.
- **Map exploration** — Interactive clickable maps for geography and location-based lessons.
- **Worksheet** — Printable or interactive homework sheets.
- **Code playground** — Interactive coding exercises learners can edit and run.
- **Timeline** — Chronological event visualizations for history and process topics.
- **Conversation** — Language-learning dialogue content with role-play exchanges.
- **Slides** — Presentation decks in classic slide style, generated from a plain prompt.
- **Practice quiz inside chat** — The learner tutor detects practice intent, generates a timed quiz on the topic, grades the submission, and returns per-question feedback, score and study recommendations.

### AI Question Paper Generator (Vsmart)

*Question papers from PDFs, photos, audio or a plain prompt*

A family of AI tools that produce editable question papers from whatever you have: a PDF or slide deck, a scanned or photographed printed paper, an audio lecture, or just a topic prompt. Every job runs in the background with a task tracker, results land in your question bank, and finished papers export as PDF or DOC or publish straight into an assessment.

**For:** Admin, Teacher, Assessment Creator · **Where:** Admin Web

- **Vsmart Upload — paper from documents** — Upload PDF, DOC/DOCX or PPT/PPTX and generate a question paper from the whole file or just a pasted section, guided by topics you add.
- **Vsmart Extract — digitize printed papers** — Upload a photo, scan or PDF of an existing printed paper; OCR turns it into a digital, editable question set you can save to the question bank.
- **Vsmart Image — questions from pictures** — Upload JPG/PNG images of handwritten notes, textbook pages or board work and get questions generated from the extracted text.
- **Vsmart Audio — questions from recordings** — Upload WAV, FLAC, MP3, AAC or M4A audio and set number of questions, level, focus topic, question type (MCQ, short answer, descriptive, mixed) and language.
- **Vsmart Topics — questions from a prompt** — Describe the coverage you want in plain language and set count, difficulty, chapter and language preferences.
- **Vsmart Chat — refine by chatting** — After generation, chat with the AI to modify the paper: add more MCQs, add higher-order questions, simplify a question, or focus on part of the document.
- **Vsmart Organizer — auto-group by topic** — Generate questions from a file and have them automatically arranged under topic headings for chapter-wise tests, with drag-to-refine.
- **Vsmart Sorter — prompt-controlled ordering** — Sort and reorder generated questions with plain-language instructions like 'put questions 5 and 6 from Plant Nutrition first'.
- **Question configuration** — Control how many questions, difficulty, question type (single-choice, multiple-choice and comprehension variants and more) and output language for each generation.
- **Background AI task tracker** — All generations run in the background; a My AI Tasks list shows status per job with retry for failures — you can navigate away and come back.
- **Export and reuse** — Export finished papers as PDF or DOC question papers (with paper-set formatting), regenerate with a custom prompt, and push questions into assessments.
- **My Resources file library** — A personal library of uploaded source files you can re-run tools against without re-uploading.
- **Complete assessment generation** — Generate a full, structured assessment (sections, questions, answers) ready to publish into the assessment system.
- **AI model picker** — Choose which AI model runs each tool via a model selector backed by the institute's model registry.

### AI Presentation Generator

*Complete slide decks written and designed by AI*

Generate a full presentation from raw text or data in the language of your choice, then regenerate any individual slide you're not happy with. Output is clean, structured slide content ready to present with the platform's live presentation tools.

**For:** Admin, Teacher · **Where:** Admin Web, Engage Client, API

- **Deck from text or data** — Paste source text or data and get a fully structured slide deck, with language selection and AI model choice.
- **Single-slide regeneration** — Regenerate one slide in place without touching the rest of the deck.
- **Prompt-driven decks** — Generate a presentation-style deck straight from a plain prompt — no source document required.

### Admin AI Agent

*An AI assistant that actually does things in your portal*

Chat with an AI agent that understands your institute's data and performs real platform actions on your behalf — looking things up and executing the right operation instead of just answering. It streams replies live, asks clarifying questions when it needs more detail, and always operates within the signed-in user's role and permissions. Admins decide exactly which capabilities each role's assistant gets.

**For:** Admin, Teacher, Counsellor · **Where:** Admin Web

- **Action-taking chat** — The agent maps your request to real platform operations and executes them within your institute context and permissions, returning results in the conversation.
- **Live streaming replies** — Responses stream in real time, with progress visible while longer actions run.
- **Clarifying-question loop** — When the agent needs more information it pauses and asks; you reply in the same thread and it continues.
- **Smart capability matching** — The agent understands the platform's full capability set, so a plain-language request finds the right action every time.
- **Secure institute context** — The agent operates with the signed-in user's own credentials, so answers and actions respect their role and institute.
- **Conversation history** — Agent sessions and messages are stored and reviewable in the AI usage console.
- **Role-based access controls** — Grant a baseline toolset to all staff and fine-tune per-role access for advanced tools, so counsellors, teachers and admins each get an assistant matched to their job.

### AI Website Builder & Page Copilot

*Describe your institute; AI builds and edits your website*

Type a short brief and the AI composes a complete, on-brand web page — or an entire multi-page site — using your real course catalogue, your images and your chosen page type. Compare multiple design directions side by side, accept the one you like as an editable draft, then keep refining by chat: tell the copilot 'make the hero darker' or 'add a testimonials section' and review each proposed edit before applying. Nothing goes live until you publish.

**For:** Admin · **Where:** Admin Web

- **Brief-to-page generation** — Write a plain-language brief, pick a page type — Homepage, Course landing, About us, Admissions, Contact — and receive a fully composed page of real builder sections you can edit normally.
- **Whole-site generation** — Toggle 'whole site' to have the AI generate a complete multi-page website in one run.
- **Grounded in your real courses** — Optionally grounds the copy in your actual course and batch offerings so generated pages advertise what you really sell — in your institute's own terminology.
- **Your images plus AI images** — Upload photos or paste image URLs for the AI to place; optionally let it auto-generate missing images, and generate logo options from a text prompt.
- **Inspiration references** — Provide inspiration images or a source website URL to steer the visual direction.
- **Multiple design directions** — 'Try another direction' regenerates with a distinct angle — editorial-premium, bold conversion-focused, minimal-calm — and every generation lands as a separate variant so drafts are never overwritten.
- **AI brand kit** — Derive a brand kit — colors, fonts, theme — and apply it as the site's global theme in one click.
- **Credit estimate before generating** — See the AI credit cost up front on the confirmation step.
- **Review before accepting** — Inspect the generated section list and preview, then accept to add it as a local draft — nothing goes live until you save and publish.
- **Chat-based page editing** — Instructions like 'rewrite the FAQ answers to be friendlier' are turned into a short list of concrete edits — add a section, restyle a block, rewrite copy — applied to the page you are editing.
- **Change preview before apply** — Each proposed edit is summarized so you see exactly what will change before accepting.
- **Works with the normal editor** — Copilot edits land as regular unsaved changes — undo, tweak manually, save as draft, and publish on your schedule.

### Math & Document OCR

*Equations and figures extracted perfectly from scans and PDFs*

Specialized math-aware OCR converts scanned pages and PDFs into clean digital content: handwritten or printed equations become editable math notation, and textbook PDFs become structured pages with real figures and tables preserved. This is what grounds AI course and question generation in your institute's actual materials.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Equation image digitization** — Extract editable math notation from an equation image — ideal for digitizing math question banks.
- **PDF to structured content** — Full PDFs convert to clean digital pages with math preserved, tables kept as tables, and figures extracted as hosted images.
- **Course grounding from reference PDFs** — Uploaded reference PDFs steer AI course outlines and content, and the document's real figures are embedded verbatim into lessons and videos instead of AI-invented ones.
- **Conversion caching** — Converted documents are cached, so re-using the same PDF across passes never pays for a second conversion.
- **Layout-aware scanned-document OCR** — A high-throughput OCR pipeline with region detection handles scanned documents and complex page layouts.

### AI Model Registry & Model Choice

*Choose which AI brain powers every job*

A live catalog of AI models spans Google, Anthropic, OpenAI, DeepSeek and free community models, each tagged with quality and speed scores, pricing and recommended uses. Every AI tool offers a model picker fed from the registry — leave it on Auto or pin a specific model per feature, and even per stage of video production. Platform admins retune defaults and pricing live, with no downtime.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Browsable model catalog** — Every model lists its provider, tier (free, standard, premium, ultra), context size, image support, pricing, quality score and speed score — filterable by tier, provider, use case or free-only.
- **Free-tier models** — A rotating set of genuinely free models lets users generate at zero model cost.
- **Auto or explicit selection** — Every model picker defaults to Auto (recommended) with the option to pin a specific model.
- **Per-use-case defaults with failover** — Each use case — content, outlines, video, images, evaluation, copilot, agent, analytics, speech, presentations — has a default, a fallback and a free-tier model, resolved automatically with graceful failover.
- **Per-stage overrides in video production** — Override the model for individual video-production stages — shot planning, narration writing, per-scene visuals, act planning and corrective regeneration — or mass-apply one model to all overridable stages; quality-critical review stages stay on vetted defaults.
- **Credit multipliers by tier** — Free models charge nothing, standard 1x, premium 2x, ultra 4x — pricing users can see before choosing.
- **Live model management** — Platform admins add models, update pricing and scores, swap the free-tier set, and change use-case defaults live — no deployment needed.
- **Provider and tier statistics** — Provider counts and per-tier average pricing feed the model-picker interfaces.

### AI Settings Hub

*Govern every AI feature from one place*

One place to govern all AI on the platform: bring your own provider keys, set default models per feature, white-label the AI course builder under your own name, feed the AI an institute knowledge base, and set the visual branding for every AI-generated video. The learner tutor's persona and visibility are shaped here too.

**For:** Admin · **Where:** Admin Web

- **Bring-your-own AI keys** — Add your own provider API keys (OpenAI-style and Google-style) and choose models per feature, or use system defaults.
- **Course AI configuration and white-labeling** — Set your AI course builder's display name (e.g. 'CourseCrafter AI'), an institute-level default course prompt, and hard rules the AI must always follow.
- **AI video style and branding** — Choose the visual style for AI-generated videos and apply your institute branding — intro/outro slides, watermark, background themes, templates and typography.
- **Institute knowledge base** — Feed the AI typed knowledge entries — announcements, policies, processes, events, results and general info — so its answers reflect your institute.
- **Learner tutor controls** — The Learner AI Tutor's persona, chat modes, voices and page visibility are all configured from this hub (see Learner AI Tutor).
- **Usage view** — AI consumption is surfaced right inside settings, with drill-down into the full usage console.

### AI Usage & Audit Console

*Know exactly who used AI, for what, and at what cost*

A transparent metering console for all AI activity in the institute: per-user usage, itemized logs, and full conversation transcripts. Every AI feature — course generation, video, evaluation, agents, call analysis and more — is tracked, and tools show their credit cost before you run them.

**For:** Admin · **Where:** Admin Web

- **Usage by user** — See which staff members and learners are using AI and how much, with per-user drill-down into their logs and conversations.
- **Usage summary and itemized logs** — An institute-wide summary plus itemized logs across 16 tracked activity types — course outlines, content, images, video, text-to-speech, evaluation, presentations, conversations, lectures, PDF questions, agent actions, analytics, copilot, call intelligence and more.
- **Conversation transcripts** — Browse all AI conversations and open the full message history of any session for audit or quality review.
- **Upfront cost preview** — Cost badges and previews on AI tools show the credit price before generation starts, driven by live, adjustable rates.

### AI Credits (Pay-As-You-Go)

*Transparent prepaid credits for every AI action*

All AI features run on a prepaid credit balance, so costs are always visible and controlled — you see the price of an action before you run it and every credit spent afterwards. Credit packs, in-app top-up, invoicing and payment handling are covered in full under Finance & Payments.

**For:** Admin · **Where:** Admin Web

- **Prepaid credit balance** — Every AI action draws from a single institute credit balance, keeping spend predictable and capped.
- **Cost preview before you spend** — Expensive actions show a credit-cost badge and a confirmation dialog with the exact estimated cost before running.
- **Usage ledger and analytics** — Overview, Usage, Analytics and History tabs show your balance, every transaction, and spend broken down by tool, model and learner activity.
- **Credit packs and top-up** — Buy credit packs in your currency with secure in-app top-up; billing details, invoices and payment handling live under Finance & Payments.

### Explore AI Hub

*One front door to every AI capability*

A single launchpad that routes staff to the right AI tool for the job: creating educational content, building end-to-end courses, the lecture assistant, the lesson planner, and the full AI tools catalog. Designed so non-technical staff discover everything the AI can do.

**For:** Admin, Teacher · **Where:** Admin Web

- **Guided entry cards** — Cards for creating educational content (videos, storybooks, quizzes, timelines), building end-to-end courses, the lecture assistant, the lesson planner and other AI learning tools — each linking straight to the right studio.
- **Works on any device** — The hub adapts from a desktop grid to a compact mobile list so teachers can jump into tools from anywhere.

---

## AI Video Studio (Vimotion)

*Prompt-to-video studio: avatars, voiceovers, editing, reels*

Vimotion is Vacademy's AI Video Studio: type a brief and get a finished, branded, narrated video — script, visuals, voiceover, music and captions produced automatically in minutes. Beyond generation, it is a complete video operation: a full post-production editor, avatars and voice cloning, dialogue-driven story scenes, reels from long recordings, screen recording, translation with lip-sync, and a developer API for video at scale. Every video renders in your brand, in 60+ languages, with credit costs shown before you spend.

### AI Video Generator (Prompt to Video)

*Type a topic, get a finished narrated video*

Turn a plain-text prompt, document or link into a complete narrated video. The AI writes the script, records the voiceover, designs every animated scene, adds captions and renders a final MP4 — while you watch each production stage complete live. Videos can also play instantly inside the course player as interactive scenes, and the same engine powers landscape explainers, vertical shorts and marketing films alike.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **One-prompt creation** — Enter a topic or a full brief in plain language — length, format and audience are parsed automatically, with no prompt engineering or template hunting required.
- **Any-source briefing** — Start from a PDF, slide deck, document, blog post or Notion page; the AI condenses it into a structured script that preserves the author's argument and message hierarchy.
- **Website grounding from URLs** — Paste a URL and the system visits the page, captures its screenshots and images, and grounds the video in that site's actual content.
- **Reference-file grounding** — Attach images and PDFs and the AI uses their real facts and figures in the video instead of inventing material.
- **Target audience control** — Pick the audience — from Class 1-2 through Graduate/Professional — and the script, vocabulary and visuals adapt to that level.
- **Target duration control** — Choose the intended length from 30 seconds to 10 minutes; pacing, shot count and script density are sized to hit it.
- **60+ narration languages** — Generate videos narrated in 60+ languages grouped by region, including 9 Indian languages and regional English variants, with voice gender and named-voice selection.
- **Landscape and portrait output** — Produce 16:9 videos for courses and YouTube or 9:16 vertical videos for Shorts and Reels, with an on/off toggle for burned-in, word-synced captions.
- **Script review mode** — Stop generation at the script stage, review and edit the narration, then continue to full production.
- **Stage-by-stage generation** — Generate up to any checkpoint — script only, script plus audio, full visual timeline, or final MP4 — and resume from any completed stage without redoing earlier work.
- **Live progress streaming** — Real-time progress shows the current stage, percentage and messages while the video builds; creators can leave and come back.
- **Cancel, retry and resume** — Cancel a running generation mid-flight, retry a failed run from its last successful checkpoint, and resume interrupted runs without losing spend.
- **Generation history and settings reuse** — A history sidebar lists every past generation with status and output links; reopen results or reuse a previous run's voice, tier, brand kit and visual settings.
- **Smart intent routing preview** — Before you submit, the studio previews how your request will be routed — which tools and stages will run, whether URLs will be scraped or the web searched — and lets you override any decision.
- **Instant interactive playback** — Videos can play immediately in the course player as synced audio and animated scenes, so learners get content right away while the MP4 render is optional.
- **Course builder integration** — AI course outlines can mark slides as video items; the pipeline generates each one and streams progress straight into the course editor.
- **Course-wide video settings** — A single settings card controls how every video in a generated course is produced — narration language, voice, audio quality, video model, target length and quality tier — set once and applied throughout.
- **Versioned re-renders** — Re-render any video on a prompt change without re-recording; past versions remain intact for rollback.

### Quality Tiers & AI Director

*Choose your quality level, from free to film-grade*

Five quality tiers — Free, Standard, Premium, Ultra and Super Ultra — let you trade cost against polish on every video. Higher tiers switch on an AI Director that plans the whole edit like a filmmaker, generates multiple candidate designs for key scenes and picks the best, and runs automated visual quality inspections before anything ships.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Five quality tiers** — Free (stock-only, fastest), Standard, Premium, Ultra and Super Ultra — each tier unlocks more design intelligence, sound design and review passes, with per-tier pricing.
- **AI Director planning** — On Premium and above, a director model plans acts, beats, shot types, emphasis, motion density and per-scene styling before any visuals are generated.
- **Frontier-model creative concepts** — Top tiers explore multiple divergent creative concepts with anti-repetition prompting, so videos never look templated.
- **Best-of-N hero shots** — On key scenes — hook, hero, closing — the system generates 2-4 candidate designs at different creative angles and a visual judge compares actual rendered frames to pick the winner.
- **AI vision review of every scene** — A vision model inspects each rendered scene for visible defects such as broken text or clipped layouts, with bounded regeneration of anything that fails.
- **Pixel-accurate overflow checks** — A deterministic bounding-box check walks every rendered frame and flags any text or media crossing the canvas edge — catching clipped headlines no reviewer can miss.
- **Animation density enforcement** — A validator ensures every scene has enough animated elements and none of the forbidden anti-patterns, keeping motion quality consistently high.
- **Creativity critic** — Ultra tiers run a director's-eye scoring gate on hero shots and elevate any scene that falls below the creative bar.
- **AI-choreographed transitions** — An edit choreographer authors scene-to-scene transitions instead of using one stock crossfade everywhere.
- **Two-pass script review** — Premium scripts are drafted, then reviewed and rewritten in a second pass for tighter narration.
- **Cost guardrails and transparency** — Every quality gate carries its own cost cap, credit pre-flight checks block runs your balance cannot support, and each run records a per-stage cost breakdown so you can see exactly where credits went.

### AI Voiceover, Text-to-Speech & Voice Cloning

*Hundreds of natural voices — or your own, cloned*

Every video gets a natural, studio-grade voiceover. A free standard tier covers 50+ languages, premium tiers add named studio voices for global and Indian languages, and voice cloning reproduces a real instructor's or founder's voice from a two-minute sample — so your star presenter narrates every video in every language. Narration also works standalone for podcasts, phone systems and accessibility.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Standard voices in 50+ languages** — Male and female neural voices included free across 50+ languages and locales, from US/UK/India English to Hindi, Tamil, Spanish, Japanese, Arabic and more.
- **Premium Indian voices** — 35+ named voices with authentic Indian accents across Hindi, Tamil, Telugu, Bengali, Marathi, Kannada, Gujarati, Malayalam, Punjabi, Odia and Indian English.
- **Premium global voices** — Multiple named studio-grade voices per language for 25+ global languages, with graceful fallback when a language and gender combination is unavailable.
- **Voice picker with audio samples** — Browse a 200+ voice library filtered by language, accent, gender, age and tone, and audition every voice with a sample clip before choosing; lock a default voice per workspace.
- **Automatic provider routing** — On the premium tier, Indian languages and global languages route automatically to the best voice engine for each — no configuration needed.
- **Voice cloning from a 2-minute sample** — Upload two minutes of clean audio — phone-mic quality is fine — and get a quality-checked clone that carries the original's cadence, warmth and quirks.
- **Consent-governed clones** — Every clone carries a consent record, stays scoped to your workspace, is never shared or used for third-party training, and can be revoked in one click with a full audit log.
- **Cross-language clone fidelity** — A cloned voice speaks 80+ languages with the same cadence — a message recorded once becomes a localized series without dubbing studios.
- **Inline direction marks** — Slow a word, lift a phrase, pause for breath — pace and emphasis marks placed inline in the script, plus per-paragraph emotion presets.
- **Custom pronunciation lexicons** — Define how product names and jargon are pronounced, per workspace.
- **Word-level timestamping** — Narration is aligned to word-level timestamps with automated verification, powering captions, scene sync and sentence editing.
- **Per-scene audio and retakes** — Narration is recorded per sentence and per scene, so individual lines can be edited or re-taken later without regenerating the whole track.
- **Voice-matched pacing** — Scene timings adapt to how fast each chosen voice actually speaks and to the content style.
- **Standalone audio export** — Ship narration as standalone audio in WAV, MP3, OGG or OPUS, download it or stream it via API to any channel — cleared for commercial use.

### AI Avatars & On-Screen Presenters

*Your best instructor on camera — without a camera*

Put a lifelike presenter in any video. Upload one clear face photo or a two-minute phone recording and the platform builds a reusable avatar that presents any script with lip-synced speech in 80+ languages — or pick from a library of 30+ pre-built presenters. Control exactly how much screen time the host gets, and choose between multiple avatar engines at different price and fidelity points.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Custom avatar from a photo** — Upload a front-facing photo plus an optional description of clothing, demeanour and background; the system generates consistent per-scene presenter footage lip-synced to the narration.
- **Avatar from a 2-minute recording** — Record two minutes on any phone in a quiet room and receive a brand-grade avatar within 24 hours, complete with a quality-assurance pass — no green screen or crew.
- **Saved avatar library** — Save reusable avatar identities with their face, engine and voice, pick them from a dropdown for any video, and choose from 30+ diverse pre-built presenters across age, gender and ethnicity.
- **Multiple avatar engines** — Seven generation engines spanning budget to premium fidelity, each labelled with its per-second credit price, so you pick the cost/realism trade-off per video.
- **Host screen-time dial** — Set what percentage of scenes show the host on camera (0-100%); the Director places host appearances on hooks, recaps and key beats while narration plays continuously.
- **First-person script rewrite** — When a host is enabled, the script is automatically rewritten in first person so the presenter speaks naturally.
- **Cross-language presenting** — The same face speaks 80+ languages with lips matching the words and the source voice's rhythm preserved, with per-language preview before render.
- **Personalized avatar videos at scale** — Pipe in a CRM feed — first name, company, deal value — and generate thousands of personalized presenter videos from one recording, with per-variable preview and approval gates.
- **Consent, IP controls and audit** — Avatar likeness rights are locked to your workspace with consent records, never reused by third parties, and every avatar render is recorded in an audit log.
- **Resolution and frame-rate options** — 480p or 720p avatar output with adjustable frame rates on engines that support it.
- **Segment-level re-renders** — Edit any sentence and re-render only that segment; versioned sources allow rollback.

### Storybook & Drama Dialogue Scenes

*Characters that talk on camera, in consistent voices*

Turn lessons into short films: the AI writes characters and dialogue, then produces lip-synced, voice-matched acted scenes. Choose Storybook mode, where a narrator carries the video and dialogue scenes land at dramatic moments, or Drama mode — a pure dialogue film with no narrator at all. Save a cast once and the same faces and voices star across a whole series.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Storybook mode** — The narrator carries the video and 1-4 dialogue scenes appear at dramatic moments for emotional impact.
- **Drama mode** — A pure dialogue film — every scene is characters talking, clips carry their own ambience, and the clip budget is raised accordingly.
- **Voice-locked characters** — The default engine lip-syncs characters to the platform's own per-character AI voices, so each character sounds identical across scenes and sequel videos.
- **Budget dialogue engine** — A lower-cost alternative engine speaks the lines itself — strong visuals at roughly half the price, for productions where per-clip voice consistency matters less.
- **Intelligent voice casting** — Each character gets a distinct voice matched to their age and personality; no two characters share a voice, and you can override any casting choice.
- **Reusable saved casts** — Save a finished video's cast — names, portraits, reference sheets and voice assignments — and reuse it so a series keeps the same faces and voices.
- **Character consistency via reference images** — Up to 9 reference images lock character and setting appearance across independently generated clips.
- **Clip quality control and re-takes** — Every filmed clip passes an automated quality check, and in Assist Mode you can review clips and send back specific shots with re-take notes.
- **Dialogue budget caps** — Dialogue-scene spend is estimated up front and capped per tier, so drama videos stay within predictable cost.

### Cinematic AI Video Clips

*True AI-generated film clips inside your videos*

On the top quality tiers, opt in to fully AI-generated cinematic video clips woven into your video as full-frame hero scenes or inline moments — with optional generated sound of their own. A built-in cost circuit-breaker caps AI-clip spend per video so premium footage never runs away with your budget.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **AI hero clips** — The AI Director plans full-frame generated video scenes where real footage doesn't exist — opt-in per run.
- **Inline AI clips** — Individual scenes can embed short AI-generated clips inside larger layouts.
- **Optional clip audio** — AI clips can carry their own generated sound; master narration is automatically silenced during those moments.
- **Hard per-video cost cap** — A circuit breaker rejects further AI-clip generation past a fixed per-video ceiling and falls back to standard scene designs, so costs never run away.
- **Worst-case cost preview** — The pre-generation estimate shows the AI-clip upper bound in credits before you commit.
- **Extended clip chaining** — Image-to-video chaining supports clips longer than a single generation window.

### Cinematic Shot Library & Motion Design

*18+ scene types, 8 visual themes, real motion design*

Videos are assembled from a library of professionally designed animated scene types — data stories, process steps, equation builds, device mockups, kinetic titles and more — each with its own motion language. Eight ready-made visual themes, style modes and preference controls keep every video on-brand and non-generic.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **18+ animated scene types** — Text diagrams, image and video heroes, split comparisons, lower thirds, annotated maps, animated data stories, process steps, equation builds, product heroes, kinetic text, SVG infographics, device mockups and more.
- **Curated shot templates** — Battle-tested layouts including definition cards, quote callouts, stat blocks, step progressions, three-up grids, horizontal timelines and article zoom-pans.
- **Motion primitives** — Reusable animation building blocks — number counters, typewriter text, growing bar charts, progress rings, staggered lists, underline sweeps and equation term reveals.
- **8 visual themes** — Whiteboard, Cerulean, Glamour, Diorama, Neon, Chalkboard, Blueprint and Minimal — each a complete look with its own palette and design rules.
- **Visual style modes** — Educational (clean lecture look), Marketing (premium brand-film look with depth and choreographed motion) or Bold (high-energy social styling) — auto-detected from content or set explicitly.
- **Visual preference sliders** — Bias the mix of stock footage, AI imagery, SVG diagrams, motion graphics, app mockups and AI video per family — or just type preferences in plain language like 'use more diagrams'.
- **On-screen text density control** — Choose minimal, low, auto or rich on-screen text independently of narration length — from title-only scenes to full supporting labels.
- **Domain-aware shot selection** — The planner picks scene types suited to the subject — math gets equation builds, business gets data stories — and enforces shot diversity so scenes never repeat.
- **Subject-matched pacing and music mood** — Speaking pace, transition style and music mood adapt to the detected subject and target duration.

### Real Footage & Imagery Sourcing

*Real stock, real news photos, and AI imagery — automatically*

Every scene is dressed with the right imagery without the creator lifting a finger. The pipeline searches licensed stock photo and video libraries, pulls real news and web images for named people, places and events, and generates AI images where nothing real fits — with an AI ranking pass choosing the best match instead of the first result.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Stock photo and video search** — Automatic licensed stock search per scene with orientation matching and built-in redundancy for reliability.
- **Real-entity image search** — Web-powered image and video search finds actual photos of specific people, places, events and products that stock libraries don't have.
- **AI image generation** — Custom images are generated for abstract or conceptual scenes, with prompt enhancement on higher tiers.
- **AI-ranked selection** — Instead of taking the first search result, higher tiers run an AI ranking over the top candidates and pick the best-fitting photo or clip.
- **Visual continuity** — Continuity mode keeps characters and settings visually consistent across scenes in the same video.
- **Reference image placement** — Attached reference images are understood by a vision model and threaded into the script and scene design, so real diagrams appear exactly where they belong.
- **Tier-based sourcing policy** — The free tier is stock-only; higher tiers prefer stock and use AI generation only where stock can't deliver.

### Use Your Own Footage

*AI videos built from your recordings and screenshots*

Upload your own videos and images — demos, lectures, podcasts, product walkthroughs — and the AI understands them: transcribing speech, detecting scenes and faces, and mapping screen regions. Generated videos then splice in your real footage with graphics intelligently overlaid around it, turning raw recordings into polished produced videos.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Video indexing with podcast and demo modes** — Uploaded videos are analyzed with mode-specific pipelines — podcast (faces, speech) or demo (screen activity) — producing transcripts, scene maps and spatial layouts, with visible processing status.
- **Image indexing** — Photos, screenshots and diagrams are indexed as reusable assets the planner can place into scenes.
- **Multi-source generation** — Attach up to 5 indexed videos to one generation; the AI Director plans which source clips to use where.
- **Original audio or AI narration** — Keep the source video's own audio as the narration, or let AI narrate over the footage — with an option to duck narration during source clips so their real sound plays.
- **Source clip priority** — Tell the Director to lean lightly or heavily on your footage versus generated visuals.
- **Smart overlay placement** — Face detection identifies free screen regions so text and graphics never cover the speaker.
- **Asset library management** — Browse, filter, inspect and delete uploaded source videos and images from a dedicated library.

### AI Sound Design & Generated Music

*Original score and sound effects on every video*

Videos ship with a complete audio mix, not just a voice. A sound planner places tasteful effects on transitions and emphasis moments, AI generates fresh custom effects so videos never reuse the same whoosh, and an AI composer writes an original background score matched to each video's emotional arc.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Automatic sound-effect placement** — Cues are derived from scene types, animation events and narration emphasis, with per-tier caps and a one-click off switch.
- **AI-generated fresh effects** — Bespoke effects — typewriter ticks, paper rustle, chart-growth tones, whooshes and stingers — are generated to match actual on-screen animation events.
- **Curated sound library with semantic search** — A role-based catalog of transition whooshes, chimes and impacts with semantic matching and repeat-avoidance so the same file isn't overused.
- **AI-composed background music** — An original score is composed per video from the Director's music plan — mood, style and emotional beats — tiled seamlessly for long videos and delivered as an editable track.
- **Curated music fallback** — A mood-tagged royalty-free library (ambient, triumphant, cinematic, tense, playful, reflective) keeps every video scored.
- **Music controls** — Enable or disable background music per run, set its starting volume, and adjust or remove it later in the editor.
- **Full audio mixdown** — Narration, source-clip audio, dialogue-scene audio, music and effects are mixed with loudness normalization into the final render.

### Assist Mode — Human-in-the-Loop Co-Direction

*Approve the AI's creative decisions like a film director*

Instead of a fully automatic video, Assist Mode pauses the pipeline at the creative checkpoints you choose and asks for your decision in a chat-style panel. Approve or redirect the concept, shot plan, narration, visual style, casting and filmed clips — so the final video matches your vision without you doing the production work.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **13 configurable decision gates** — Enable any subset of pause points: creative concept, shot plan, styleframe, asset requests, narration, cast, dailies, visual casting, shot look, contact sheet, voice, music and avatar.
- **Conversational approvals with five answer modes** — Each gate arrives as a chat card where you select an option, edit the draft directly, type free-form direction, let the AI decide this one, or auto-approve all remaining decisions of that kind.
- **Shot plan review and editing** — See, reorder and rewrite the full planned shot list before any visuals are generated.
- **Narration review and editing** — Edit narration per scene or replace the full script at the gate before the voiceover is recorded.
- **Visual casting with live stock search** — At the visual-casting gate, search stock media live and hand-pick the exact footage or photo for each scene.
- **Dailies review with re-takes** — Review each filmed dialogue clip alongside its automated quality verdict and send back specific shots with a note describing what the re-take must fix.
- **Design identity approval** — Approve the video's visual signature — font pairing, motion style, finishing and color arc — before every shot is produced in that style.
- **Per-decision or batched granularity** — Pause at every individual choice, including per-shot, or receive same-kind decisions consolidated in batches.
- **Persistent, resumable decisions** — Pending decisions survive page reloads; the run resumes cleanly the moment an answer arrives.
- **Live pipeline map** — Watch production as a node graph — research, pitch, screenplay, narration, shot planning, storyboard, talent, filming, score and final cut — with live status per stage.
- **Thumbnail picker** — Choose the video's cover image from generated frame options.
- **Production audit trail** — An audit sheet exposes every stage's inputs and outputs for quality inspection.

### AI Video Editor

*Fix any scene or sentence without regenerating the video*

Every generated video opens in a full timeline editor: scrub frame-accurately, rewrite narration sentence by sentence in the same voice, move and restyle on-screen elements directly on the canvas, and layer music and effects — then re-render the final cut. An AI edit assistant also takes plain-English instructions like 'change the headline' or 'cut the intro', shows you the proposed change, and applies surgical fixes without a costly full regeneration.

**For:** Admin, Teacher · **Where:** Admin Web

- **Timeline scrubbing and live playback** — Frame-accurate scrubbing with a real in-browser playback engine, so you review edits instantly without waiting for renders.
- **Scene and shot management** — Add, edit, reorder, duplicate or delete scenes on the timeline, override a shot's captions, and download individual shots.
- **Edit with AI in plain English** — Type an instruction — 'swap the background video', 'add captions in French', 'drop the last 10 seconds' — and the assistant applies a fast targeted patch or a full remake as needed, with a preview you accept, reject or refine.
- **AI gap-fill scenes** — Generate a brand-new scene to fill a gap in the timeline, styled to match its neighbors.
- **Sentence-level re-narration** — Rewrite one sentence and the platform re-records just that line in the same voice, splices it into the master audio with crossfades, and ripples all later timings automatically.
- **Mute a sentence or scene** — Replace any sentence's or scene's audio with equal-length silence in one click.
- **On-canvas visual editing** — Select, drag and resize text and media layers directly on the video canvas with alignment guides and a full layer stack.
- **Built-in media picker and overlays** — Search stock photos and videos, generate AI images on demand, add image and video overlays, and maintain a saved media library — all inside the editor.
- **Advanced markup editing** — Power users can open any scene's underlying markup in a built-in code editor for pixel-level control.
- **Caption styling** — Ready-made caption style presets plus per-shot caption overrides.
- **Audio tracks, music and transitions** — Manage multiple audio tracks with waveforms, add or remove music and sound cues, trim silent tails, and apply shot-to-shot transitions from a library.
- **Channel restyling** — Restyle a finished video for a new channel — different brand frame, pacing and captions — and export in every aspect ratio needed.
- **AI thumbnails** — Each video gets AI-generated thumbnail options with the headline typeset into the image; swap the selected option or regenerate.
- **Safe collaborative saving** — Conflict detection warns when someone else saved the same video, so edits are never silently lost; script, audio, timings and renders are stored as separate recoverable assets.

### Brand Kits & Video Branding

*Every video in your colors, fonts and logo — automatically*

Define your brand once — palette, fonts, logo, intro and outro, watermark and standing creative instructions — and every AI video applies it automatically at render time. Named brand kits keep separate identities for different brands or departments, a one-click scraper drafts a complete kit from any public website, and per-video overrides handle special cases without touching saved settings.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Institute-wide branding defaults** — Configure intro slide, outro slide, watermark, background theme and typography defaults with live previews; every generated video follows them.
- **Named brand kits** — Create multiple kits — palette, fonts, layout, intro/outro, watermark and director instructions — set a default, and pick a kit per video to fully replace defaults for that run.
- **AI brand kit from a website** — Paste a URL and the platform screenshots the site, detects logo, palette and fonts, and drafts a ready-to-save brand kit including intro, outro and watermark designs.
- **Brand voice instructions** — A free-text instruction block in the kit steers the AI's script, planning and scene design on every video — tone rules, taglines, do/don't lists.
- **Per-video overrides** — Layer one-shot overrides — palette tweaks, a different intro/outro or watermark, custom director instructions — on a single generation without changing saved settings.
- **Intro and outro cards** — Branded opening and closing segments with configurable duration and design, baked into the render.
- **Watermark control** — Configurable watermark position, opacity and design; branding can be toggled off per render.
- **Governance and template locks** — Workspace brand definitions are locked with permission-gated overrides, version history, per-template approval gates and a render audit trail — so every team ships on-brand video self-serve.
- **Template library by team** — Pre-built templates organized by team and use case — launch films, sales videos, training, social cuts, executive updates — forkable into a workspace library and lockable for reuse.

### Professional Rendering & Export

*Broadcast-ready MP4s from a dedicated render farm*

Final videos render on dedicated infrastructure with parallel chunked encoding, so long videos finish fast without affecting the rest of the platform. Creators control resolution, frame rate and a full caption styling suite — including karaoke-style word highlighting — at export time, and one render can serve every channel's aspect ratio.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Resolution and orientation options** — Export at 720p or 1080p in landscape (1920x1080) or portrait (1080x1920).
- **Frame rate options** — Choose 15, 20, 25, 30, 45 or 60 fps per render.
- **Caption styling suite** — Phrase or karaoke word-highlight styles, multiple font families and weights, text and background colors with opacity, stroke, highlight color, position and size presets.
- **Multi-ratio output** — Produce 16:9, 9:16 and 1:1 cuts for every channel from the same project.
- **Branding toggle at export** — Show or hide watermarks and branding per render without editing the video.
- **Parallel chunked rendering** — Videos render in parallel chunks with aggregate progress reporting for fast turnaround on long content.
- **Render job management** — Submit, track and cancel render jobs; completion updates the video automatically.
- **Source footage compositing** — Scenes using your own uploaded footage are composited with frame-accurate seeking and correctly mixed audio.

### AI Reels & Clip Finder

*Turn one lecture into a week of viral shorts*

Point the platform at any long recording and it finds the most engaging moments, scores them like a social media editor, and renders them as short-form reels with captions and branding. A three-step funnel — free scan, low-cost AI preview, full render — means you only pay for clips worth publishing.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Free engagement scan** — Heuristic scoring finds up to 50 candidate moments, rating each on hook strength, pacing, information density, loop-back potential and topic concentration.
- **Targeting controls** — Set target reel duration (10-120 seconds), tolerance, aspect ratio, topic keywords and must-include time ranges; re-scan anytime.
- **Candidate preview** — Review each candidate with a segment player, a thumbnail strip, and a word-importance timeline showing why the moment scored well.
- **AI preview enrichment** — Selected candidates get an AI pass that writes a hook title and rationale, grades words for caption emphasis, and corrects misheard names and terms in the transcript.
- **Aspect ratios and layouts** — Render 9:16, 16:9 or 1:1 with full-speaker, stacked or picture-in-picture layouts.
- **B-roll options** — Auto-pick relevant stock b-roll from the transcript, or supply your own video.
- **Silence trimming and pacing** — Off, gentle or tighter silence trimming plus configurable playback pace up to 1.5x clean up dead air.
- **Cut plan overrides** — Manually override the AI's cut points with your own spans before rendering.
- **Reel scene editing** — Add, update or delete overlay scenes on a finished reel just like the main video editor.
- **Render tracking and retry** — Stage-by-stage progress per reel with one-click retry on failures, plus full reel management.

### Long-Form Edit Projects (Multi-Clip Wizard)

*Raw recordings to a finished edit in guided steps*

A project-based workspace that assembles long-form videos from your raw footage through a guided AI wizard: arrange and slice clips, clean up silences and filler words, add titles and captions, lay in music and effects, and build straight into the editor for final polish. The AI proposes a plan at every step; you refine it in conversation and confirm before anything is built.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Project workspace** — Create and manage projects that bundle multiple indexed video and image assets with a prompt, preferences and per-project options; a dashboard tracks build status per project.
- **Four-step AI wizard** — Arrangement (clip ordering), Cuts (what to trim), Overlays (titles, captions, text) and Audio (music and effects) — each step offers an AI plan, chat-style refinement and explicit confirmation.
- **Smart cut detection** — Automatic silence and filler-word detection proposes cuts; segment picking and sequencing tools assemble the story.
- **Overlay and caption proposals** — The AI proposes titles, text overlays and captions placed on the timeline; every proposal is editable.
- **Audio proposals** — The AI proposes background music and sound effects; a master soundtrack is assembled per build with per-track control.
- **Deep control at every layer** — Override per asset, per project, per wizard step, per operation and per build — skip steps, reorder, or hand-edit anything the AI proposed.
- **Builds and publishing** — Create multiple builds — fork a previous build, change aspect ratio or frame rate — track their status, publish the winner and delete the rest.
- **Frame-level build editing** — Add, update, delete and reorder scenes on a finished build before rendering.
- **Editor handoff and final render** — Open any build directly in the AI video editor for polish, then render to MP4 with the full export options.

### Video Translation & Lip-Synced Localization

*One video localized into 80+ markets in one batch*

Translate any video — script, voiceover and captions — into 80+ languages with frame-accurate lip sync, so the result looks filmed in the target language rather than dubbed. Brand glossaries protect product names from translation, per-segment review lets humans approve the lines that matter, and one batch produces the entire localized set.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Frame-accurate lip sync** — Mouth movements match the new language — for AI avatars and real human talent alike — with per-language preview before render.
- **Brand-glossary protection** — A workspace-locked glossary protects product names, trademarks and idioms from translation; translation memory carries across projects.
- **Per-segment review and approval** — Reviewers approve individual translated lines before render, per market.
- **Batch multi-market rendering** — Pick target markets and produce the full localized set — voiced, captioned, lip-synced — in one batch, with an audit log of every locale shipped.
- **Works on any source video** — Localize videos made on the platform or uploaded from anywhere.
- **Native-speaker QA** — Enterprise plans add a native-speaker quality-assurance review per market.

### AI Transcription & Translation

*Accurate word-timed transcripts for any recording*

Any audio or video file can be transcribed with word-level timestamps, in the source language or translated into English. Transcription powers captions, video indexing, reels, clip extraction and searchable content across the platform.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Async transcription jobs** — Submit any media file, choose accuracy level, and receive the finished transcript with completion callbacks.
- **Word-level timestamps** — Every word is timed, enabling synced captions, sentence editing and clip extraction.
- **Translate mode** — Transcribe in the source language, translate to English, or produce both in one job.
- **Multiple output formats** — Plain text and structured formats for downstream use.

### Screen Recorder with Auto-Edit

*Record once, auto-edit, ship anywhere*

Record a browser tab, application window or full screen with webcam picture-in-picture and background removal — straight from the browser with nothing to install. The platform then automatically removes filler words and dead space, tightens pacing, adds captions and brand-stamps the result for internal shares, support replies or social.

**For:** Admin, Teacher · **Where:** Admin Web

- **Browser-based capture** — Record tab, window or full screen with webcam picture-in-picture and background removal — no extension or install.
- **Automatic filler removal** — 'Ums', silences and dead space are cut with pacing-aware trims, with a one-click 'keep raw' option for technical demos.
- **Caption and brand stamping** — Captions in source and target language plus workspace brand marks applied to every recording.
- **Multi-destination sharing** — Push the same cut to chat, drive or support tools as an internal share, ticket reply or social short.

### Thumbnail Maker

*Click-worthy, on-brand thumbnails with A/B variants*

Generate platform-perfect thumbnails from a finished video, a frame or a brief — with preset compositions tuned for YouTube click-through, LinkedIn scroll-stop, TikTok hooks and X. Brand type, color and logo lockups apply automatically, and multiple variants per video can be pushed straight into YouTube A/B testing.

**For:** Admin, Teacher · **Where:** Admin Web

- **Platform composition presets** — Presets for YouTube, LinkedIn, TikTok and X with per-platform safe-area and crop logic.
- **Automatic brand styling** — Type, palette, logo lockup and overlay style applied at render time, with per-channel variations.
- **A/B variant generation** — Four composition variants per video, pushed directly to YouTube A/B tests with per-variant performance reporting.

### PowerPoint to Video & Animated Slides

*Slide decks that present themselves*

Upload a deck and get two superpowers: a narrated presenter video — speaker notes become the script, transitions are animated, and pacing matches each slide's density — or web-ready animated slides that replay your click-by-click entrance animations beautifully in the browser. Existing uploaded decks can be upgraded in bulk.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Engage Client, API

- **Multi-format deck input** — PPTX, Keynote, Google Slides and PDF supported, with slide text, speaker notes and visual hierarchy read automatically.
- **Speaker-notes narration** — Speaker notes become the narration script when present; otherwise copy is generated — optionally in a cloned voice.
- **Content-aware pacing** — Each slide gets a timing window matched to its density — no flat per-slide timing.
- **Branded motion layer** — Transitions, lower-thirds and motion language applied per your brand template, tweakable per slide.
- **Animation-preserving web slides** — Click-by-click entrance animations are detected from the PPTX and replayed as smooth build steps in the online deck player, rendered at high fidelity.
- **Async conversion and bulk upgrade** — Submit decks as background jobs and upgrade previously uploaded decks to the animated format in bulk.
- **Flexible export** — Every aspect ratio from one deck, exported to MP4, WebM or GIF preview with auto-captions.

### Image to Video

*Product stills turned into branded motion clips*

Turn product shots, screenshots or stock images into motion clips with composition-aware camera moves, narration and on-brand captions. Built for product pages, retargeting creative and email — with batch rendering across an entire product catalog.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Composition-aware motion** — Each image receives the camera move its composition warrants — pans, zooms, parallax — with per-image override and preview.
- **Automatic brand framing** — Lower-thirds, logo placement rules, color overlays and locked caption styles applied at render time.
- **Catalog batch rendering** — Render hundreds of clips across a product catalog in one pass, in every aspect ratio.
- **Ad-account push** — Push finished clips directly to ad accounts and asset managers.

### Video API & Automation

*Video as infrastructure, wired into your stack*

The entire video engine is available as a documented developer API: create API keys, generate videos programmatically from your CRM, product, LMS or marketing tools, and receive webhooks when each video is ready. Teams wire it so releases trigger launch films, CRM stages trigger personalized outreach, and catalogs render per-SKU video automatically.

**For:** Admin, Teacher · **Where:** API, Admin Web

- **API key management** — Generate, list and revoke workspace-scoped API keys directly from the studio.
- **In-app interactive documentation** — Docs cover generation, status polling and asset endpoints with ready-to-copy JavaScript, Python and cURL examples.
- **Cost and route preview endpoints** — Programmatically preview the credit cost and planned production route for a prompt before generating.
- **Personalization at scale** — Submit a template plus variables from a CRM, CSV or webhook — name, company, deal value — and generate thousands of personalized videos with preview and approval gates.
- **Lifecycle webhooks** — Signed webhooks with retries fire at every render lifecycle event; bulk generation is built in.
- **Release-pipeline integration** — Connect the API to your changelog or release process so walkthroughs and launch content refresh automatically with every ship.
- **Catalog and ad integrations** — Wire a product catalog or CSV feed for per-SKU video and push variants directly to ad platforms.
- **Throughput guarantees** — Priority render queues and guaranteed API throughput on higher plans.

### Cost Preview & Spend Guardrails

*Know the credit cost before you press Generate*

Before any video generates, creators see an itemized credit estimate for their exact selections — tier, duration, voice tier, avatar, AI clips, dialogue scenes — next to their live balance. Hard per-run caps, tier balance checks and a full run ledger keep AI video spend predictable and auditable.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Itemized pre-flight estimate** — The cost preview prices your exact configuration — tier, model, duration, voice tier, avatar, music, AI clips, dialogue mode — and shows the breakdown next to your balance.
- **Worst-case rows for premium add-ons** — AI clips and dialogue scenes show upper-bound rows so maximum possible spend is visible before submit.
- **Tier balance checks** — Runs are blocked up front if the balance can't realistically cover the chosen quality tier.
- **Per-run caps and circuit breakers** — Every expensive subsystem — AI clips, vision review, best-of-N designs — carries its own hard cost cap.
- **Run cost ledger** — Each generation records a per-stage, per-model cost breakdown reconciled into credit transactions for full auditability.

### Vimotion Studio Workspace

*A dedicated video studio workspace for your team*

Vimotion is a self-contained studio environment for video teams: a dashboard organizes recent videos, assets, avatars, brand kits, reels and team members, while an onboarding wizard and guided tour get new studios productive quickly. The workspace runs on desktop and inside a mobile app shell.

**For:** Admin, Teacher · **Where:** Admin Web

- **Studio dashboard** — A tabbed workspace — Recent videos, Assets, Avatars, Brand Kits, Reels and Team — with a desktop sidebar and mobile-friendly navigation.
- **Onboarding wizard** — Step-by-step setup covering account type, contact details, verification, studio details and brand panel (colors, fonts, logo).
- **Avatar and brand kit managers** — Create and edit saved presenter avatars and brand kits in dedicated panels, directly usable in every new video.
- **Team management** — Invite and manage the studio's team members from the workspace.
- **Guided product tour** — A built-in interactive tour and help menu walk new users through the studio and editor.
- **Mobile app shell** — The workspace runs inside a native mobile shell, with the heavy editor reserved for desktop.

### Vimotion Standalone Product & Enterprise Governance

*A standalone video studio, from free pilot to enterprise*

Vimotion also ships as a standalone product with its own signup, self-serve pricing and enterprise governance. Prospects join via waitlist or invite code, start on a free pilot video, and scale to plans with per-team approval gates, SSO, SOC 2 compliance, data residency choices and consent-governed AI — everything IT, security and procurement need to say yes.

**For:** Admin · **Where:** Public Web, Admin Web

- **Early access and invite codes** — A public waitlist with live counter, invite codes with usage limits and redemption audit, and a funnel console to invite or reject applicants.
- **Verified self-serve signup** — Email-OTP-verified signup with a dedicated studio login; a brief typed on the website carries through signup so the studio opens pre-loaded with the visitor's intent.
- **Self-serve pricing tiers** — Four transparent tiers from a free pilot video to enterprise, with a public per-tier feature matrix, monthly/annual billing with proration, and invoicing/PO support on higher plans.
- **Render credit system** — Each hero render uses one credit while social cuts from the same brief are free; unused credits roll over on paid plans.
- **Identity and access** — SSO/SAML, automated user provisioning, role-based brand kits and an audit log accessible via console and API.
- **Security, compliance and residency** — SOC 2 Type II, GDPR, custom DPAs and indemnity terms, with US/EU data regions and deployment options up to dedicated single-tenant hosting.
- **AI governance** — Workspace-scoped voice and avatar models, per-asset consent records with revocation, and a guarantee that customer inputs and outputs are never used for model training.
- **Procurement readiness** — Annual invoicing, custom MSAs, line-item POs, pre-completed security questionnaires, and dedicated customer success with quarterly reviews on enterprise plans.

### Vimotion Public Site & Adoption Programs

*Try it, learn it, and earn with it — before you buy*

A dedicated public website lets prospects experience Vimotion before signing up: type a video brief right on the homepage, watch real unedited output, and explore team-specific playbooks. Free browser tools, live masterclass cohorts, a tutorial library and a public changelog support adoption, while an affiliate program rewards partners who refer B2B teams.

**For:** Admin · **Where:** Public Web

- **Interactive marketing website** — A homepage brief prompt that carries into the studio, a showcase wall of sample videos, a live unedited demo render, an interactive feature explorer, and honest pricing and limitations pages.
- **Team use-case playbooks** — Eight audience-specific pages — marketing, sales, onboarding, internal comms, education and L&D, eCommerce, localization and agencies — each with worked workflows and an adoption plan.
- **Free browser tools** — Single-purpose free utilities — caption translator, voice tone detector, thumbnail generator and transcript clipper — as a low-friction way to try the platform.
- **Masterclass cohorts** — Quarterly live, hands-on training sessions per buyer team, taught by the product team in real workspaces.
- **Learning resources and changelog** — A getting-started rollout guide, tutorial library, editorial blog and a public versioned changelog documenting every release.
- **Affiliate program** — 30% recurring commission for 12 months on referred workspaces, 90-day attribution, monthly payouts and curated partner approval.

---

## Automation & Workflows

*Visual workflows and one-click automations across the platform*

Automation & Workflows turns every event in your institute — an enrollment, a missed class, a payment, a new lead — into the next right action, automatically. Build sophisticated flows on a visual canvas, switch on ready-made automations with one click, or simply describe what you want and let AI draft it. Every run is logged step-by-step, so you always know exactly what was sent, to whom, and when.

### Visual Workflow Builder

*Drag-and-drop automation engine for your whole institute*

A full visual builder for event-driven and scheduled automations across the platform. Drag nodes onto a canvas — triggers, data queries, filters, conditions, loops, emails, WhatsApp, push notifications, webhooks and more — wire them together, test them safely, and publish. Workflows listen to what actually happens (attendance, payments, enquiries, live classes, assessments) and fire the next move without anyone lifting a finger. Every run is logged step-by-step so you can see exactly what happened and to whom.

**For:** Admin · **Where:** Admin Web

- **35+ trigger events** — Fire workflows on enrollment, re-enrollment, learner termination, lead form submission, lead opt-out, installment due, live class created/started/ended, payment success/failure, abandoned cart, subscription cancelled, membership expiry, course created, doubt raised, assignment submitted, invites, counsellor assignment, follow-ups due or overdue, lead SLA breaches, lead status changes, inbound AI calls, and assessment lifecycle events.
- **Scheduled workflows** — Run automations on a schedule — cron expressions, intervals or day-of-month, timezone-aware, with start and end dates and next-run visibility.
- **20 node types** — Trigger, Query, Transform, Filter, Aggregate, Action, Send Email, Send WhatsApp, Push Notification, HTTP Request, Chatbot, Delay, If/Else, For-Each loop, Merge, Schedule Task, Update Record, Set Lead Status, Router and AI Call nodes — all in a searchable palette.
- **Prebuilt data queries** — Ready-made lookups like batch students, live-session attendance (present and absent lists), fee installments, admin team emails, attendance reports and user contact details — no technical setup needed.
- **Point-and-click condition & aggregate builders** — Build branching logic and data aggregations visually, with a variable picker that surfaces every value available at each step.
- **Template gallery with 26 use-case templates** — Start from proven templates — batch emails, parent updates, lead confirmations, fee reminders, expiry checks, session recaps, assessment notifications, engagement summaries and more — each with a short question wizard.
- **Outgoing webhooks (Zapier, Make, Pabbly, n8n)** — Send learner or cart details to any external URL on events like enrollment or abandoned checkout, with a fully configurable payload and per-course scoping.
- **Incoming webhook trigger** — Each workflow can expose its own webhook URL, so external systems can start it directly.
- **Safe test runs & manual triggering** — Test-run a workflow before publishing, or fire it on demand outside its schedule — with clear warnings before real messages go out.
- **Pre-publish validation** — Built-in validation catches misconfigured steps with errors and warnings before anything goes live.
- **Execution history & step-by-step logs** — Every run appears in a history tab with summary cards (total, completed, failed, success rate, average duration), a visual execution flow, a timeline, and per-node logs including messages sent and any errors.
- **Duplicate-safe delivery** — Built-in safeguards ensure a learner never receives the same automated message twice for the same event.
- **Workflow management** — Search and list all workflows (event-driven vs scheduled), edit them on the canvas, pause or deactivate with full history preserved, and view a simplified diagram of any automation.

### AI-Assisted Workflow Creation

*Describe the automation — AI drafts the workflow*

Type your goal in plain language — 'email parents every Friday with attendance' — and AI drafts a complete, ready-to-review workflow on the canvas. It asks clarifying questions when needed, explains its reasoning step-by-step, and flags anything that needs your attention. Nothing goes live until you review and publish.

**For:** Admin · **Where:** Admin Web

- **Plain-language drafting** — Describe what you want; the AI picks the right triggers, data queries, templates and actions and assembles the flow for you.
- **Clarifying questions** — When your goal is ambiguous — which batch? which template? — the AI asks targeted follow-up questions and re-drafts.
- **Step-by-step rationale** — Every draft comes with an explanation of why each step exists, so you can trust it and tweak it confidently.
- **Human review before publish** — Drafts load into the visual builder for full review and editing — an admin always makes the final call to publish.
- **Same validation as hand-built workflows** — AI drafts run through the standard validation checks, surfacing errors and warnings inline before going live.

### One-Click Automations Library

*Switch on ready-made automations — no builder required*

A curated library of plug-and-play automations organised by what they do for learners, parents and your own team. Each one is a plain-language toggle: pick a template (or use a provided sample), answer one or two simple questions, and it's live. Behind the scenes each recipe creates a full workflow you can inspect or extend later.

**For:** Admin · **Where:** Admin Web

- **Audience & lead automations** — Instant welcome email on form submission, opt-out confirmations, immediate nurture and second-touch emails, and follow-ups sent a set number of days after a lead submits.
- **Course announcements** — Automatically announce a newly published course to learners in chosen batches — built-in cross-sell.
- **Live class automations** — 'We're live now' alerts when a class starts, invites when one is scheduled, post-class follow-ups, and separate recap emails for learners who attended versus those who missed.
- **Enrollment & onboarding** — Welcome emails with login credentials on enrollment, welcome-back emails on re-enrollment, sub-organisation member welcomes, and access-removed notices.
- **Payments & fees automations** — Daily fee-due reminders, instant payment-success receipts, payment-failed emails with retry links, and abandoned-checkout nudges.
- **Membership & renewal automations** — Scheduled expiry scans with configurable notice periods, renewal nudges when a plan enters its renewal window, cancellation win-back emails, and termination notices.
- **Attendance & engagement reports** — Scheduled attendance reports across all batches, per-learner engagement summaries, and weekly attendance updates.
- **Parent update automations** — Tell parents whether their child attended each live class, plus scheduled weekly attendance roll-ups.
- **Admin team alerts** — Email your team on every new enrollment, payment success or failure, new lead, new course, new doubt raised, assignment submission, and post-class attendance summaries.
- **Assessment notifications** — Notify a batch when an assessment is published and remind them when the assessment window opens.
- **Guided configuration** — Each recipe asks only friendly questions — which template, which batch, what time, how many days — with sample email templates offered when you have none.
- **Toggle on and off with confidence** — Automations show as simple switches; turning one off pauses the underlying workflow with all history preserved.

### WhatsApp Chatbot Flow Builder

*Build WhatsApp bots that qualify leads while you sleep*

A visual drag-and-drop builder for automated WhatsApp conversations. Trigger flows on keywords or events, send messages, templates or interactive button menus, branch on replies, trigger platform workflows mid-chat, and hand over to AI for free-form conversation. Every conversation is recorded as a session, with live inspection and analytics to show how each flow performs.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Nine node types** — Build flows from Trigger, Send Message, Send Template, Send Interactive, Condition, Workflow Action, Delay, HTTP Webhook and AI Response nodes connected on a visual canvas.
- **Six trigger types** — Start flows on keyword match (contains or exact), first contact from a new number, button reply, enrollment events, form submissions, or engagement-threshold events.
- **Free-form messaging** — Send text, images, videos or documents inside the 24-hour conversation window — no template approval needed.
- **Approved template sends** — Send pre-approved WhatsApp templates with body parameters, header media and buttons.
- **Interactive buttons & lists** — Send tappable button menus and list pickers to guide users through choices.
- **Conditional branching & personalisation** — Branch the conversation on the user's reply or resolved variables, with a default fallback path; personalisation variables are substituted throughout the flow.
- **AI-powered replies** — Hand the conversation to AI for natural, free-form answers to open-ended questions inside the flow.
- **Workflow actions & external webhooks** — Trigger any platform workflow from inside a chat — create a lead, enroll a learner, send an email — or call an external URL mid-conversation to fetch or push data.
- **Timed delays** — Pause a flow for minutes or hours (for example, follow up after 24 hours) with a scheduler that reliably resumes where it left off.
- **Variable capture to lead fields** — Map chat answers into lead fields — name, email, mobile, city and more — plus custom fields and session variables, building a lead record straight from the conversation.
- **Session viewer & tracking** — Every user's journey through a flow is a session with a clear status (active, completed, timed-out or error), browsable message-by-message.
- **Flow analytics** — Per-flow and institute-wide analytics on sessions and completions show exactly how each bot performs.
- **Flow lifecycle management** — Draft, activate, deactivate, duplicate, archive and edit flows, with everything listed in one place.
- **Works with your WhatsApp provider** — Flows run transparently over the institute's connected WhatsApp provider.

### Audience Messaging & Drip Automation

*Message an entire lead list in one send*

Send WhatsApp, email or push messages to everyone in a campaign audience, with template variables auto-filled from each lead's form answers and filters to narrow the recipient list. A full history of what was sent to each audience is kept, and leads who opt out are handled automatically — including a polite goodbye sequence.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Multi-channel sends** — Choose WhatsApp (template-based with language selection), email (utility or promotional, with subject and rich body), push notification or in-app alert.
- **Variable mapping** — Map template variables to lead fields so every message is personalised automatically.
- **Recipient filtering** — Narrow a send by lead source, submission date range or custom-field values instead of blasting the whole list.
- **Communication history** — A per-campaign log of every message sent, and per-lead communication history right in the lead drawer.
- **Opt-out management** — Leads who reply STOP or tap opt-out are moved to an opt-out list immediately; silent leads can be auto-opted-out by an inactivity scanner.
- **Opt-out goodbye drip** — A polite goodbye sequence goes out on opt-out — immediate for explicit opt-outs, next morning for inactivity — with a second message two days later.
- **Suppression everywhere** — Opted-out and deleted leads are excluded from every future recipient list automatically.

### Automated Engagement Nudges

*Automatically re-engage learners who go quiet*

Configure inactivity triggers that automatically send a WhatsApp message when a learner or lead hasn't engaged for a chosen period. Rules can be scoped to a batch or the whole institute, chained so a nudge only fires after a previous message, and paired with audience filters that find inactive users ready for a campaign.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **Inactivity thresholds** — Define a time threshold — cumulative or since last activity — after which a chosen template is sent automatically to the inactive contact.
- **Sequenced nudges** — Require that a previous message was already sent before the next nudge fires, enabling drip-style re-engagement sequences.
- **Inactive-audience filters** — Find inactive users, inactive phone numbers, users at a specific point in a message sequence, or users by the messages they have or haven't received — ready to target with a campaign.
- **Real engagement signals** — Learner activity events are logged continuously, so triggers evaluate on real usage rather than guesswork.
- **Per-batch or institute-wide scope** — Each trigger rule is scoped to a specific batch or the whole institute and can be switched on or off independently.

---

## Finance & Payments

*Fees, invoices, subscriptions and 6+ payment gateways*

Vacademy Finance & Payments handles every way an education business collects money — online course sales, recurring subscriptions, school-style fee installments, and front-office cash collection — with the funds settling directly into your own payment gateway account. Branded tax-compliant invoicing, shareable payment links, self-service learner billing and audited fee adjustments replace a patchwork of gateway dashboards, billing tools and spreadsheets with one connected system.

### Payment Gateway Integrations

*Your gateway, your money — connected in minutes*

Connect the payment gateway your institute already uses and collect money directly into your own account — Vacademy never sits between you and your funds. Six gateways are supported out of the box, each with guided credential entry, copy-paste webhook URLs and automatic payment verification. Manage, edit and deactivate gateways any time.

**For:** Admin · **Where:** Admin Web

- **Stripe** — Accept international card payments with your own API keys, including saved cards and recurring charges. An optional webhook signing secret verifies every payment callback.
- **Razorpay** — India's most popular gateway for UPI, cards, netbanking and wallets, with guided setup for key ID, key secret and webhook secret.
- **PhonePe** — PhonePe Standard Checkout for Indian merchants — UPI, cards and wallets with INR settlement, live and sandbox environments, and credential-secured webhooks.
- **Cashfree** — Cashfree Payments for India with hosted checkout and automatic payment-status callbacks.
- **eWAY** — eWAY for Australian and international merchants, including tokenized recurring payments and automatic payment-status polling.
- **PayPal** — Accept international payments through PayPal.
- **Guided gateway setup** — Step-by-step, provider-specific setup inside Settings — field-by-field help, links to each provider's dashboard, and the exact webhook URL to paste in so payment statuses sync automatically.
- **Secure webhook verification** — Incoming payment confirmations are signature-verified per gateway; failed callbacks are logged and can be reprocessed so no payment is ever lost.
- **Real-time payment status checks** — Live order-status lookup against the gateway ensures a payer's screen always reflects the true outcome, even if a confirmation callback is delayed.
- **Gateway lifecycle management** — View configured gateways, edit credentials, refresh status and deactivate a gateway at any time.

### Flexible Payment Plans

*Free, one-time, subscription, installment or donation — price it your way*

Sell every course or batch under the pricing model that fits it: free access, one-time payments, recurring subscriptions, multi-installment fee plans or pay-what-you-want donations. Build payment options once, attach them to batches or enrollment invites as the default or a per-batch preference, and learners automatically see the right checkout.

**For:** Admin · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Free enrollment plans** — Open a course at no charge, optionally with a validity period after which access expires.
- **One-time (upfront) payment** — A single payment for access, with validity configurable in days or months and an optional strike-through 'was' price to show savings.
- **Subscriptions with custom intervals** — Recurring plans with any billing intervals you define (e.g. 1/3/6/12 months), each with its own title, price and feature checklist on the plan card.
- **Donation plans** — Let supporters pay what they want — configure suggested amounts, an optional minimum, and whether custom amounts are allowed.
- **Installment fee plans** — Attach a multi-installment, school-style fee structure (tuition, admission, transport and more) as the payment option for a batch.
- **Plan-level discounts** — Configure discounts directly on a plan — for example longer-commitment pricing — so the reduced price is what learners see at checkout.
- **Enrollment approval gate** — Optionally require admin approval before a paid or free enrollment goes live.
- **Default and preferred plans** — Mark one payment option as the institute default and set preferred options per batch; checkout picks the right one automatically.
- **Multi-member plans** — Plans can carry a member count for family and group enrollments.
- **Plan descriptions, tags and feature lists** — Each plan supports a marketing description, tag and feature list that render on public plan cards.
- **Checkout previews** — Live previews show subscription and donation plans exactly as learners will see them before you publish.
- **Plan library management** — Edit, list and safely delete payment plans from one place.

### Subscriptions & Auto-Pay

*Recurring revenue with automatic off-session charging*

Recurring plans charge learners automatically when each period renews, using saved payment mandates on Stripe, Razorpay or eWAY. Learners manage their own memberships and cards; admins can see and change any learner's plan status at any time.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Payment mandates** — A saved, provider-agnostic auto-pay authorization per subscription charges renewals without the learner returning to checkout.
- **Charge cap protection** — Every mandate carries a maximum amount derived from the plan, enforced before each recurring charge as an extra safety layer.
- **Mandate lifecycle states** — Mandates move through Pending, Active, Paused, Revoked and Failed states, so admins always know why a renewal did or didn't charge.
- **Learner self-service cancellation** — Learners can view their active memberships and cancel a subscription themselves from their account.
- **Admin plan management** — List every learner plan, change plan status (Active, Pending Payment, Payment Failed, Canceled, Expired, Terminated), or cancel on a learner's behalf.
- **Membership details view** — Per-learner membership lookup showing the plan, validity window, payment option and full payment history behind it.
- **Expiry and re-enrollment policies** — Configurable policies define what happens when a plan expires, including re-enrollment rules and follow-up actions.
- **Saved card updates** — Learners can securely replace the card on file and update billing details without contacting the institute.

### School Fee Structures

*Real school fees: heads, installments, penalties, approvals*

Model true school-style fees with multiple fee heads — tuition, admission, transport, hostel, mess, sports and any custom types — each with its own amount, installment schedule and rules. Structures pass through a maker-checker approval before use and attach directly to batches, so every new admission inherits the right fee plan automatically.

**For:** Admin · **Where:** Admin Web

- **Custom fee type catalog** — Define any number of fee heads with name, code and description (Tuition, Admission, Transport, Hostel, Mess, Sports, Exam and more) and reuse them across fee plans.
- **Per-fee installment schedules** — Each fee head can be paid in full or split into numbered installments, each with its own amount, start/end dates and due date.
- **Installment plan templates** — Ready-made Monthly, Quarterly, Term-wise and Annual structures, editable to your academic calendar, with one plan markable as the institute default.
- **Late-payment penalties** — Mark a fee head as penalty-bearing with a configurable penalty percentage for overdue installments.
- **Refundable flags** — Tag fee heads such as caution money as refundable for correct accounting.
- **Built-in discounts** — Apply a percentage or flat discount to a fee head, keeping both the original and discounted amounts on record.
- **Maker-checker approval** — Fee structures record who created them and require a separate approval step before going live.
- **Batch linking** — Attach a fee structure to one or more batches or enrollment invites so new admissions automatically inherit the right fee plan.
- **Fee-type priority ordering** — Set an institute-wide priority order of fee heads that controls how incoming payments are allocated across dues.
- **Edit and retire safely** — Update structures and fee types or retire a structure without losing historical payment records.

### Fee Collection Desk

*Front-office counter for cash, cheque, UPI and card*

A guided four-step counter workflow for office staff: find the student, pick the installments being paid, record the payment, and hand over the receipt. Built for offline payments — cash, cheque, UPI or card — with automatic receipt generation on the spot.

**For:** Admin · **Where:** Admin Web

- **Student search** — Find any student instantly by name or details as the first step of collection.
- **Installment selection** — See all pending and overdue installments across fee heads and choose exactly which ones this payment covers.
- **Offline payment modes** — Record Cash, Cheque, UPI or Card payments with a reference number and a free-text note.
- **Smart payment allocation** — An allocation engine spreads a lump-sum payment across dues by fee-type priority — with overdue-only, upcoming-only or all-dues scopes — or allocate to specific installments manually.
- **Instant receipts** — A fee receipt is generated on the spot with a download link, and past receipts remain downloadable per installment.
- **On-the-spot adjustments** — Apply a concession or penalty during collection, routed through the approval workflow, before confirming the payment.
- **Confirmation and success summary** — A confirmation dialog recaps amounts before recording, followed by a success screen with receipt and invoice actions.

### Student Fee Ledger

*Every student's fee position in one searchable table*

A master view of every student's fee status — expected, paid, due, overdue and waived amounts with a visual collection progress bar per student. Drill into any row for the full installment schedule, receipts and payment ledger, and act on a student's fees straight from their profile.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Status at a glance** — Each student is flagged Paid, Partial, Pending or Overdue with color-coded badges and a collection progress bar.
- **Search and filters** — Filter the ledger by course, fee plan, status and more, with expandable rows showing per-fee-head detail.
- **Installment drill-down** — See every installment with amounts, due dates, payments applied, adjustments and remaining balance.
- **Receipts history** — List and download all fee receipts and invoice receipts for any student.
- **Per-student fee tools** — From a student's profile, staff can view payment history, edit that student's installment plan, apply a plan-level discount, record an offline payment and generate an invoice.
- **Learner self-view** — Learners can check their own dues and receipts and pay pending installments from their app.

### Concessions & Penalties with Approval Workflow

*Discretionary fee changes, fully audited and approved*

Staff can propose a concession (fee waiver) or penalty on any installment, but nothing takes effect until an authorized approver signs off. Every request, approval, rejection and retraction is kept in a permanent, searchable audit trail.

**For:** Admin · **Where:** Admin Web

- **Concession requests** — Reduce a student's installment by a chosen amount with a reason; the request is validated against the expected amount and queued for approval.
- **Penalty application** — Add late-fee penalties to an installment, either manually or from the fee plan's configured penalty percentage.
- **Pending approvals queue** — A dedicated Adjustment Approvals page lists every pending request with student, amount, type and requester for one-click approve or reject.
- **Retraction** — Requesters can withdraw a pending adjustment before it is reviewed.
- **Full adjustment history** — Per-installment and institute-wide history of every adjustment event — submitted, approved, rejected, retracted — with who did what and when.

### Invoicing

*Branded invoices — automatic on payment or raised on demand*

Every successful payment can generate a professional PDF invoice automatically, and admins can raise invoices manually for anything else — for one learner or in bulk — with live preview, taxes, payment links and reminders. Invoices are delivered by email and payable online.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Automatic invoice on payment** — A branded PDF invoice is generated and emailed automatically after each successful online payment, including multi-course orders.
- **Manual invoice creation** — Raise an invoice for any learner with free-form line items (description, quantity, unit price), currency, due date, custom invoice date and notes.
- **Bulk invoicing** — Create the same invoice for many learners at once — each gets their own numbered invoice and payment link.
- **Live preview before sending** — A pixel-accurate preview shows exactly what the learner will receive, with editable fields grouped by section.
- **Editable details** — Override invoice number, customer name and address, institute details, tax label, place of supply and notes per invoice; totals are always computed, never editable.
- **Per-invoice tax control** — Tax defaults from institute settings but can be switched off for an individual invoice.
- **Payment link per invoice** — Every invoice gets a shareable payment link — copy it, email it, or send it over WhatsApp directly from the success screen.
- **Mark paid manually** — Record an offline settlement against an invoice, with payment details, so books stay accurate.
- **Void with reason** — Void an incorrect invoice with a recorded reason instead of deleting history.
- **Duplicate invoice** — Clone a past invoice's line items, currency and notes into a new one; tax re-defaults from current settings for safety.
- **Payment reminders** — Send a reminder email for any unpaid invoice or overdue installment with one click.
- **PDF download and regeneration** — Download any invoice PDF at any time; expired links are regenerated automatically.
- **Invoice lists and search** — Browse all invoices institute-wide or per learner; learners see their own invoices too.

### Invoice Branding, Templates & Tax Settings

*Your logo, your numbering, your country's taxes*

Control exactly how invoices look and how tax is applied. Pick and customize invoice templates with your branding, set your country, tax registration details and tax components, and choose how invoice emails reach payers — so every invoice is compliant out of the box.

**For:** Admin · **Where:** Admin Web

- **Template gallery** — Choose from ready-made invoice templates and customize them; templates use placeholders like invoice number, line items, tax components and institute logo.
- **Institute branding** — Invoices carry your institute logo, name and address automatically.
- **Country and currency defaults** — Set your billing country and default invoice currency once; all new invoices inherit them.
- **Custom tax label and components** — Name your tax (GST, VAT, Sales Tax) and split it into components with individual rates — e.g. CGST 9% + SGST 9% — that render as a tax table on the invoice, with different components possible per package type.
- **Tax registration fields** — Store your GSTIN/tax ID, HSN/SAC code and place of supply so invoices meet local requirements.
- **Invoice email placement** — Choose whether the PDF arrives in a dedicated invoice email or attached to the payment-confirmation email.
- **Internal notification recipients** — Pick which admins are notified about invoice events.

### Payment Links & Public Checkout

*Anyone can pay from a link — no login needed*

Share a link and get paid. Public, branded payment pages let learners, parents or guests pay an invoice, settle fee installments, or buy a course through a stepped catalogue-to-cart-to-payment flow — all without signing in, with live payment-status tracking and a clear result screen. Every signup captures campaign attribution automatically.

**For:** Admin, Learner, Parent · **Where:** Public Web, Learner Web, Learner Mobile App, Admin Web

- **Public invoice payment page** — Each invoice link opens a mobile-friendly page showing the institute's logo, invoice details and line items, with a pay button that launches the configured gateway.
- **Guest fee payment** — Fee dues and full installment schedules can be viewed and paid through open links — ideal for parents paying school fees without an account.
- **Stepped course checkout** — Visitors move through catalogue, cart and payment steps with a clear progress indicator; the starting step is set by the page owner.
- **Coupon entry at checkout** — Buyers apply coupon codes that are validated live and reflected in the payable amount.
- **Enroll multiple learners at once** — A multi-enroll form captures several learners — for example siblings — in one transaction.
- **Custom fields at signup** — Any custom fields configured on the page are collected and stored with the enrollment or lead.
- **Automatic campaign attribution** — UTM source, medium, campaign, content and term on the link are captured and attributed to the resulting lead or enrollment.
- **Instant account and access** — Successful checkout enrolls the learner into the mapped courses immediately, with a configurable success page and login access to start learning.
- **Universal payment result page** — After checkout, payers land on a result screen that confirms success, failure or cancellation, polling the gateway for the final status.
- **Multi-gateway checkout** — The same public flow works across Stripe, Razorpay, PhonePe, Cashfree, eWAY and PayPal based on the institute's configuration.
- **Share via WhatsApp or email** — Payment links can be copied or sent over WhatsApp or email straight from the admin screens that generate them.

### Learner Payment Center & In-App Checkout

*Learners see, manage and pay everything themselves*

Learners and parents get self-service access to their entire financial relationship with the institute: enrolling and paying in-app under any plan type, tracking dues and installments, downloading receipts and invoices, and managing memberships and saved cards — on web, mobile and desktop.

**For:** Learner, Parent · **Where:** Learner Web, Learner Mobile App, Learner Desktop App, Public Web

- **Checkout for every plan type** — Free enrollment, one-time purchase, subscription and donation checkouts, each with clear confirmation, success, pending and failure dialogs.
- **Approval-based enrollment** — Courses that require institute approval show a pending-approval dialog with automatic status polling and a success dialog once approved.
- **Enroll by invite** — Learners enroll through invite links sent by the institute, with a guided form and payment step where applicable.
- **Gateway-matched payment experience** — Checkout adapts to the institute's gateway — inline card, hosted modal or redirect — across Stripe, Razorpay, PhonePe, Cashfree and eWAY, with a result page that routes redirect payments back into the course.
- **Live payment status polling** — After paying, the app polls payment status and moves the learner from pending to success automatically — no manual refresh.
- **Coupon codes at checkout** — Learners apply coupon codes during checkout with instant validation.
- **My dues** — Pending and overdue installments across all fee heads, with amounts and due dates, payable online without visiting the office.
- **My receipts and invoices** — Download past fee receipts and invoices anytime, and pay institute-issued invoices from a link.
- **Membership management** — View active subscriptions and plans with validity, and cancel a recurring plan when needed.
- **Saved payment method and billing details** — View the card on file, replace it securely, and keep billing name and address up to date for receipts.
- **Payment history and expiry visibility** — A record of past payments with statuses and references, plus a list of enrollments nearing expiry so learners can renew in time.

### Multi-Currency Pricing

*Charge in 16 currencies with correct local formatting*

Price courses, plans and invoices in the payer's currency. The platform supports 16 charge currencies and handles each one's symbol, formatting and minor-unit rules — including zero-decimal currencies like yen — correctly across checkout, invoices and reports.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **16 charge currencies** — USD, EUR, GBP, INR, AED, SAR, QAR, AUD, CAD, SGD, HKD, NZD, CHF, JPY, ZAR and MYR available anywhere a price is set.
- **Per-currency prices** — Payment plans and coupons carry explicit prices per currency rather than converted approximations.
- **Correct minor-unit handling** — Gateways are charged in exact minor units per currency — paise, cents, zero-decimal yen — eliminating rounding surprises.
- **Localized symbols everywhere** — Every dashboard, invoice and checkout screen renders the right currency symbol and formatting automatically.
- **Institute default currency** — Set your default currency once and all new plans and invoices inherit it.

### Per-Learner Price Markdowns

*Case-by-case pricing without touching the public plan*

Give an individual enrollment a special price without editing the published plan. Apply a percentage or fixed-amount markdown to a plan for specific enrollment links, look up current markdowns before quoting a family, and reset back to standard pricing at any time.

**For:** Admin · **Where:** Admin Web

- **Percent or absolute markdowns** — Reduce a plan's price by a percentage or a fixed amount for targeted enrollment invites.
- **Markdown lookup** — Query which plans currently carry markdowns and by how much before quoting a price.
- **One-click reset** — Remove a markdown and restore the standard published price instantly.
- **Enrollment-invite discounts** — Attach discount options directly to specific enrollment invites so a particular admission link carries its own pricing.

### Coupons & Discount Codes

*Discount codes with caps, scopes and email locks*

Create discount coupons that apply at any checkout: percentage or flat discounts with an optional maximum cap, usable institute-wide or scoped to specific courses and invite links, with usage limits and optional restriction to named email addresses. Coupon-driven promotions and campaigns pair with the Marketing & Website tools.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Coupon codes** — Custom codes (e.g. SAVE20) with configurable percentage or flat discount value.
- **Maximum discount cap** — Cap the monetary value of percentage discounts.
- **Usage limits** — Limit total redemptions or leave a coupon unlimited.
- **Scope control** — Run coupons institute-wide or scope them to specific courses or invite links.
- **Email-restricted coupons** — Restrict a coupon to specific email addresses — perfect for negotiated or alumni discounts.
- **Live validation at checkout** — Coupons are validated instantly at public and in-app checkout, with the discount reflected in the payable amount.

---

## Institute ERP, HR & Operations

*Enrollment, batches, branches, staff and payroll — run the institute*

Run the entire institute — not just the teaching — from one platform. This pillar covers the operational backbone: a complete learner directory with every enrollment tool from single admissions to 10,000-row bulk imports, batch and session structures with live seat inventory, automated renewals, branch and franchise management, parent engagement, and a full HR suite spanning staff attendance, leave, approvals and payroll. Everything your registrar, HR team and branch managers do daily, unified with your academics.

### Learner Directory & Profiles

*Every learner — searchable, filterable, fully profiled*

A central directory of every learner in the institute with fast search, deep filtering and a detailed profile panel for each person. Admins see enrollment details, contact and guardian info, custom fields, payment status and learning progress in one place, and can export any view to CSV.

**For:** Admin, Teacher, Counsellor · **Where:** Admin Web

- **Server-side search with auto-suggest** — Paginated learner table with name search and type-ahead suggestions, scoped to your institute and academic session.
- **Rich filtering** — Filter by batch, status (active, inactive, invited, pending approval), gender, session expiry window, payment status, approval status, abandoned cart, sub-organization, sub-org role and any custom field.
- **Side-panel profile** — Open any learner's full profile — personal details, batch memberships, custom fields, payment plan and enrollment history — without leaving the list.
- **Learning progress drill-down** — See study progress per subject, module, chapter and slide, including video watch percentage, pages read, quiz and assignment completion, and last activity.
- **Custom field values per learner** — View and edit institute-defined custom fields captured at enrollment for each learner.
- **Edit learner details** — Update a learner's name, contact, address, guardian details and other profile fields at any time.
- **CSV export** — Export the full filtered list or a basic-details version to CSV, including an account-credentials export for offline distribution.
- **Learner statistics** — Aggregate headcounts by status, batch and user type for instant reporting.
- **Multi-course memberships view** — See every course and batch a learner is enrolled in, with expiry date and status per enrollment.

### Enrollment Invite Links

*Shareable enrollment pages with forms and payment built in*

Create branded invite links that let learners self-enroll into chosen courses and batches. Each invite carries its own registration form, payment plans, discounts and referral programs, and every response is tracked, reviewed and approved before or after enrollment.

**For:** Admin, Learner · **Where:** Admin Web, Public Web

- **Invite builder** — Pick the courses, sessions, levels and batches an invite covers; optionally let the learner choose from allowed options via dropdowns.
- **Custom registration form** — Add your custom fields to each invite's form to capture exactly the data you need; a sensible default form is generated automatically.
- **Payment plans on invites** — Attach free, one-time, subscription or donation payment plans with pricing per invite.
- **Discounts** — Configure discounts on invite pricing through a dedicated discount setup.
- **Referral programs** — Attach referral reward programs so existing learners bring in new ones through the same link.
- **Invite lifecycle management** — List, edit, preview, copy and activate or close invites — closed links stop accepting registrations.
- **Response review queue** — Every submission is stored with status; browse, filter and accept or reject registrations individually or in bulk.
- **Automatic registrant emails** — Invitation and status update emails are sent to registrants automatically.
- **Default invite resolution** — Bulk operations and enrollments can resolve a batch's default invite automatically, keeping pricing and forms consistent everywhere.

### Manual & Assisted Enrollment

*Enroll a learner in seconds, with or without payment*

Multiple ways to get learners into courses: a step-by-step enrollment wizard, direct admin enrollment into any batch, and enrollment on a learner's behalf with recorded offline payment. Enrollment automatically sends welcome messages with login credentials.

**For:** Admin, Counsellor, Learner · **Where:** Admin Web, Public Web

- **Enrollment wizard** — Guided form to add a single learner with personal details, guardian info, batch selection, expiry and custom fields.
- **Direct admin enrollment** — Enroll an existing or new user straight into a batch, optionally attaching a payment plan and recording an offline payment amount and mode.
- **Add to more batches** — Attach additional course batches to an existing learner without re-entering their details.
- **Automatic welcome messages** — Send the learner their username and password by email or WhatsApp the moment they are enrolled.
- **Self-enrollment** — Learners can join through institute pages and catalog checkout, feeding the same directory.
- **Re-enroll inactive learners** — One click restores access for a learner whose registration ended.
- **Enrollment audit trail** — Every learner add and update is captured in the admin activity log automatically.

### Bulk Learner Import (CSV)

*Onboard hundreds of learners from one spreadsheet*

Upload a CSV to enroll whole batches at once. You control exactly which columns appear in the template — address, guardian details, expiry, status — and can auto-generate usernames, passwords and enrollment IDs so learners are login-ready immediately.

**For:** Admin · **Where:** Admin Web

- **Configurable CSV template** — Choose optional columns (address, city, region, pincode, parent name, parent mobile/email, linked institute, expiry days, status) before download so the sheet matches your data.
- **Auto-generated credentials** — Toggle auto-generation of usernames, passwords and enrollment IDs during import.
- **Row-level validation** — Uploads are validated with per-row results so bad rows can be fixed and re-uploaded.
- **Default expiry and status** — Apply a default access expiry and enrollment status to every imported learner.
- **Credential distribution** — Send imported learners their login credentials in bulk after import.

### Bulk Assign & De-assign

*Move thousands of learners between courses, safely*

A bulk engine that assigns existing users, brand-new users or a filtered audience into one or more batches — or removes them — in a single operation. A dry-run preview shows exactly what will happen before you commit, with duplicate handling, offline payment capture and optional notifications.

**For:** Admin · **Where:** Admin Web, API

- **Assign by list, new users or filter** — Target explicit users, freshly created users with full profiles including guardian data, or a saved user filter — all in one operation.
- **Multiple destination batches** — Each assignment specifies its batch, invite link, payment option, plan and access days, with per-assignment custom field values.
- **Dry-run preview** — Simulate the whole operation and see the per-user outcome before committing anything.
- **Duplicate handling** — Choose how already-enrolled users are treated (for example, skip) so re-runs are always safe.
- **Offline payment capture** — Record a payment amount, mode, transaction ID and date against each bulk enrollment for fee reconciliation.
- **Installment overrides** — Override installment schedules for bulk-enrolled users where payment plans apply.
- **Soft or hard de-assign** — Remove learners from batches in recoverable soft mode or permanent hard mode, with optional notification and its own dry-run.
- **Optional notifications and credentials** — Decide whether learners are notified and whether login credentials are sent as part of the bulk action.

### Enrollment Requests & Approvals

*Review and approve who joins, one by one or in bulk*

A dedicated inbox of learners whose enrollment is pending approval or who were invited but not yet confirmed. Filter by gender, preferred batch, payment status and payment option, then accept or decline individually or across a whole selection.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Pending-request inbox** — See every learner awaiting approval or confirmation, with their requested batch and payment details.
- **Accept / decline actions** — Approve or reject a request in one click, with bulk accept and bulk decline across selections.
- **Approval with batch placement** — Approving a request enrolls the learner into their requested batch immediately.
- **Triage filters** — Filter requests by gender, preferred batch, payment status, approval status and payment option.
- **Outreach from the inbox** — Share credentials or send WhatsApp and email to requestors without leaving the screen.

### Learner Lifecycle Actions

*Change batch, extend, renew, terminate — solo or in bulk*

Day-to-day registrar actions available on any learner or any multi-select of learners: batch transfers, access extensions, next-session re-registration, termination and deletion, plus outbound actions like credential sharing, WhatsApp and email blasts, and certificate creation.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Change batch** — Move one or many learners to a different course, session and level in one dialog.
- **Extend access** — Push out session expiry dates individually or in bulk.
- **Re-register for next session** — Roll learners into the next academic session with target packages and access days; study material can carry over from the previous session.
- **Terminate registration** — End a learner's enrollment, optionally triggering a configured off-boarding workflow.
- **Re-enroll** — Restore an inactive learner's access with a single click.
- **Delete learner** — Remove learner records entirely, with confirmation and bulk support.
- **Share credentials** — Send usernames and passwords to selected learners via your configured channels.
- **Bulk WhatsApp & email** — Message any selection of learners straight from the list.
- **Create certificates** — Generate course-completion certificates for selected learners from the same bulk menu.

### Batch & Academic Session Management

*Structure courses into sessions, levels and batches*

Manage the institute's academic structure end to end: create academic sessions, levels and batches through guided steps, organize cohorts into hierarchies, and administer everything from one screen with learner counts always in view.

**For:** Admin · **Where:** Admin Web

- **Create batch wizard** — A step-by-step dialog creates the course, level and session in sequence, producing a ready-to-enroll batch.
- **Academic session administration** — Add, edit and delete academic sessions, with guards against destructive deletes.
- **Batch listing & summary** — Paginated batch lists per session with learner counts, start times, status, and search.
- **Parent-child batch hierarchies** — Link parent batches to child batches for cohort hierarchies and franchise structures.
- **Sub-org association** — Assign batches to sub-organizations so each branch sees only its own cohorts.
- **Learner grouping** — Tie batches to named groups for organizing cohorts within a course.
- **Bulk batch lookup** — Look up many batches at once for reporting or integration scenarios.
- **Safe deletion** — Remove batches that are no longer needed, individually or in bulk, with confirmation.

### Seat Inventory Management

*Cap seats per batch and watch availability live*

Set maximum seats for any batch and monitor capacity across the institute in real time. Seats are reserved and released automatically during enrollment, and dashboards flag batches that are nearly full — so sales can push urgency or admins can add capacity.

**For:** Admin · **Where:** Admin Web

- **Per-batch capacity** — Set maximum seats and available slots for each batch, or mark it unlimited.
- **Automatic reservations** — Seats are reserved and released automatically as learners move through enrollment flows — no overselling.
- **Capacity stat cards** — At-a-glance totals: total batches, limited vs unlimited, total capacity, seats remaining, and low-availability and critical batches.
- **Availability checks & filters** — Check availability for one batch or many at once, and filter inventory by course, level, session, search text and availability status.
- **Table and card views** — Switch between a dense table and visual cards over the same inventory data.
- **Quick capacity updates** — Update seat counts from a dialog without leaving the inventory screen.

### Enrollment & Renewal Automation

*Expiries, reminders and renewals that run themselves*

Define per-batch policies for everything around expiry: automated email, WhatsApp and push reminders before and on expiry, waiting periods, automatic renewal charges for saved payment methods, and re-enrollment rules. The scheduler executes these policies continuously without staff involvement.

**For:** Admin, Learner · **Where:** Admin Web, API

- **Pre-expiry and on-expiry notifications** — Configure templated reminders per channel (email, WhatsApp, push) triggered before expiry or the moment it arrives.
- **Expiry processing pipeline** — Automated processing moves learners correctly through pre-expiry, waiting period and final expiry stages.
- **Automatic renewal charging** — Subscription renewals are charged automatically, and the success or failure drives the learner's status.
- **Re-enrollment rules** — Set re-enrollment gap validation and upgrade options, with invite links shown to expired learners.
- **Repurchase behavior** — Choose whether a repurchase while still active stacks onto remaining time or overwrites it.
- **Workflow hooks & learner actions** — Attach workflows and interactive elements — such as WhatsApp buttons — to each lifecycle stage.
- **Sub-org payment routing** — The policy engine recognizes sub-organization-paid enrollments and routes renewal charges accordingly.

### Sub-Organization (Branch & Franchise) Management

*Run branches, franchises and partner orgs under one roof*

Create and manage sub-organizations — branches, franchise partners or client companies — each with its own team, seat allocation and finances. Parent-institute admins see seat usage, a full financial ledger and subscription status per sub-org, while partners manage their own learner rosters without needing admin-portal access.

**For:** Admin, Counsellor · **Where:** Admin Web, Learner Web

- **Create sub-orgs** — Spin up a sub-organization directly, or create one bundled with a subscription — seats, validity and courses — in one step.
- **Seat usage tracking** — Monitor seats consumed versus purchased for each sub-org subscription.
- **Financial ledger** — Per-sub-org ledger with invoice, payment, waiver, adjustment and penalty entries; record payments and mark invoices paid from the UI.
- **Subscription status** — See each sub-org's subscription state and pending installments at a glance.
- **Team roster** — Add or remove sub-org team members, list them with filters, and view each member's installment history.
- **Scoped invite links** — Enrollment invites can be scoped to a sub-org so its learners register under the right branch.
- **Analytics panel** — Per-sub-org dashboard covering admin payments, invoices, member courses and learner lists.
- **Learner-to-sub-org linking** — Learners link to sub-orgs as direct, inherited or partnership members, and the main directory filters by sub-org.
- **Member outstanding balances** — Per-member financial summary of total accrued, paid, balance and overdue amounts in the sub-org's currency.
- **Partner self-serve roster** — Partners get their own in-app screen to view their member roster, add learners individually with custom fields, or bulk upload many at once.
- **Partner member removal** — Partners can select and terminate members from their own organization directly.

### Sub-Org Self-Registration

*Partners onboard themselves through a public link*

Publish a registration link that lets a new branch or partner organization sign itself up end to end: fill a custom form, accept terms, verify by OTP, complete KYC, pay online and receive a ready-made workspace with admin access — with optional manual approval by the parent institute.

**For:** Admin · **Where:** Admin Web, Public Web

- **Registration templates** — Design reusable templates defining form steps, custom fields, terms document and consent items, seat count, validity, allowed team roles, admin permissions and included courses.
- **Public multi-step flow** — Applicants save their details, verify email or phone by OTP with resend, and can resume an interrupted registration later.
- **Built-in payments** — Collect registration payment online with retry support and a configurable vendor and currency.
- **KYC verification** — Integrated identity verification with a document checklist and live status updates.
- **Approval gate & caps** — Optionally require parent-institute approval, and cap total registrations per link.
- **Completion experience** — Custom completion message, button label and redirect so new partners land exactly where you want them.
- **Registrations pipeline** — List every registration with status — including KYC status — and manage templates centrally.

### Staff, Teams & Org Chart

*Your whole staff, their teams, and who reports to whom*

Manage every staff account centrally — invite by email with pre-assigned roles, create users in bulk, distribute credentials and reset passwords. Model your real organization with departments, nested teams, team heads and reporting lines, all visualized on an interactive org chart.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Institute users view** — List all staff with role and status filters, enable or disable accounts, and edit roles in place.
- **Email invitations with roles** — Invite admins, teachers, course creators, assessment creators and evaluators with roles pre-assigned; resend or edit pending invitations before acceptance.
- **Bulk user creation** — Create many users in one operation — onboard an entire teaching staff at once.
- **Credentials & passwords** — Send login credentials individually or in batches, and update or reset passwords when someone is locked out.
- **Search & profile management** — Type-ahead search across all users, with editable profiles — name, email, mobile, photo — reflected across every app.
- **Teams & sub-teams** — Create named teams, nest them under parent teams, order them for display, and manage each member's access.
- **Team heads & member roles** — Designate a head for each team and give every member a role label, such as 'Senior Counsellor'.
- **Reporting lines & org chart** — Link each member to the person they report to, and see the whole hierarchy on a visual, drag-and-drop org chart with permission-controlled visibility.
- **Hierarchy lookups** — Trace any member's full chain of managers upward, everyone beneath them, and every team they belong to.
- **Sub-org scoped team views** — Filter users by sub-org and view a per-sub-org team page with its own analytics.
- **Inactive-user export** — Export a CSV of users inactive for a chosen number of days to drive re-engagement.

### Roles & Granular Permissions

*Decide exactly what each role sees and can do*

Access is governed by roles — Admin, Teacher, Evaluator and Learner out of the box — plus unlimited custom roles you define yourself. Configure each role's entire portal experience: which sidebar sections, tabs, columns and dashboard widgets appear, and which sensitive actions are allowed.

**For:** Admin · **Where:** Admin Web, API

- **Built-in role set** — Admin, Teacher and Evaluator roles for staff plus the Learner role for students, each unlocking the right screens and actions.
- **Custom roles** — Create, rename and delete institute-specific roles — such as 'Front Desk' or 'Lead Manager' — each with its own permission set and configuration screen.
- **Per-institute role scoping** — The same person can be an Admin in one institute and a Teacher in another — roles are scoped to each workspace.
- **Role lifecycle management** — Add or remove roles on users, view counts per role, filter by status (invited, active, disabled), and disable access without deleting the account.
- **Per-user permission grants** — Grant individual users named permissions on specific resources, on top of what their roles provide.
- **Layout & navigation control** — Toggle sidebar sections per role, and add custom tabs and sub-tabs — for example, links out to your own tools.
- **Course & slide permissions** — Control access to All Courses, Authored Courses, Courses In Review and Course Approval, plus slide-level rights: copy, move, delete, download and read-only viewing.
- **Learner profile tab control** — Show or hide each learner-profile tab per role — Overview, Progress, Tests, Membership, Payment History, Guardian, Enquiry, Lead Profile, Files, Badges, Reports and more.
- **Sensitive account permissions** — Per-role switches for viewing learner passwords, sending password resets, accessing the learner portal on a learner's behalf, and editing institute details.
- **Audience & campaign access modes** — Restrict a role to specific audience lists — ideal for counsellor teams working separate campaigns.
- **Column & filter pickers** — Choose which learner-list columns and which lead-filter custom fields each role sees.
- **Concurrent login limit** — Cap active sessions per account to prevent account sharing.
- **Role display names** — Role labels shown across the portal respect your institute-configured display names.

### Faculty & Teaching Assignment

*Map every teacher to their subjects and batches*

Assign teachers to the exact subjects and batches they teach, update assignments as timetables change, and browse the whole faculty with filters. Fine-grained access grants control what else each staff member can reach.

**For:** Admin, Teacher · **Where:** Admin Web

- **Assign subjects & batches** — Attach a teacher — existing or newly created — to one or more batches with specific subjects per batch.
- **Update assignments** — Revise a teacher's batch-subject mapping at any time as timetables change.
- **Faculty directory** — Search and filter all faculty with their statuses and assignments; a flat batch-subject view supports auditing.
- **Course-creator lookup** — Quickly list faculty who create content, for authoring workflows.
- **Per-user access grants** — Grant staff named access to specific resources with a chosen permission level, viewable per user.

### Parent & Guardian Linking

*Connect parents to their children's learning accounts*

Link parent and guardian accounts to learners so families stay connected to progress, fees and communication. Link existing accounts or create new ones on the spot, in either direction, and backfill guardian links and portal credentials from historical records in bulk.

**For:** Admin, Parent, Learner · **Where:** Admin Web, Learner Mobile App, API

- **Link existing or create new** — Connect two existing accounts, or create a new guardian or student account on the spot with name, email and mobile.
- **Bidirectional linking** — Works from either side — a parent adding their student or a student adding their parent — and supports multiple children per parent.
- **Family relations lookup** — Look up a learner's parents or a parent's children from any profile, powering dashboards, notifications and fee communication.
- **Parent lookup by mobile** — Find or match a parent account by phone number during admissions or messaging.
- **Bulk guardian backfill** — Detect learners whose records contain parent details but no linked guardian account — including from leads — and create the links in one run.
- **Credential backfill** — Send portal credentials to guardians of all existing students in one action, choosing who receives the notification.
- **Parent experience settings** — Institute-level settings control how guardian details are collected and what parents can access.

### Parent Portal

*A dedicated portal for parents, from admission to results*

Parents get their own portal — with a child selector for multi-child families — covering the entire journey: admission applications, interview and test scheduling, document verification, fee payments, attendance, progress and upcoming schedules. Ideal for schools running structured admission cycles and for keeping families engaged after enrollment.

**For:** Parent, Admin, Teacher · **Where:** Learner Web, Learner Mobile App, Public Web

- **Multi-child support** — All children under one login, with one-tap switching between child profiles.
- **Parent dashboard** — An overview per child of admission progress, attendance, scores, completion, certificates, payment status, schedule and pending actions.
- **Digital application form** — Parents fill and submit the admission application online.
- **Interview & tests module** — View and track scheduled interviews and entrance assessments.
- **Admission tracker** — A step-by-step status tracker showing exactly where the child is in the admission pipeline.
- **Document verification** — Upload required documents and track them through verification.
- **Fee payments** — Pay admission and course fees online, with a clear breakdown of what is due.
- **Schedule view** — The child's upcoming sessions and events, visible to parents.
- **Branded parent mobile app** — A native mobile experience under the institute's own brand, with push notifications.
- **Structured faculty messaging** — Parent-to-faculty messages routed through the platform, keeping staff personal numbers private.
- **Progress digests & alerts** — Automatic progress digests and alerts delivered over WhatsApp, email and push.
- **Multi-language interface** — Parents choose their preferred language for the portal.

### Learner Attendance Reports

*Learners and parents always know the attendance picture*

Attendance captured in live classes rolls up into learner- and parent-facing reports. A weekly widget shows day-by-day status on the dashboard, and a full report page lets families review attendance history across batches.

**For:** Learner, Parent · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **Weekly attendance widget** — A day-by-day present, absent or pending view of the current week, right on the dashboard.
- **Attendance report page** — Detailed attendance history with session-level records across batches.
- **Attendance-driven stats** — Attendance percentages feed dashboard stats and achievement badges.

### Teacher Planning & Diary Logs

*Lesson plans and daily diaries, shareable with students*

Teachers record lesson plans and diary logs against a batch and subject for any interval — daily, weekly, monthly or yearly. Entries are rich documents with attachments, browsable as a table or timeline, and can be shared so learners and parents see what was planned versus what was done.

**For:** Teacher, Admin, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Plans and diaries** — Create forward-looking planning entries or retrospective diary logs — two distinct record types.
- **Interval-based organization** — Attach logs to daily, weekly, monthly or yearly periods, with quick pickers for today, tomorrow, this week, next month and more.
- **Rich content editor** — Write plans in a rich-text editor with an automatic title generator and file attachments.
- **Batch & subject scoping** — Every entry ties to a specific batch and subject so records line up with the timetable.
- **Share with students** — Toggle any plan to be visible to learners.
- **Table & timeline views** — Browse logs as a filterable table or a chronological timeline, and edit entries in place.
- **Learner-side today's plan** — Learners see the current day's plan highlighted on their planning page for quick action.
- **Learner activity timeline** — Learners and parents browse planning and activity logs on a timeline, filter by period and type, and open attachments on each entry.

### Custom Fields & Data Model Builder

*Capture exactly the data your institute needs*

Define your own data fields — text, dropdowns, dates, files, multi-selects and more — and attach them to enrollment forms, live-session and assessment registrations, audience campaigns or institute-wide learner records. Map custom fields to built-in system fields and keep both in sync automatically.

**For:** Admin, Counsellor · **Where:** Admin Web, Public Web, API

- **12 field types** — Text, textarea, email, URL, number, date, phone, dropdown, radio, checkbox, file upload and multi-select — dropdown-style fields carry their own configurable option lists.
- **Attach fields anywhere** — Scope fields institute-wide or per enrollment invite, live session, assessment or audience form — each context gets its own tailored set.
- **Reusable field library** — Create fields once and reuse them across enrollment invites, audience forms and learner profiles.
- **Field groups & ordering** — Organize fields into groups and control their order on forms.
- **File-upload answers** — Forms can collect document and image uploads as answers to custom fields.
- **System-field mapping & sync** — Map custom fields to built-in fields on students, users or enquiries, and sync values automatically in either direction.
- **Usage tracking & safe deletion** — See everywhere a field is used before deleting; deletions are soft and can be done in bulk.
- **Custom fields in filters & columns** — Expose chosen custom fields as lead filters and learner-list columns per role, and render them on public enrollment and enquiry pages.

### Catalog Operations Console

*Administer every course, price and batch from one table*

A power-admin console over the entire course catalog. See every course and batch combination in a filterable table, edit course details, sessions, payment options and invites inline, and manage pricing at scale — including bulk offers and CSV-driven course creation.

**For:** Admin · **Where:** Admin Web

- **Catalog table with filters** — A filterable, paginated table of all courses and their batch variants, with a detail sidebar per batch.
- **Inline edit dialogs** — Edit a course, its session, its payment option or its enrollment invite directly from the table row.
- **Bulk offer pricing** — Select eligible batches by session, level and status and apply an offer price across all of them at once, with per-row eligibility reasons, a results summary and a reset-to-original option.
- **Bulk course creation from CSV** — Import many courses at once — with type, tags, batches, seat inventory and payment configuration per row — including similar-course detection, preview and global defaults.
- **Payment configuration at scale** — Set free, one-time, subscription or donation pricing, currency, validity days, strike-through price and approval requirements during bulk creation.
- **Publishing control** — Choose per course whether it appears in the public catalogue.

### Student Terms & Conditions

*Digital T&C signing built into enrollment*

Upload your institute's terms and conditions as a PDF and have learners sign digitally with their name during enrollment. Chosen staff are notified by email every time a learner signs.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web

- **T&C PDF upload** — Upload the terms document learners must accept.
- **Named signature** — Require the learner's name on the signature for a stronger record.
- **Sign notifications** — Notify chosen email recipients whenever a learner signs.

### HR: Employee Records

*A proper HRIS for your staff, inside the platform*

Maintain complete employee records for all staff: profiles, departments, designations, employment type and status, bank accounts for salary and a document vault. Employee state changes — probation, notice period, relieved — are tracked formally. Fully API-driven, so it plugs into your existing systems.

**For:** Admin · **Where:** Admin Web, API

- **Employee profiles** — Create and update employee profiles with filtering and search across the workforce.
- **Departments & designations** — Define departments and designations and organize employees under them.
- **Employment types & statuses** — Track full-time, part-time and contract staff through statuses: active, probation, notice period, relieved, terminated.
- **Bank details** — Store one or more bank accounts per employee for salary payout, editable over time.
- **Document vault** — Upload and manage employee documents — offer letters, appointment letters, ID proofs, PAN, Aadhaar, passport, degrees, experience and relieving letters.
- **Reporting-line view** — See any employee's position in the org chart — their manager and their reports.

### HR: Staff Attendance & Shifts

*Check-ins, shifts, holidays and regularization*

Track staff attendance with self check-in and check-out or admin bulk marking, sourced manually, from biometric devices or by geo-location. Define shifts and assign them to employees, maintain the holiday calendar, and let staff request regularization of missed punches with approval.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Check-in / check-out** — Employees punch in and out; records capture the source — manual, biometric device or geo-location — and mode.
- **Bulk attendance marking** — Mark attendance for many employees at once with statuses: present, absent, half day, on leave, holiday, weekend.
- **Records & summaries** — Query attendance history and per-period summaries for one employee or across the institute.
- **Attendance configuration** — Institute-level attendance settings, including the time-tracking mode.
- **Regularization requests** — Staff raise requests for missed or incorrect punches; approvers act on them through the approval workflow.
- **Shift management** — Create shifts, edit timings and assign shifts to employees.
- **Holiday calendar** — Maintain holidays individually or via bulk upload, with edit and delete.

### HR: Leave Management

*Policies, balances, approvals and comp-offs, automated*

A full leave system: define leave types and policies with monthly or yearly accrual, let staff apply — including half days — route approvals, and keep balances accurate with adjustments, scheduled accrual runs and year-end carry-forward processing. Compensatory off is supported end to end.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Leave types & policies** — Create leave types and policy rules with monthly or yearly accrual, and update them as HR rules evolve.
- **Apply & track** — Employees apply for full or half-day leave, follow the status — pending, approved, rejected, cancelled — and cancel when needed.
- **Approval queue** — Managers see pending applications and approve or reject in one action.
- **Leave balances** — Per-employee balances with manual adjustment for corrections.
- **Accrual & year-end runs** — Run accrual processing and year-end carry-forward or lapse processing across the institute.
- **Compensatory off** — Grant comp-off for extra days worked, approve or reject requests, and keep full comp-off history.

### HR: Approval Workflows

*Multi-step approval chains for every HR request*

Configure who approves what: build approval chains where each step is the reporting manager, department head or HR admin. Chains govern leave applications, attendance regularizations, reimbursements and loans, with a unified pending queue and a complete history.

**For:** Admin · **Where:** API

- **Approval chain builder** — Define ordered approver steps by type: reporting manager, department head or HR admin.
- **Broad coverage** — Chains apply to leave applications, attendance regularization, reimbursements and loans.
- **Unified pending queue** — Approvers see everything awaiting them in one place and approve or reject per request.
- **Approval history** — A complete audit trail of who approved what, and when.

### HR: Payroll, Payslips & Disbursement

*Salary runs from calculation to paid, with holds*

Run monthly payroll end to end: create a run, auto-calculate every employee's entry from their salary structure, review component-level breakdowns, hold or release individual payouts, then approve and mark the run paid. Loans, salary advances and expense reimbursements flow into the same run, and payslips and bank-transfer files come out the other side.

**For:** Admin · **Where:** Admin Web, API

- **Payroll runs** — Create, process, approve, mark paid or delete runs; statuses move through draft, processing, processed, approved and paid.
- **Entry-level detail** — Inspect each employee's payroll entry and every earning and deduction component behind it.
- **Hold & release** — Put any employee's payout on hold within a run and release it later.
- **Loans & salary advances** — Issue salary advances or personal loans, approve them, and track repayments that auto-deduct through payroll.
- **Reimbursements** — Staff claim travel, medical, food, phone or internet expenses; approved amounts pay out through payroll.
- **Payslip generation** — Generate payslips in bulk for a run, retrievable individually per employee.
- **Bank export files** — Produce bank-ready disbursement exports for salary transfer, with a log of every export.
- **Payroll summary reports** — Aggregate payroll cost reporting across periods for management and finance.

### HR: Salary Structures & Employee Tax

*Reusable salary templates with India-ready tax handling*

Model compensation with earning and deduction components calculated as flat amounts or percentages of basic, CTC or gross. Combine components into reusable templates, assign structures per employee with overrides, and handle Indian income tax — investment declarations and old-versus-new regime computation — inside payroll so TDS deductions are correct.

**For:** Admin · **Where:** API

- **Salary components** — Define earning and deduction components as a fixed amount or a percentage of basic, CTC or gross, categorized fixed or variable.
- **Salary templates** — Bundle components into templates for common pay grades, editable centrally.
- **Employee structures with overrides** — Assign a structure to each employee with component-level overrides where needed.
- **Revision history** — Every salary revision is recorded and listable for audits and increment cycles.
- **Tax configuration** — Institute-level tax setup covering financial-year parameters.
- **Investment declarations** — Employees submit and update declarations, and HR verifies them before they affect tax.
- **Regime-aware tax computation** — A built-in engine computes each employee's liability under India's old or new tax regime, keeping TDS deductions accurate.

---

## Analytics & Reports

*Dashboards and reports for learning, sales, fees and engagement*

Every part of Vacademy — learning, sales, finance, communication and operations — feeds into a connected reporting layer, so leadership runs the institute on live data instead of end-of-month spreadsheets. Role-aware dashboards surface what matters to each team, AI turns raw activity into readable report cards for students and parents, and every report exports as branded PDFs or CSVs under your own letterhead.

### AI Student Report Cards

*A complete AI-written report on any student, on demand*

Generate a comprehensive report card for any learner that pulls together everything the platform knows — attendance, marks, course progress, assignments, live-class participation, doubts asked, login habits, achievements and certificates — and adds an AI-written narrative with insights and topic-level confidence. Export it as a polished PDF or email it straight to parents, and let learners open their own reports in the app.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **One-click report generation** — Kick off an AI analysis for any student and track the run until the finished report is ready.
- **Comprehensive data sections** — Overview, identity, attendance, academics and subject marks, course progress, assignments, live classes, doubts and engagement, study habits, login activity, achievements and certificates — all aggregated automatically.
- **AI narrative and insights** — A readable, teacher-quality narrative plus AI insights and per-topic confidence ratings that explain how the student is really doing.
- **PDF export** — Download any report as a polished, branded PDF report card.
- **Email delivery to parents** — Send the report card by formatted email — ideal for keeping parents in the loop.
- **External data enrichment** — Attach records from outside the platform to a student's profile so they are woven into future reports.
- **Learner reports hub** — Learners and parents open every institute-generated report card from a dedicated 'My Reports' area, with report status per run.
- **Printable report view** — Report cards render in a clean, print-friendly layout for sharing and filing.

### Admin Home Dashboard

*A role-aware command center with live KPIs*

The landing dashboard adapts to each staff member's role — admins see institute-wide KPIs and finance, teachers see today's classes and their courses. Widgets cover enrollments, live classes, doubts, notifications, payments and real-time user analytics, with one-click quick actions for the most common tasks.

**For:** Admin, Teacher, Evaluator · **Where:** Admin Web

- **Role-based widget bundles** — Admins, teachers, course creators, assessment creators and evaluators each get a curated default widget set, adjustable through display settings.
- **KPI band with deltas** — Headline institute KPIs with change-over-period deltas so trends are obvious at a glance.
- **Quick actions strip** — Role-relevant one-click actions: add student, new batch, announcement, payments, reports, today's classes, my courses, new course, assessments and evaluations.
- **Operational widgets** — Widgets for enrolling learners, live classes with editable class links, unresolved doubts, recent notifications, pending actions, the learning center and the assessment center.
- **Finance widgets** — A finance summary and recent transactions right on the home screen.
- **Real-time usage widgets** — Live tiles for currently active users, hourly activity, daily trends, most active users, device usage and service usage.
- **User management tabs** — Manage institute users, send invites and view learners without leaving the dashboard.
- **Guided onboarding tracker** — New institutes see a step-by-step onboarding tracker that walks them through setting up their workspace.
- **Admin profile editing** — Edit your own profile and account details directly from the dashboard.

### Sales Dashboard

*Your whole sales operation on one screen*

A live command center for admissions sales: headline KPIs, the conversion funnel, source performance, call volume, follow-up risk and counsellor rankings — all filterable by team and date range. Auto-generated insights call out what changed and what needs attention.

**For:** Admin, Counsellor · **Where:** Admin Web

- **KPI band** — Headline numbers for the selected window — leads, conversions and other core sales metrics at a glance.
- **Conversion funnel** — Stage-by-stage funnel showing exactly where leads drop off.
- **Conversion by source** — Compare how each lead source — Meta, Google, website, walk-in — actually converts.
- **Calls-per-day trend** — Daily calling volume charted over the selected window.
- **New vs existing leads** — A time series separating fresh leads from returning ones.
- **Reassignment volume** — Track how often leads move between counsellors over time.
- **Upcoming and missed follow-ups** — Live widgets list follow-ups due soon and follow-ups already missed, so nothing slips.
- **Campaign cards** — Per-campaign performance cards side by side for quick comparison.
- **Counsellor leaderboard** — A team ranking embedded right on the dashboard.
- **Automatic insights strip** — System-generated callouts highlight notable movements in your numbers.
- **Team and date scoping** — 7/30/90-day presets or custom ranges plus a team picker; permissions control whether a manager sees their team or the whole institute.

### CRM Reports Center

*A dozen deep-dive sales reports in one hub*

A tabbed analytics hub with shared date, team and counsellor filters feeding every report — from top-line overviews and source analysis to revenue, cohorts and forecasts. Each tab exports to CSV and every view is deep-linkable for sharing with the team.

**For:** Admin, Counsellor · **Where:** Admin Web

- **Overview report** — Top-line lead and conversion metrics for the selected window.
- **Sources report** — Lead volume and conversion broken down by acquisition source.
- **Funnel report** — Pipeline-stage funnel with drop-off analysis.
- **Dispositions report** — How calls and leads are being dispositioned across the team.
- **Calling report** — Call volume, connect rates and outcomes across human and AI calls.
- **Activity report** — Team activity levels — notes, status changes, touches — with CSV export.
- **Follow-ups report** — Follow-up completion and overdue analysis.
- **Counsellors report** — Per-rep performance comparison across the team.
- **Manager report** — Manager-level rollups across teams, with CSV export.
- **Revenue report** — Revenue attributed to leads and campaigns.
- **Cohort report** — How lead cohorts from different periods mature over time.
- **Forecast report** — A forward-looking projection based on the current pipeline.
- **Custom reports** — Build your own report views beyond the standard tabs.
- **CRM intelligence report** — AI-assisted intelligence summaries of CRM performance when call intelligence is enabled.
- **Center heatmap** — Center-level heatmap analytics of lead activity across locations.
- **Shared filter bar and deep links** — Date presets or custom ranges, team scope and counsellor scope apply across every tab; the active tab lives in the URL for shareable deep links.

### Admission Pipeline Dashboard

*Your enquiry-to-admission funnel at a glance*

A dedicated dashboard showing total enquiries, applications and admissions with conversion rates at every step — including how many admissions came from enquiries, from applications only, or arrived directly. Filter by batch and academic session, then drill into the actual people at each stage.

**For:** Admin · **Where:** Admin Web

- **Funnel metrics** — Totals for enquiries, applications and admissions plus enquiry-to-application, application-to-admission and overall conversion rates.
- **Admission origin split** — See how many admissions started as an enquiry, came from an application only, or were direct admissions.
- **Batch and session filter** — Scope the whole dashboard to a specific batch and academic session, or view institute-wide.
- **Pipeline people table** — A drill-down table of the actual people sitting at each stage of the pipeline.

### Learner Progress Reports & Email Digests

*Automatic daily, weekly and monthly progress reports*

Track every learner's study progress subject by subject, chapter by chapter and slide by slide — for individuals or whole batches — and export any view as a PDF. Automated daily, weekly and monthly email digests keep learners and parents informed without anyone lifting a finger, and the same reports are available in context right inside the study library.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web

- **Learner progress drill-down** — Subject-wise, chapter-wise and slide-wise (date-wise) progress views per learner, including average daily time spent.
- **Batch reports and leaderboard** — Batch-level subject and chapter progress plus a leaderboard ranking learners to drive healthy competition.
- **Scheduled email digests** — Daily, weekly and monthly progress report emails, generated and sent automatically on schedule.
- **Institute and per-learner settings** — Admins set the institute-wide report policy; individual learners can carry their own digest settings.
- **PDF exports** — Export batch reports, learner reports, subject-wise reports, module progress reports and chapter-wise batch or learner reports as PDFs.
- **In-context study library reports** — Batch, individual-learner and leaderboard views open directly inside the study library, so teachers spot who is falling behind without leaving the content area.

### Learner Activity & Usage Analytics

*Real-time visibility into who is learning right now*

Live and historical analytics on learner behavior across the institute: who is online this minute, daily and hourly activity patterns, your most engaged learners, and which devices and platform areas they use most. Perfect for spotting engagement drops before they become dropouts.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Real-time active users** — A live counter of learners on the platform right now, with a list of exactly who is online.
- **Daily and hourly activity patterns** — Day-by-day trend charts and hour-of-day heat views reveal when your learners actually study.
- **Engagement trends over time** — Activity summaries and trends over configurable time ranges — including a same-day snapshot — to spot momentum or drop-off.
- **Most active learners leaderboard** — Rank learners by activity to identify champions and at-risk students.
- **Device usage breakdown** — See the split of learners across web, mobile and desktop.
- **Feature usage breakdown** — Which parts of the platform — learning, assessments, live classes and more — get used most.
- **Student login statistics** — Login frequency and recency per student, feeding attendance-style regularity reports.

### Assessment Analytics & Results

*Leaderboards, question insights and AI performance reports*

Every assessment gets a full analytics suite for staff — overview dashboard, ranked leaderboard, marks-vs-rank curve and question-level insights — with CSV and PDF export throughout. Learners get their own detailed results: score breakdowns, question-wise review, peer comparison and an AI-written performance report in plain language.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Overview dashboard** — At-a-glance participation, completion and score statistics per assessment, plus institute-wide assessment counts.
- **Leaderboard** — A ranked list of all participants by score, exportable to CSV and PDF.
- **Marks-vs-rank analysis** — A graph and table mapping marks to ranks, exportable to CSV and PDF.
- **Question insights** — Per-question charts of correct, incorrect, partially-correct and skipped responses to spot weak topics or bad questions, with PDF export.
- **Individual student report** — Drill into any learner's attempt with question-wise performance, exportable as PDF.
- **Participant exports** — Export registered-participant and respondent lists as CSV or PDF.
- **Learner attempt report** — Learners see a score summary, marks obtained, accuracy and time-spent breakdown for each attempt, with a question-wise review of their response versus the correct answer.
- **Peer comparison** — Learners see how their attempt compares to batch peers — ranks, percentiles and score distributions.
- **AI performance report card** — An AI-generated narrative highlighting strengths, weak topics and recommended next steps, presented as a consolidated printable report card.

### Challenge & Campaign Analytics

*Measure campaigns from first touch to completion*

A dedicated analytics suite tracks engagement challenges and messaging campaigns end to end: daily participation, engagement leaderboards, completion cohorts, churn, referrals, centre-wise heatmaps and lead funnels from ad to conversion. Filters slice everything by date range, campaign and centre.

**For:** Admin, Counsellor · **Where:** Admin Web, API

- **KPI overview** — Headline cards summarising participation, engagement and completion across the selected period.
- **Daily participation reports** — Day-by-day view of active participants and who engaged with which message templates, with incoming/outgoing metrics and per-user drill-down including custom profile fields.
- **Engagement leaderboard** — Rank participants by engagement over any date range to spot champions — ideal for gamified challenge campaigns.
- **Completion cohorts** — Cohort analysis showing how far each intake progressed and exactly who completed a multi-day programme.
- **Churn analysis** — Identify where and when participants drop off.
- **Centre heatmap and distribution** — Compare performance across physical centres with heatmaps and distribution charts.
- **Referral tracking** — Measure participant-driven referrals and their conversion.
- **Lead funnels** — A daily funnel of Facebook ad leads flowing into the challenge, plus lead-journey funnels tracing prospects through sequential message touchpoints to spot drop-off.
- **Message template performance** — Per-template outgoing metrics and template-to-day mapping so multi-day programmes can be measured stage by stage.
- **Flexible filters** — Slice every view by date range, campaign and centre.

### Communication Analytics Hub

*Know who saw it, who clicked, who replied*

One hub for the health and performance of every communication channel. See whether email and WhatsApp are set up and working, track each announcement's delivery down to the individual recipient, and follow every email through sent, delivered, opened, clicked or bounced — with exact timestamps and the specific link clicked.

**For:** Admin, Teacher, Counsellor, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, API

- **Channel setup status** — At-a-glance indicators for whether outbound email, inbound email and WhatsApp are configured and working.
- **Email funnel stats** — Sent, delivered, opened, clicked, bounced, complained and inbound email counts for any chosen time window.
- **WhatsApp volume stats** — Outgoing and incoming WhatsApp message counts for the selected window.
- **Announcement delivery statistics** — Per-announcement stats covering pending, sent, delivered, failed and read counts across channels.
- **Recipient-level tracking** — Drill into an announcement's full recipient list and see each person's delivery and read status.
- **Interactions and threaded replies** — Read, dismissed, clicked, liked and shared interactions are captured per user per message; recipients can reply in nested threads that senders can browse and moderate.
- **Per-email event timeline** — Each email shows a chronological history of delivered, opened, clicked, bounced, complaint and pending events with exact timestamps in the viewer's timezone.
- **Click and bounce detail** — Click events record the specific link, device and browser; bounces carry type and sub-type so hard failures are distinguished from temporary ones.
- **Lookup and source attribution** — Retrieve the complete email history of any user or address, search across all tracked emails, and trace every message back to the feature that sent it — announcement, campaign or automation.
- **Bulk send monitoring** — Watch active and recently completed bulk send batches with per-batch status, alongside a live recent-activity feed across channels.

### Fee Collection Dashboard

*A live picture of expected vs collected fees*

A visual dashboard that shows how fee collection is tracking across the institute: total expected, collected, due and overdue, a collection-rate gauge, a pipeline chart and class-wise breakdowns. Filter by batch, plan or period to find exactly where collections are slipping.

**For:** Admin · **Where:** Admin Web

- **Summary cards** — At-a-glance totals for expected fees, amount collected, outstanding dues and overdue amounts.
- **Collection rate gauge** — A live gauge showing the percentage of expected fees actually collected.
- **Collection pipeline chart** — Visualizes fees moving from upcoming to due to paid, making cash flow predictable.
- **Class-wise collection table** — Breaks collections down by class and batch to spot which groups are behind.
- **Payment mode insights** — See the split of collections across cash, cheque, UPI, card and online gateway payments.
- **Flexible filters** — Slice the whole dashboard by batch, fee plan and date range.

### Payment Logs & Reconciliation

*Every transaction tracked, filterable and reconciled*

A dedicated payment log records every payment attempt across all gateways with its live, reconciled status. Filter by time, status or plan, see revenue statistics at the top, and drill into any transaction's full details.

**For:** Admin · **Where:** Admin Web

- **Revenue statistics** — Instant totals for payment count, successful payments, failed payments and total revenue for the current filter.
- **Quick time filters** — One-click views for the last hour, today, 7/30/90 days or all time, plus a custom date-time range.
- **Status filters** — Filter by payment status (paid, failed, pending) and by learner plan status (active, payment failed, expired, inactive).
- **Rich transaction rows** — Each row shows date, payer name and email, amount, color-coded status, payment method and vendor, plan status, course or membership, transaction ID and plan validity.
- **Reconciled status logic** — Displayed status is derived from gateway confirmations, not just the initial attempt, so the table reflects reality.
- **Tracking updates** — Payment records can be annotated with tracking information as follow-ups happen.
- **Built for scale** — Configurable page sizes with newest-first sorting keep large institutes' logs fast to work through.

### Membership Analytics & Expiry Tracking

*Know who's new, who's renewing, who's about to lapse*

Two dedicated dashboards track membership health: one analyzes new joiners versus retained members over time, the other surfaces memberships that have ended or are about to end — so your team drives renewals before revenue walks out the door.

**For:** Admin, Counsellor · **Where:** Admin Web

- **New vs retained analysis** — Membership stats split members into new users and retainers, with daily and weekly trend charts and filterable stat cards.
- **Expiring-soon pipeline** — See memberships expiring in the next 30 days with member-level detail for proactive renewal outreach.
- **Recently expired list** — Track memberships that ended in the last 30 days to run win-back campaigns.
- **Filterable member tables** — Both dashboards include member tables with date-range, user-type and status filters.
- **Expiry trend charts** — Expiry volume charted over time so leadership can spot churn spikes early.

### Admin Activity Audit Log

*Every admin action recorded, searchable and exportable*

A complete audit trail of administrative actions across the platform — enrollments, settings changes, certificate updates, live-class edits, parent links and more. Compliance teams can filter the log, inspect exactly what changed with sensitive data automatically redacted, and export everything to CSV.

**For:** Admin · **Where:** Admin Web

- **Filterable log viewer** — Filter logs by actor, action, entity and time range in a dedicated screen.
- **Payload inspection** — Open any entry to see the full details of what changed, with sensitive fields automatically redacted.
- **CSV export** — Export filtered audit logs as CSV for external compliance archives.
- **Automatic capture** — Actions across enrollment, settings, certificates, live sessions, bookings, courses and parent-link operations are logged asynchronously, without slowing the app.
- **Retention management** — A retention policy automatically prunes old logs on your configured schedule.

### Report Branding

*Every exported report carries your letterhead*

Brand the PDF reports your institute sends out: logo and letterhead, custom header and footer with full HTML control, report colors, and an optional watermark — with a live preview as you edit.

**For:** Admin · **Where:** Admin Web

- **Logo and letterhead** — Upload the logo and letterhead used across all generated reports.
- **Header and footer** — Set footer text, or take full control with custom header and footer HTML.
- **Report colors** — Primary and secondary brand colors applied to report styling.
- **Watermark** — Optional watermark text across report pages.
- **Live preview** — See the branded report layout before saving.

---

## Community & Gamification

*Shared question banks, leaderboards, XP and badges*

Community & Gamification turns your institute into a place learners want to show up to every day. Built-in chat with a full safety toolkit keeps every conversation on-platform, while XP, streaks, badges and leaderboards convert study time into friendly competition. A network-wide community library of question papers, ratings and reviews rounds it out — so your teachers reuse the best content and your learners broadcast the social proof.

### In-App Chat & Messaging

*DMs, batch groups and community chat — no phone numbers shared*

A built-in messenger connects admins, teachers and learners without anyone exchanging phone numbers. It covers one-to-one direct messages, automatic per-batch group chats and an institute-wide community channel, with text, image and file messages delivered in real time. Read receipts, unread counts and offline push notifications keep every conversation current, and a role-based permission matrix puts the institute in full control of who can message whom.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Direct messages** — Start one-to-one conversations with anyone the institute's role matrix permits; a people search finds members by name or role.
- **Batch group chats** — Every batch gets its own group conversation whose membership syncs automatically with enrollment, plus a searchable batch directory for admins.
- **Community channel** — An institute-wide channel for all members that the institute can enable or hide.
- **Text, image and file messages** — Send text, images and file attachments, with attachment permissions configurable per institute.
- **Read receipts and unread counts** — Per-conversation mark-as-read with unread counters across the conversation list.
- **Real-time delivery with offline push** — Messages reach online members instantly; offline members get a push notification so nothing is missed.
- **Role-based permission matrix** — Control exactly which role may message which role — student-to-teacher, student-to-student and more — plus who may post in batch groups and the community channel.
- **Message deletion** — Senders and moderators can remove messages from a conversation.
- **Member, Moderator and Owner roles** — Conversations distinguish members, moderators and owners for management actions.
- **Per-institute opt-in** — Chat is off by default and switched on per institute, so every school adopts messaging on its own terms.

### Chat Moderation & Safety

*Rules, filters and reporting keep student conversations safe*

Community and group chats ship with a complete safety toolkit built for education. Publish channel guidelines that members must acknowledge, calm busy channels with slow mode, restrict links and attachments, and hold new joiners read-only. Banned-keyword filters and a report-and-review workflow give moderators everything they need to act fast on problem messages.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Channel rules and guidelines** — Publish titled guideline lists per channel; institutes set defaults and individual channels can override them.
- **Mandatory acknowledgement** — Optionally require members to acknowledge the rules before they can post.
- **Slow mode** — Enforce a minimum number of seconds between posts per member to calm busy channels.
- **Link and attachment controls** — Allow or block links and attachments on a per-channel basis.
- **New-member read-only period** — Keep new joiners read-only for a configurable number of minutes before they can post.
- **Banned-keyword filters** — Maintain a banned-keyword list per channel and choose the action: block the message outright or flag it for review.
- **Message reporting** — Members report messages for spam, abuse, harassment or inappropriate content; auto-moderation flags create reports too.
- **Moderation review queue** — Admins work an Open, Reviewing, Actioned or Dismissed queue of reports from a dedicated review screen.

### Gamification: XP, Streaks & Badges

*XP, levels, streaks and badges make studying addictive*

Learners earn experience points for studying, attending live classes and scoring well on assessments, and XP rolls up into levels with visible progress. Daily streaks reward consistency, while achievement badges unlock automatically from configurable triggers or are awarded manually by admins. Institutes design their own badges and scoring rules — or switch the whole system off with one toggle.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **XP and levels** — Points earned across learning activities roll into levels, with an XP-to-next-level progress display and a breakdown of where every point came from.
- **Daily streaks** — A streak counter rewards consecutive days of learning activity.
- **Achievement badges** — Badges unlock automatically from configurable triggers — course progress, assessment scores, live-class attendance — and admins can also award them manually.
- **Custom badge designer** — Create your own badges with a name, an icon from a built-in library and a description, then edit or retire them as your program evolves.
- **Configurable unlock criteria** — Choose the activity- or achievement-based rule that unlocks each badge.
- **Institute-controlled scoring** — Institutes define the badge and scoring rules, and a master toggle disables badges entirely when they are not wanted.
- **Play theme** — A gamified, kid-friendly dashboard theme with progress rings, XP pills and badge showcases.

### Leaderboards

*Friendly competition that keeps learners coming back*

Leaderboards rank learners everywhere they compete: within their batch, across the whole institute, and live during quiz sessions. Learning-activity leaderboards are driven by study time, attendance and badges earned, while live-session leaderboards score every answer in real time with configurable points, optional negative marking and speed-aware ranking. Standings can be shared publicly and exported for prize-giving.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, Engage Client, Public Web

- **Batch leaderboard** — Rankings within a learner's batch, driven by real learning activity such as study time, live-class attendance and badges earned.
- **Institute leaderboard** — An institute-wide leaderboard that ranks learners across all batches.
- **Public shareable leaderboard** — A public leaderboard view that can be shared outside the app for recognition and marketing.
- **My rank card** — Each learner sees their own rank and badge summary on their profile.
- **Live session leaderboard** — Every live quiz session ranks the whole audience in real time; both the presenter and participants can view the standings, with results revealed on the final slide.
- **Configurable scoring with negative marking** — Set the points each correct answer is worth when creating a session, and optionally deduct a chosen number of marks per wrong answer.
- **Speed-aware ranking** — Total response time is recorded alongside score, so faster correct answers rank higher among ties.
- **Full performance breakdown** — Each leaderboard row shows rank, name, total score, total time, correct, wrong and unanswered counts, and total questions.
- **CSV export** — Download the complete session leaderboard as a spreadsheet for records or prize distribution.

### Course Ratings & Reviews

*Learner reviews that become your best social proof*

Learners rate and review courses and batches with a star score and text, and ratings roll up into averages and distributions shown on course pages, library cards and the public catalogue. Readers can mark reviews helpful so the best feedback rises to the top, and admins get a filterable console over every review for moderation and insight.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Public Web

- **Submit and edit reviews** — Learners leave a star rating with text for a course or a specific batch, and can update it later.
- **Rating summaries** — Aggregate star ratings and rating distributions per course and per batch, ready for display anywhere.
- **Review feed** — Read individual reviews with reviewer name, photo, date, star score, text and like counts.
- **Ratings on cards and public catalogues** — Star ratings appear on library course cards and public catalogue listings, so prospective students see social proof before enrolling.
- **Like / dislike on reviews** — Readers mark a review helpful or not — or withdraw their reaction — surfacing the best feedback first.
- **Admin review console** — Browse all ratings for any course or batch with filters, for moderation and insight.

### Community Question Paper Library

*A shared library of ready-made question papers and practice content*

A community hub inside the admin portal where teachers browse question papers and practice resources shared across the Vacademy network. Content is presented as a visual card gallery with instant search, academic filters and topic tags, and any paper can be previewed question by question — with answers toggled on or off — before you adopt it. It turns every institute's best assessments into a reusable, network-wide resource pool.

**For:** Admin, Teacher · **Where:** Admin Web

- **Browse card gallery** — Scroll a paginated grid of community question papers presented as visual cards; click any card to open the full paper.
- **Instant search** — Search question papers by name from the hub header, with results refreshing as you type.
- **Cascading academic filters** — Narrow the library by level or grade, then stream, then subject — each dropdown shows only options relevant to the previous choice.
- **Difficulty and content-type filters** — Filter by Easy, Medium or Hard, and by resource kind — the library is built to hold questions, full question papers, PDFs, videos and PPTs.
- **Topic tag chips** — One-click topic chips stack on top of the dropdown filters for precise discovery.
- **Combined multi-filter results** — Search text, dropdown selections and tag chips all combine into a single filtered, paginated result set.
- **Question paper preview** — Read every question in order with rich formatting, images and math rendered correctly.
- **Show / hide answers toggle** — Reveal or hide the answer key with one click while previewing, to judge quality before adopting a paper.
- **Paper detail sidebar** — Every paper shows its full tag set — level, stream, subject, topic and difficulty — so you know exactly what it covers.
- **Share a paper** — A share action on each community paper lets you pass it along to colleagues.

### Cross-Institute Content Sharing

*Publish your papers to the network, import theirs into yours*

Institutes share question papers with the wider Vacademy community and pull any public community paper into their own private question bank with one click. Imported papers become fully editable copies inside your institute, ready to use in your own assessments, while a public/private access setting keeps you in control of what leaves your walls.

**For:** Admin, Teacher · **Where:** Admin Web

- **Add to my Question Bank** — One button copies a public community question paper into your institute's private collection, confirmed the moment it lands.
- **Publish to the community** — A Share-and-Explore publishing flow pushes your own papers into the community library for other institutes to discover.
- **Public / private access control** — Every question paper carries an access setting, so only content deliberately marked public is visible to other institutes.
- **Authorship and history preserved** — Shared papers keep their title, description, creator and creation dates, so provenance is always visible.

### Academic Taxonomy & Smart Tagging

*Every shared resource organized the way syllabi actually work*

A structured academic catalogue — Levels, Streams, Subjects, Chapters and Topics — underpins the community library, so every shared resource is findable by exactly where it fits in a curriculum. Content also carries free-form tags, difficulty ratings and type labels, and the taxonomy itself grows as new chapters and topics are added.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Five-level academic hierarchy** — Content is organized by Level → Stream → Subject → Chapter → Topic, mirroring how real syllabi are structured.
- **Structured tag dimensions** — Resources are tagged across six dimensions: level, stream, subject, topic, difficulty and content type.
- **Free-form tags** — Beyond the structured taxonomy, contributors attach custom tags to any question, paper, PDF, video or PPT.
- **Tag lookup per resource** — View all tags attached to any resource — or a batch of resources — grouped by category, to understand its coverage at a glance.
- **Growable curriculum catalogue** — Add new chapters under any subject and new topics under any chapter, including bulk additions, so the taxonomy keeps pace with new syllabi.
- **Always-current filter options** — The community hub loads live filter options — levels, streams, subjects, difficulties, types and topics — so dropdowns always reflect the current catalogue.
- **Rich-content questions** — Question text, options and explanations are stored as rich content, so shared questions keep images, tables and math notation intact.

---

## Platform, Apps & White-Label

*Your brand, your domain, your apps — on enterprise-grade rails*

The foundation that makes Vacademy feel like your own product, not someone else's software. Run every portal on your own domains with your own branding, ship your own Android, iOS, Windows and Mac apps, rename the platform's vocabulary to match yours, and operate multiple brands or branches from one account. Underneath sits serious infrastructure — flexible sign-in, device security, cloud file storage, open APIs, data migration tooling and a support and status operation that keeps your institute running.

### Custom Domains & White-Label Portals

*Your domain, your brand — Vacademy invisible*

Run the learner, teacher and admin portals on your own domains (e.g. learn.myschool.com) with zero Vacademy branding. A guided setup wizard provisions domains automatically — DNS and SSL included — and every domain carries its own logo, colors, fonts, browser-tab identity, sign-in rules and legal links, so learners only ever see your brand.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Public Web

- **One-click domain setup** — A setup wizard creates DNS records and SSL certificates automatically and wires the domains to your institute. For domains you host elsewhere, it surfaces the exact CNAME record to add and reports live provisioning status.
- **Separate domains per portal** — Attach distinct domains or subdomains for the learner, teacher and admin portals. Multiple domains can serve the same portal, with one marked primary.
- **Per-domain branding** — Each domain sets its own theme color, font family, logo dimensions, browser tab title and tab icon — and can hide the institute name entirely when the logo already carries it.
- **Per-domain login rules** — Choose which sign-in methods (password, email OTP, phone, Google, GitHub) are available on each domain, and whether open self-signup is allowed or access stays invite-only.
- **Navigation, redirects & legal links** — Set the after-login landing route, after-logout route and home-icon destination per domain, and point privacy policy and terms & conditions links to your own pages.
- **App download links** — Attach your Play Store, App Store, Windows and Mac app links so each branded portal promotes your own apps.
- **Sub-organization branded domains** — Bind a domain to a specific sub-organization so each branch or partner brand gets its own branded login and signup entry point.
- **Regional & terminology preferences** — Set preferred country lists for phone-number inputs per domain, and choose whether your custom naming terminology applies on each white-labeled domain.
- **White-label status dashboard** — See at a glance which portals are configured, their URLs, domain types and provisioning state — verify what is live at any time.

### Branded Mobile & Desktop Apps

*Your own Android, iOS, Windows and Mac apps*

The learner experience ships as installable apps for Android, iOS, Windows and Mac — each buildable as a fully branded app published under your institute's own name, icon and store listing. Mobile-native touches like push notifications, privacy screens and offline handling make it feel truly native, and admins get a companion mobile app to run the institute on the go.

**For:** Admin, Learner, Parent · **Where:** Learner Mobile App, Learner Desktop App, Admin Web

- **White-label Android & iOS apps** — Tenant-specific builds carry your institute's own app name, icon, theme and app-store listing, published under your developer account.
- **Windows & Mac desktop apps** — Desktop builds of the learner app for exam centers, office-based training and distraction-free home study.
- **Admin mobile app** — A mobile flavor of the admin dashboard so owners and staff can manage the institute from their phone.
- **Native social sign-in** — Apps include native Sign in with Apple on iOS and Google sign-in, meeting app-store sign-in requirements.
- **White-label push notifications** — Each institute can plug in its own Firebase project so push notifications are delivered under the institute's own app identity.
- **Privacy screen protection** — Blocks screenshots and screen recording of protected content on mobile.
- **Offline resilience** — Network status detection, offline message queuing and cached preferences keep the app usable on poor connections.
- **Mobile-native UX** — Pull-to-refresh, in-app browser, network awareness and mobile-first layouts throughout — no cut-down web wrapper.
- **iOS purchase compliance** — Purchase flows automatically adapt on iOS to meet App Store rules.

### Over-the-Air App Updates

*Ship app fixes instantly — no app-store wait*

Push new versions of the mobile app straight to users' devices, skipping app-store review for content and UI updates. Releases can target specific institutes' branded apps, be marked as forced updates for critical fixes, and be rolled back instantly if something goes wrong.

**For:** Admin, Learner · **Where:** Admin Web, Learner Mobile App, API

- **Instant OTA releases** — Publish a new app bundle with version, release notes and integrity checksum; devices pick it up on their next update check via an in-app update banner.
- **Targeted rollouts** — Aim a release at specific branded apps, specific platforms, or every app at once.
- **Forced updates** — Mark a release as mandatory so devices must update before continuing — critical for security fixes.
- **Native-version gating** — Each bundle declares the minimum native app version it supports, so older installs are never broken by an incompatible update.
- **One-click rollback** — Deactivate a bad release and reactivate a previous one; devices revert on their next check.
- **Release history** — A full log of every published version with size, publisher, notes and active status.

### Multi-Tenant Institute Workspaces

*Isolated, branded workspaces for every institute and sub-org*

Every institute runs in its own secure workspace with its own users, roles, settings, branding and data — fully separated from every other tenant. Larger organizations operate sub-organizations (branches, franchises, partner academies) under one umbrella, each with its own branded entry point, while people who belong to several institutes switch between them from a single account.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, API

- **Isolated institute workspaces** — Each institute's data, users and settings are fully separated from every other tenant on the platform.
- **Sub-organizations & multi-brand operations** — Run branches or franchise partners as sub-orgs under a parent institute, each with its own domain routing, branding and self-registration entry points.
- **Multi-institute membership** — One person can belong to several institutes with different roles in each, choosing the workspace at login and switching anytime — branding, terminology and content reload instantly without re-login.
- **Batch selection for learners** — Learners enrolled in multiple batches choose which one to enter after login.
- **Per-institute security settings** — Institute-level controls, such as the maximum concurrent sessions per learner, are configured per workspace.
- **Instant workspace signup** — New organizations sign up and get a workspace with an owner account created immediately — including via Google or GitHub signup.

### Naming Settings — Custom Terminology

*The whole platform speaks your institute's language*

Rename every user-facing term per institute, with independent singular and plural forms. Call a Course a 'Program', a Batch a 'Cohort', a Learner a 'Student' or 'Trainee' — and the change flows through menus, buttons, page titles, dialogs and reports everywhere, including your white-labeled domains. Ideal for schools, coaching institutes and corporate academies that each have their own vocabulary.

**For:** Admin, Teacher, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Content & structure terms** — Rename Course, Level, Session, Subject, Module, Chapter, Slide, Live Session, Batch, Package and the 'Popular' tag — 16+ configurable terms in total.
- **Role terms** — Rename user roles — Admin, Teacher, Course Creator, Assessment Creator, Evaluator and Learner (e.g. 'Learner' becomes 'Student' or 'Trainee').
- **Other terms** — Rename Audience List (campaigns), Invite (enrollment links) and Inventory to match how your team talks.
- **True singular and plural forms** — Configure each term's singular and plural independently — 'Faculty/Faculty', 'Child/Children' — not naive 's' appending.
- **Plain-language explanations** — Each term shows a description of what it means in the platform, so admins rename with confidence.
- **Applies across the product** — Custom names appear in sidebars, tabs, dialogs, table headers, toasts and page titles across admin and learner apps, and can apply on white-labeled domains and per-domain overrides.
- **Session vs Batch taxonomy** — Distinguishes academic Session (semester or year) from Batch (learner group), so schools and corporate L&D both get natural language.

### Flexible Login & Single Sign-On

*Every sign-in method your learners and staff prefer*

Learners and staff sign in the way that suits them — password, one-time codes by email or WhatsApp, phone number, or one-tap social sign-in with Google, GitHub and Apple. Institutes choose exactly which methods are enabled on each portal, first-time social sign-ins are registered automatically, and sessions renew silently so users stay signed in without interruption.

**For:** Admin, Teacher, Counsellor, Evaluator, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, Public Web

- **Email / username + password login** — Classic sign-in for both admin and learner portals, with optional automatic lowercase normalization of usernames to avoid typo lockouts.
- **Email OTP login** — Passwordless sign-in with a one-time code sent to the user's email — no password to remember or reset.
- **WhatsApp & phone OTP login** — One-time codes delivered on WhatsApp for phone-first audiences, including a verify-only flow for confirming phone numbers and a verify-and-login flow.
- **Extended 10-day OTP session** — A special OTP login keeps the learner signed in for ten days — ideal for exam-prep apps where daily re-login kills engagement.
- **Social sign-in (Google, GitHub, Apple)** — One-tap Google and GitHub OAuth login for admin and learner portals, plus native Sign in with Apple on the learner iOS app.
- **WordPress single sign-on** — A secure webhook logs users who sign in on your WordPress website straight into their learner account — one login for website and LMS.
- **Auto account creation with welcome email** — First-time social sign-ins get an account created automatically and receive a welcome email with fallback credentials.
- **Cross-app auth handoff** — After login, users are returned to the exact app and page they started from — including white-label custom domains — without re-authenticating.
- **Per-portal login controls** — For every branded portal, independently switch password login, email OTP, phone login, Google and GitHub sign-in, and self-signup on or off.
- **Credential recovery & distribution** — Users request their credentials by email in one click; admins can push login credentials to individual users or in bulk.
- **Silent session renewal** — Sessions refresh securely in the background, so users stay signed in without interruption while security is preserved.
- **Account identifier & duplicate detection** — Choose the identifier (such as email) that uniquely identifies users at registration and login; enrollment automatically detects existing accounts instead of creating duplicates.

### Device & Session Security

*Stop account sharing with per-learner device limits*

Cap how many devices a learner can be signed in on at once to stop account sharing. When the limit is hit, the learner sees their active devices and can log one out to free a slot — no support ticket needed. Revoked sessions are killed within minutes, and every session records its device type for visibility.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App

- **Concurrent device limit** — Admins set a maximum number of simultaneous active sessions per learner for their institute (e.g. 2 devices); zero keeps it unlimited.
- **Active device list** — When the limit is exceeded, the learner sees every active session with its device type and last activity.
- **Remote logout of a single device** — The learner can end one specific session — say, the shared family tablet — and immediately sign in on the new device.
- **Session heartbeat & instant revocation** — Apps validate the session every few minutes; a terminated session is signed out on its next request, so revocation takes effect fast.
- **Clean logout everywhere** — Normal logout terminates the session server-side, not just locally, keeping the device count accurate.
- **Device-type tracking** — Each session records whether it came from web, mobile app or desktop, giving admins visibility into how learners access content.

### Learner Portal Designer

*Design the learner app without writing code*

Shape everything a learner sees — sidebar layout, navigation style, custom tabs and widgets, sign-up options, notifications and post-login redirects. Preview how course navigation will look before saving, and control which profile fields learners can see and edit. Institutes effectively compose their own learner app.

**For:** Admin, Learner · **Where:** Admin Web, Learner Web, Learner Mobile App

- **Layout & navigation** — Toggle, rename and reorder learner sidebar sections, and add custom tabs, sub-tabs and even custom widgets to the learner dashboard.
- **Course navigation style** — Choose between a full expandable course tree or compact breadcrumb dropdowns, with a live visual preview of both.
- **Learning experience defaults** — Set the default tab learners land on and how content outlines open.
- **Learner side-view tabs** — Choose which side panels and tabs appear inside the learner content view.
- **Login & signup options** — Control sign-up availability and account options for learners, including settings exposed to public enrollment pages.
- **Notifications & post-login redirect** — Configure learner notification behavior and where learners land after login.
- **Profile field visibility** — Choose which profile fields learners can see and which they can edit.
- **Language selection** — A language dropdown lets learners switch the app language where enabled.

### Feature & Tab Visibility Controls

*Turn whole product areas on or off per institute*

Switch entire product areas on or off so your team only sees what you actually use. Hide the Community Centre, Evaluation Centre, Doubt Management or Reports — down to individual sub-items under each area — and restore the standard layout in one click.

**For:** Admin · **Where:** Admin Web

- **Top-level tab toggles** — Show or hide major areas such as Community Centre, Evaluation Centre, Doubt Management and Reports.
- **Sub-item toggles** — Within a visible area, toggle individual sub-items; at least one sub-item always stays visible as a safety net.
- **Reset to defaults** — One click restores the standard tab layout.
- **Module entitlements** — Institutes are provisioned with product modules (Assessment, LMS, Volt, Vsmart) and their sub-modules, controlling which product areas appear at all.

### Branded Sender Email

*Send from your own domain, not ours*

Verify your own sender email addresses and domains so all platform email goes out under your brand. The product triggers verification, hands you the exact DNS records to publish, and tracks verification status separately for marketing, transactional and notification email.

**For:** Admin · **Where:** Admin Web, API

- **Self-serve sender verification** — Start verification of a custom from-address directly from the product; the platform handles the email-provider setup behind the scenes.
- **DNS record guidance** — The verification flow returns the DNS records needed for domain authentication and reports live verification status.
- **Per-purpose sender identities** — Configure distinct verified senders for marketing, transactional and notification emails — each independently managed, testable and restorable to defaults.
- **Sender configuration management** — Create, update, delete and test per-institute email configurations, including from-name display and default templates.

### Webhooks & Open API

*Connect Vacademy to anything you build, buy or use*

Real-time webhooks for platform events and a REST API covering the platform's core entities let you connect Vacademy to your own systems. Pre-built connectors cover your WordPress website, lead-ad platforms and payment gateways — included with the platform, no enterprise upsell.

**For:** Admin · **Where:** API, Admin Web

- **Real-time webhooks** — Signed webhook events across the learner lifecycle — enrollment, payments, exams, certificates, leads and more — delivered to your endpoints as they happen.
- **REST API coverage** — Programmatic access to courses, batches, learners, exams, payments, certificates and leads for your own integrations.
- **Reliable delivery** — Webhook deliveries retry automatically on failure so transient outages on your side don't lose events.
- **Native connectors** — Ready-made integrations for WordPress sites, Meta and Google lead ads into the CRM, and payment-gateway webhooks.
- **External LMS connections** — Manage connections to external learning systems from a single settings screen, with optional custom fields mapped across each connection so records stay in sync.

### Institute Profile & Settings Engine

*Your identity and configuration, all in one place*

Maintain the institute's public profile — name, address, contact, website and type — plus branding assets like theme color and letterhead used across portals, certificates and invoices. A per-institute settings engine underneath lets you define reusable custom fields, customize role display names, and configure dozens of behavior settings across the product.

**For:** Admin · **Where:** Admin Web, Public Web, API

- **Institute details editing** — Update name, address, email, website and other profile fields; separate learner-portal and admin-portal URLs are stored per institute.
- **Institute types** — Classify your organization as a college, school, online coaching or offline coaching institute.
- **Theme & letterhead branding** — Set the institute theme color (including role-based multi-hue themes) that skins both portals, and upload a letterhead used on generated documents.
- **Custom field library** — Create institute-wide custom fields (text or dropdown), see where each field is used before changing it, and rename fixed system fields.
- **Role display settings** — Customize how each role name appears to your team.
- **Settings catalog** — Dozens of setting groups — course, LMS, lead, doubt management, live session, AI calling, content protection, theme and more — configured per institute from one place.
- **Public discovery & branding endpoints** — Public search across institutes powers discovery experiences, and branding resolves by subdomain to serve white-labeled public pages.

### Cloud File Storage & Secure Media Delivery

*Every file stored safely, delivered fast, under your control*

Every image, video, PDF, recording and document across the platform is stored securely in the cloud and delivered through smart links you control. Uploads go straight from the user's device to cloud storage via secure one-time links, so even very large lecture videos upload fast, and protected content is served through expiring links that can't be reused forever.

**For:** Admin, Teacher, Counsellor, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, Engage Client, Public Web, API

- **Direct-to-cloud uploads** — Files upload straight from the user's device to cloud storage using secure, time-limited upload links — no size bottlenecks, with public-page flows accepting uploads from visitors who aren't logged in.
- **Public and private storage tiers** — Open content like thumbnails and catalogue images lives in a fast public tier; sensitive files sit in a private tier reachable only via authorized links, and a private file can be promoted to public when you choose.
- **Encrypted storage for sensitive recordings** — Sensitive media such as phone-call recordings is stored with encryption at rest and is only reachable via expiring authorized links.
- **Permanent and expiring links** — Open content gets stable always-on links suitable for websites and emails; protected content is served through links that expire after a chosen number of days.
- **Automatic file cataloguing** — Each upload records its name, type, size, dimensions and originating feature, so every file stays organized and traceable to its source — and can be looked up by what it belongs to.
- **Smart caching for speed** — Delivery uses browser caching and change-detection so repeat views load instantly without re-downloading, while access rules stay intact.
- **Instant links & bulk lookups** — Uploads return a ready-to-use viewing link immediately, and pages with lots of media resolve many file links in one request to stay fast.
- **Safe deletion** — Files can be removed individually or in batches, with soft-delete protecting user-library files from accidental permanent loss.

### File Library & Sharing

*The right files, shared with exactly the right people*

A central library of files, links and rich notes that can be shared with exactly the right audience — a single user, a batch, a role or the whole institute, each with view or edit rights. Learners get a dedicated My Files area listing every report, note and document shared with them, organized into browsable folders.

**For:** Admin, Teacher, Learner, Parent · **Where:** Admin Web, Learner Web, Learner Mobile App, Learner Desktop App, API

- **Multi-format entries** — Store uploaded files, external web links or rich notes; media is classified as video, audio, PDF, document, image or note.
- **Fine-grained sharing** — Grant access at user, batch, role or institute level, with separate view and edit permissions per grant.
- **Access review & editing** — Inspect who can see any file and update its access list at any time; withdrawn shares disappear from learner views automatically.
- **Personal folders with icons** — Each user's files are organized into named folders with custom icons — certificates, reports, notes — browsable one folder at a time.
- **Learner My Files area** — Learners see everything shared with them with type icons and shared dates: links open in a new tab, rich notes read in an in-app preview, and files download via secure links — ideal for report cards, forms and study packs.
- **Email asset library** — Upload and browse images used inside email campaigns, kept separate from learning content.

### Smart Document Conversion Engine

*PDFs and docs become clean, editable web content*

Behind features like question import and AI content generation sits a conversion engine that turns PDFs and Word documents into clean web text. It tracks every conversion's status, hosts extracted images automatically, and tidies messy formatting so the result is ready to use.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **PDF and document to web text** — Documents are converted to rich web text through professional conversion services, preserving structure and content.
- **Conversion status tracking** — Every conversion job records its progress and finished result, so long conversions can be checked and retrieved when ready.
- **Embedded images auto-hosted** — Images buried inside documents are extracted, uploaded to cloud storage and swapped for fast-loading hosted links.
- **Legacy image format rescue** — Old Windows metafile graphics (WMF/EMF) common in older question banks are converted to modern images that display everywhere.
- **Formatting cleanup** — Redundant styling and clutter produced by word processors is stripped so converted content looks clean and consistent.

### Background Task Tracker

*Watch long-running jobs finish without babysitting them*

Long-running jobs like AI content generation and document processing are tracked per institute with live statuses. Users see their institute's recent tasks, check progress messages, and pick up results — including generated files — the moment a job completes.

**For:** Admin, Teacher · **Where:** Admin Web, API

- **Per-institute task history** — Each institute sees its own recent tasks with name, type, status and timestamps.
- **Live status and messages** — Tasks report progress states and human-readable status messages while they run.
- **Results with attached files** — Finished tasks deliver their output — structured results plus any generated file with a ready download link.
- **Linked task chains** — Related jobs, like a re-run or follow-up step, stay linked so their history reads as one connected story.

### Platform Data Migration

*Bring users, enrollments and payment history with you*

Move your existing business onto the platform without losing history. A general importer takes bulk users and enrollments complete with payment history, subscriptions, tags and custom fields, while specialized CSV pipelines migrate members from legacy CRMs with staging, validation and per-row result files — so billing continuity survives the cutover.

**For:** Admin · **Where:** API

- **Bulk user import** — Import users in bulk with per-item results and defaults, including custom fields and tags.
- **Bulk enrollment import** — Import enrollments including one-time payments, payment history, subscriptions and gateway references, so billing continuity is preserved.
- **Legacy CRM pipelines** — Staged CSV pipelines migrate individual and organization members across active, cancelled and expired segments, each returning a results file.
- **Staging & validation** — Records land in staging with validation and status tracking before final migration.
- **Migration status monitoring** — Check migration progress and per-record status throughout a cutover.

### Transparent Platform Billing & Flat-Fee Pricing

*Flat pricing, no revenue share — keep what you collect*

Vacademy is sold on flat annual pricing with no revenue share, no learner caps hidden in the fine print, and no percentage of your fee collections. Everything your institute buys from Vacademy — plans and credit packs — runs through a clean billing pipeline with itemized, tax-compliant invoices and verified payment confirmation.

**For:** Admin · **Where:** Admin Web, Public Web, API

- **Flat-fee, no-revenue-share model** — A flat annual platform fee instead of a percentage of collections — institutes keep 100% of what they collect from learners.
- **Included white-label add-ons** — Branded Android and iOS apps published on your developer accounts, payment-gateway integration and setup assistance are included in the plan rather than sold as upsells.
- **Pay-per-use AI credits** — Core AI features are included, with metered AI usage billed through reviewable, controllable credits and a basic allowance included for normal academic use.
- **Itemized platform invoices** — Each purchase produces an invoice with line items, tax breakup and totals tied to the exact payment record, with multi-currency price display for international buyers.
- **Verified payment fulfillment** — Payments are confirmed via signed gateway callbacks, and support can manually fulfill a payment that verifiably succeeded but missed its callback.
- **Full payment lifecycle audit** — Every platform payment tracks its complete lifecycle — created, paid, fulfilled, failed — for clean reconciliation.
- **Data ownership & export** — Your institute owns its data outright, with full export capability.

### Support Help Desk with SLAs

*Built-in ticketing with response-time guarantees*

Raise support tickets right from your dashboard and chat with the support team in a threaded conversation with attachments. Tickets carry priority, category, status and a client-visible ETA, and each account sits on a support plan with defined response-time SLAs — up to a dedicated named engineer.

**For:** Admin · **Where:** Admin Web, API

- **In-portal ticket creation** — Raise tickets from the dashboard with a category (bug, question, billing, feature request, other) and priority.
- **Threaded conversations with attachments** — Customer and support messages flow in one thread per ticket, with file attachments and system events recorded.
- **Full ticket lifecycle** — Statuses run Open, In Progress, Waiting on Customer, Resolved and Closed, updatable by both sides.
- **Client-visible ETA** — Support sets an expected-resolution time on each ticket that your team can see.
- **Support plans & SLAs** — Tiered plans from standard support up to 24/7 coverage with fast major-incident response and a dedicated named engineer; SLA due-by times are computed automatically per ticket.
- **On-behalf ticket logging** — Requests that arrive by email, WhatsApp or phone are logged by the support team, so every request is tracked in one place.
- **Engineer assignment & board** — Tickets are assigned to named support engineers and managed on a Kanban-style board with an inbox, counts and filters.
- **SLA breach alerts** — Automatic alerts fire when tickets approach or breach their first-response SLA.

### Public Status Page & Platform Health Monitoring

*Transparent uptime, monitored around the clock*

A public status page tells customers when something is wrong and when it's fixed, with severity-classified incidents and dated timeline updates through investigation, monitoring and resolution. Behind it, an operations dashboard continuously checks every service, database, cache and live-class server so problems surface before customers feel them.

**For:** Admin · **Where:** Public Web, Admin Web, API

- **Public incident feed** — Anyone can view current and past incidents on the status page without logging in.
- **Severity levels** — Incidents are classified Minor, Major, Critical or Maintenance so customers gauge impact instantly.
- **Incident lifecycle & timeline updates** — Statuses progress Investigating, Identified, Monitoring, Resolved — with dated updates posted under each incident building a full chronological record, including planned maintenance notices.
- **Full-stack health dashboard** — Aggregated health of all backend services with quick and deep check modes, plus per-service response-time tracking to catch slowdowns early.
- **Database & cache diagnostics** — Dedicated checks on databases and caches, including slow-query surfacing before it hurts users.
- **Live-class server pool manager** — Monitor and manage the pool of live-classroom servers powering online classes.
- **Accurate server time service** — A trusted universal time source with timezone validation keeps exam timers and schedules exact on every device.

### Dashboard Widgets & Broadcasts

*Onboarding trackers and announcements on every dashboard*

The platform team places live widgets on institute dashboards: an implementation tracker showing onboarding milestones with statuses and ETAs, and announcement cards for maintenance notices or launches. Widgets target one institute or broadcast to every account with a given tag, and institutes can comment and confirm milestones — a two-way channel during onboarding.

**For:** Admin · **Where:** Admin Web

- **Onboarding tracker widget** — A milestone checklist (Not Started / In Progress / Blocked / Done) with ETAs, so the institute always knows where its implementation stands; a ready-made template speeds setup.
- **Announcement cards** — Severity-styled cards (Info / Warning / Critical) with optional image and call-to-action button for maintenance notices, feature launches or alerts.
- **Two-way interaction** — Institute admins comment on widgets (even per milestone) and confirm milestones, with all interactions visible to the platform team.
- **Targeted or broadcast delivery** — Send a widget to one institute, or broadcast to every institute carrying a given account tag.
- **Draft, publish, archive lifecycle** — Widgets are drafted privately, published to dashboards, and archived when done — only published widgets appear to institutes.

### In-Product Guides, Assist Dock & Roadmap

*Help and product news, right where you're working*

A floating assist dock in the admin portal offers page-aware tutorials, support access and product news without leaving your workflow. Guides are matched to the exact screen you're on, new walkthroughs are published centrally with no app update, and a 'What's new' panel keeps every institute up to date on the product roadmap.

**For:** Admin, Teacher · **Where:** Admin Web

- **Route-aware tutorials** — The Guides tab lists step-by-step tutorials relevant to the exact page — even the exact tab — you have open, viewed in-app.
- **Assist and Issues tabs** — The same dock gives one-click access to assistance and to raising or tracking support tickets, keeping all help in one place.
- **Centrally published guides** — New walkthrough guides are published by the platform team, targeted to specific screens, and appear for customers instantly — no software update, with full create/update/activate management.
- **In-app roadmap viewer** — Read the latest published roadmap and release highlights in a rich formatted panel without leaving the dashboard.
- **New-update indicator** — An unread dot lights up on the dock whenever the roadmap changes, and clears once you open the panel.

### Platform Owner Console (Super Admin)

*Run the whole platform from one command center*

A dedicated operations console for the platform owner: browse every institute with usage summaries, tag accounts by lifecycle stage, inspect courses and users inside any institute, grant or deduct AI credits with an audit trail, and watch platform-wide activity dashboards. A built-in file manager finds any file on the platform in seconds.

**For:** Admin · **Where:** Admin Web, API

- **Institute directory** — A searchable, paginated list of all institutes with key stats and a drill-down summary per institute.
- **Lifecycle account tags** — Tag each institute by lifecycle stage (production, trial, churn-risk) to segment accounts for broadcasts and prioritization.
- **Platform-wide dashboard** — Cross-institute growth, usage and engagement metrics in a single view, with per-institute session lists, currently-active user counts and activity trends.
- **Per-institute course inventory** — See every course an institute runs, with paging and search.
- **Credit grants & deductions** — Grant promotional AI credits to an institute or deduct balances, always with an auditable reason.
- **User administration** — List any institute's users and deactivate an account when needed for offboarding or abuse.
- **Platform file manager** — Search every file on the platform by name with filters for type, feature, owner and date; preview images, copy fresh access links, upload replacements and safely delete — all restricted to authorized platform staff.

### Embeddable AI Content Player

*Share AI-generated lessons anywhere with an embed link*

AI-generated content — videos, quizzes and storybooks — plays through a clean, full-screen embed page with synchronized audio and captions. Share AI lessons or embed them on external sites without giving anyone access to the admin portal.

**For:** Admin, Teacher, Learner · **Where:** Public Web

- **Public embed pages** — Each piece of AI content gets an embeddable player page suitable for iframes and link sharing.
- **Captions and audio sync** — The player supports an audio track and word-level captions for accessible playback.

### Learner Profile & Account Control

*Self-service profile, credentials and account safety*

Learners manage their own profile details, photo and password, and see progress stats and earned badges on their profile page. Account safety features include graceful session-expiry handling and a full in-app account-deletion flow that meets app-store privacy requirements.

**For:** Learner · **Where:** Learner Web, Learner Mobile App, Learner Desktop App

- **Profile view & edit** — Edit personal details, contact info and profile photo, within the field-visibility rules the institute sets.
- **Progress stats on profile** — Learning statistics and a badges-and-rank card displayed on the profile page.
- **Change password** — Self-service password change and forgot-password recovery.
- **Account deletion** — An in-app account-deletion request flow meeting app-store privacy requirements.
- **Graceful session handling** — Clear session-expiry prompts and a dedicated screen when access is revoked or the account signs in elsewhere.
- **Terms & privacy pages** — Built-in terms-and-conditions and privacy-policy pages.

---

## Maintaining this catalog

- **This file** (`vacademy-features.md`): plain-Markdown reference — easy to diff, grep, and paste into proposals.
- **`vacademy-features.html`**: interactive explorer for clients — open it in any browser (no server or internet needed). All content lives in the single `DATA` object near the bottom of the file; edit it there. Products, features and capability rows render automatically, including search.
- Keep the two in sync: every feature added/renamed/removed in one must be mirrored in the other.
- Bump the `updated` date (in this header and in the HTML `DATA.meta.updated`) whenever you edit.
