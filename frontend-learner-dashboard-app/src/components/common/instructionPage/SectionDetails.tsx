import { StatusCheck } from "@/components/design-system/chips";
import { SectionDto } from "@/types/assessment";
import { parseHtmlToString } from "@/lib/utils";

export const SectionDetails = ({ section }: { section: SectionDto }) => {
  return (
    <div className="w-full mb-4">
      <div className="space-y-6">
        <h2 className="text-primary-500 text-lg font-semibold">
          {section.name}
        </h2>

        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <div className="font-semibold ">
              <p className="font-bold">Section Description:</p>
            </div>
            <div className="text-gray-700">
              {parseHtmlToString(section?.description?.content)}
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <div className="mb-4">
              <span className="font-bold">Section Duration: </span>
              <span className="text-gray-900">{section?.duration}</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-bold">Negative Marking: </span>
                {section..checked
                  ? section.negativeMarking.value
                  : "No"}
              </div>
              {section.cutoff_marks && <StatusCheck />}
            </div> */}

            <div className="flex items-center justify-between text-sm text-gray-600">
              {/* <div>
                <p className="font-bold">Partial Marking</p>
              </div> */}
              {/* {section. && <StatusCheck />} */}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-bold">Cut off marks: </span>
                {section.cutoff_marks ? section.cutoff_marks : "NA"}
              </div>
              {section.cutoff_marks && <StatusCheck />}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600">
              <div>
                <span className="font-bold">Total Marks: </span>
                <span>{section.total_marks}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionDetails;
