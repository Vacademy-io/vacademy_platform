import React from "react";
import { Page, GlobalSettings, CourseCatalogueData } from "../-types/course-catalogue-types";
import { HeaderComponent } from "./components/HeaderComponent";
import { BannerComponent } from "./components/BannerComponent";
import { CourseCatalogComponent } from "./components/CourseCatalogComponent";
// Removed CourseRecommendationsComponent import as it's not used
// Removed CourseDetailsComponent import as it's not used
import { FooterComponent } from "./components/FooterComponent";
import { HeroSectionComponent } from "./components/HeroSectionComponent";
import { MediaShowcaseComponent } from "./components/MediaShowcaseComponent";
import { StatsHighlightsComponent } from "./components/StatsHighlightsComponent";
import { TestimonialSectionComponent } from "./components/TestimonialSectionComponent";
import { CartComponent } from "./components/CartComponent";
import { BuyRentSectionComponent } from "./components/BuyRentSectionComponent";
import { BookCatalogueComponent } from "./components/BookCatalogueComponent";
import { BookDetailsComponent } from "./components/BookDetailsComponent";
import { Policy } from "./components/Policy";

interface JsonRendererProps {
  page: Page;
  globalSettings: GlobalSettings;
  instituteId: string;
  tagName: string;
  courseData?: any; // Course data for dynamic content
  catalogueData?: CourseCatalogueData; // Full catalogue data for route matching
}

export const JsonRenderer: React.FC<JsonRendererProps> = ({
  page,
  globalSettings,
  instituteId,
  tagName,
  courseData,
  catalogueData,
}) => {
  const renderComponent = (component: any) => {
    const { type, props, id, enabled = true, showCondition } = component;

    // Check if component is enabled
    if (!enabled) {
      return null;
    }

    // Check conditional rendering based on showCondition
    if (showCondition) {
      const { field, value } = showCondition;
      // Support nested field paths like "globalSettings.courseCatalogeType.enabled"
      // If field starts with "globalSettings.", remove it since we already have globalSettings
      const fieldPath = field.startsWith('globalSettings.') ? field.substring('globalSettings.'.length) : field;
      const fieldParts = fieldPath.split('.');
      let currentValue: any = globalSettings;

      for (const part of fieldParts) {
        if (currentValue && typeof currentValue === 'object' && part in currentValue) {
          currentValue = currentValue[part];
        } else {
          currentValue = undefined;
          break;
        }
      }

      // Normalize boolean values for comparison (handle both boolean true and string "true")
      const normalizedCurrentValue = typeof currentValue === 'boolean' ? currentValue : currentValue;
      const normalizedExpectedValue = typeof value === 'boolean' ? value : (value === 'true' || value === true);


      // Check if condition matches
      if (normalizedCurrentValue !== normalizedExpectedValue) {
        console.log(`[JsonRenderer] Component ${id} HIDDEN - condition not met`);
        return null;
      }

      console.log(`[JsonRenderer] Component ${id} SHOWN - condition met`);
    }

    switch (type) {
      case "header":
        return (
          <HeaderComponent
            key={id}
            {...props}
            navigation={props.navigation}
            authLinks={props.authLinks}
            catalogueData={catalogueData}
            tagName={tagName}
          />
        );
      case "banner":
        return <BannerComponent key={id} {...props} />;
      case "courseCatalog":
        return (
          <CourseCatalogComponent
            key={id}
            {...props}
            instituteId={instituteId}
            globalSettings={globalSettings}
            tagName={tagName}
          />
        );
      case "bookCatalogue":
        return (
          <BookCatalogueComponent
            key={id}
            {...props}
            instituteId={instituteId}
            globalSettings={globalSettings}
            tagName={tagName}
          />
        );
      case "courseDetails":
        // Skip course details component - it shows hardcoded data after footer
        return null;
      case "bookDetails":
        return (
          <BookDetailsComponent
            key={id}
            {...props}
            courseData={courseData}
          />
        );
      case "courseRecommendations":
        // Skip course recommendations component - user doesn't want "you may also like" section
        return null;
      case "footer":
        return (
          <FooterComponent
            key={id}
            {...props}
            catalogueData={catalogueData}
            tagName={tagName}
          />
        );
      case "heroSection":
        return <HeroSectionComponent key={id} {...props} courseData={courseData} />;
      case "mediaShowcase":
      case "MediaShowcaseComponent":
        console.log(`[JsonRenderer] Rendering MediaShowcaseComponent ${id}:`, {
          layout: props?.layout,
          slidesLength: props?.slides?.length,
          autoplay: props?.autoplay,
          autoplayInterval: props?.autoplayInterval,
          hasSlides: !!props?.slides
        });
        return <MediaShowcaseComponent key={id} {...props} />;
      case "statsHighlights":
        return <StatsHighlightsComponent key={id} {...props} />;
      case "testimonialSection":
        return <TestimonialSectionComponent key={id} {...props} />;
      case "cartComponent":
        return <CartComponent key={id} {...props} instituteId={instituteId} />;
      case "buyRentSection":
        return <BuyRentSectionComponent key={id} {...props} tagName={tagName} />;
      case "policyRenderer":
        return <Policy key={id} {...props} />;
      default:
        console.warn(`Unknown component type: ${type}`);
        return null;
    }
  };

  return (
    <div className="page w-full" data-page-id={page.id}>
      {page.components.map(renderComponent)}
    </div>
  );
};
