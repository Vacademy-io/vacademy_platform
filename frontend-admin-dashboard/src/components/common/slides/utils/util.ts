import { SlideType } from "../constant/slideType";
import { Slide } from "../types";
import { titleSlide, textSlide, webEmbedSlide, videoSlide, textMediaSlide, fullMediaSlide } from "../constant/textSlide";

export const createNewSlide = (type: SlideType): Slide => {
        switch (type) {
            case SlideType.Title:
                return {type : type ,  id: String(Math.random()), elements: titleSlide };
            case SlideType.Text:
                return {type : type ,  id: String(Math.random()), elements: textSlide };
            case SlideType.WebLink:
                return {type : type,  id: String(Math.random()), elements: webEmbedSlide };
            case SlideType.InteractiveVideo:
                return {type : type , id: String(Math.random()), elements: videoSlide };
            case SlideType.TextMedia:
                return {type : type, id: String(Math.random()), elements: textMediaSlide };
            case SlideType.FullscreenMedia:
                return {type : type, id: String(Math.random()), elements: fullMediaSlide };
            case SlideType.Quiz:
                 return {type : type, id: String(Math.random()), elements:  {
                    questionName: "",
                    explanation: "",
                    questionType:SlideType.Quiz,
                    questionMark: "",
                    imageDetails: [],
                    singleChoiceOptions: [
                        {
                            name: "",
                            isSelected: false,
                            image: {
                                imageId: "",
                                imageName: "",
                                imageTitle: "",
                                imageFile: "",
                                isDeleted: false,
                            },
                        },
                        {
                            name: "",
                            isSelected: false,
                            image: {
                                imageId: "",
                                imageName: "",
                                imageTitle: "",
                                imageFile: "",
                                isDeleted: false,
                            },
                        },
                        {
                            name: "",
                            isSelected: false,
                            image: {
                                imageId: "",
                                imageName: "",
                                imageTitle: "",
                                imageFile: "",
                                isDeleted: false,
                            },
                        },
                        {
                            name: "",
                            isSelected: false,
                            image: {
                                imageId: "",
                                imageName: "",
                                imageTitle: "",
                                imageFile: "",
                                isDeleted: false,
                            },
                        },
                    ],
                }};
          case SlideType.Feedback:
                    return {type : type, id: String(Math.random()), elements:  {
                       questionName: "",
                       explanation: "",
                       questionType: SlideType.Feedback,
                       questionMark: "",
                       imageDetails: [],
                       singleChoiceOptions: [
                           {
                               name: "",
                               isSelected: false,
                               image: {
                                   imageId: "",
                                   imageName: "",
                                   imageTitle: "",
                                   imageFile: "",
                                   isDeleted: false,
                               },
                           },
                           {
                               name: "",
                               isSelected: false,
                               image: {
                                   imageId: "",
                                   imageName: "",
                                   imageTitle: "",
                                   imageFile: "",
                                   isDeleted: false,
                               },
                           },
                           {
                               name: "",
                               isSelected: false,
                               image: {
                                   imageId: "",
                                   imageName: "",
                                   imageTitle: "",
                                   imageFile: "",
                                   isDeleted: false,
                               },
                           },
                           {
                               name: "",
                               isSelected: false,
                               image: {
                                   imageId: "",
                                   imageName: "",
                                   imageTitle: "",
                                   imageFile: "",
                                   isDeleted: false,
                               },
                           },
                       ],
                  
                   }};
            default:
                return {type : type, id: String(Math.random()), elements: [] };
        }

       
};


export function filterSlidesByIdType(slides: Slide[], isNew: boolean): Partial<Slide>[] {
    return slides
      .filter(slide => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slide.id);
        return isNew ? !isUUID : isUUID;
      })
      .map(slide => {
        if (isNew) {
          const { id, ...rest } = slide;
          return rest;
        }
        return slide;
      });
  }