import { Plus } from "lucide-react";

export function NewProjectCard() {
  return (
    <div className="bg-[#eff4ff] border-2 border-dashed border-[rgba(198,197,212,0.3)] rounded-xl p-10 flex flex-col items-center justify-center text-center min-h-[200px]">
      <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
        <Plus size={25} className="text-[#000666]" />
      </div>
      <h3 className="font-manrope font-bold text-[#000666] text-lg mb-2">Start a New Hunt</h3>
      <p className="text-[#454652] text-sm max-w-[240px] leading-relaxed">
        Define your criteria and let FlatGuard curator start finding your next home.
      </p>
    </div>
  );
}
