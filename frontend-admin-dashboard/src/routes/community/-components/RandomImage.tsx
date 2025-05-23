import React from "react";
import { ComptetiveExam, Grade1to5, Grade5to12, NoTag, PostGrad, UnderGrad } from "@/svgs";

const RandomImage: React.FC = () => {
    const randomIndex = Math.floor(Math.random() * 5);
    switch (randomIndex) {
        case 0:
            return <ComptetiveExam className="h-full w-full"></ComptetiveExam>;
        case 1:
            return <Grade1to5 className="h-full w-full"></Grade1to5>;
        case 2:
            return <UnderGrad className="h-full w-full"></UnderGrad>;
        case 3:
            return <Grade5to12 className="h-full w-full"></Grade5to12>;
        case 4:
            return <PostGrad className="h-full w-full"> </PostGrad>;
        case 5:
            return <NoTag className="h-full w-full"></NoTag>;
    }
    return <NoTag className="size-full" />;
};

export default RandomImage;
