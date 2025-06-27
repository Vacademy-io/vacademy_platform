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
      className={`relative ${
        isNew 
          ? "bg-gradient-to-br from-primary-50/90 to-white/80 border-primary-200/70 shadow-lg shadow-primary-100/50" 
          : "bg-gradient-to-br from-white/90 to-slate-50/80 border-slate-200/60 shadow-md"
      } backdrop-blur-xl border rounded-2xl p-6 transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] group cursor-pointer animate-fade-in-up overflow-hidden`}
    >
      {/* Animated Background Gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        isNew 
          ? "from-primary-100/20 via-transparent to-primary-50/30" 
          : "from-slate-50/20 via-transparent to-white/30"
      } opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`}></div>
      
      {/* Floating Orb Effects */}
      <div className={`absolute -top-4 -right-4 w-8 h-8 ${
        isNew ? 'bg-primary-200/30' : 'bg-slate-200/30'
      } rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-1000 animate-pulse`}></div>
      
      <div className="relative z-10">
        {/* Title with Icon */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2 rounded-lg ${
            isNew 
              ? 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600' 
              : 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600'
          } group-hover:scale-110 transition-transform duration-300`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 9h6V7H9v2zm0 2h6v2H9v-2zm0 4h6v2H9v-2zM4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight group-hover:text-slate-700 transition-colors duration-300 leading-tight">
        {title}
            </h3>
            {isNew && (
              <div className="inline-flex items-center gap-1 mt-1">
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-semibold text-primary-600 tracking-wide">Just arrived</span>
              </div>
            )}
          </div>
      </div>
      
      {/* Description */}
        <div className="text-slate-600 font-medium leading-relaxed mb-4 text-base line-clamp-3 group-hover:text-slate-700 transition-colors duration-300">
        {description}
      </div>
      
        {/* Enhanced Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100/60">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 ${
              isNew ? 'bg-primary-500 animate-pulse' : 'bg-slate-400'
            } rounded-full transition-all duration-300`}></div>
            <span className="text-sm font-medium text-slate-500">{date}</span>
          </div>
          
          <div className="flex items-center gap-2">
        {isNew && (
              <div className="animate-slide-in-right">
                <span className="bg-gradient-to-r from-primary-100 to-primary-200 text-primary-700 px-2.5 py-1 rounded-full text-sm font-bold tracking-wide shadow-sm">
              New
            </span>
          </div>
        )}
            
            {/* Action Arrow */}
            <div className="text-slate-400 group-hover:text-primary-500 transition-all duration-300 transform group-hover:translate-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Progress Bar Animation */}
        <div className={`absolute bottom-0 left-0 h-0.5 ${
          isNew ? 'bg-gradient-to-r from-primary-400 to-primary-600' : 'bg-gradient-to-r from-slate-300 to-slate-500'
        } w-0 group-hover:w-full transition-all duration-1000 ease-out`}></div>
      </div>
    </div>
  );
}
