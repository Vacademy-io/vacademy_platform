// const dercripters = {
//   assigned: [
//     "You have been assigned a new assessment:",
//     "Check the details and stay prepared!",
//   ],
//   tolive: ["Your assessment", "will be available shortly. Get ready"],
//   live: ["Your assessment", "is now available. Start now!"],
//   finish: [
//     "The deadline for your assessment",
//     "is almost here. Submit before time runs out! ",
//   ],
//   reportGenerated: [
//     "Your assessment report for ",
//     "is now available. Check your performance and feedback to improve your learning.",
//   ],
//   published: [
//     "New study material: ",
//     "is now available. Access it to enhance your learning and stay ahead!",
//   ],
// };

interface NotifcationCardProps {
  title?: string;
  description?: string;
  date?: string;
  isNew?:boolean;
}
export function NotifcationCard({
  title,
  description,
  date,
  isNew = true,
}: NotifcationCardProps) {
  return (
    <div
      className={`${
        isNew 
          ? "bg-orange-50/80 border-orange-200 shadow-lg" 
          : "bg-white/80 border-gray-200/60"
      } backdrop-blur-xl border rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] group cursor-pointer`}
    >
      {/* Title */}
      <div className="text-lg font-light text-gray-900 tracking-tight group-hover:text-gray-700 transition-colors duration-300">
        {title}
      </div>
      
      {/* Description */}
      <div className="text-gray-600 font-light leading-relaxed">
        {description}
      </div>
      
      {/* Date and Status */}
      <div className="flex flex-row gap-3 items-center pt-2 border-t border-gray-100/50">
        <div className={`size-2.5 ${isNew ? 'bg-orange-500' : 'bg-gray-400'} rounded-full transition-colors duration-300`}></div>
        <div className="text-sm text-gray-500 font-light">{date}</div>
        {isNew && (
          <div className="ml-auto">
            <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-xs font-medium">
              New
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
