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
      className={`${isNew ? "bg-primary-50 border-primary-500" : ""}  border p-6 flex flex-col gap-3 rounded-xl`}
    >
      <div className="font-[600]">{title}</div>
      <div className="text-caption">{description}</div>
      <div className="flex flex-row gap-2 items-center">
        <div className="size-[10px] bg-primary-500 rounded-full"></div>
        <div className="text-caption">{date}</div>
      </div>
    </div>
  );
}
