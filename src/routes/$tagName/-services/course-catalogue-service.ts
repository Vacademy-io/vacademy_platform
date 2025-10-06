import axios from "axios";
import { BASE_URL } from "@/constants/urls";
import { CourseCatalogueData } from "../-types/course-catalogue-types";

// Create a public axios instance that doesn't require authentication
const publicAxios = axios.create({
  withCredentials: false,
});

export class CourseCatalogueService {
  private static readonly API_ENDPOINT = `${BASE_URL}/admin-core-service/public/course-catalogue/v1/institute/get/by-tag`;

  static async getCourseCatalogueByTag(
    instituteId: string,
    tagName: string
  ): Promise<CourseCatalogueData> {
    try {
      console.log("[CourseCatalogueService] Making API call to:", this.API_ENDPOINT);
      console.log("[CourseCatalogueService] With params:", { instituteId, tagName });
      
      const response = await publicAxios.get(this.API_ENDPOINT, {
        params: {
          instituteId,
          tagName,
        },
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("[CourseCatalogueService] API response received:", response.data);
      
      // Parse the catalogue_json field if it exists
      if (response.data.catalogue_json) {
        try {
          const parsedData = JSON.parse(response.data.catalogue_json);
          console.log("[CourseCatalogueService] Parsed catalogue data:", parsedData);
          return parsedData;
        } catch (parseError) {
          console.error("[CourseCatalogueService] Error parsing catalogue_json:", parseError);
          throw new Error("Invalid JSON in catalogue_json field");
        }
      }
      
      // If no catalogue_json field, return the response as-is
      return response.data;
    } catch (error: any) {
      console.error("[CourseCatalogueService] Error fetching course catalogue:", error);
      
      // Check if it's a 404 error (tag not found)
      if (error?.response?.status === 404) {
        console.log("[CourseCatalogueService] Tag not found, returning empty catalogue");
        return this.getEmptyCatalogueData();
      }
      
      // For any other error, throw it to be handled by the component
      throw error;
    }
  }

  private static getEmptyCatalogueData(): CourseCatalogueData {
    return {
      globalSettings: {
        mode: "light",
        compactness: "medium",
        audience: "all",
        leadCollection: {
          enabled: false,
          mandatory: false,
          inviteLink: "",
          fields: []
        },
        enrollment: {
          enabled: true,
          requirePayment: false
        },
        payment: {
          enabled: true,
          provider: "razorpay"
        }
      },
      pages: [
        {
          id: "empty",
          route: "empty",
          title: "No Courses Found",
          components: [
            {
              id: "empty-1",
              type: "banner",
              props: {
                title: "No courses found for this tag",
                media: { type: "image", url: "/api/placeholder/800/400" },
                alignment: "center"
              }
            },
            {
              id: "empty-2",
              type: "footer",
              props: {
                description: "Please check back later or try a different tag."
              }
            }
          ]
        }
      ]
    };
  }

}
