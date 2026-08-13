/**
 * Rehydrates a chapter's `Slide[]` (the shape `useSlides`/study-library
 * components expect) from a locally persisted manifest, for offline use
 * (plan §B4 "use-slides.ts offline fallback hydrating from manifests
 * tree_json"). Only covers the fields the offline-downloadable slide types
 * actually need to render (DOCUMENT/AUDIO/VIDEO(FILE_ID)/QUESTION/QUIZ/
 * ASSIGNMENT) — online-only types have nothing offline to hydrate anyway
 * (they render `RequiresInternetSlide` instead).
 */

import { getOfflineDb } from "./db/connection";
import { manifestsDao } from "./db/dao/manifests-dao";
import { slidePayloadsDao } from "./db/dao/slide-payloads-dao";
import { getOrCreateOfflineKey } from "./crypto/keys";
import { decryptJsonPayload } from "./crypto/decrypt";
import type { Slide } from "@/hooks/study-library/use-slides";
import type { OfflineManifest, OfflineManifestSlide } from "@/services/offline/manifest-service";

function findAsset(slide: OfflineManifestSlide, role: string) {
  return slide.assets.find((a) => a.role === role);
}

async function toAppSlide(
  userId: string,
  slide: OfflineManifestSlide
): Promise<Slide> {
  const base: Slide = {
    id: slide.slide_id,
    source_id: slide.slide_id,
    source_type: slide.slide_type,
    title: slide.title,
    image_file_id: "",
    description: "",
    status: "PUBLISHED",
    slide_order: slide.slide_order ?? 0,
    is_loaded: true,
    new_slide: false,
    percentage_completed: 0,
    progress_marker: 0,
  };

  const videoAsset = findAsset(slide, "VIDEO");
  if (videoAsset) {
    base.video_slide = {
      id: slide.slide_id,
      description: "",
      title: slide.title,
      url: videoAsset.file_id,
      video_length_in_millis: 0,
      published_url: videoAsset.file_id,
      published_video_length_in_millis: 0,
      source_type: "FILE_ID",
      questions: [],
    };
  }

  const documentAsset = findAsset(slide, "DOCUMENT");
  if (documentAsset) {
    base.document_slide = {
      id: slide.slide_id,
      type: "PDF",
      data: "",
      title: slide.title,
      cover_file_id: "",
      total_pages: 0,
      published_data: documentAsset.file_id,
      published_document_total_pages: 0,
    };
  }

  const audioAsset = findAsset(slide, "AUDIO");
  if (audioAsset) {
    base.audio_slide = {
      id: slide.slide_id,
      source_type: "FILE",
      published_audio_file_id: audioAsset.file_id,
      published_audio_length_in_millis: 0,
    };
  }

  if (slide.inline_payload !== null && slide.inline_payload !== undefined) {
    const db = await getOfflineDb();
    const payloadRow = await slidePayloadsDao.get(db, userId, slide.slide_id);
    let payload: unknown = slide.inline_payload;
    if (payloadRow) {
      try {
        const key = await getOrCreateOfflineKey(userId);
        payload = await decryptJsonPayload(key, payloadRow.ciphertext, payloadRow.nonce);
      } catch {
        // fall back to the (unencrypted-in-memory) manifest copy already on `base`
      }
    }
    const slideType = slide.slide_type?.toUpperCase();
    if (slideType === "DOCUMENT") {
      // DOC/HTML documents keep their content inline (only PDFs are a binary
      // asset), so the payload IS the document. Without this the viewer got a
      // slide with no document_slide at all and rendered a blank page over
      // content that was sitting decrypted-able on disk.
      base.document_slide = payload as Slide["document_slide"];
    } else if (slideType === "QUIZ") {
      base.quiz_slide = payload as Slide["quiz_slide"];
    } else if (slideType === "QUESTION") {
      base.question_slide = payload as Slide["question_slide"];
    } else if (slideType === "ASSIGNMENT") {
      base.assignment_slide = payload as Slide["assignment_slide"];
    }
  }

  return base;
}

/** Loads the persisted manifest for `packageSessionId` and reconstructs the given chapter's slides, or `null` if nothing is persisted locally. */
export async function hydrateOfflineSlides(
  userId: string,
  packageSessionId: string,
  chapterId: string
): Promise<Slide[] | null> {
  const db = await getOfflineDb();
  const row = await manifestsDao.get(db, userId, packageSessionId);
  if (!row) return null;

  const manifest = JSON.parse(row.tree_json) as OfflineManifest;
  for (const subject of manifest.subjects ?? []) {
    for (const mod of subject.modules ?? []) {
      for (const chapter of mod.chapters ?? []) {
        if (chapter.chapter_id !== chapterId) continue;
        const slides = await Promise.all(
          (chapter.slides ?? [])
            .filter((s) => s.downloadable)
            .map((s) => toAppSlide(userId, s))
        );
        return slides;
      }
    }
  }
  return null;
}
