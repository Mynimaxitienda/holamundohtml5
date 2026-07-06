import React from "react";

interface BonoBadgeProps {
  count: number;
  type: "asignados" | "redimidos" | "premios";
}

const BonoBadge: React.FC<BonoBadgeProps> = ({ count, type }) => {
  if (count <= 0) return null;

  const gradientMap = {
    asignados: "from-amber-500 to-orange-600 shadow-orange-500/30",
    redimidos: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
    premios: "from-rose-500 to-pink-600 shadow-rose-500/30",
  };

  const gradient = gradientMap[type] || "from-blue-500 to-indigo-600";

  return (
    <div
      className={`absolute -top-2 -right-2 flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-gradient-to-r ${gradient} text-[10px] font-black text-white shadow-lg border-2 border-white transform scale-100 hover:scale-115 transition-all duration-300 z-10 animate-fade-in`}
    >
      {count}
    </div>
  );
};

export default BonoBadge;
